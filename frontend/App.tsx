import React, { useEffect, useState, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Admin from './pages/Admin';
import Login from './pages/Login';
import BackendGuide from './pages/BackendGuide';

// Detailed Orders Page
import { useStore } from './context/StoreContext';
import { Receipt, ArrowLeft, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { mockApi } from './services/mockBackend';
import SpecialCouponPopup from './components/SpecialCouponPopup';
import { SocketProvider } from './context/SocketContext';
import ToastNotification from './components/ToastNotification';

// Helper to format date labels
const getDateLabel = (dateStr: string): string => {
  const orderDate = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  if (orderDateOnly.getTime() === todayOnly.getTime()) {
    return 'Today';
  } else if (orderDateOnly.getTime() === yesterdayOnly.getTime()) {
    return 'Yesterday';
  } else {
    return orderDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
};

// Helper to get unique date key for grouping
const getDateKey = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const Orders = () => {
  const { state, dispatch } = useStore();
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  if (!state.user) {
    return <Navigate to="/login" />;
  }

  // Fetch orders specific to the logged-in user when the page mounts
  useEffect(() => {
    const fetchUserOrders = async () => {
      console.log('[Orders] state.user:', state.user);
      if (state.user) {
        try {
          console.log('[Orders] Fetching orders using JWT token auth');
          const allOrders = await mockApi.getOrders();
          const myOrders = allOrders.filter(
            (order: any) => order.username === state.user?.username
          );
          dispatch({ type: 'SET_ORDERS', payload: myOrders });
        } catch (error) {
          console.error('[Orders] Error fetching orders:', error);
        }
      }
    };
    fetchUserOrders();
  }, [state.user, dispatch]);

  // Get unique dates for dropdown
  const uniqueDates = useMemo(() => {
    const dates = new Map<string, string>();
    state.orders.forEach(o => {
      const key = getDateKey(o.createdAt);
      const label = getDateLabel(o.createdAt);
      dates.set(key, label);
    });
    return Array.from(dates.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [state.orders]);

  // Filter and group orders by date
  const groupedOrders = useMemo(() => {
    let filtered = state.orders;

    if (selectedDateFilter !== 'all') {
      filtered = state.orders.filter(o => getDateKey(o.createdAt) === selectedDateFilter);
    }

    // Group by date
    const groups = new Map<string, typeof filtered>();
    filtered.forEach(order => {
      const key = getDateKey(order.createdAt);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(order);
    });

    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dateKey, orders]) => ({
        dateKey,
        dateLabel: getDateLabel(orders[0].createdAt),
        orders
      }));
  }, [state.orders, selectedDateFilter]);

  // Toggle date group expansion
  const toggleDateGroup = (dateKey: string) => {
    setExpandedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // Initialize all groups as expanded
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    groupedOrders.forEach(g => { initial[g.dateKey] = true; });
    setExpandedDates(initial);
  }, [groupedOrders.length]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold">My Order History</h1>
        <div className="flex items-center gap-4">
          {/* Date Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
            >
              <option value="all">All Orders</option>
              {uniqueDates.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <Link to="/home" className="text-green-600 font-medium hover:text-green-700 flex items-center gap-2 text-sm">
            <ArrowLeft size={16} /> Continue Shopping
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {state.orders.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500 mb-4">You haven't placed any orders yet.</p>
            <Link to="/home" className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
              Start Shopping
            </Link>
          </div>
        )}

        {/* Grouped Orders by Date */}
        {groupedOrders.map(({ dateKey, dateLabel, orders }) => (
          <div key={dateKey} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Date Header - Collapsible */}
            <button
              onClick={() => toggleDateGroup(dateKey)}
              className="w-full px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200 flex items-center justify-between hover:from-green-100 hover:to-emerald-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-green-600" />
                <span className="font-bold text-gray-800">{dateLabel}</span>
                <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {orders.length} order{orders.length > 1 ? 's' : ''}
                </span>
              </div>
              {expandedDates[dateKey] ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
            </button>

            {/* Orders in this date group */}
            {expandedDates[dateKey] && (
              <div className="divide-y divide-gray-100">
                {orders.map(o => (
                  <div key={o.id} className="p-6">
                    {/* Order Header */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                      <div>
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          <Receipt size={16} className="text-gray-500" />
                          Order #{o.id}
                        </h3>
                        <p className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleString()}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${o.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                        o.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                        {o.status}
                      </span>
                    </div>

                    {/* Receipt Details */}
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Receipt Details</h4>
                      <span className="text-xs text-gray-400">Ordered by: {o.username || state.user?.username}</span>
                    </div>

                    <ul className="space-y-3 mb-4">
                      {o.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between items-start text-sm">
                          <div className="flex gap-3">
                            <span className="font-bold text-gray-700 w-6">{item.quantity}x</span>
                            <div>
                              <div className="text-gray-900 font-medium">{item.name}</div>
                              <div className="text-xs text-gray-500">Rs. {item.price.toFixed(2)} / unit</div>
                            </div>
                          </div>
                          <span className="font-medium text-gray-900">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Subtotal</span>
                        <span>Rs. {o.total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span>
                        <span>-Rs. {o.discount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Delivery Charge</span>
                        <span>{o.deliveryCharge > 0 ? `Rs. ${o.deliveryCharge.toFixed(2)}` : 'FREE'}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t mt-2">
                        <span>Total Paid</span>
                        <span>Rs. {o.finalTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Delivery Info */}
                    <div className="mt-6 bg-gray-50 rounded p-3 text-xs text-gray-600">
                      <span className="font-bold text-gray-800">Delivered to:</span> {o.location.address}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

import { AuthProvider } from './context/AuthContext';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <StoreProvider>
        <SocketProvider>
          <ToastNotification />
          <SpecialCouponPopup />
          <Router>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-grow bg-gray-50">
                <Routes>
                  <Route path="/" element={<Login />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/backend-guide" element={<BackendGuide />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </main>
              {/* Footer removed as requested */}
            </div>
          </Router>
        </SocketProvider>
      </StoreProvider>
    </AuthProvider>
  );
};

export default App;