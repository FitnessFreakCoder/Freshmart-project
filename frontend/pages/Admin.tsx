import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useNavigate } from 'react-router-dom';
// Using the REAL API now instead of mockApi
import api from '../services/api';
import { Product, Order, OrderStatus, UserRole, Coupon } from '../types';
import { Edit, Trash, Package, Map, Tag, Plus, ExternalLink, User as UserIcon, Phone, Upload, X, Image as ImageIcon, Users, Calendar, ChevronDown, ChevronUp, Gift, ShoppingBag } from 'lucide-react';

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

const Admin: React.FC = () => {
    const { state, dispatch, isAdmin, isStaff } = useStore();
    const navigate = useNavigate();

    // Set default tab based on Role (Staff sees Orders by default, Admin sees Products)
    const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'coupons' | 'staff' | 'customers'>(isAdmin ? 'products' : 'orders');

    // Staff Management State
    const [staffList, setStaffList] = useState<any[]>([]);
    const [isAddingStaff, setIsAddingStaff] = useState(false);
    const [newStaff, setNewStaff] = useState({ username: '', email: '', password: '' });

    // Product State
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

    // Coupon State
    const [isAddingCoupon, setIsAddingCoupon] = useState(false);
    const [editingCouponCode, setEditingCouponCode] = useState<string | null>(null); // Track if editing
    const [newCoupon, setNewCoupon] = useState<Partial<Coupon>>({ code: '', discountAmount: 0, expiry: '', minOrderAmount: 0 });

    // Date Filter State for Orders
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
    const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

    // Category Management State
    const [showCategoryModal, setShowCategoryModal] = useState(false);

    // Customer Coupon State
    const [showCustomerCouponModal, setShowCustomerCouponModal] = useState(false);
    const [targetCustomer, setTargetCustomer] = useState<string | null>(null);
    const [customerCoupon, setCustomerCoupon] = useState<{
        code: string;
        discountAmount: number | string;
        expiry: string;
        giftMessage: string;
    }>({ code: '', discountAmount: '', expiry: '', giftMessage: 'Special gift from owner! 🎁' });

    useEffect(() => {
        // Basic protection - Allow if Admin OR Staff
        if (!state.user || (state.user.role !== UserRole.ADMIN && state.user.role !== UserRole.STAFF)) {
            navigate('/');
        }
    }, [state.user, navigate]);

    useEffect(() => {
        // If Staff logs in, force active tab to orders if it's set to restricted tabs
        if (isStaff && activeTab !== 'orders') {
            setActiveTab('orders');
        }
    }, [isStaff, activeTab]);

    useEffect(() => {
        // Refresh Data on mount
        const refresh = async () => {
            try {
                const prods = await api.getProducts();
                dispatch({ type: 'SET_PRODUCTS', payload: prods });

                // Staff & Admin can see orders
                const orders = await api.getOrders();
                dispatch({ type: 'SET_ORDERS', payload: orders });

                // Only Admin can see coupons
                if (isAdmin) {
                    const coupons = await api.getCoupons();
                    dispatch({ type: 'SET_COUPONS', payload: coupons });
                }
            } catch (error) {
                console.error("Error loading initial data", error);
            }
        };
        refresh();
    }, [dispatch, isAdmin]);

    // Load staff list when Staff tab is selected
    useEffect(() => {
        if (activeTab === 'staff' && isAdmin) {
            const loadStaff = async () => {
                try {
                    const staffData = await api.getStaff();
                    setStaffList(staffData);
                } catch (err) {
                    console.error('Failed to load staff:', err);
                }
            };
            loadStaff();
        }
    }, [activeTab, isAdmin]);

    const handleDeleteCategory = async (category: string) => {
        if (window.confirm(`Are you sure you want to delete category '${category}'? All associated products will be marked as 'Uncategorized'.`)) {
            try {
                await api.deleteCategory(category);
                // Refresh products to reflect category changes
                const prods = await api.getProducts();
                dispatch({ type: 'SET_PRODUCTS', payload: prods });
            } catch (error) {
                console.error("Failed to delete category:", error);
                alert("Failed to delete category.");
            }
        }
    };

    const handleProductSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;

        // Clean up bulk rule if incomplete
        let finalProduct = { ...editingProduct } as any;
        if (finalProduct.bulkRule && (!finalProduct.bulkRule.qty || !finalProduct.bulkRule.price)) {
            finalProduct.bulkRule = undefined;
        }

        // If we have a new image file, include it for upload
        // If imageUrl is already a URL (not base64), keep it; otherwise clear it so backend uses uploaded file
        const productToSave = {
            ...finalProduct,
            id: finalProduct.id || 0,
            imageFile: finalProduct.imageFile, // Include the file for FormData upload
            imageUrl: finalProduct.imageFile ? undefined : (finalProduct.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80')
        };

        try {
            await api.saveProduct(productToSave as Product);

            // Refresh products after save
            const prods = await api.getProducts();
            dispatch({ type: 'SET_PRODUCTS', payload: prods });
            setEditingProduct(null);
        } catch (error) {
            console.error("Save failed:", error);
            alert("Failed to save product.");
        }
    };

    // Helper to resolve image URL (handle relative /uploads/ paths from backend)
    const getImageUrl = (url: string) => {
        if (!url) return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';
        if (url.startsWith('/uploads/')) {
            return `https://freshmart-project.onrender.com${url}`;
        }
        return url;
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editingProduct) {
            // Validation: Check size
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert("Please use images smaller than 5MB.");
                return;
            }

            // Store the actual file for upload AND create Base64 for preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditingProduct({
                    ...editingProduct,
                    imageUrl: reader.result as string, // For preview
                    imageFile: file // For actual upload
                } as any);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleProductDelete = async (id: number | string) => {
        if (window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
            try {
                await api.deleteProduct(id);

                // Immediately fetch fresh data to update UI
                const prods = await api.getProducts();
                dispatch({ type: 'SET_PRODUCTS', payload: prods });

                // If we were editing this product, close the modal
                if (editingProduct && String(editingProduct.id) === String(id)) {
                    setEditingProduct(null);
                }
            } catch (error) {
                console.error("Delete failed:", error);
                alert("Failed to delete product. Please try again.");
            }
        }
    };

    // CREATE OR UPDATE COUPON
    const handleSaveCoupon = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newCoupon.code && newCoupon.discountAmount && newCoupon.expiry) {
            try {
                if (editingCouponCode) {
                    // Update Existing
                    await api.updateCoupon(editingCouponCode, newCoupon as Coupon);
                } else {
                    // Create New
                    await api.createCoupon(newCoupon as Coupon);
                }

                // Refetch to stay in sync
                const coupons = await api.getCoupons();
                dispatch({ type: 'SET_COUPONS', payload: coupons });

                setIsAddingCoupon(false);
                setEditingCouponCode(null);
                setNewCoupon({ code: '', discountAmount: 0, expiry: '', minOrderAmount: 0 });
            } catch (err: any) {
                alert(err.message || 'Failed to save coupon');
            }
        }
    };

    // PREPARE EDIT MODE
    const handleEditCoupon = (coupon: Coupon) => {
        setNewCoupon(coupon);
        setEditingCouponCode(coupon.code);
        setIsAddingCoupon(true);
    };

    const handleCancelCouponEdit = () => {
        setIsAddingCoupon(false);
        setEditingCouponCode(null);
        setNewCoupon({ code: '', discountAmount: 0, expiry: '', minOrderAmount: 0 });
    };

    const handleDeleteCoupon = async (code: string) => {
        if (window.confirm("Are you sure you want to delete this coupon?")) {
            await api.deleteCoupon(code);

            // Refetch data from backend to ensure state is synchronized
            const coupons = await api.getCoupons();
            dispatch({ type: 'SET_COUPONS', payload: coupons });

            // If we were editing this coupon, close the form
            if (editingCouponCode === code) {
                handleCancelCouponEdit();
            }
        }
    };

    const updateStatus = async (id: string, status: OrderStatus) => {
        await api.updateOrderStatus(id, status);
        dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id, status } });
    };

    // Unique dates for dropdown filter
    const uniqueDates = useMemo(() => {
        const dates: Record<string, string> = {};
        state.orders.forEach(o => {
            const key = getDateKey(o.createdAt);
            const label = getDateLabel(o.createdAt);
            dates[key] = label;
        });
        return Object.entries(dates).sort((a, b) => b[0].localeCompare(a[0]));
    }, [state.orders]);

    // Filter and group orders by date
    const groupedOrders = useMemo(() => {
        let filtered = state.orders;

        if (selectedDateFilter !== 'all') {
            filtered = state.orders.filter(o => getDateKey(o.createdAt) === selectedDateFilter);
        }

        const groups: Record<string, Order[]> = {};
        filtered.forEach(order => {
            const key = getDateKey(order.createdAt);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(order);
        });

        return Object.entries(groups)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([dateKey, orders]) => ({
                dateKey,
                dateLabel: getDateLabel(orders[0].createdAt),
                orders
            }));
    }, [state.orders, selectedDateFilter]);

    // Toggle date group expansion
    const toggleDateGroup = (dateKey: string) => {
        setExpandedDates(prev => ({ ...prev, [dateKey]: prev[dateKey] === undefined ? false : !prev[dateKey] }));
    };

    // Customer stats aggregation - sorted by order count (highest to lowest)
    const customerStats = useMemo(() => {
        const stats: Record<string, { username: string; orderCount: number; totalSpent: number; lastOrder: string }> = {};

        state.orders.forEach(order => {
            const username = order.username || 'Unknown';
            if (!stats[username]) {
                stats[username] = {
                    username,
                    orderCount: 0,
                    totalSpent: 0,
                    lastOrder: order.createdAt
                };
            }
            stats[username].orderCount++;
            stats[username].totalSpent += order.finalTotal;
            if (new Date(order.createdAt) > new Date(stats[username].lastOrder)) {
                stats[username].lastOrder = order.createdAt;
            }
        });

        return Object.values(stats).sort((a, b) => b.orderCount - a.orderCount);
    }, [state.orders]);

    // Handle creating customer-specific coupon
    const handleCreateCustomerCoupon = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetCustomer || !customerCoupon.code) return;

        try {
            await api.createCoupon({
                code: customerCoupon.code.toUpperCase(),
                discountAmount: Number(customerCoupon.discountAmount),
                expiry: customerCoupon.expiry,
                minOrderAmount: 0,
                targetUsername: targetCustomer,
                giftMessage: customerCoupon.giftMessage || 'Special gift from owner! 🎁'
            });

            // Refresh coupons
            const coupons = await api.getCoupons();
            dispatch({ type: 'SET_COUPONS', payload: coupons });

            // Reset state
            setShowCustomerCouponModal(false);
            setTargetCustomer(null);
            setCustomerCoupon({ code: '', discountAmount: '', expiry: '', giftMessage: 'Special gift from owner! 🎁' });
        } catch (error) {
            console.error('Error creating customer coupon:', error);
        }
    };

    if (!state.user || (!isAdmin && !isStaff)) return <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {isAdmin ? 'Admin Dashboard' : 'Staff Dashboard'}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {isAdmin ? 'Manage your inventory, orders, and discounts' : 'Manage and update order status'}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('products')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-indigo-600'}`}
                            >
                                Products
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-indigo-600'}`}
                        >
                            Orders
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('coupons')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'coupons' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-indigo-600'}`}
                            >
                                Coupons
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('staff')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'staff' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-indigo-600'}`}
                            >
                                Staff
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('customers')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'customers' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-indigo-600'}`}
                            >
                                Customers
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {activeTab === 'products' && isAdmin && (
                <div className="space-y-6">
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setShowCategoryModal(true)}
                            className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm font-medium transition-colors"
                        >
                            <Tag size={18} /> Manage Categories
                        </button>
                        <button
                            onClick={() => setEditingProduct({ name: '', price: 0, originalPrice: 0, stock: 0, category: '', imageUrl: '', unit: '', bulkRule: { qty: 0, price: 0 } })}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 shadow-sm font-bold"
                        >
                            <Plus size={18} /> Add New Product
                        </button>
                    </div>

                    {/* Manage Categories Modal */}
                    {showCategoryModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-gray-800">Manage Categories</h2>
                                    <button onClick={() => setShowCategoryModal(false)} className="text-gray-500 hover:text-gray-700">
                                        <X size={20} />
                                    </button>
                                </div>
                                <p className="text-sm text-gray-500 mb-4">
                                    Deleting a category will move all associated products to "Uncategorized".
                                </p>
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                    {Array.from(new Set(state.products.map(p => p.category).filter(Boolean)))
                                        .sort()
                                        .filter(cat => cat !== 'Uncategorized')
                                        .map(cat => (
                                            <div key={cat} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                <span className="font-medium text-gray-900">{cat}</span>
                                                <button
                                                    onClick={() => handleDeleteCategory(cat)}
                                                    className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                    title="Delete Category"
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    {Array.from(new Set(state.products.map(p => p.category).filter(Boolean))).length === 0 && (
                                        <p className="text-center text-gray-500 py-4">No categories found.</p>
                                    )}
                                </div>
                                <div className="mt-6 flex justify-end">
                                    <button
                                        onClick={() => setShowCategoryModal(false)}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Product Form Modal */}
                    {editingProduct && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold">{editingProduct.id ? 'Edit' : 'Add'} Product</h2>
                                    <button onClick={() => setEditingProduct(null)} className="text-gray-500 hover:text-gray-700">
                                        <X size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleProductSave} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Product Name</label>
                                        <input
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none text-gray-900"
                                            value={editingProduct.name || ''}
                                            onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Sale Price (Rs.)</label>
                                            <input
                                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none text-gray-900"
                                                type="number" step="0.01"
                                                value={editingProduct.price || ''}
                                                onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Regular Price (MRP)</label>
                                            <input
                                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-900"
                                                type="number" step="0.01"
                                                value={editingProduct.originalPrice || ''}
                                                onChange={e => setEditingProduct({ ...editingProduct, originalPrice: parseFloat(e.target.value) })}
                                                placeholder="Optional"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Unit (e.g. 1kg)</label>
                                            <input
                                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none text-gray-900"
                                                value={editingProduct.unit || ''}
                                                onChange={e => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                                                placeholder="e.g. 500ml"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Stock Qty</label>
                                            <input
                                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none text-gray-900"
                                                type="number"
                                                value={editingProduct.stock || ''}
                                                onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                                        <div className="relative">
                                            <input
                                                list="category-options"
                                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none text-gray-900"
                                                value={editingProduct.category || ''}
                                                onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}
                                                placeholder="Select or type new category"
                                                required
                                            />
                                            <datalist id="category-options">
                                                {Array.from(new Set(state.products.map(p => p.category).filter(Boolean))).sort().map(cat => (
                                                    <option key={cat} value={cat} />
                                                ))}
                                            </datalist>
                                        </div>
                                    </div>

                                    {/* Bulk Rule Section */}
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                        <h3 className="text-sm font-bold text-yellow-800 mb-2 flex items-center gap-1">
                                            <Tag size={14} /> Bulk Pricing Strategy
                                        </h3>
                                        <p className="text-xs text-yellow-700 mb-2">
                                            Example: 1 item is Rs. 20. But if user buys 6, total is Rs. 100.
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-yellow-800 mb-1">Buy Quantity</label>
                                                <input
                                                    className="w-full border border-yellow-300 p-2 rounded focus:ring-2 focus:ring-yellow-500 outline-none text-gray-900"
                                                    type="number"
                                                    value={editingProduct.bulkRule?.qty || ''}
                                                    onChange={e => setEditingProduct({
                                                        ...editingProduct,
                                                        bulkRule: {
                                                            qty: parseInt(e.target.value),
                                                            price: editingProduct.bulkRule?.price || 0
                                                        }
                                                    })}
                                                    placeholder="e.g. 6"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-yellow-800 mb-1">Bundle Price (Rs.)</label>
                                                <input
                                                    className="w-full border border-yellow-300 p-2 rounded focus:ring-2 focus:ring-yellow-500 outline-none text-gray-900"
                                                    type="number" step="0.01"
                                                    value={editingProduct.bulkRule?.price || ''}
                                                    onChange={e => setEditingProduct({
                                                        ...editingProduct,
                                                        bulkRule: {
                                                            qty: editingProduct.bulkRule?.qty || 0,
                                                            price: parseFloat(e.target.value)
                                                        }
                                                    })}
                                                    placeholder="e.g. 100.00"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Image Upload Input */}
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
                                        <label className="block cursor-pointer w-full h-full">
                                            <div className="flex flex-col items-center gap-2">
                                                <Upload className="text-indigo-500" size={24} />
                                                <span className="text-sm font-medium text-gray-700">
                                                    Click to Upload Image
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    (PNG, JPG - Max 5MB)
                                                </span>
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                            />
                                        </label>
                                    </div>

                                    {/* Image Preview */}
                                    {editingProduct.imageUrl && (
                                        <div className="mt-2 flex items-center justify-between bg-gray-50 p-2 rounded border">
                                            <div className="flex items-center gap-4">
                                                <img
                                                    src={editingProduct.imageUrl}
                                                    alt="Preview"
                                                    className="h-16 w-16 object-contain rounded bg-white border"
                                                />
                                                <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <ImageIcon size={14} /> Image Loaded
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setEditingProduct({
                                                    ...editingProduct,
                                                    imageUrl: '',
                                                    imageFile: undefined
                                                } as any)}
                                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                                title="Remove Image"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex gap-3 justify-end mt-6">
                                        <button type="button" onClick={() => setEditingProduct(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Save Product</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Mobile View: Product Cards */}
                    <div className="md:hidden space-y-4">
                        {state.products.map(p => (
                            <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-start gap-4">
                                <img className="h-16 w-16 rounded-lg object-cover bg-gray-50" src={getImageUrl(p.imageUrl)} alt={p.name} />
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-gray-900">{p.name}</h3>
                                            <p className="text-xs text-gray-500">{p.category}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setEditingProduct(p)}
                                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                                                title="Edit"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleProductDelete(p.id)}
                                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                                title="Delete"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-2 flex items-center justify-between text-sm">
                                        <span className="font-bold text-gray-900">Rs. {p.price.toFixed(2)}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.stock > 10 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            Stock: {p.stock}
                                        </span>
                                    </div>

                                    {p.bulkRule && (
                                        <div className="mt-2 text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded inline-block font-medium border border-yellow-100">
                                            Buy {p.bulkRule.qty} for Rs. {p.bulkRule.price}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop View: Product Table */}
                    <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden border border-gray-100">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price Info</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offers</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {state.products.map(p => (
                                    <tr key={p.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 flex-shrink-0">
                                                    <img className="h-10 w-10 rounded-full object-cover" src={getImageUrl(p.imageUrl)} alt="" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                                    <div className="text-xs text-gray-500">{p.category} • {p.unit}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 font-bold">Rs. {p.price.toFixed(2)}</div>
                                            {p.originalPrice && (
                                                <div className="text-xs text-gray-400 line-through">MRP: Rs. {p.originalPrice.toFixed(2)}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {p.bulkRule ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                                    Buy {p.bulkRule.qty} for Rs. {p.bulkRule.price}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.stock > 10 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {p.stock}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingProduct(p); }}
                                                className="text-indigo-600 hover:text-indigo-900 mr-4 p-2"
                                                title="Edit"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleProductDelete(p.id); }}
                                                className="text-red-600 hover:text-red-900 p-2"
                                                title="Delete"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div >
            )}

            {activeTab === 'coupons' && isAdmin && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-800">Active Coupons</h2>
                        <button
                            onClick={() => {
                                setIsAddingCoupon(true);
                                setEditingCouponCode(null);
                                setNewCoupon({ code: '', discountAmount: 0, expiry: '', minOrderAmount: 0 });
                            }}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm"
                        >
                            <Plus size={18} /> Create Coupon
                        </button>
                    </div>

                    {isAddingCoupon && (
                        <div className="bg-indigo-50 p-6 rounded-lg mb-8 border border-indigo-100">
                            <h3 className="text-lg font-bold text-indigo-900 mb-4">
                                {editingCouponCode ? 'Edit Coupon' : 'Create New Discount'}
                            </h3>
                            <form onSubmit={handleSaveCoupon} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-semibold text-indigo-800 mb-1">Code</label>
                                    <input
                                        className="w-full border p-2 rounded uppercase"
                                        placeholder="NEPAL100"
                                        value={newCoupon.code}
                                        onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-indigo-800 mb-1">Amount (Rs.)</label>
                                    <input
                                        className="w-full border p-2 rounded"
                                        type="number"
                                        placeholder="100"
                                        value={newCoupon.discountAmount || ''}
                                        onChange={e => setNewCoupon({ ...newCoupon, discountAmount: parseFloat(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-indigo-800 mb-1">Min Order Amount (Rs.)</label>
                                    <input
                                        className="w-full border p-2 rounded"
                                        type="number"
                                        placeholder="0"
                                        value={newCoupon.minOrderAmount || ''}
                                        onChange={e => setNewCoupon({ ...newCoupon, minOrderAmount: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-indigo-800 mb-1">Expiry Date</label>
                                    <input
                                        className="w-full border p-2 rounded"
                                        type="date"
                                        value={newCoupon.expiry}
                                        onChange={e => setNewCoupon({ ...newCoupon, expiry: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={handleCancelCouponEdit} className="px-4 py-2 text-indigo-600 hover:bg-indigo-100 rounded">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex-1">Save</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {state.coupons.filter(c => !c.targetUsername).map((coupon, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-indigo-500 flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Tag className="text-indigo-500" size={18} />
                                        <span className="text-xl font-bold text-gray-900 tracking-wider">{coupon.code}</span>
                                    </div>
                                    <p className="text-sm text-gray-500">Expires: {coupon.expiry}</p>
                                    {coupon.minOrderAmount ? (
                                        <p className="text-xs text-orange-600 mt-1 font-medium">Min Order: Rs. {coupon.minOrderAmount}</p>
                                    ) : (
                                        <p className="text-xs text-green-600 mt-1 font-medium">No Minimum Limit</p>
                                    )}
                                </div>
                                <div className="text-right flex flex-col items-end justify-between h-full">
                                    <div>
                                        <span className="block text-2xl font-bold text-green-600">-Rs.{coupon.discountAmount}</span>
                                        <span className="text-xs text-gray-400">OFF</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-2">
                                        <button
                                            onClick={() => handleEditCoupon(coupon)}
                                            className="text-indigo-400 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-50 transition"
                                            title="Edit Coupon"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCoupon(coupon.code)}
                                            className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition"
                                            title="Delete Coupon"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'orders' && (isAdmin || isStaff) && (
                <div className="space-y-6">
                    {/* Stats and Filter Row */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                        <div className="flex items-center gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Total Orders</p>
                                    <h3 className="text-2xl font-bold text-gray-900">{state.orders.length}</h3>
                                </div>
                            </div>
                        </div>
                        {/* Date Filter Dropdown */}
                        <div className="relative">
                            <select
                                value={selectedDateFilter}
                                onChange={(e) => setSelectedDateFilter(e.target.value)}
                                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
                            >
                                <option value="all">All Orders</option>
                                {uniqueDates.map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Grouped Orders by Date */}
                    {groupedOrders.map(({ dateKey, dateLabel, orders }) => (
                        <div key={dateKey} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Date Header - Collapsible */}
                            <button
                                onClick={() => toggleDateGroup(dateKey)}
                                className="w-full px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200 flex items-center justify-between hover:from-indigo-100 hover:to-purple-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-5 w-5 text-indigo-600" />
                                    <span className="font-bold text-gray-800">{dateLabel}</span>
                                    <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                                        {orders.length} order{orders.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                                {expandedDates[dateKey] !== false ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                            </button>

                            {/* Orders in this date group */}
                            {expandedDates[dateKey] !== false && (
                                <div className="divide-y divide-gray-100">
                                    {orders.map(order => (
                                        <div key={order.id} className="p-6">
                                            <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4 border-b pb-4">
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900">Order #{order.id}</h3>
                                                    <p className="text-sm text-gray-500">Placed on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}</p>
                                                    <div className="flex items-center gap-4 mt-2">
                                                        <div className="flex items-center gap-1 text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
                                                            <UserIcon size={14} />
                                                            <span>{order.username || 'Unknown Customer'}</span>
                                                        </div>
                                                        {order.mobileNumber && (
                                                            <div className="flex items-center gap-1 text-sm font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full">
                                                                <Phone size={14} />
                                                                <span>{order.mobileNumber}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-right mr-4">
                                                        <div className="text-2xl font-bold text-gray-900">Rs. {order.finalTotal.toFixed(2)}</div>
                                                        <div className="text-xs text-gray-400 uppercase">Total Paid</div>
                                                    </div>
                                                    <select
                                                        value={order.status}
                                                        onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                                                        className={`text-sm font-bold px-3 py-2 rounded-lg border cursor-pointer outline-none ${order.status === OrderStatus.DELIVERED ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                                                            }`}
                                                    >
                                                        {Object.values(OrderStatus).map(s => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-8">
                                                {/* Order Items */}
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Items Ordered</h4>
                                                    <ul className="space-y-3">
                                                        {order.items.map(item => (
                                                            <li key={item.id} className="flex justify-between text-sm items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-gray-600">{item.quantity}x</span>
                                                                    <span className="text-gray-800">{item.name}</span>
                                                                </div>
                                                                <span className="text-gray-600">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <div className="mt-4 pt-3 border-t space-y-1">
                                                        <div className="flex justify-between text-sm text-gray-500">
                                                            <span>Subtotal</span>
                                                            <span>Rs. {order.total.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm text-green-600">
                                                            <span>Discount</span>
                                                            <span>-Rs. {order.discount.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm text-gray-600">
                                                            <span>Delivery</span>
                                                            <span>{order.deliveryCharge && order.deliveryCharge > 0 ? `Rs. ${order.deliveryCharge}` : 'Free'}</span>
                                                        </div>
                                                        <div className="flex justify-between font-bold text-gray-900 pt-2">
                                                            <span>Final Total</span>
                                                            <span>Rs. {order.finalTotal.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Location Map View */}
                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col">
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                                                        <Map size={14} /> Delivery Details
                                                    </h4>
                                                    <div className="flex-grow">
                                                        <p className="text-sm font-semibold text-gray-900 mb-1">{order.location.address}</p>
                                                        <p className="text-xs text-gray-500 font-mono mb-4">Lat: {order.location.lat}, Lng: {order.location.lng}</p>
                                                    </div>

                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${order.location.lat},${order.location.lng}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="mt-auto w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                                                    >
                                                        <ExternalLink size={16} /> Open in Google Maps
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'staff' && isAdmin && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800">Staff Management</h2>
                            <p className="text-sm text-gray-500">Create and manage staff accounts</p>
                        </div>
                        <button
                            onClick={() => {
                                setIsAddingStaff(true);
                                setNewStaff({ username: '', email: '', password: '' });
                            }}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm"
                        >
                            <Plus size={18} /> Add Staff
                        </button>
                    </div>

                    {/* Add Staff Form */}
                    {isAddingStaff && (
                        <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-100">
                            <h3 className="text-lg font-bold text-indigo-900 mb-4">Create New Staff Account</h3>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (newStaff.username && newStaff.email && newStaff.password) {
                                    try {
                                        await api.createStaff(newStaff);
                                        alert('Staff account created successfully!');
                                        setIsAddingStaff(false);
                                        setNewStaff({ username: '', email: '', password: '' });
                                        // Refresh staff list
                                        const staffData = await api.getStaff();
                                        setStaffList(staffData);
                                    } catch (err: any) {
                                        alert(err.message || 'Error creating staff account');
                                    }
                                }
                            }} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-semibold text-indigo-800 mb-1">Username</label>
                                    <input
                                        className="w-full border p-2 rounded"
                                        placeholder="staffuser"
                                        value={newStaff.username}
                                        onChange={e => setNewStaff({ ...newStaff, username: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-indigo-800 mb-1">Email</label>
                                    <input
                                        className="w-full border p-2 rounded"
                                        type="email"
                                        placeholder="staff@freshmart.com"
                                        value={newStaff.email}
                                        onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-indigo-800 mb-1">Password</label>
                                    <input
                                        className="w-full border p-2 rounded"
                                        type="password"
                                        placeholder="••••••••"
                                        value={newStaff.password}
                                        onChange={e => setNewStaff({ ...newStaff, password: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setIsAddingStaff(false)} className="px-4 py-2 text-indigo-600 hover:bg-indigo-100 rounded">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex-1">Create</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Staff List */}
                    <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {staffList.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                                            <Users size={32} className="mx-auto mb-2 opacity-50" />
                                            <p>No staff members yet. Click "Add Staff" to create one.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    staffList.map((staff) => (
                                        <tr key={staff.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 flex-shrink-0 bg-indigo-100 rounded-full flex items-center justify-center">
                                                        <UserIcon className="text-indigo-600" size={20} />
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">{staff.username}</div>
                                                        <div className="text-xs text-indigo-500 font-semibold">STAFF</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.email}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {staff.createdAt ? new Date(staff.createdAt).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={async () => {
                                                        if (window.confirm(`Are you sure you want to delete staff "${staff.username}"?`)) {
                                                            try {
                                                                await api.deleteStaff(staff.id);
                                                                setStaffList(staffList.filter(s => s.id !== staff.id));
                                                            } catch (err) {
                                                                alert('Error deleting staff');
                                                            }
                                                        }
                                                    }}
                                                    className="text-red-600 hover:text-red-900 p-2"
                                                    title="Delete Staff"
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* CUSTOMERS TAB - Admin Only */}
            {activeTab === 'customers' && isAdmin && (
                <div className="space-y-6">
                    {/* Stats Card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                                <Users size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Total Customers</p>
                                <h3 className="text-2xl font-bold text-gray-900">{customerStats.length}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100 flex items-center gap-4">
                            <div className="p-3 bg-green-50 text-green-600 rounded-full">
                                <ShoppingBag size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Total Orders</p>
                                <h3 className="text-2xl font-bold text-gray-900">{state.orders.length}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Customer List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Users size={18} className="text-indigo-600" />
                                Customer Orders (Highest to Lowest)
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-3">Rank</th>
                                        <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-3">Customer</th>
                                        <th className="text-center text-xs font-bold text-gray-500 uppercase px-6 py-3">Orders</th>
                                        <th className="text-right text-xs font-bold text-gray-500 uppercase px-6 py-3">Total Spent</th>
                                        <th className="text-center text-xs font-bold text-gray-500 uppercase px-6 py-3">Last Order</th>
                                        <th className="text-center text-xs font-bold text-gray-500 uppercase px-6 py-3">Active Gifts</th>
                                        <th className="text-center text-xs font-bold text-gray-500 uppercase px-6 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {customerStats.map((customer, index) => (
                                        <tr key={customer.username} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                    index === 1 ? 'bg-gray-100 text-gray-700' :
                                                        index === 2 ? 'bg-orange-100 text-orange-700' :
                                                            'bg-indigo-50 text-indigo-600'
                                                    }`}>
                                                    #{index + 1}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                                        <UserIcon size={18} className="text-indigo-600" />
                                                    </div>
                                                    <span className="font-medium text-gray-800">{customer.username}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                                                    {customer.orderCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-green-600">
                                                Rs. {customer.totalSpent.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm text-gray-500">
                                                {new Date(customer.lastOrder).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1 justify-center max-w-[200px] mx-auto">
                                                    {state.coupons.filter(c => c.targetUsername === customer.username).length > 0 ? (
                                                        state.coupons.filter(c => c.targetUsername === customer.username).map(c => (
                                                            <span key={c.code} className="px-2 py-1 bg-pink-100 text-pink-700 text-xs font-bold rounded shadow-sm border border-pink-200">
                                                                {c.code}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">None</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => {
                                                        setTargetCustomer(customer.username);
                                                        setShowCustomerCouponModal(true);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-medium rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all shadow-sm"
                                                >
                                                    <Gift size={14} />
                                                    Gift Coupon
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Customer Coupon Modal */}
                    {showCustomerCouponModal && targetCustomer && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                                <div className="bg-gradient-to-r from-pink-500 to-orange-500 px-6 py-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Gift size={20} /> Gift Coupon
                                        </h3>
                                        <button
                                            onClick={() => {
                                                setShowCustomerCouponModal(false);
                                                setTargetCustomer(null);
                                            }}
                                            className="text-white/80 hover:text-white"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <p className="text-white/90 text-sm mt-1">
                                        Create a special coupon for <span className="font-bold">{targetCustomer}</span>
                                    </p>
                                </div>
                                <form onSubmit={handleCreateCustomerCoupon} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
                                        <input
                                            type="text"
                                            value={customerCoupon.code}
                                            onChange={(e) => setCustomerCoupon({ ...customerCoupon, code: e.target.value.toUpperCase() })}
                                            placeholder="e.g. GIFT50"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Discount Amount (Rs.)</label>
                                        <input
                                            type="number"
                                            value={customerCoupon.discountAmount}
                                            onChange={(e) => setCustomerCoupon({ ...customerCoupon, discountAmount: e.target.value === '' ? '' : Number(e.target.value) })}
                                            placeholder="50"
                                            min="1"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                                        <input
                                            type="date"
                                            value={customerCoupon.expiry}
                                            onChange={(e) => setCustomerCoupon({ ...customerCoupon, expiry: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Gift Message</label>
                                        <input
                                            type="text"
                                            value={customerCoupon.giftMessage}
                                            onChange={(e) => setCustomerCoupon({ ...customerCoupon, giftMessage: e.target.value })}
                                            placeholder="Special gift from owner!"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div className="bg-pink-50 p-3 rounded-lg border border-pink-100">
                                        <p className="text-sm text-pink-700">
                                            <strong>Note:</strong> This coupon will only be visible to and usable by <span className="font-bold">{targetCustomer}</span>.
                                        </p>
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all shadow-md"
                                    >
                                        🎁 Create Gift Coupon
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div >
    );
};

export default Admin;