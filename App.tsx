
import React, { useEffect } from 'react';
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
import { Receipt, ArrowLeft } from 'lucide-react';
import { mockApi } from './services/mockBackend';

const Orders = () => {
  const { state, dispatch } = useStore();
  
  if (!state.user) {
      return <Navigate to="/login" />;
  }

  // Fetch orders specific to the logged-in user when the page mounts
  useEffect(() => {
    const fetchUserOrders = async () => {
        if (state.user) {
            const myOrders = await mockApi.getOrders(state.user.id);
            dispatch({ type: 'SET_ORDERS', payload: myOrders });
        }
    };
    fetchUserOrders();
  }, [state.user, dispatch]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Order History</h1>
        <Link to="/" className="text-green-600 font-medium hover:text-green-700 flex items-center gap-2 text-sm">
            <ArrowLeft size={16} /> Continue Shopping
        </Link>
      </div>
      
      <div className="space-y-6">
        {state.orders.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <p className="text-gray-500 mb-4">You haven't placed any orders yet.</p>
                <Link to="/" className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                    Start Shopping
                </Link>
            </div>
        )}
        {state.orders.map(o => (
           <div key={o.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
             
             {/* Header */}
             <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                 <div>
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Receipt size={16} className="text-gray-500"/> 
                        Order #{o.id}
                    </h3>
                    <p className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleString()}</p>
                 </div>
                 <div className="flex items-center gap-4">
                     <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                         o.status === 'Delivered' ? 'bg-green-100 text-green-800' : 
                         o.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                     }`}>
                         {o.status}
                     </span>
                 </div>
             </div>

             {/* Receipt Body */}
             <div className="p-6">
                 <div className="flex justify-between items-start mb-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Receipt Details</h4>
                    <span className="text-xs text-gray-400">Ordered by: {o.username || state.user?.username}</span>
                 </div>
                 
                 <ul className="space-y-3 mb-6">
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
           </div>
        ))}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <Router>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-grow bg-gray-50">
            <Routes>
              <Route path="/" element={<Home />} />
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
    </StoreProvider>
  );
};

export default App;
