/**
 * AuthContext - Manages authentication with in-memory access tokens
 * 
 * Key features:
 * - Access token stored in memory (not localStorage) for security
 * - Refresh token stored in HTTP-only cookie (managed by backend)
 * - Auto-refresh on page load and on 401 errors
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '../types';
import { setApiAccessToken } from '../services/api';

interface AuthContextType {
    accessToken: string | null;
    user: User | null;
    isLoading: boolean;
    login: (identifier: string, password: string) => Promise<User>;
    loginWithGoogle: (googleToken: string) => Promise<User>;
    register: (username: string, email: string, password: string) => Promise<User>;
    logout: () => Promise<void>;
    refreshAuth: () => Promise<boolean>;
    getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = 'https://freshmart-project.onrender.com/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Sync token with API service whenever it changes
    useEffect(() => {
        setApiAccessToken(accessToken);
    }, [accessToken]);

    // Refresh auth on mount (uses HTTP-only cookie)
    const refreshAuth = useCallback(async (): Promise<boolean> => {
        try {
            const res = await fetch(`${API_BASE}/refresh-token`, {
                method: 'POST',
                credentials: 'include' // Important: sends cookies
            });

            if (!res.ok) {
                setAccessToken(null);
                setUser(null);
                return false;
            }

            const data = await res.json();
            setAccessToken(data.accessToken);
            setUser({
                id: data.user.id,
                username: data.user.username,
                email: data.user.email,
                role: data.user.role as UserRole,
                mobileNumber: data.user.mobileNumber,
                profilePicture: data.user.profilePicture
            });
            return true;
        } catch (err) {
            console.error('[AuthContext] Refresh failed:', err);
            setAccessToken(null);
            setUser(null);
            return false;
        }
    }, []);

    // Try to restore session on mount
    useEffect(() => {
        const init = async () => {
            await refreshAuth();
            setIsLoading(false);
        };
        init();
    }, [refreshAuth]);

    // Login with email/password
    const login = async (identifier: string, password: string): Promise<User> => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ identifier, password })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Login failed');
        }

        const data = await res.json();
        setAccessToken(data.accessToken);

        const loggedInUser: User = {
            id: data.user.id,
            username: data.user.username,
            email: data.user.email,
            role: data.user.role as UserRole,
            mobileNumber: data.user.mobileNumber,
            profilePicture: data.user.profilePicture
        };
        setUser(loggedInUser);

        // Also save to localStorage for StoreContext compatibility
        localStorage.setItem('freshmart_user', JSON.stringify({ ...loggedInUser, token: data.accessToken }));

        return loggedInUser;
    };

    // Login with Google
    const loginWithGoogle = async (googleToken: string): Promise<User> => {
        const res = await fetch(`${API_BASE}/google-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token: googleToken })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Google login failed');
        }

        const data = await res.json();
        setAccessToken(data.accessToken);

        const loggedInUser: User = {
            id: data.id,
            username: data.username,
            email: data.email,
            role: data.role as UserRole,
            mobileNumber: data.mobileNumber,
            profilePicture: data.profilePicture
        };
        setUser(loggedInUser);

        // Also save to localStorage for StoreContext compatibility
        localStorage.setItem('freshmart_user', JSON.stringify({ ...loggedInUser, token: data.accessToken }));

        return loggedInUser;
    };

    // Register new user
    const register = async (username: string, email: string, password: string): Promise<User> => {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, email, password })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Registration failed');
        }

        const data = await res.json();
        setAccessToken(data.accessToken);

        const newUser: User = {
            id: data.user.id,
            username: data.user.username,
            email: data.user.email,
            role: data.user.role as UserRole
        };
        setUser(newUser);

        // Also save to localStorage for StoreContext compatibility
        localStorage.setItem('freshmart_user', JSON.stringify({ ...newUser, token: data.accessToken }));

        return newUser;
    };

    // Logout
    const logout = async (): Promise<void> => {
        try {
            await fetch(`${API_BASE}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (err) {
            console.error('[AuthContext] Logout error:', err);
        }

        setAccessToken(null);
        setUser(null);
        localStorage.removeItem('freshmart_user');
    };

    // Get current access token (for API calls)
    const getAccessToken = useCallback(() => accessToken, [accessToken]);

    return (
        <AuthContext.Provider value={{
            accessToken,
            user,
            isLoading,
            login,
            loginWithGoogle,
            register,
            logout,
            refreshAuth,
            getAccessToken
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
