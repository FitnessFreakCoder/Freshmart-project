
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Minus, Plus, Trash2, Sparkles, ChefHat, ArrowLeft, X, Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { mockApi } from '../services/mockBackend';
import { generateRecipe } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

const Cart: React.FC = () => {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<number>(0);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [couponError, setCouponError] = useState('');
  const [recipe, setRecipe] = useState<string | null>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);

  // Calculations with Delivery Charge
  const { subtotal, bulkDiscount, total, deliveryCharge } = useMemo(() => {
    let sub = 0;
    let bDisc = 0;

    state.cart.forEach(item => {
      sub += item.price * item.quantity;
      if (item.bulkRule) {
        const bundles = Math.floor(item.quantity / item.bulkRule.qty);
        const remainder = item.quantity % item.bulkRule.qty;
        const regularCost = item.quantity * item.price;
        const bulkCost = (bundles * item.bulkRule.price) + (remainder * item.price);
        bDisc += (regularCost - bulkCost);
      }
    });

    const netAmount = sub - bDisc;
    
    // Delivery Logic
    let dCharge = 0;
    if (netAmount > 3000) {
        dCharge = 0;
    } else if (netAmount >= 1000) {
        dCharge = 25;
    } else {
        dCharge = 50;
    }

    return { 
        subtotal: sub, 
        bulkDiscount: bDisc, 
        deliveryCharge: dCharge,
        total: netAmount - appliedCoupon + dCharge 
    };
  }, [state.cart, appliedCoupon]);

  // Auto-Apply Logic for Orders > 2000
  useEffect(() => {
    const checkAutoApply = async () => {
      // NOTE: We check subtotal (before discounts) or net total? Usually subtotal for coupon eligibility.
      if (subtotal >= 2000 && !appliedCouponCode) {
         const result = await mockApi.validateCoupon('AUTO50', subtotal);
         if (result.isValid && result.coupon) {
             setAppliedCoupon(result.coupon.discountAmount);
             setAppliedCouponCode('AUTO50');
             setAutoApplied(true);
         }
      }
      if (subtotal < 2000 && autoApplied) {
          setAppliedCoupon(0);
          setAppliedCouponCode('');
          setAutoApplied(false);
      }
    };
    checkAutoApply();
  }, [subtotal, appliedCouponCode, autoApplied]);

  const handleApplyCoupon = async () => {
    const result = await mockApi.validateCoupon(couponCode, subtotal);
    if (result.isValid && result.coupon) {
      setAppliedCoupon(result.coupon.discountAmount);
      setAppliedCouponCode(result.coupon.code);
      setCouponError('');
      setAutoApplied(false);
      setCouponCode('');
    } else {
      setCouponError(result.error || 'Invalid coupon');
      setAppliedCoupon(0);
      setAppliedCouponCode('');
    }
  };

  const handleRemoveCoupon = () => {
      setAppliedCoupon(0);
      setAppliedCouponCode('');
      setCouponError('');
      setAutoApplied(false);
  };

  const handleGetRecipe = async () => {
    setLoadingRecipe(true);
    setRecipe(null);
    const result = await generateRecipe(state.cart);
    setRecipe(result);
    setLoadingRecipe(false);
  };

  const handleCheckout = () => {
      navigate('/checkout', { state: { appliedCoupon } });
  }

  if (state.cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
        <Link to="/" className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          <Link to="/" className="text-green-600 font-medium hover:text-green-700 flex items-center gap-2">
              <ArrowLeft size={18} /> Continue Shopping
          </Link>
      </div>

      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
            <ul className="divide-y divide-gray-200">
              {state.cart.map((item) => {
                const isMaxStock = item.quantity >= item.stock;
                return (
                <li key={item.id} className="p-6 flex items-center">
                  <img src={item.imageUrl} alt={item.name} className="h-20 w-20 object-cover rounded-md" />
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
                    <p className="text-gray-500 text-sm">{item.category}</p>
                    {item.bulkRule && (
                       <span className="text-xs text-indigo-600 font-semibold">Bulk: Buy {item.bulkRule.qty} for Rs. {item.bulkRule.price}</span>
                    )}
                    {isMaxStock && <p className="text-xs text-red-500 mt-1 font-medium">Available stock: {item.stock}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => dispatch({ type: 'UPDATE_CART_QTY', payload: { id: item.id, qty: item.quantity - 1 } })}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        title="Decrease Quantity"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center font-bold text-gray-900">{item.quantity}</span>
                      <button 
                         onClick={() => {
                             if (!isMaxStock) {
                                dispatch({ type: 'UPDATE_CART_QTY', payload: { id: item.id, qty: item.quantity + 1 } });
                             }
                         }}
                         disabled={isMaxStock}
                         className={`p-2 rounded-lg transition-colors ${
                             isMaxStock 
                             ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                             : 'bg-green-100 text-green-600 hover:bg-green-200'
                         }`}
                         title="Increase Quantity"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <button 
                      onClick={() => dispatch({ type: 'REMOVE_FROM_CART', payload: item.id })}
                      className="text-red-500 hover:text-red-700 p-2 ml-2"
                      title="Remove Item"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </li>
              )})}
            </ul>
          </div>
          
           {/* AI Chef Section */}
           <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
                    <ChefHat size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Chef Gemini's Recipe Suggestion</h3>
                    <p className="text-gray-600 text-sm mb-4">Not sure what to cook? Let our AI generate a recipe based on your cart items.</p>
                    
                    {!recipe && (
                        <button 
                            onClick={handleGetRecipe}
                            disabled={loadingRecipe}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <Sparkles size={16} />
                            {loadingRecipe ? 'Thinking...' : 'Generate Recipe'}
                        </button>
                    )}

                    {recipe && (
                        <div className="mt-4 bg-white p-6 rounded-lg border border-indigo-100 text-gray-800 prose prose-sm max-w-none prose-headings:text-indigo-900 prose-p:text-gray-700 prose-li:text-gray-700">
                            <ReactMarkdown>{recipe}</ReactMarkdown>
                        </div>
                    )}
                </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 mt-8 lg:mt-0">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h2>
            
            {/* Delivery Charge Info Box */}
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800 mb-4">
               <p className="font-bold flex items-center gap-2 mb-1"><Truck size={16}/> Delivery Policy</p>
               <ul className="text-xs space-y-1 ml-1">
                  <li>&lt; Rs. 1000: Rs. 50</li>
                  <li>Rs. 1000-3000: Rs. 25</li>
                  <li>&gt; Rs. 3000: <span className="font-bold text-green-600">FREE</span></li>
               </ul>
            </div>

            <div className="flow-root">
              <dl className="-my-4 text-sm divide-y divide-gray-200">
                <div className="py-4 flex items-center justify-between">
                  <dt className="text-gray-600">Subtotal</dt>
                  <dd className="font-medium text-gray-900">Rs. {subtotal.toFixed(2)}</dd>
                </div>
                {bulkDiscount > 0 && (
                  <div className="py-4 flex items-center justify-between">
                    <dt className="text-indigo-600">Bulk Savings</dt>
                    <dd className="font-medium text-indigo-600">-Rs. {bulkDiscount.toFixed(2)}</dd>
                  </div>
                )}
                
                <div className="py-4">
                   {!appliedCouponCode ? (
                       <div className="flex gap-2 mb-2">
                            <input 
                            type="text" 
                            placeholder="Promo Code" 
                            className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-900"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            />
                            <button 
                            onClick={handleApplyCoupon}
                            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm"
                            >
                            Apply
                            </button>
                       </div>
                   ) : (
                       <div className="flex items-center justify-between bg-green-50 border border-green-200 p-2 rounded-lg">
                           <div className="flex flex-col">
                               <span className="text-xs text-green-800 font-bold uppercase">{appliedCouponCode} APPLIED</span>
                               {autoApplied && <span className="text-[10px] text-green-600">Auto-applied (Order {'>'} 2000)</span>}
                           </div>
                           <button onClick={handleRemoveCoupon} className="text-gray-400 hover:text-red-500 p-1">
                               <X size={16} />
                           </button>
                       </div>
                   )}
                   
                   {couponError && <p className="text-red-500 text-xs mt-2">{couponError}</p>}
                   {appliedCoupon > 0 && <p className="text-green-600 text-xs mt-1">Discount: -Rs. {appliedCoupon.toFixed(2)}</p>}
                </div>

                <div className="py-4 flex items-center justify-between">
                  <dt className="text-gray-600">Delivery Charge</dt>
                  <dd className={`font-medium ${deliveryCharge === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {deliveryCharge === 0 ? 'FREE' : `Rs. ${deliveryCharge.toFixed(2)}`}
                  </dd>
                </div>

                <div className="py-4 flex items-center justify-between border-t border-gray-200">
                  <dt className="text-base font-bold text-gray-900">Order Total</dt>
                  <dd className="text-base font-bold text-gray-900">Rs. {Math.max(0, total).toFixed(2)}</dd>
                </div>
              </dl>
            </div>
            <div className="mt-6">
              <button 
                onClick={handleCheckout}
                className="w-full bg-green-600 border border-transparent rounded-lg shadow-sm py-3 px-4 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Checkout
              </button>
            </div>
            <div className="mt-4 text-center">
                <Link to="/" className="text-sm text-gray-500 hover:text-green-600">
                    Continue Shopping
                </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
