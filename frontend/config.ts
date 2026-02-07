/**
 * Frontend Configuration
 * Uses environment variables with fallbacks for local development
 * 
 * In production (Vercel):
 * - Set VITE_API_URL=https://your-backend.onrender.com
 * - Set VITE_SOCKET_URL=https://your-backend.onrender.com
 */

// API Base URL (without /api suffix)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// API endpoints base
export const API_BASE = `${API_URL}/api`;

// Socket.io URL
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;

// Helper to resolve image URLs (handles both relative and absolute)
export const getImageUrl = (url: string | undefined): string => {
    if (!url) return '';
    // If already absolute URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    // If relative path (e.g., /uploads/...), prepend API_URL
    return `${API_URL}${url}`;
};

// Environment helpers
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
