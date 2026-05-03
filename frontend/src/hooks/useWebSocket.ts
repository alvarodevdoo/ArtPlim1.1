import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

interface WebSocketHook {
  socket: Socket | null;
  connected: boolean;
  subscribe: (event: string, handler: (data: any) => void) => (() => void) | undefined;
  emit: (event: string, data?: any) => void;
  stats: {
    lastConnected: Date | null;
    lastDisconnected: Date | null;
  };
}

export const useWebSocket = (): WebSocketHook => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastConnected, setLastConnected] = useState<Date | null>(null);
  const [lastDisconnected, setLastDisconnected] = useState<Date | null>(null);
  
  const { user } = useAuth();
  
  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!user?.organizationId || !token) {
      return;
    }

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const wsUrl = isLocalhost ? '/' : (import.meta.env.VITE_API_URL || '/');

    const newSocket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      path: '/socket.io'
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket: Conectado com sucesso');
      setConnected(true);
      setLastConnected(new Date());
      newSocket.emit('join-organization', user.organizationId);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket: Desconectado -', reason);
      setConnected(false);
      setLastDisconnected(new Date());
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket: Erro de conexão -', error.message);
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.organizationId]);

  const subscribe = useCallback((event: string, handler: (data: any) => void) => {
    if (!socket) {
      return;
    }
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [socket]);

  const emit = useCallback((event: string, data?: any) => {
    if (!socket || !connected) {
      return;
    }
    socket.emit(event, data);
  }, [socket, connected]);

  return {
    socket,
    connected,
    subscribe,
    emit,
    stats: {
      lastConnected,
      lastDisconnected
    }
  };
};

export default useWebSocket;