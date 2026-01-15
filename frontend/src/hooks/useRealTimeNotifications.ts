import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  autoClose?: boolean;
  duration?: number;
}

interface NotificationOptions {
  autoClose?: boolean;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }>;
}

export const useRealTimeNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // WebSocket para notificações em tempo real
  const { isConnected, sendMessage } = useWebSocket('/notifications', {
    onMessage: (data) => {
      if (data.type === 'notification') {
        addNotification(data.notification);
      }
    }
  });

  const addNotification = useCallback((
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>,
    options: NotificationOptions = {}
  ) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false,
      autoClose: options.autoClose ?? notification.type === 'success',
      duration: options.duration ?? 5000,
      actions: options.actions
    };

    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Auto close se configurado
    if (newNotification.autoClose) {
      const timeout = setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
      
      timeoutsRef.current.set(id, timeout);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    // Limpar timeout se existir
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearAll = useCallback(() => {
    // Limpar todos os timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
    
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Cleanup na desmontagem
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Funções de conveniência para diferentes tipos
  const showSuccess = useCallback((title: string, message: string, options?: NotificationOptions) => {
    return addNotification({ type: 'success', title, message }, options);
  }, [addNotification]);

  const showError = useCallback((title: string, message: string, options?: NotificationOptions) => {
    return addNotification({ type: 'error', title, message }, { ...options, autoClose: false });
  }, [addNotification]);

  const showWarning = useCallback((title: string, message: string, options?: NotificationOptions) => {
    return addNotification({ type: 'warning', title, message }, options);
  }, [addNotification]);

  const showInfo = useCallback((title: string, message: string, options?: NotificationOptions) => {
    return addNotification({ type: 'info', title, message }, options);
  }, [addNotification]);

  return {
    notifications,
    unreadCount,
    isConnected,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
};