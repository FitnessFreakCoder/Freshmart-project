
import React, { useState } from 'react';
import { Product } from '../types';
import { Plus, Minus, Clock, Tag } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../config';

interface Props {
  product: Product;
}

const ProductCard: React.FC<Props> = ({ product }) => {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();

  // Get current quantity in cart
  const cartItem = state.cart.find(i => i.id === product.id);
  const qty = cartItem ? cartItem.quantity : 0;
  const isMaxStock = qty >= product.stock;

  const handleAdd = () => {
    if (!state.user) {
      alert("Please sign in to add items to your cart.");
      navigate('/login');
      return;
    }
    if (product.stock > 0) {
      dispatch({ type: 'ADD_TO_CART', payload: product });
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!state.user) {
      alert("Please sign in to add items to your cart.");
      navigate('/login');
      return;
    }
    if (!isMaxStock) {
      dispatch({ type: 'ADD_TO_CART', payload: product });
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'UPDATE_CART_QTY', payload: { id: product.id, qty: qty - 1 } });
  };

  // Calculate discount percentage if original price exists
  const discountPct = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  // Helper to resolve image URL (handle relative /uploads/ paths from backend)
  const resolveImageUrl = (url: string) => {
    if (!url) return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';
    return getImageUrl(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-100 flex flex-col h-full group relative">
      {/* Image Area */}
      <div className="h-44 relative bg-white p-4 flex justify-center items-center overflow-hidden border-b border-gray-50">
        <img
          src={resolveImageUrl(product.imageUrl)}
          alt={product.name}
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        />

        {/* Discount Badge */}
        {discountPct > 0 && (
          <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-10">
            {discountPct}% OFF
          </div>
        )}

        {/* Out of Stock Overlay */}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center z-20">
            <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-3 flex flex-col flex-grow">

        {/* Delivery Time Mock */}
        <div className="flex items-center gap-1 mb-2 bg-gray-100 self-start px-1.5 py-0.5 rounded text-[10px] text-gray-600 font-medium">
          <Clock size={10} />  less than 30 MINS
        </div>

        {/* Title & Unit */}
        {/* Fixed height (h-10) for title ensures alignment across grid even with varying title lengths */}
        <h3 className="text-sm font-semibold text-gray-900 leading-tight mb-1 line-clamp-2 h-10" title={product.name}>
          {product.name}
        </h3>
        <p className="text-xs text-gray-500 mb-2 truncate">{product.unit || '1 unit'}</p>

        {/* Bulk Deal Badge */}
        <div className="min-h-[24px] mb-2">
          {product.bulkRule ? (
            <div className="inline-flex items-center gap-1 bg-yellow-50 border border-yellow-100 px-2 py-1 rounded text-[10px] font-bold text-yellow-700 w-full truncate">
              <Tag size={10} className="flex-shrink-0" />
              <span className="truncate">Buy {product.bulkRule.qty} for Rs. {product.bulkRule.price}</span>
            </div>
          ) : (
            // Spacer to keep buttons aligned if no bulk rule
            <div className="h-[24px]"></div>
          )}
        </div>

        {/* Price & Button Container - Pushed to bottom */}
        <div className="mt-auto flex items-center justify-between gap-2 h-9">
          <div className="flex flex-col leading-none">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-sm font-bold text-gray-900">
                Rs. {product.price.toFixed(0)}
              </span>
              {product.originalPrice && (
                <span className="text-xs text-gray-400 line-through">
                  Rs. {product.originalPrice.toFixed(0)}
                </span>
              )}
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-end">
            {/* Available Stock Warning */}
            {isMaxStock && qty > 0 && (
              <span className="absolute -top-7 right-0 text-[9px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 whitespace-nowrap z-20 shadow-sm">
                Only {product.stock} left
              </span>
            )}

            {qty > 0 ? (
              <div className="flex items-center bg-green-600 rounded-lg shadow-sm h-8">
                <button
                  onClick={handleDecrement}
                  className="w-8 h-full flex items-center justify-center text-white hover:bg-green-700 rounded-l-lg transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 font-bold text-white text-xs text-center">{qty}</span>
                <button
                  onClick={handleIncrement}
                  disabled={isMaxStock}
                  className={`w-8 h-full flex items-center justify-center text-white rounded-r-lg transition-colors ${isMaxStock ? 'opacity-50 cursor-not-allowed bg-gray-400' : 'hover:bg-green-700'
                    }`}
                >
                  <Plus size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                disabled={product.stock === 0}
                className={`
                            px-6 h-8 rounded-lg font-bold text-xs uppercase tracking-wide transition-all border
                            ${product.stock === 0
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-green-50 text-green-700 border-green-200 shadow-sm hover:bg-green-600 hover:text-white hover:border-green-600 active:scale-95'
                  }
                        `}
              >
                ADD
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
