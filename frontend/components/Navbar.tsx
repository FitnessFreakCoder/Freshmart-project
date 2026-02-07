
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User as UserIcon, LogOut, Menu, X, MapPin } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';

const Navbar: React.FC = () => {
  const { state, dispatch, isAdmin, isStaff } = useStore();
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  const cartCount = state.cart.reduce((acc, item) => acc + item.quantity, 0);

  const closeMenu = () => setIsMenuOpen(false);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
    closeMenu();
  };

  const confirmLogout = async () => {
    await logout();
    setShowLogoutConfirm(false);
    navigate('/');
  };

  const handleCartClick = () => {
    closeMenu();
    if (!state.user) {
      alert("Please sign in to view your cart.");
      navigate('/login');
      return;
    }
    navigate('/cart');
  };

  const isLoginPage = location.pathname === '/login';

  return (
    <>
      <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Left: Logo & Location */}
            <div className="flex items-center gap-6">
              <Link to="/home" onClick={closeMenu} className="flex-shrink-0 flex items-center gap-1">
                <span className="text-2xl font-bold tracking-tight text-gray-900">Freshmart<span className="text-orange-500">.</span></span>
              </Link>

              {/* Location Mock */}
              <div className="hidden md:flex items-center gap-1 max-w-xs cursor-pointer hover:bg-gray-50 p-1 rounded transition">
                <MapPin size={18} className="text-orange-500" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] font-bold text-gray-800">Delivery to</span>
                  <span className="text-xs text-gray-500 leading-snug">kakarvitta,ittabhatta,turkeny,dokandada,governsari,purnechowk</span>
                </div>
              </div>
            </div>

            {/* Middle: Search (Optional placeholder for now, can be expanded) */}
            <div className="hidden lg:block flex-1 max-w-xl mx-8">
              <div className="relative">
                {/* Input handled in Home.tsx */}
              </div>
            </div>

            {/* Mobile Cart: Visible only on mobile and if items exist */}
            {!isLoginPage && cartCount > 0 && (
              <button
                onClick={handleCartClick}
                className="md:hidden flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full border border-green-100"
              >
                <ShoppingCart className="h-5 w-5 text-green-700" />
                <span className="font-bold text-sm text-green-700">{cartCount}</span>
              </button>
            )}

            {/* Right: Actions */}
            <div className="hidden md:flex items-center space-x-6">
              {state.user && (
                <Link to="/orders" className="text-gray-700 hover:text-orange-600 font-medium text-sm">
                  Orders
                </Link>
              )}

              {(isAdmin || isStaff) && (
                <Link to="/admin" className="text-gray-700 hover:text-orange-600 font-medium text-sm">
                  Dashboard
                </Link>
              )}

              {state.user ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {state.user.profilePicture ? (
                      <img
                        src={state.user.profilePicture}
                        alt={state.user.username}
                        className="h-8 w-8 rounded-full border border-gray-200"
                      />
                    ) : (
                      <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">
                        {state.user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-bold text-gray-700">{state.user.username}</span>
                  </div>
                  <button
                    onClick={handleLogoutClick}
                    className="flex items-center gap-1 text-red-500 hover:text-red-700 font-medium transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <Link to="/login" className="text-gray-700 hover:text-orange-600 flex items-center gap-1 font-medium text-sm">
                  <UserIcon className="h-5 w-5" /> Sign In
                </Link>
              )}

              {/* Hide Cart button if on Login Page */}
              {!isLoginPage && (
                <button
                  onClick={handleCartClick}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span className="font-bold text-sm">{cartCount} items</span>
                </button>
              )}
            </div>

            <div className="-mr-2 flex md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-orange-500 hover:bg-gray-100 focus:outline-none"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden bg-white border-t absolute w-full left-0 shadow-lg z-40">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link to="/home" onClick={closeMenu} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-orange-500 hover:bg-gray-50">Shop</Link>

              {/* Show Cart link in menu even if icon is visible in header, for completeness */}
              {!isLoginPage && (
                <button onClick={handleCartClick} className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-orange-500 hover:bg-gray-50">
                  Cart ({cartCount})
                </button>
              )}

              {state.user && <Link to="/orders" onClick={closeMenu} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-orange-500 hover:bg-gray-50">Orders</Link>}

              {(isAdmin || isStaff) && <Link to="/admin" onClick={closeMenu} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-orange-500 hover:bg-gray-50">Dashboard</Link>}

              {!state.user ? (
                <Link to="/login" onClick={closeMenu} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-orange-500 hover:bg-gray-50">Login</Link>
              ) : (
                <button onClick={handleLogoutClick} className="block w-full text-left px-3 py-2 text-base font-medium text-red-500 hover:text-red-700 hover:bg-gray-50">
                  Logout ({state.user.username})
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in-up">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <LogOut className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Logout</h3>
              <p className="text-gray-500 mb-6">Are you sure you want to logout from your account?</p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
