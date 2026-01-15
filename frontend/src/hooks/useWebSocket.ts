import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

interface WebSocketHook {
  socket: Socket | null;
  connected: boolean;
  subscribe: (event: string, handler: (data: any) => void) => (() => void) | undefined;
  emit: (event: string, data?: any) => void;
  stats: {
    reconnectAttempts: number;
    lastConnected: Date | null;
    lastDisconnected: Date | null;
  };
}

export const useWebSocket = (): WebSocketHook => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastConnected, setLastConnected] = useState<Date | null>(null);
  const [lastDisconnected, setLastDisconnected] = useState<Date | null>(null);
  
  const { user, token } = useAuth();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 segundos

  const connect = useCallback(() => {
    if (!user?.organizationId || !token) {
      console.log('🔌 WebSocket: Aguardando autenticação...');
      return;
    }

    if (socket?.connected) {
      console.log('🔌 WebSocket: Já conectado');
      return;
    }

    console.log('🔌 WebSocket: Conectando...');

    const wsUrl = process.env.REACT_APP_WS_URL || 
                  process.env.REACT_APP_API_URL?.replace('/api', '') || 
                  'http://localhost:3001';

    const newSocket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false, // Vamos gerenciar a reconexão manualmente
      forceNew: true
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket: Conectado com sucesso');
      setConnected(true);
      setLastConnected(new Date());
      setReconnectAttempts(0);
      
      // Entrar na sala da organização
      newSocket.emit('join-organization', user.organizationId);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket: Desconectado -', reason);
      setConnected(false);
      setLastDisconnected(new Date());
      
      // Tentar reconectar se não foi desconexão intencional
      if (reason !== 'io client disconnect' && reconnectAttempts < maxReconnectAttempts) {
        scheduleReconnect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket: Erro de conexão -', error.message);
      setConnected(false);
      
      if (reconnectAttempts < maxReconnectAttempts) {
        scheduleReconnect();
      } else {
        console.error('❌ WebSocket: Máximo de tentativas de reconexão atingido');
      }
    });

    // Heartbeat para manter conexão viva
    newSocket.on('pong', () => {
      // console.log('💓 WebSocket: Pong recebido');
    });

    setSocket(newSocket);
  }, [user?.organizationId, token, reconnectAttempts]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const attempts = reconnectAttempts + 1;
    setReconnectAttempts(attempts);
    
    const delay = reconnectDelay * Math.pow(1.5, attempts - 1); // Backoff exponencial
    console.log(`🔄 WebSocket: Tentativa de reconexão ${attempts}/${maxReconnectAttempts} em ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [reconnectAttempts, connect]);

  // Conectar quando o usuário estiver autenticado
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        console.log('🔌 WebSocket: Desconectando...');
        socket.disconnect();
      }
    };
  }, [connect]);

  // Heartbeat periódico
  useEffect(() => {
    if (!socket || !connected) return;

    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 30000); // 30 segundos

    return () => clearInterval(heartbeatInterval);
  }, [socket, connected]);

  const subscribe = useCallback((event: string, handler: (data: any) => void) => {
    if (!socket) {
      console.warn(`🔌 WebSocket: Tentativa de subscribe em '${event}' sem conexão`);
      return;
    }

    console.log(`🔌 WebSocket: Subscrevendo em '${event}'`);
    socket.on(event, handler);

    return () => {
      console.log(`🔌 WebSocket: Unsubscrevendo de '${event}'`);
      socket.off(event, handler);
    };
  }, [socket]);

  const emit = useCallback((event: string, data?: any) => {
    if (!socket || !connected) {
      console.warn(`🔌 WebSocket: Tentativa de emit '${event}' sem conexão`);
      return;
    }

    console.log(`🔌 WebSocket: Emitindo '${event}'`, data);
    socket.emit(event, data);
  }, [socket, connected]);

  return {
    socket,
    connected,
    subscribe,
    emit,
    stats: {
      reconnectAttempts,
      lastConnected,
      lastDisconnected
    }
  };
};

export default useWebSocket;