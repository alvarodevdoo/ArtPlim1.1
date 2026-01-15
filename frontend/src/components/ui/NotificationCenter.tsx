import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X, 
  Bell,
  BellRing
} from 'lucide-react';
import { useRealTimeNotifications } from '../../hooks/useRealTimeNotifications';
import { Button } from './button';
import { Badge } from './badge';

const NotificationIcon: React.FC<{ type: string }> = ({ type }) => {
  const iconProps = { className: "w-5 h-5" };
  
  switch (type) {
    case 'success':
      return <CheckCircle {...iconProps} className="w-5 h-5 text-green-500" />;
    case 'error':
      return <XCircle {...iconProps} className="w-5 h-5 text-red-500" />;
    case 'warning':
      return <AlertTriangle {...iconProps} className="w-5 h-5 text-yellow-500" />;
    case 'info':
    default:
      return <Info {...iconProps} className="w-5 h-5 text-blue-500" />;
  }
};

const NotificationItem: React.FC<{
  notification: any;
  onClose: (id: string) => void;
  onMarkAsRead: (id: string) => void;
}> = ({ notification, onClose, onMarkAsRead }) => {
  const typeColors = {
    success: 'border-green-200 bg-green-50',
    error: 'border-red-200 bg-red-50',
    warning: 'border-yellow-200 bg-yellow-50',
    info: 'border-blue-200 bg-blue-50'
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`
        relative p-4 rounded-lg border shadow-sm mb-3 cursor-pointer
        ${typeColors[notification.type as keyof typeof typeColors]}
        ${!notification.read ? 'ring-2 ring-blue-200' : ''}
      `}
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
    >
      <div className="flex items-start space-x-3">
        <NotificationIcon type={notification.type} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">
              {notification.title}
            </h4>
            <div className="flex items-center space-x-2">
              {!notification.read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(notification.id);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <p className="mt-1 text-sm text-gray-600">
            {notification.message}
          </p>
          
          <p className="mt-2 text-xs text-gray-500">
            {notification.timestamp.toLocaleTimeString('pt-BR')}
          </p>
          
          {notification.actions && notification.actions.length > 0 && (
            <div className="mt-3 flex space-x-2">
              {notification.actions.map((action: any, index: number) => (
                <Button
                  key={index}
                  size="sm"
                  variant={action.variant || 'secondary'}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.action();
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const NotificationCenter: React.FC = () => {
  const {
    notifications,
    unreadCount,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    isConnected
  } = useRealTimeNotifications();

  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      {/* Botão de notificações */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-6 h-6" />
        ) : (
          <Bell className="w-6 h-6" />
        )}
        
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 px-1 min-w-[1.25rem] h-5 text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
        
        {/* Indicador de conexão */}
        <div className={`
          absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white
          ${isConnected ? 'bg-green-500' : 'bg-red-500'}
        `} />
      </button>

      {/* Painel de notificações */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Painel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 w-96 max-h-96 bg-white rounded-lg shadow-lg border z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Notificações
                  </h3>
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={markAllAsRead}
                      >
                        Marcar todas como lidas
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearAll}
                    >
                      Limpar todas
                    </Button>
                  </div>
                </div>
                
                {/* Status da conexão */}
                <div className="mt-2 flex items-center text-sm">
                  <div className={`
                    w-2 h-2 rounded-full mr-2
                    ${isConnected ? 'bg-green-500' : 'bg-red-500'}
                  `} />
                  <span className="text-gray-600">
                    {isConnected ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
              </div>

              {/* Lista de notificações */}
              <div className="max-h-80 overflow-y-auto p-4">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhuma notificação</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClose={removeNotification}
                        onMarkAsRead={markAsRead}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Toast notifications que aparecem no canto da tela
export const NotificationToasts: React.FC = () => {
  const { notifications, removeNotification } = useRealTimeNotifications();
  
  // Mostrar apenas as 3 notificações mais recentes que não foram lidas
  const toastNotifications = notifications
    .filter(n => !n.read && n.autoClose)
    .slice(0, 3);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {toastNotifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
            onMarkAsRead={() => {}} // Toasts não precisam ser marcados como lidos
          />
        ))}
      </AnimatePresence>
    </div>
  );
};