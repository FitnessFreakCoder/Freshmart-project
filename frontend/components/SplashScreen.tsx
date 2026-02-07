import React from 'react';
import { ShoppingBag } from 'lucide-react';

const SplashScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-green-600 overflow-hidden">
            {/* Background Circles for visual interest */}
            <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-green-500 rounded-full opacity-50 blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-emerald-500 rounded-full opacity-50 blur-3xl animate-pulse delay-700"></div>

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center">
                {/* Bouncing Icon */}
                <div className="bg-white p-6 rounded-full shadow-xl mb-8 animate-bounce">
                    <ShoppingBag size={48} className="text-green-600" />
                </div>

                {/* Animated Text */}
                <h1 className="text-5xl font-extrabold text-white tracking-tight mb-2 animate-fade-in-up">
                    Freshmart<span className="text-yellow-400 animate-pulse">.</span>
                </h1>

                <p className="text-green-100 text-lg font-medium tracking-wide animate-fade-in-up delay-200">
                    Freshness Delivered Daily
                </p>

                {/* Loading Indicator */}
                <div className="mt-12 flex space-x-2">
                    <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-100"></div>
                    <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-200"></div>
                    <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-300"></div>
                </div>
            </div>

            {/* Custom Keyframe Styles (Tailwind usually needs config for this, but we can inject style tag for portability) */}
            <style>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.8s ease-out forwards;
                }
                .delay-200 { animation-delay: 0.2s; }
            `}</style>
        </div>
    );
};

export default SplashScreen;
