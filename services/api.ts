/**
 * FreshMart API Service
 * HTTP client for communicating with the Express backend
 */

const API_BASE = 'http://localhost:5000/api';

// Helper to get auth headers
const getAuthHeaders = (): Record<string, string> => {
    const user = localStorage.getItem('freshmart_user');
    if (user) {
        try {
            const parsed = JSON.parse(user);
            if (parsed.token) {
                return { 'Authorization': `Bearer ${parsed.token}` };
            }
        } catch (e) {
            // Invalid JSON, ignore
        }
    }
    return {};
};

// Helper for API requests with timeout
const apiRequest = async (
    endpoint: string,
    options: RequestInit = {}
): Promise<any> => {
    const url = `${API_BASE}${endpoint}`;
    console.log('[FreshMart API] Request:', options.method || 'GET', url);

    const headers: Record<string, string> = {
        ...getAuthHeaders(),
        ...(options.headers as Record<string, string> || {})
    };

    // Only add Content-Type for non-FormData requests
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log('[FreshMart API] Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
            console.error('[FreshMart API] Error response:', errorData);
            throw new Error(errorData.message || errorData.error || 'Request failed');
        }

        const data = await response.json();
        console.log('[FreshMart API] Response data received');
        return data;
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[FreshMart API] Request error:', error.message);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check if the server is running on port 5000.');
        }
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            throw new Error('Cannot connect to server. Make sure the backend is running: node server.cjs');
        }
        throw error;
    }
};

export const api = {
    // =====================
    // AUTH ENDPOINTS
    // =====================

    login: async (identifier: string, password: string) => {
        return apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password })
        });
    },

    register: async (username: string, email: string, password: string) => {
        return apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
    },

    googleAuth: async (email: string, name: string, picture: string) => {
        return apiRequest('/auth/google', {
            method: 'POST',
            body: JSON.stringify({ email, name, picture })
        });
    },

    resetPassword: async (identifier: string, newPassword: string) => {
        return apiRequest('/auth/reset-password', {
            method: 'PUT',
            body: JSON.stringify({ identifier, newPassword })
        });
    },

    // =====================
    // PRODUCT ENDPOINTS
    // =====================

    getProducts: async () => {
        return apiRequest('/products');
    },

    saveProduct: async (product: any) => {
        const isNew = !product.id || product.id === 0;
        const endpoint = isNew ? '/admin/products' : `/admin/products/${product.id}`;
        const method = isNew ? 'POST' : 'PUT';

        // Use FormData if there's a file, otherwise JSON
        if (product.imageFile) {
            const formData = new FormData();
            formData.append('name', product.name);
            formData.append('price', String(product.price));
            if (product.originalPrice) formData.append('originalPrice', String(product.originalPrice));
            if (product.unit) formData.append('unit', product.unit);
            formData.append('stock', String(product.stock));
            formData.append('category', product.category);
            if (product.bulkRule) formData.append('bulkRule', JSON.stringify(product.bulkRule));
            formData.append('image', product.imageFile);

            return apiRequest(endpoint, { method, body: formData });
        }

        return apiRequest(endpoint, {
            method,
            body: JSON.stringify({
                name: product.name,
                price: product.price,
                originalPrice: product.originalPrice,
                unit: product.unit,
                stock: product.stock,
                category: product.category,
                imageUrl: product.imageUrl,
                bulkRule: product.bulkRule ? JSON.stringify(product.bulkRule) : null
            })
        });
    },

    deleteProduct: async (id: string | number) => {
        return apiRequest(`/admin/products/${id}`, { method: 'DELETE' });
    },

    // =====================
    // ORDER ENDPOINTS
    // =====================

    getOrders: async (userId?: number) => {
        // Backend filters by user role automatically
        return apiRequest('/orders');
    },

    placeOrder: async (order: any) => {
        return apiRequest('/orders', {
            method: 'POST',
            body: JSON.stringify(order)
        });
    },

    updateOrderStatus: async (orderId: string, status: string) => {
        return apiRequest(`/admin/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    },

    // =====================
    // COUPON ENDPOINTS
    // =====================

    getCoupons: async () => {
        return apiRequest('/coupons');
    },

    validateCoupon: async (code: string, orderTotal: number) => {
        return apiRequest('/coupons/validate', {
            method: 'POST',
            body: JSON.stringify({ code, orderTotal })
        });
    },

    createCoupon: async (coupon: any) => {
        return apiRequest('/admin/coupons', {
            method: 'POST',
            body: JSON.stringify(coupon)
        });
    },

    updateCoupon: async (originalCode: string, coupon: any) => {
        return apiRequest(`/admin/coupons/${originalCode}`, {
            method: 'PUT',
            body: JSON.stringify(coupon)
        });
    },

    deleteCoupon: async (code: string) => {
        return apiRequest(`/admin/coupons/${code}`, { method: 'DELETE' });
    },

    // =====================
    // GEO ENDPOINTS
    // =====================

    reverseGeocode: async (lat: number, lng: number) => {
        const response = await apiRequest(`/geo/reverse?lat=${lat}&lng=${lng}`);
        return response.address;
    }
};

export default api;
