import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { Minus, Plus, Trash2, ArrowLeft, X, Truck, Tag, Gift } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { mockApi } from '../services/mockBackend';

interface AppliedCoupon {
  code: string;
  discount: number;
}

// Define your tiered coupons here from Highest Priority to Lowest
const TIERED_COUPONS = [
  { code: 'NEPAL100', threshold: 8000, name: 'Nepal Special' },
  { code: 'ABOVE2500', threshold: 2500, name: 'Bulk Discount' },
  { code: 'ABOVE2000', threshold: 2000, name: 'Bulk Discount' },
];

const Cart: React.FC = () => {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  // --- State Declarations ---
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupons, setAppliedCoupons] = useState<AppliedCoupon[]>([]);
  const [couponError, setCouponError] = useState('');
  const [autoApplied, setAutoApplied] = useState(false);
  const [autoApplyMessage, setAutoApplyMessage] = useState('');
  const [hasPlacedOrder, setHasPlacedOrder] = useState(false);
  const [usedSpecialCoupons, setUsedSpecialCoupons] = useState<string[]>([]);

  // --- Effects ---

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Check order history
  useEffect(() => {
    const checkHistory = async () => {
      if (state.user) {
        try {
          if (state.orders.length > 0) {
            setHasPlacedOrder(true);
          } else {
            const orders = await mockApi.getOrders();
            if (orders.length > 0) setHasPlacedOrder(true);
          }
        } catch (e) {
          console.error("Failed to check order history", e);
        }
      }
    };
    checkHistory();
  }, [state.user, state.orders.length]);

  // Fetch coupons
  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const coupons = await mockApi.getCoupons();
        dispatch({ type: 'SET_COUPONS', payload: coupons });
      } catch (err) {
        console.error(err);
      }
    };
    fetchCoupons();
  }, [dispatch]);

  // --- Calculations ---
  const { subtotal, bulkDiscount, total, deliveryCharge, totalCouponDiscount } = useMemo(() => {
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

    bDisc = Number(bDisc.toFixed(2));
    const netAmount = sub - bDisc;

    // Calculate total discount from all applied coupons
    const totalDisc = appliedCoupons.reduce((sum, coupon) => sum + coupon.discount, 0);

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
      totalCouponDiscount: totalDisc,
      total: netAmount - totalDisc + dCharge
    };
  }, [state.cart, appliedCoupons]);

  // Clear errors whenever subtotal changes
  useEffect(() => {
    setCouponError('');
  }, [subtotal]);

  // --- Handlers ---

  const handleApplyCoupon = useCallback(async (codeOverride?: string) => {
    const codeToValidate = codeOverride || couponCode;
    if (!codeToValidate) return;

    // Check if already applied
    if (appliedCoupons.some(c => c.code === codeToValidate)) {
      const msg = `Coupon ${codeToValidate} is already applied`;
      setCouponError(msg);
      return;
    }

    const result = await mockApi.validateCoupon(codeToValidate, subtotal);

    if (result.isValid && result.coupon) {
      setAppliedCoupons(prev => [...prev, { code: result.coupon!.code, discount: result.coupon!.discountAmount }]);
      setCouponError('');
      setCouponCode('');

      // Mark special gift coupons as used
      const specialCoupon = state.coupons.find(c =>
        c.code === result.coupon!.code &&
        c.targetUsername &&
        state.user?.username &&
        c.targetUsername.trim().toLowerCase() === state.user.username.trim().toLowerCase()
      );
      if (specialCoupon && !usedSpecialCoupons.includes(result.coupon!.code)) {
        setUsedSpecialCoupons(prev => [...prev, result.coupon!.code]);
      }
    } else {
      const errorMsg = result.error || 'Invalid coupon';
      setCouponError(errorMsg);
    }
  }, [couponCode, subtotal, appliedCoupons, state.coupons, state.user?.username, usedSpecialCoupons]);

  const handleRemoveCoupon = (codeToRemove: string) => {
    setAppliedCoupons(prev => prev.filter(c => c.code !== codeToRemove));
    // If removing any tiered/auto coupon, reset the message
    if (TIERED_COUPONS.some(tc => tc.code === codeToRemove) || codeToRemove === 'AUTO50') {
      setAutoApplied(false);
      setAutoApplyMessage('');
    }
    setCouponError('');
  };

  const handleClearAllCoupons = () => {
    setAppliedCoupons([]);
    setAutoApplied(false);
    setAutoApplyMessage('');
    setCouponError('');
  };

  const handleCheckout = () => {
    navigate('/checkout', { state: { appliedCoupons } });
  };

  // --- Auto-Apply Logic (Refactored for Priority) ---
  useEffect(() => {
    const checkAutoApply = async () => {
      // 1. Navigation State (Manual Override from other pages)
      if (location.state?.autoApply) {
        if (!appliedCoupons.some(c => c.code === location.state.autoApply)) {
          handleApplyCoupon(location.state.autoApply);
        }
      }

      // 2. First Order Logic (Independent of Bulk tiers)
      if (!hasPlacedOrder) {
        const firstOrderCoupon = state.coupons.find(c => c.type === 'FIRST_ORDER');
        if (firstOrderCoupon && !appliedCoupons.some(c => c.code === firstOrderCoupon.code)) {
          const result = await mockApi.validateCoupon(firstOrderCoupon.code, subtotal);
          if (result.isValid && result.coupon) {
            setAppliedCoupons(prev => [...prev, { code: result.coupon!.code, discount: result.coupon!.discountAmount }]);
            setCouponError('');
          }
        }
      }

      // 3. Tiered Bulk Logic (Mutually Exclusive)
      // Find the highest priority coupon that matches current subtotal
      const targetTierCoupon = TIERED_COUPONS.find(c => subtotal >= c.threshold);

      // Check if we already have a tiered coupon applied
      const activeTierCoupon = appliedCoupons.find(c => TIERED_COUPONS.some(tc => tc.code === c.code));

      if (targetTierCoupon) {
        // We qualify for a tier. Is it the correct one?
        if (activeTierCoupon?.code !== targetTierCoupon.code) {
          // Either no bulk coupon is applied, OR the wrong one (lower tier) is applied.

          // Validate the target coupon first
          const result = await mockApi.validateCoupon(targetTierCoupon.code, subtotal);

          if (result.isValid && result.coupon) {
            setAppliedCoupons(prev => {
              // Remove ANY existing tiered coupons (upgrade/downgrade logic)
              const cleaned = prev.filter(c => !TIERED_COUPONS.some(tc => tc.code === c.code));
              // Add the new target coupon
              return [...cleaned, { code: result.coupon!.code, discount: result.coupon!.discountAmount }];
            });
            setAutoApplied(true);
            setAutoApplyMessage(`${targetTierCoupon.name} Applied!`);
            setCouponError('');
          }
        }
      } else {
        // We do NOT qualify for any tiered coupon (subtotal too low)
        // If we still have one applied, remove it
        if (activeTierCoupon) {
          setAppliedCoupons(prev => prev.filter(c => !TIERED_COUPONS.some(tc => tc.code === c.code)));
          setAutoApplied(false);
          setAutoApplyMessage('');
        }
      }
    };

    if (state.cart.length > 0) {
      checkAutoApply();
    }
  }, [subtotal, appliedCoupons.length, location.state, state.coupons, state.cart.length, hasPlacedOrder, handleApplyCoupon]);

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
                          onClick={() => {
                            dispatch({ type: 'UPDATE_CART_QTY', payload: { id: item.id, qty: item.quantity - 1 } });
                            handleClearAllCoupons();
                          }}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-8 text-center font-bold text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => !isMaxStock && dispatch({ type: 'UPDATE_CART_QTY', payload: { id: item.id, qty: item.quantity + 1 } })}
                          disabled={isMaxStock}
                          className={`p-2 rounded-lg ${isMaxStock ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          dispatch({ type: 'REMOVE_FROM_CART', payload: item.id });
                          handleClearAllCoupons();
                        }}
                        className="text-red-500 hover:text-red-700 p-2 ml-2"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Special Gifts Section - User-specific coupons */}
          {state.coupons.filter(c => c.targetUsername && state.user?.username && c.targetUsername.trim().toLowerCase() === state.user.username.trim().toLowerCase()).length > 0 && (
            <div className="mt-6 bg-gradient-to-r from-pink-50 to-orange-50 rounded-xl shadow-sm p-6 border border-pink-200">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Gift size={18} className="text-pink-500" /> 🎁 Special Gifts For You!
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.coupons
                  .filter(c => c.targetUsername && state.user?.username && c.targetUsername.trim().toLowerCase() === state.user.username.trim().toLowerCase())
                  .map(coupon => {
                    const isApplied = appliedCoupons.some(ac => ac.code === coupon.code);
                    const isUsed = usedSpecialCoupons.includes(coupon.code);
                    return (
                      <div key={coupon.code} className={`border ${isApplied ? 'border-green-300 bg-green-50' : isUsed ? 'border-gray-300 bg-gray-50' : 'border-pink-300 bg-white'} rounded-lg p-4 shadow-sm transition-all`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className={`font-bold text-lg ${isUsed && !isApplied ? 'text-gray-400' : 'text-pink-600'}`}>{coupon.code}</div>
                            <div className="text-sm text-gray-700">Save Rs. {coupon.discountAmount}</div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${isUsed && !isApplied ? 'bg-gray-200 text-gray-500' : 'bg-pink-100 text-pink-700'}`}>
                            {isUsed && !isApplied ? 'USED' : 'SPECIAL GIFT'}
                          </span>
                        </div>
                        {coupon.giftMessage && (
                          <p className={`text-sm p-2 rounded mb-3 italic ${isUsed && !isApplied ? 'text-gray-500 bg-gray-100' : 'text-pink-700 bg-pink-50'}`}>
                            "{coupon.giftMessage}"
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">Expires: {new Date(coupon.expiry).toLocaleDateString()}</div>
                          {isApplied ? (
                            <button
                              disabled
                              className="text-xs bg-green-100 text-green-700 border border-green-200 px-4 py-2 rounded-lg font-bold cursor-default flex items-center gap-1"
                            >
                              <span className="w-2 h-2 rounded-full bg-green-500"></span> Applied
                            </button>
                          ) : isUsed ? (
                            <button
                              disabled
                              className="text-xs bg-gray-100 text-gray-400 border border-gray-200 px-4 py-2 rounded-lg font-bold cursor-not-allowed"
                            >
                              Not Available
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApplyCoupon(coupon.code)}
                              className="text-xs bg-gradient-to-r from-pink-500 to-orange-500 text-white px-4 py-2 rounded-lg font-bold hover:from-pink-600 hover:to-orange-600 shadow-sm"
                            >
                              🎁 Apply Gift
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {state.coupons.filter(c => !c.targetUsername || c.targetUsername === state.user?.username).length > 0 && (
            <div className="mt-6 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Tag size={18} className="text-orange-500" /> Available Coupons
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.coupons
                  .filter(c => (!c.targetUsername) && (c.type !== 'FIRST_ORDER' || !hasPlacedOrder))
                  .map(coupon => {
                    const isApplied = appliedCoupons.some(ac => ac.code === coupon.code);
                    return (
                      <div key={coupon.code} className={`border border-dashed ${isApplied ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-orange-50'} rounded-lg p-3 flex flex-col justify-between gap-2 transition-colors`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-gray-800 text-sm">{coupon.code}</div>
                            <div className="text-xs text-gray-600">Save Rs. {coupon.discountAmount}</div>
                          </div>
                          {coupon.type === 'FIRST_ORDER' && <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">FIRST ORDER</span>}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          {coupon.minOrderAmount && <div className="text-[10px] text-gray-500">Min Order: Rs. {coupon.minOrderAmount}</div>}
                          {isApplied ? (
                            <button
                              disabled
                              className="text-xs bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded font-bold cursor-default flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Applied
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApplyCoupon(coupon.code)}
                              className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded font-bold hover:bg-orange-600 shadow-sm"
                            >
                              Apply
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 mt-8 lg:mt-0">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h2>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800 mb-4">
              <p className="font-bold flex items-center gap-2 mb-1"><Truck size={16} /> Delivery Policy</p>
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
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Promo Code"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-900"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                    <button
                      onClick={() => handleApplyCoupon()}
                      className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
                    >
                      Apply
                    </button>
                  </div>
                  {couponError && <p className="text-red-500 text-xs mt-2">{couponError}</p>}
                </div>

                {appliedCoupons.length > 0 && (
                  <div className="py-2 space-y-2">
                    {appliedCoupons.map((coupon) => (
                      <div key={coupon.code} className="flex items-center justify-between bg-green-50 border border-green-200 p-2 rounded-lg">
                        <div className="flex flex-col">
                          <span className="text-xs text-green-800 font-bold uppercase">{coupon.code} APPLIED</span>
                          <span className="text-[10px] text-green-600">Discount: -Rs. {coupon.discount.toFixed(2)}</span>
                        </div>
                        <button onClick={() => handleRemoveCoupon(coupon.code)} className="text-gray-400 hover:text-red-500 p-1">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    {autoApplied && autoApplyMessage && (
                      <p className="text-[10px] text-green-600 italic text-center">{autoApplyMessage}</p>
                    )}
                  </div>
                )}

                {totalCouponDiscount > 0 && (
                  <div className="py-4 flex items-center justify-between border-t border-gray-100 border-dashed">
                    <dt className="text-green-600">Coupon Discount</dt>
                    <dd className="font-medium text-green-600">-Rs. {totalCouponDiscount.toFixed(2)}</dd>
                  </div>
                )}

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
                className="w-full bg-green-600 rounded-lg py-3 text-white font-medium hover:bg-green-700"
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;