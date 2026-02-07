
import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocation as useRouteLocation, useNavigate } from 'react-router-dom';
import { mockApi } from '../services/mockBackend';
import { Order, OrderStatus } from '../types';
import { MapPin, Loader, CheckCircle, Edit2, ShoppingBag, Banknote, Phone, X, ArrowLeft } from 'lucide-react';

const Checkout: React.FC = () => {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const locationState = useRouteLocation().state as { appliedCoupons: { code: string, discount: number }[] } | null;
  const appliedCouponsList = locationState?.appliedCoupons || [];
  const appliedCoupon = appliedCouponsList.reduce((sum, c) => sum + c.discount, 0);

  const [loadingGeo, setLoadingGeo] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [address, setAddress] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [manualAddressMode, setManualAddressMode] = useState(false);

  // Mobile Number State
  const [mobile, setMobile] = useState('');
  const [isEditingMobile, setIsEditingMobile] = useState(true);

  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  // Load Saved Mobile Number on Mount
  useEffect(() => {
    if (state.user?.mobileNumber) {
      setMobile(state.user.mobileNumber);
      setIsEditingMobile(false);
    }
  }, [state.user]);

  // Recalculate Total and Delivery Charge
  let subtotal = 0;
  let bulkDiscount = 0;
  state.cart.forEach(item => {
    subtotal += item.price * item.quantity;
    if (item.bulkRule) {
      const bundles = Math.floor(item.quantity / item.bulkRule.qty);
      const remainder = item.quantity % item.bulkRule.qty;
      const reg = item.quantity * item.price;
      const bulk = (bundles * item.bulkRule.price) + (remainder * item.price);
      bulkDiscount += (reg - bulk);
    }
  });

  const netAmount = subtotal - bulkDiscount;
  let deliveryCharge = 0;
  if (netAmount > 3000) {
    deliveryCharge = 0;
  } else if (netAmount >= 1000) {
    deliveryCharge = 25;
  } else {
    deliveryCharge = 50;
  }

  const finalTotal = netAmount - appliedCoupon + deliveryCharge;

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser');
      return;
    }

    setLoadingGeo(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          const addr = await mockApi.reverseGeocode(latitude, longitude);
          setAddress(addr);
        } catch (e) {
          setAddress('Address fetch failed. Please enter manually.');
        } finally {
          setLoadingGeo(false);
        }
      },
      (err) => {
        console.error(err);
        setGeoError('Unable to retrieve high-accuracy location. Ensure GPS is enabled.');
        setLoadingGeo(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // "Back" button logic to stop editing and revert to saved
  const handleCancelMobileEdit = () => {
    if (state.user?.mobileNumber) {
      setMobile(state.user.mobileNumber);
      setIsEditingMobile(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!state.user) {
      navigate('/login');
      return;
    }
    if (!coords && !address) {
      setGeoError('Delivery location is required.');
      return;
    }
    if (mobile.length !== 10) {
      setGeoError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setPlacingOrder(true);

    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      userId: state.user.id,
      username: state.user.username,
      mobileNumber: `+977-${mobile}`,
      items: [...state.cart],
      total: subtotal,
      discount: bulkDiscount + appliedCoupon,
      deliveryCharge: deliveryCharge, // Include in order
      finalTotal: Math.max(0, finalTotal),
      status: OrderStatus.PENDING,
      location: {
        lat: coords ? coords.lat : 0,
        lng: coords ? coords.lng : 0,
        address
      },
      couponCodes: locationState?.appliedCoupons?.map((c: any) => c.code) || [],
      createdAt: new Date().toISOString()
    };

    await mockApi.placeOrder(newOrder);
    dispatch({ type: 'PLACE_ORDER', payload: newOrder });

    // Persist user mobile locally in state so it shows up next time
    dispatch({ type: 'UPDATE_USER_MOBILE', payload: mobile });

    setTimeout(() => {
      setPlacingOrder(false);
      setOrderComplete(true);
    }, 1500);
  };

  if (orderComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <div className="bg-green-100 p-4 rounded-full text-green-600 mb-6">
          <CheckCircle size={64} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Order Placed Successfully!</h2>
        <p className="text-gray-600 mb-8">Your order is being processed. You can track it in your order history.</p>
        <div className="flex gap-4">
          <button onClick={() => navigate('/orders')} className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800">
            View Receipt
          </button>
          <button onClick={() => navigate('/')} className="text-green-600 font-medium px-6 py-3 hover:underline">
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>

      {/* Location Step */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <MapPin className="text-green-600" /> Delivery Location
        </h2>

        {!coords && !address ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            {!manualAddressMode ? (
              <>
                <p className="text-sm text-gray-500 mb-4">We need your location for delivery.</p>
                <button
                  onClick={handleGetLocation}
                  disabled={loadingGeo}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {loadingGeo ? <Loader className="animate-spin" size={16} /> : <MapPin size={16} />}
                  {loadingGeo ? 'Locating...' : 'Get Precise Location'}
                </button>
                {geoError && <p className="text-red-500 text-xs mt-2">{geoError}</p>}
                
                {/* Manual Entry Option */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-400 mb-2">Location access denied or not working?</p>
                  <button
                    onClick={() => {
                      setManualAddressMode(true);
                      setGeoError('');
                    }}
                    className="text-green-600 text-sm font-medium hover:underline flex items-center gap-1 mx-auto"
                  >
                    <Edit2 size={14} /> Enter Address Manually
                  </button>
                </div>
              </>
            ) : (
              /* Manual Address Entry Form */
              <div className="text-left">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                  Enter Your Delivery Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="House/Flat number, Street, Area, City&#10;e.g., Flat 12, Sunrise Apartments, Baluwatar, Kathmandu"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 mt-3 justify-end">
                  <button
                    onClick={() => {
                      setManualAddressMode(false);
                      setAddress('');
                    }}
                    className="px-4 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (address.trim().length >= 10) {
                        setManualAddressMode(false);
                      } else {
                        setGeoError('Please enter a complete address (at least 10 characters).');
                      }
                    }}
                    disabled={address.trim().length < 10}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Address
                  </button>
                </div>
                {geoError && <p className="text-red-500 text-xs mt-2">{geoError}</p>}
                
                {/* Option to try GPS again */}
                <div className="mt-4 pt-3 border-t border-gray-200 text-center">
                  <button
                    onClick={() => {
                      setManualAddressMode(false);
                      setAddress('');
                      setGeoError('');
                    }}
                    className="text-gray-500 text-xs hover:underline"
                  >
                    ← Try GPS Location Instead
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex justify-between items-start">
              <div className="w-full">
                <p className="text-xs font-bold text-green-800 uppercase mb-1">Delivery Address</p>

                {isEditingAddress ? (
                  <textarea
                    className="w-full p-2 border border-green-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                  />
                ) : (
                  <p className="text-sm text-green-900 font-medium">{address}</p>
                )}

                {coords && (
                  <p className="text-xs text-green-600 mt-1 font-mono">
                    GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </p>
                )}
                {!coords && (
                  <p className="text-xs text-gray-500 mt-1 italic">
                    Manual entry (no GPS)
                  </p>
                )}
              </div>

              <button
                onClick={() => setIsEditingAddress(!isEditingAddress)}
                className="ml-4 text-green-700 hover:text-green-900"
                title="Edit Address"
              >
                <Edit2 size={16} />
              </button>
            </div>

            {isEditingAddress && (
              <div className="mt-2 text-right">
                <button
                  onClick={() => setIsEditingAddress(false)}
                  className="text-xs bg-green-600 text-white px-3 py-1 rounded"
                >
                  Done
                </button>
              </div>
            )}
            
            {/* Option to change location method */}
            <div className="mt-3 pt-3 border-t border-green-200">
              <button
                onClick={() => {
                  setAddress('');
                  setCoords(null);
                  setManualAddressMode(false);
                  setGeoError('');
                }}
                className="text-xs text-green-700 hover:underline"
              >
                Use a different address
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Number Section */}
      <div className={`bg-white rounded-xl shadow-sm p-6 mb-6 border ${mobile.length !== 10 && isEditingMobile ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}`}>
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Phone className="text-green-600" /> Contact Number
        </h2>
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-1 text-xs font-bold text-gray-700 uppercase">
              Mobile Number (Nepal) <span className="text-red-500">*</span>
            </label>

            {/* Show Change button only if not currently editing */}
            {!isEditingMobile && (
              <button
                onClick={() => setIsEditingMobile(true)}
                className="text-xs text-green-600 hover:text-green-800 font-medium hover:underline"
              >
                Change Number
              </button>
            )}
          </div>

          {isEditingMobile ? (
            <div>
              <div className="flex gap-2">
                <div className="flex flex-1">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm font-medium">
                    +977
                  </span>
                  <input
                    type="text"
                    maxLength={10}
                    className="flex-1 block w-full rounded-none rounded-r-lg border border-gray-300 py-2.5 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm outline-none"
                    placeholder="98XXXXXXXX"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                  />
                </div>

                {/* CANCEL / BACK BUTTON - Only shown if we have a saved number to go back to */}
                {state.user?.mobileNumber && (
                  <button
                    onClick={handleCancelMobileEdit}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-1"
                  >
                    <X size={16} /> Cancel
                  </button>
                )}
              </div>

              {/* Validation Messages */}
              {mobile.length > 0 && mobile.length !== 10 && (
                <p className="mt-2 text-xs text-red-600 font-bold flex items-center gap-1">
                  <X size={12} /> Please enter a valid 10-digit number.
                </p>
              )}
              {mobile.length === 0 && (
                <p className="mt-2 text-xs text-red-500 font-medium">
                  * Mobile number is required for delivery.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full text-green-700">
                  <Phone size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-900 font-bold tracking-wide text-lg">+977 {mobile}</span>
                  <span className="text-[10px] text-gray-500 uppercase">Verified Contact</span>
                </div>
              </div>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold">Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Method - COD Only */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Banknote className="text-green-600" /> Payment Method
        </h2>
        <div className="flex items-center gap-3 p-4 border border-green-200 bg-green-50 rounded-lg cursor-pointer">
          <div className="h-5 w-5 rounded-full border-2 border-green-600 flex items-center justify-center bg-white">
            <div className="h-2.5 w-2.5 rounded-full bg-green-600" />
          </div>
          <span className="font-bold text-gray-800">Cash on Delivery (COD)</span>
        </div>
      </div>

      {/* Final Review */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <ShoppingBag className="text-green-600" /> Order Summary
        </h2>

        {/* Item List */}
        <div className="mb-4 bg-gray-50 rounded-lg p-3">
          <ul className="divide-y divide-gray-200 text-sm">
            {state.cart.map(item => (
              <li key={item.id} className="py-2 flex justify-between items-center">
                <div>
                  <span className="font-semibold text-gray-800">{item.name}</span>
                  <div className="text-xs text-gray-500">
                    {item.quantity} x Rs. {item.price.toFixed(2)}
                  </div>
                </div>
                <span className="font-medium text-gray-900">
                  Rs. {(item.quantity * item.price).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-between mb-2 text-sm text-gray-600">
          <span>Subtotal</span>
          <span>Rs. {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mb-2 text-sm text-green-600">
          <span>Discounts</span>
          <span>-Rs. {(bulkDiscount + appliedCoupon).toFixed(2)}</span>
        </div>
        <div className="flex justify-between mb-2 text-sm text-gray-600">
          <span>Delivery Charge</span>
          <span>{deliveryCharge === 0 ? <span className="text-green-600 font-bold">FREE</span> : `Rs. ${deliveryCharge.toFixed(2)}`}</span>
        </div>
        <div className="flex justify-between mt-4 pt-4 border-t font-bold text-xl text-gray-900">
          <span>Total To Pay</span>
          <span>Rs. {finalTotal.toFixed(2)}</span>
        </div>

        {/* Disable button if no mobile number or invalid length */}
        <button
          onClick={handlePlaceOrder}
          disabled={(!coords && !address) || placingOrder || mobile.length !== 10}
          className="w-full mt-6 bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex justify-center items-center gap-2"
        >
          {placingOrder ? <Loader className="animate-spin" /> : 'Confirm Order'}
        </button>

        {mobile.length !== 10 && (
          <p className="text-center text-xs text-red-500 mt-3 font-medium">
            Please provide a valid contact number to proceed.
          </p>
        )}
      </div>
    </div>
  );
};

export default Checkout;
