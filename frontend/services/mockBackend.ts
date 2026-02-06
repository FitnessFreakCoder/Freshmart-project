/**
 * FreshMart Mock Backend - Now using Real MongoDB API
 * 
 * This file provides the same `mockApi` interface as before,
 * but now routes all calls to the Express backend + MongoDB.
 * 
 * This allows all existing components to work without changes.
 */

import { profile } from 'console';
import { Product, User, UserRole, Order, Coupon, OrderStatus } from '../types';
import { api } from './api';

// Google OAuth Client ID from environment (injected at build time or hardcoded)
const GOOGLE_CLIENT_ID = '517633694714-15kjgviesn1u4ghfs9cgs7d4030ob09a.apps.googleusercontent.com';

export const mockApi = {
  login: async (identifier: string, password: string): Promise<User> => {
    console.log('[FreshMart] Attempting login for:', identifier);

    try {
      const response = await api.login(identifier, password);
      console.log('[FreshMart] Login response received:', response);

      // Save user with token to localStorage for session persistence
      const user = {
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        role: response.user.role as UserRole,
        token: response.accessToken,
        mobileNumber: response.user.mobileNumber,
        profilePicture: response.user.profilePicture
      };

      localStorage.setItem('freshmart_user', JSON.stringify(user));
      console.log('[FreshMart] Login successful, user saved to localStorage');
      return user;
    } catch (error: any) {
      console.error('[FreshMart] Login failed:', error.message);
      throw error;
    }
  },

  loginWithGoogle: async (): Promise<User> => {
    console.log('[FreshMart] Starting Google Login flow...');

    // Load Google Identity Services
    const googleLoginPromise = new Promise<User>((resolve, reject) => {
      // Check if google is available
      if (typeof (window as any).google === 'undefined') {
        console.log('[FreshMart] Loading GSI script...');
        // Load the Google Identity Services script
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          console.log('[FreshMart] GSI script loaded');
          initGoogleAuth(resolve, reject);
        };
        script.onerror = () => {
          console.error('[FreshMart] Failed to load Google Identity Services script');
          reject(new Error('Failed to load Google Identity Services'));
        };
        document.head.appendChild(script);
      } else {
        console.log('[FreshMart] GSI already loaded, initializing...');
        initGoogleAuth(resolve, reject);
      }
    });

    // Add 30s timeout to prevent infinite loading state
    const timeoutPromise = new Promise<User>((_, reject) => {
      setTimeout(() => {
        console.error('[FreshMart] Google Login TIMED OUT after 30s');
        reject(new Error('Google Login timed out. Please check console for errors.'));
      }, 30000);
    });

    try {
      const user = await Promise.race([googleLoginPromise, timeoutPromise]);
      console.log('[FreshMart] Google Login SUCCESS:', user.email);
      return user;
    } catch (error: any) {
      console.error('[FreshMart] Google Login FAILED:', error.message);
      throw error;
    }
  },

  register: async (username: string, email: string, password: string): Promise<User> => {
    const response = await api.register(username, email, password);

    const user = {
      id: response.user.id,
      username: response.user.username,
      email: response.user.email,
      role: response.user.role as UserRole,
      token: response.acessToken,
      profilePicture: response.user.profilePicture
    };

    localStorage.setItem('freshmart_user', JSON.stringify(user));
    return user;
  },

  resetPassword: async (identifier: string, newPassword: string): Promise<void> => {
    await api.resetPassword(identifier, newPassword);
  },

  getProducts: async (): Promise<Product[]> => {
    return await api.getProducts();
  },

  saveProduct: async (product: Product): Promise<Product> => {
    const response = await api.saveProduct(product);
    return response.product || product;
  },

  deleteProduct: async (id: number | string): Promise<void> => {
    await api.deleteProduct(id);
  },

  getOrders: async (userId?: number | string): Promise<Order[]> => {
    const orders = await api.getOrders(userId);
    return orders.map((o: any) => ({
      ...o,
      status: o.status as OrderStatus
    }));
  },

  placeOrder: async (order: Order): Promise<Order> => {
    const response = await api.placeOrder({
      items: order.items,
      total: order.total,
      discount: order.discount,
      couponCodes: order.couponCodes, // Pass applied coupon codes
      deliveryCharge: order.deliveryCharge,
      finalTotal: order.finalTotal,
      location: order.location,
      mobileNumber: order.mobileNumber,
      username: order.username
    });

    return {
      ...order,
      id: response.id,
      status: OrderStatus.PENDING,
      createdAt: response.createdAt || new Date().toISOString()
    };
  },

  updateOrderStatus: async (orderId: string, status: OrderStatus): Promise<void> => {
    await api.updateOrderStatus(orderId, status);
  },

  getCoupons: async (): Promise<Coupon[]> => {
    return await api.getCoupons();
  },

  createCoupon: async (coupon: Coupon): Promise<void> => {
    await api.createCoupon(coupon);
  },

  updateCoupon: async (originalCode: string, updatedCoupon: Coupon): Promise<void> => {
    await api.updateCoupon(originalCode, updatedCoupon);
  },

  deleteCoupon: async (code: string): Promise<void> => {
    await api.deleteCoupon(code);
  },

  validateCoupon: async (code: string, orderTotal: number = 0): Promise<{ isValid: boolean, coupon?: Coupon, error?: string }> => {
    return await api.validateCoupon(code, orderTotal);
  },

  reverseGeocode: async (lat: number, lng: number): Promise<string> => {
    return await api.reverseGeocode(lat, lng);
  }
};

// Helper function to initialize Google Auth
function initGoogleAuth(
  resolve: (user: User) => void,
  reject: (error: Error) => void
) {
  const google = (window as any).google;

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async (response: any) => {
      try {
        // Decode the JWT token from Google
        const payload = JSON.parse(atob(response.credential.split('.')[1]));

        // Send to our backend
        const authResponse = await api.googleAuth(
          payload.email,
          payload.name,
          payload.picture
        );

        const user = {
          id: authResponse.user.id,
          username: authResponse.user.username,
          email: authResponse.user.email,
          role: authResponse.user.role as UserRole,
          token: authResponse.accessToken,
          profilePicture: authResponse.user.profilePicture
        };

        localStorage.setItem('freshmart_user', JSON.stringify(user));
        resolve(user);
      } catch (error) {
        reject(error as Error);
      }
    }
  });

  // Trigger the Google One Tap UI
  google.accounts.id.prompt((notification: any) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      // Fall back to popup if One Tap is not available
      google.accounts.id.renderButton(
        document.createElement('div'),
        { theme: 'outline', size: 'large' }
      );

      // Show manual popup
      google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'email profile',
        callback: async (tokenResponse: any) => {
          try {
            // Get user info from Google
            const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            }).then(r => r.json());

            const authResponse = await api.googleAuth(
              userInfo.email,
              userInfo.name,
              userInfo.picture
            );

            const user = {
              id: authResponse.user.id,
              username: authResponse.user.username,
              email: authResponse.user.email,
              role: authResponse.user.role as UserRole,
              token: authResponse.accessToken,
              profilePicture: authResponse.user.profilePicture
            };

            localStorage.setItem('freshmart_user', JSON.stringify(user));
            resolve(user);
          } catch (error) {
            reject(error as Error);
          }
        }
      }).requestAccessToken();
    }
  });
}
