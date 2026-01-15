import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useToast } from '../hooks/use-toast';
import { api } from '../lib/api';

export interface Notification {
  id: string;
  organizationId: string;
  userId?: string;
  type: 'CHANGE_REQUEST' | 'CHANGE_APPROVED' | 'CHANGE_REJECTED';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadNotifications: (page?: number, unreadOnly?: boolean) => Promise<void>;
  playNotificationSound: boolean;
  setPlayNotificationSound: (play: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [playNotificationSound, setPlayNotificationSound] = useState(true);
  
  const { subscribe, connected } = useWebSocket();
  const { toast } = useToast();

  // Carregar notificações iniciais
  const loadNotifications = useCallback(async (page: number = 1, unreadOnly: boolean = false) => {
    try {
      setLoading(true);
      const response = await api.get('/production/notifications', {
        params: { page, limit: 50, unreadOnly }
      });
      
      if (page === 1) {
        setNotifications(response.data.data);
      } else {
        setNotifications(prev => [...prev, ...response.data.data]);
      }
      
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as notificações',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Carregar contagem de não lidas
  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/production/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Erro ao carregar contagem de não lidas:', error);
    }
  }, []);

  // Marcar notificação como lida
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await api.post(`/production/notifications/${notificationId}/read`);
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível marcar a notificação como lida',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Marcar todas como lidas
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await api.post('/production/notifications/read-all');
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      
      toast({
        title: 'Sucesso',
        description: `${response.data.count} notificações marcadas como lidas`,
      });
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível marcar todas as notificações como lidas',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Reproduzir som de notificação
  const playSound = useCallback(() => {
    if (!playNotificationSound) return;
    
    try {
      // Criar um som simples usando Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Não foi possível reproduzir som de notificação:', error);
    }
  }, [playNotificationSound]);

  // Mostrar notificação do browser
  const showBrowserNotification = useCallback((notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: false
      });

      browserNotification.onclick = () => {
        window.focus();
        markAsRead(notification.id);
        browserNotification.close();
      };

      // Auto-close após 5 segundos
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }
  }, [markAsRead]);

  // Solicitar permissão para notificações do browser
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('Permissão de notificação:', permission);
    }
  }, []);

  // Configurar listeners WebSocket
  useEffect(() => {
    if (!connected || !subscribe) return;

    console.log('🔔 Configurando listeners de notificação...');

    // Listener para novas solicitações de alteração
    const unsubscribeChangeRequest = subscribe('change-request', (data: any) => {
      console.log('📢 Nova solicitação de alteração recebida:', data);
      
      const notification = data.notification;
      
      // Adicionar à lista
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Toast
      toast({
        title: notification.title,
        description: notification.message,
        variant: 'default'
      });
      
      // Som
      playSound();
      
      // Notificação do browser
      showBrowserNotification(notification);
    });

    // Listener para decisões de alteração
    const unsubscribeChangeDecision = subscribe('change-decision', (data: any) => {
      console.log('📢 Decisão de alteração recebida:', data);
      
      const notification = data.notification;
      
      // Adicionar à lista
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Toast com cor baseada na aprovação
      toast({
        title: notification.title,
        description: notification.message,
        variant: data.approved ? 'default' : 'destructive'
      });
      
      // Som
      playSound();
      
      // Notificação do browser
      showBrowserNotification(notification);
    });

    // Listener para broadcast de decisões (para operadores)
    const unsubscribeChangeDecisionBroadcast = subscribe('change-decision-broadcast', (data: any) => {
      console.log('📢 Broadcast de decisão recebido:', data);
      
      // Toast mais discreto para broadcast
      toast({
        title: `Alteração ${data.approved ? 'aprovada' : 'rejeitada'}`,
        description: `Pedido #${data.orderNumber} por ${data.reviewedBy}`,
        variant: 'default'
      });
    });

    // Listener para notificações gerais
    const unsubscribeNotification = subscribe('notification', (notification: Notification) => {
      console.log('📢 Notificação geral recebida:', notification);
      
      setNotifications(prev => [notification, ...prev]);
      if (!notification.read) {
        setUnreadCount(prev => prev + 1);
      }
      
      toast({
        title: notification.title,
        description: notification.message,
        variant: 'default'
      });
      
      playSound();
      showBrowserNotification(notification);
    });

    // Listener para notificação lida
    const unsubscribeNotificationRead = subscribe('notification-read', (data: any) => {
      console.log('📖 Notificação marcada como lida:', data);
      
      setNotifications(prev => 
        prev.map(n => n.id === data.notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    });

    // Listener para todas marcadas como lidas
    const unsubscribeAllNotificationsRead = subscribe('all-notifications-read', (data: any) => {
      console.log('📖 Todas as notificações marcadas como lidas:', data);
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    });

    return () => {
      unsubscribeChangeRequest?.();
      unsubscribeChangeDecision?.();
      unsubscribeChangeDecisionBroadcast?.();
      unsubscribeNotification?.();
      unsubscribeNotificationRead?.();
      unsubscribeAllNotificationsRead?.();
    };
  }, [connected, subscribe, toast, playSound, showBrowserNotification]);

  // Carregar dados iniciais
  useEffect(() => {
    if (connected) {
      loadNotifications();
      loadUnreadCount();
      requestNotificationPermission();
    }
  }, [connected, loadNotifications, loadUnreadCount, requestNotificationPermission]);

  // Atualizar contagem periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      if (connected) {
        loadUnreadCount();
      }
    }, 60000); // 1 minuto

    return () => clearInterval(interval);
  }, [connected, loadUnreadCount]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    loadNotifications,
    playNotificationSound,
    setPlayNotificationSound
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;