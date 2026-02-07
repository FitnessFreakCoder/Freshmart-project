
import React from 'react';
import { useStore } from '../context/StoreContext';
import ProductCard from '../components/ProductCard';
import { Search, ChevronRight, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
    const { state, dispatch } = useStore();
    const navigate = useNavigate();
    const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [selectedCategory, setSelectedCategory] = React.useState('All');

    // Extract Categories
    const categories = ['All', ...Array.from(new Set(state.products.map(p => p.category)))];

    // Fetch coupons on mount
    React.useEffect(() => {
        const fetchCoupons = async () => {
            try {
                const coupons = await import('../services/mockBackend').then(m => m.mockApi.getCoupons());
                // We should ideally dispatch this to store, but for now we can just use local state or dispatch if store has coupons
                // state.coupons is available in store, let's dispatch
                dispatch({ type: 'SET_COUPONS', payload: coupons });
            } catch (err) {
                console.error("Failed to fetch coupons", err);
            }
        };
        fetchCoupons();
    }, [dispatch]);

    const filteredProducts = state.products.filter(p => {
        const term = search.toLowerCase().trim();
        // If we have a search term, we do a global search across Name and Category
        // We ignore the selectedCategory because we auto-set it to 'All' on input change, 
        // but even if we didn't, a global search usually overrides filters in this UX pattern.
        if (term) {
            return p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term);
        }
        // Otherwise apply category filter
        return selectedCategory === 'All' || p.category === selectedCategory;
    });

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

            {/* Header / Search Bar Area */}
            <div className="mb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Groceries & Essentials</h1>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="K chaiyo khojnu hoss......"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-shadow text-gray-900 placeholder-gray-400"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            if (e.target.value) setSelectedCategory('All');
                        }}
                    />
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">

                {/* Sidebar */}
                <aside className="w-full md:w-64 flex-shrink-0 md:sticky md:top-24 space-y-6">
                    {/* Categories */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 hidden md:block">
                            <h2 className="font-bold text-gray-700">Categories</h2>
                        </div>
                        {/* Mobile: Horizontal Scroll | Desktop: Vertical List */}
                        <ul className="flex md:flex-col overflow-x-auto md:overflow-visible p-3 md:p-0 gap-3 md:gap-0 md:divide-y md:divide-gray-100">
                            {categories.map(c => (
                                <li key={c} className="flex-shrink-0">
                                    <button
                                        onClick={() => setSelectedCategory(c)}
                                        className={`
                                    text-sm font-medium transition-all
                                    
                                    /* Mobile: Rectangle Box */
                                    px-4 py-2 rounded-lg border shadow-sm
                                    
                                    /* Desktop: Sidebar Item */
                                    md:shadow-none md:w-full md:text-left md:px-4 md:py-3 md:rounded-none md:border-0 md:border-l-4 md:flex md:justify-between md:items-center

                                    ${selectedCategory === c
                                                ? 'bg-green-600 text-white border-green-600 md:bg-green-50 md:text-green-600 md:border-l-green-600'
                                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 md:border-l-transparent'
                                            }
                                `}
                                    >
                                        {c}
                                        <span className="hidden md:inline">{selectedCategory === c && <ChevronRight size={16} />}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Delivery Charges Info Box */}
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-900">
                        <h3 className="font-bold flex items-center gap-2 mb-2">
                            <Truck size={18} className="text-blue-600" />
                            Delivery Charges
                        </h3>
                        <ul className="space-y-2 text-sm">
                            <li className="flex justify-between">
                                <span>Below Rs. 1000</span>
                                <span className="font-bold">Rs. 50</span>
                            </li>
                            <li className="flex justify-between">
                                <span>Rs. 1000 - 3000</span>
                                <span className="font-bold">Rs. 25</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span>Above Rs. 3000</span>
                                <span className="bg-green-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">Free</span>
                            </li>
                        </ul>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 w-full">

                    {/* Promo Banner */}
                    {!search && (
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 md:p-8 text-white mb-8 shadow-lg relative overflow-hidden">
                            <div className="relative z-10 text-left">
                                <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded mb-2 inline-block"> DELIVERY within 30 minutes</span>
                                <h2 className="text-3xl font-bold mb-2">Fresh Groceries in Minutes</h2>
                                <p className="text-emerald-50 max-w-md">Get fresh daily grocery essentials delivered to your doorstep faster than ever.</p>
                            </div>
                            <div className="absolute right-0 bottom-0 opacity-20 transform translate-y-1/4 translate-x-1/4">
                                <div className="w-64 h-64 bg-white rounded-full blur-3xl"></div>
                            </div>
                        </div>
                    )}

                    {/* Product Grid Header */}
                    <div className="mb-4 flex items-baseline justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {search ? `Search Results for "${search}"` : (selectedCategory === 'All' ? 'All Products' : selectedCategory)}
                            </h2>
                            {search && (
                                <button onClick={() => setSearch('')} className="text-sm text-red-500 hover:underline">Clear Search</button>
                            )}
                        </div>
                        <span className="text-sm text-gray-500">{filteredProducts.length} items</span>
                    </div>

                    {filteredProducts.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredProducts.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
                            <div className="inline-block p-4 bg-gray-50 rounded-full mb-4">
                                <Search className="h-8 w-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
                            <p className="text-gray-500">We couldn't find anything matching "{search}".</p>
                            <button onClick={() => setSearch('')} className="mt-4 text-green-600 font-bold hover:underline">View All Products</button>
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
};

export default Home;
