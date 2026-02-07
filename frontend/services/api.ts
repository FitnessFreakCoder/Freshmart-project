/**
 * FreshMart API Service
 * HTTP client for communicating with the Express backend
 */

const API_BASE = 'http://localhost:5000/api';

// In-memory access token (set by AuthContext)
let memoryAccessToken: string | null = null;

export const setApiAccessToken = (token: string | null) => {
    memoryAccessToken = token;
};

// Helper to get auth headers
const getAuthHeaders = (): Record<string, string> => {
    if (memoryAccessToken) {
        return { 'Authorization': `Bearer ${memoryAccessToken}` };
    }
    return {};
};

// In-memory CSRF token
let csrfToken: string | null = null;

// Helper to get CSRF token
const getCsrfToken = async () => {
    if (csrfToken) return csrfToken;
    try {
        const res = await fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
        const data = await res.json();
        csrfToken = data.csrfToken;
        return csrfToken;
    } catch (err) {
        console.error('Failed to fetch CSRF token', err);
        return null;
    }
};

// Helper for API requests with timeout and auto-refresh
const apiRequest = async (
    endpoint: string,
    options: RequestInit = {}
): Promise<any> => {
    const url = `${API_BASE}${endpoint}`;

    // 1. Prepare headers
    const headers: Record<string, string> = {
        ...getAuthHeaders(),
        ...(options.headers as Record<string, string> || {})
    };

    // Auto-set Content-Type to JSON unless using FormData
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    // 2. Perform Request
    const performRequest = async (token?: string) => {
        const currentHeaders = { ...headers };
        if (token) currentHeaders['Authorization'] = `Bearer ${token}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(url, {
                ...options,
                headers: currentHeaders,
                credentials: 'include', // <--- IMPORTANT: Send cookies (CSRF & Refresh Token)
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    };

    try {
        let response = await performRequest();

        // --- FIX: Handle Mock Backend returning plain objects directly ---
        // If 'response' is a plain object and not a standard Response, return it immediately
        if (response && typeof (response as any).json !== 'function') {
            return response;
        }

        // 4. Handle 401 (Unauthorized) -> Try Refresh
        if (response.status === 401) {
            console.log('[FreshMart API] 401 detected, attempting refresh...');
            try {
                // Attempt refresh via HTTP-only cookie
                const refreshRes = await fetch(`${API_BASE}/refresh-token`, {
                    method: 'POST',
                    credentials: 'include'
                });

                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    if (data.accessToken) {
                        console.log('[FreshMart API] Refresh successful, retrying request...');
                        // Update memory token
                        setApiAccessToken(data.accessToken);
                        // Retry original request with new token
                        response = await performRequest(data.accessToken);
                    }
                } else {
                    console.log('[FreshMart API] Refresh failed');
                }
            } catch (err) {
                console.error('[FreshMart API] Error during auto-refresh:', err);
            }
        }

        // --- FIX: Safe Response Parsing ---
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { message: response.statusText || 'Request failed' };
            }
            throw new Error(errorData.message || errorData.error || 'Request failed');
        }

        // Check if response has content before parsing
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            // If response is not JSON (e.g., plain text), return text or empty object
            const text = await response.text();
            return text ? { message: text } : {};
        }

    } catch (error: any) {
        console.error('[FreshMart API] Request error:', error.message);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out.');
        }
        if (error.message?.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server.');
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
            // FormData REQUIRES strings, so we must stringify the object
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
                // --- FIX: Do NOT stringify nested objects when sending JSON content-type ---
                // The backend parser expects a JSON object here, not a string of JSON.
                bulkRule: product.bulkRule ? product.bulkRule : null
            })
        });
    },

    deleteProduct: async (id: string | number) => {
        return apiRequest(`/admin/products/${id}`, { method: 'DELETE' });
    },

    deleteCategory: async (category: string) => {
        return apiRequest(`/admin/categories/${encodeURIComponent(category)}`, { method: 'DELETE' });
    },

    // =====================
    // ORDER ENDPOINTS
    // =====================

    getOrders: async (userId?: number | string) => {
        const query = userId ? `?userId=${userId}` : '';
        return apiRequest(`/orders${query}`);
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
    },

    // =====================
    // STAFF ENDPOINTS
    // =====================

    getStaff: async () => {
        return apiRequest('/admin/staff');
    },

    createStaff: async (staffData: any) => {
        return apiRequest('/admin/staff', {
            method: 'POST',
            body: JSON.stringify(staffData)
        });
    },

    deleteStaff: async (id: string) => {
        return apiRequest(`/admin/staff/${id}`, { method: 'DELETE' });
    },
};

export default api;