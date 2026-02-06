import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Gift, X, Copy, Check } from 'lucide-react';

const SpecialCouponPopup: React.FC = () => {
    const { state } = useStore();
    const [visibleCoupon, setVisibleCoupon] = useState<any | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!state.user || state.coupons.length === 0) return;

        // Find special coupons for this user
        const mySpecialCoupons = state.coupons.filter(c => c.targetUsername === state.user?.username);

        if (mySpecialCoupons.length === 0) return;

        // Check local storage for seen coupons
        const seenCoupons = JSON.parse(localStorage.getItem('seen_special_coupons') || '[]');

        // Find the first unseen coupon
        const unseenCoupon = mySpecialCoupons.find(c => !seenCoupons.includes(c.code));

        if (unseenCoupon) {
            setVisibleCoupon(unseenCoupon);
        }

    }, [state.user, state.coupons]);

    const handleClose = () => {
        if (!visibleCoupon) return;

        // Mark as seen
        const seenCoupons = JSON.parse(localStorage.getItem('seen_special_coupons') || '[]');
        localStorage.setItem('seen_special_coupons', JSON.stringify([...seenCoupons, visibleCoupon.code]));

        setVisibleCoupon(null);
    };

    const handleCopy = () => {
        if (!visibleCoupon) return;
        navigator.clipboard.writeText(visibleCoupon.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!visibleCoupon) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden relative animate-in zoom-in-95 duration-300">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-3 right-3 p-1.5 bg-black/10 hover:bg-black/20 rounded-full transition-colors z-10"
                >
                    <X size={20} className="text-white" />
                </button>

                {/* Header with Gradient Background */}
                <div className="bg-gradient-to-br from-pink-500 to-orange-500 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <Gift size={32} className="text-pink-500 animate-bounce" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">You Found a Gift! 🎁</h2>
                        <p className="text-white/90 text-sm">
                            {visibleCoupon.giftMessage || "A special surprise just for you!"}
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-center text-gray-600 mb-4 text-sm">
                        Use this code at checkout to save <span className="font-bold text-pink-500">Rs. {visibleCoupon.discountAmount}</span> on your order!
                    </p>

                    <div
                        onClick={handleCopy}
                        className="bg-gray-50 border-2 border-dashed border-pink-200 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-pink-50 transition-colors group relative"
                    >
                        <div className="text-center w-full">
                            <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Coupon Code</span>
                            <span className="text-2xl font-black text-gray-800 tracking-widest group-hover:text-pink-600 transition-colors">
                                {visibleCoupon.code}
                            </span>
                        </div>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-pink-500">
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                        </div>
                    </div>

                    {copied && (
                        <p className="text-center text-xs text-green-600 font-bold mt-2">Copied to clipboard!</p>
                    )}

                    <button
                        onClick={handleClose}
                        className="w-full mt-6 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-transform active:scale-95"
                    >
                        Hooray! Thanks! 🎉
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SpecialCouponPopup;
