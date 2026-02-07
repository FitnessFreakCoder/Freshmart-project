import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from './StoreContext';
import { UserRole } from '../types';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { state } = useStore();
    const user = state.user;

    useEffect(() => {
        // Initialize Socket
        // const newSocket = io('http://localhost:5000', { // Local
        const newSocket = io('https://freshmart-project.onrender.com', { // Production
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
        });

        newSocket.on('connect', () => {
            console.log('✅ Socket connected:', newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
            setIsConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Handle Room Joining based on User Role
    useEffect(() => {
        if (!socket || !user) return;

        // Always join personal user room for own order updates
        socket.emit('join_room', `user_${user.id}`);

        // If Admin/Staff, also join management rooms
        if (user.role === UserRole.ADMIN) {
            socket.emit('join_room', 'admin_room');
        } else if (user.role === UserRole.STAFF) {
            socket.emit('join_room', 'staff_room');
        }
    }, [socket, user]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
