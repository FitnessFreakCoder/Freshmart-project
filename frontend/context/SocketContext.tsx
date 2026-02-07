import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../context/StoreContext'; // Adjusted path if needed
import { UserRole } from '../types';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const useSocket = () => useContext(SocketContext);

// 1. Define URL outside component or strictly inside effect to avoid re-declarations
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { state } = useStore();
    const user = state.user;

    useEffect(() => {
        // 2. Initialize Socket with correct configuration
        const newSocket = io(SOCKET_URL, {
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        // Connection Event Listeners
        newSocket.on('connect', () => {
            console.log('✅ Socket connected:', newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('connect_error', (err) => {
            console.error('❌ Socket Connection Error:', err.message);
            setIsConnected(false);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('⚠️ Socket disconnected:', reason);
            setIsConnected(false);
        });

        setSocket(newSocket);

        // Cleanup on unmount
        return () => {
            if (newSocket) {
                console.log('🔌 Disconnecting socket...');
                newSocket.disconnect();
            }
        };
    }, []); // Empty dependency array = runs once on mount

    // 3. Handle Room Joining (Runs when socket or user changes)
    useEffect(() => {
        if (!socket || !isConnected || !user) return;

        console.log(`👤 Joining personal room: user_${user.id}`);
        socket.emit('join_room', `user_${user.id}`);

        if (user.role === 'ADMIN') {
            console.log('🛡️ Joining Admin Room');
            socket.emit('join_room', 'admin_room');
        }

        if (user.role === 'STAFF' || user.role === 'ADMIN') {
            // Often Admins also need to hear Staff alerts, if not, remove the OR condition
            console.log('👷 Joining Staff Room');
            socket.emit('join_room', 'staff_room');
        }

    }, [socket, isConnected, user]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};