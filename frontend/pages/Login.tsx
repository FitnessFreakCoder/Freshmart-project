
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { mockApi } from '../services/mockBackend';
import { Lock, User, Mail, LogIn, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';
import { UserRole } from '../types';

type ViewState = 'LOGIN' | 'REGISTER' | 'FORGOT';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1022561909186-33i8psb5samvvb42kmve5gs4i3vgulhu.apps.googleusercontent.com';
import SplashScreen from '../components/SplashScreen';

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
    const [redirecting, setRedirecting] = useState(false);

    const { login, register, loginWithGoogle, user, isLoading } = useAuth();
    const { dispatch } = useStore();
    const navigate = useNavigate();

    // Redirect if already logged in - BUT only if we aren't in the middle of a manual login process (loading/redirecting)
    React.useEffect(() => {
        // We check !loading (local state) and !redirecting (local state) to ensure we don't interrupt the manual login flow animations
        if (!isLoading && user && !loading && !redirecting) {
            if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF) {
                navigate('/admin');
            } else {
                navigate('/home');
            }
        }
    }, [user, isLoading, navigate, loading, redirecting]);

    const handleLoginRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Artificial delay for UX (2.5 seconds)
        await new Promise(resolve => setTimeout(resolve, 2500));

        try {
            let user;
            if (view === 'REGISTER') {
                user = await register(username, email, password);
            } else {
                user = await login(identifier, password);
            }

            // Show redirecting screen
            setRedirecting(true);

            // Delay for better UX
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Note: AuthContext automatically updates StoreContext via the syncing effect
            // But we can dispatch here for immediate feedback if needed, 
            // though keeping it single source of truth (AuthContext) is better.
            // dispatch({ type: 'SET_USER', payload: user }); 

            // Redirect based on role: Staff/Admin go to Dashboard, Users go to Home
            if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
                navigate('/admin');
            } else {
                navigate('/home');
            }

        } catch (err: any) {
            setError(err.message || 'Authentication failed');
            setRedirecting(false);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        setLoading(true);
        setError('');

        // Artificial delay for UX (2.5 seconds)
        await new Promise(resolve => setTimeout(resolve, 2500));

        try {
            const token = credentialResponse.credential;
            if (!token) throw new Error('No Google token received');

            const user = await loginWithGoogle(token);

            // Show redirecting screen
            setRedirecting(true);

            // Delay for better UX
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Redirect based on role
            if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
                navigate('/admin');
            } else {
                navigate('/home');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Google Login failed');
            setRedirecting(false);
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

    // Redirecting Overlay
    if (redirecting) {
        return <SplashScreen />;
    }

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
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
                                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 outline-none ${confirmPassword && confirmPassword !== newPassword
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
                            <div className="flex justify-center">
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => setError('Google Login Failed')}
                                    theme="outline"
                                    shape="rectangular"
                                    size="large"
                                    width="100%"
                                />
                            </div>

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

                                {loading && !redirecting && (
                                    <p className="text-green-600 text-sm text-center animate-pulse">Verifying credentials...</p>
                                )}

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
        </GoogleOAuthProvider>
    );
};

export default Login;
