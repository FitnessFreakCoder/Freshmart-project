
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { mockApi } from '../services/mockBackend';
import { Lock, User, Mail, LogIn, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';
import { UserRole } from '../types';

type ViewState = 'LOGIN' | 'REGISTER' | 'FORGOT';

const Login: React.FC = () => {
  const [view, setView] = useState<ViewState>('LOGIN');
  
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState(''); // Email or Username for Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Forgot Password States
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { dispatch } = useStore();
  const navigate = useNavigate();

  const handleLoginRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      let user;
      if (view === 'REGISTER') {
         user = await mockApi.register(username, email, password);
      } else {
         user = await mockApi.login(identifier, password);
      }
      
      dispatch({ type: 'SET_USER', payload: user });
      
      // Redirect based on role: Staff/Admin go to Dashboard, Users go to Home
      if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
          navigate('/admin');
      } else {
          navigate('/');
      }
      
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
      setLoading(true);
      setError('');
      try {
          const user = await mockApi.loginWithGoogle();
          dispatch({ type: 'SET_USER', payload: user });
          
          // Redirect based on role: Staff/Admin go to Dashboard, Users go to Home
          if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
              navigate('/admin');
          } else {
              navigate('/');
          }
      } catch (err: any) {
          setError(err.message || 'Google Login failed');
      } finally {
          setLoading(false);
      }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      setSuccessMsg('');

      if (newPassword !== confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
      }

      if (newPassword.length < 4) {
          setError("Password must be at least 4 characters.");
          setLoading(false);
          return;
      }

      try {
          await mockApi.resetPassword(resetEmail, newPassword);
          setSuccessMsg('Password Reset Successfully. Please Login.');
          setTimeout(() => {
              setView('LOGIN');
              setSuccessMsg('');
              setPassword('');
              setResetEmail('');
              setNewPassword('');
              setConfirmPassword('');
          }, 2000);
      } catch (err: any) {
          setError(err.message || 'Failed to reset password. Check if email exists.');
      } finally {
          setLoading(false);
      }
  };

  const GoogleIcon = () => (
      <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
  );

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-gray-100">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {view === 'REGISTER' && 'Create Account'}
              {view === 'LOGIN' && 'Welcome Back'}
              {view === 'FORGOT' && 'Reset Password'}
          </h1>
          <p className="text-gray-500">
              {view === 'REGISTER' && 'Join Freshmart for exclusive deals'}
              {view === 'LOGIN' && 'Sign in to access your orders'}
              {view === 'FORGOT' && 'Enter your email to reset password'}
          </p>
        </div>

        {view === 'FORGOT' ? (
            // Forgot Password Form
            <form onSubmit={handleResetPassword} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="user@example.com"
                            required
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="Enter new password"
                            required
                            minLength={4}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <div className="relative">
                        <CheckCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 outline-none ${
                                confirmPassword && confirmPassword !== newPassword 
                                ? 'border-red-300 focus:ring-red-500' 
                                : 'border-gray-300 focus:ring-green-500'
                            }`}
                            placeholder="Confirm new password"
                            required
                        />
                    </div>
                </div>

                {error && <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded">{error}</p>}
                {successMsg && <p className="text-green-600 text-sm text-center bg-green-50 py-2 rounded font-bold">{successMsg}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Updating...' : 'Set New Password'}
                </button>
                
                <button 
                    type="button"
                    onClick={() => { setView('LOGIN'); setError(''); setSuccessMsg(''); }}
                    className="w-full text-center text-gray-600 text-sm hover:text-green-600 flex items-center justify-center gap-1"
                >
                    <ArrowLeft size={16} /> Back to Login
                </button>
            </form>
        ) : (
            // Login / Register Form
            <div className="space-y-5">
                {/* GOOGLE LOGIN BUTTON */}
                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm"
                >
                    <GoogleIcon />
                    {loading ? 'Connecting...' : 'Continue with Google'}
                </button>

                <div className="flex items-center gap-2">
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <span className="text-gray-400 text-sm">or</span>
                    <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <form onSubmit={handleLoginRegister} className="space-y-5">
                    {view === 'REGISTER' ? (
                        // Register Fields
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                        placeholder="johndoe"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                        placeholder="john@example.com"
                                        required
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        // Login Fields
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Username or Email</label>
                            <div className="relative">
                            <LogIn className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                            <input
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                placeholder="user@example.com or user"
                                required
                            />
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-700">Password</label>
                            {view === 'LOGIN' && (
                                <button 
                                    type="button"
                                    onClick={() => { setView('FORGOT'); setError(''); setSuccessMsg(''); }}
                                    className="text-xs text-green-600 hover:underline"
                                >
                                    Forgot Password?
                                </button>
                            )}
                        </div>
                        <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="••••••"
                            required
                        />
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (view === 'REGISTER' ? 'Register' : 'Sign In')}
                    </button>
                </form>
            </div>
        )}

        {view !== 'FORGOT' && (
            <div className="mt-6 text-center">
                <p className="text-gray-600 text-sm">
                    {view === 'REGISTER' ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button 
                        onClick={() => { setView(view === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setError(''); }}
                        className="text-green-600 font-bold hover:underline"
                    >
                        {view === 'REGISTER' ? 'Login' : 'Register'}
                    </button>
                </p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Login;
