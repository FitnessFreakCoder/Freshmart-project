import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useStore } from '../context/StoreContext';
import { UserRole } from '../types';
import { Bell, CheckCircle, Truck, Package } from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    title: string;
    type: 'info' | 'success' | 'warning';
}

const ToastNotification: React.FC = () => {
    const { socket } = useSocket();
    const { state, dispatch } = useStore(); // Access dispatch to update state
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        // Request notification permission
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    const showSystemNotification = (title: string, body: string) => {
        if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/vite.svg' });
        }
    };

    useEffect(() => {
        if (!socket) return;

        const handleNewOrder = (data: any) => {
            const message = `Order #${data.order.id} received (Rs. ${data.order.total})`;
            addToast(message, 'New Order', 'info');
            showSystemNotification('New Order Received', message);

            // Update global state with the new order
            dispatch({ type: 'RECEIVE_NEW_ORDER', payload: data.order });
        };

        const handleStatusUpdate = (data: any) => {
            // If the current user triggered this update, don't show toast
            if (state.user && data.updatedBy === state.user.id) return;

            const title = `Order ${data.status}`;
            addToast(data.message, title, 'success');
            showSystemNotification(title, data.message);

            // Update local state if the order is in the current list
            dispatch({
                type: 'UPDATE_ORDER_STATUS',
                payload: { id: data.orderId, status: data.status }
            });
        };

        socket.on('newOrderNotification', handleNewOrder);
        socket.on('orderStatusUpdated', handleStatusUpdate);

        return () => {
            socket.off('newOrderNotification', handleNewOrder);
            socket.off('orderStatusUpdated', handleStatusUpdate);
        };
    }, [socket, dispatch, state.user]);

    const addToast = (message: string, title: string, type: 'info' | 'success' | 'warning') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, title, type }]);
        setTimeout(() => removeToast(id), 5000);
    };

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div className="fixed top-20 right-4 z-[1000] space-y-3">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`
                        min-w-[300px] p-4 rounded-lg shadow-xl border-l-4 transition-all duration-500 transform translate-x-0
                        ${toast.type === 'info' ? 'bg-white border-blue-500' :
                            toast.type === 'success' ? 'bg-white border-green-500' : 'bg-white border-yellow-500'}
                    `}
                >
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${toast.type === 'info' ? 'bg-blue-100 text-blue-600' :
                            toast.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                            }`}>
                            {toast.type === 'info' ? <Bell size={20} /> : <CheckCircle size={20} />}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800">{toast.title}</h4>
                            <p className="text-sm text-gray-600">{toast.message}</p>
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="ml-auto text-gray-400 hover:text-gray-600"
                        >
                            &times;
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ToastNotification;
