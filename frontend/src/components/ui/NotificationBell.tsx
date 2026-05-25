import React, { useState } from 'react';
import { Bell, BellRing, Check, Volume2, VolumeX, FileText, Clock, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { Badge } from './badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import { ScrollArea } from './scroll-area';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDraftRegistry } from '../../hooks/useDraftRegistry';

export const NotificationBell: React.FC = () => {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    loadNotifications,
    playNotificationSound,
    setPlayNotificationSound
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);

  // Rascunhos prestes a expirar (≤15 min). Aparecem como uma seção dedicada
  // no popover do sino — não vão para o backend, são apenas locais.
  const { expiringDrafts, expiringCount, extend: extendDraft, discard: discardDraft } = useDraftRegistry();
  const totalBadgeCount = unreadCount + expiringCount;

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Navegar para o contexto da notificação se necessário
    if (notification.data?.orderId) {
      // Implementar navegação para o pedido
      console.log('Navegar para pedido:', notification.data.orderId);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'CHANGE_REQUEST':
        return '🔄';
      case 'CHANGE_APPROVED':
        return '✅';
      case 'CHANGE_REJECTED':
        return '❌';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'CHANGE_REQUEST':
        return 'text-blue-600';
      case 'CHANGE_APPROVED':
        return 'text-green-600';
      case 'CHANGE_REJECTED':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          {totalBadgeCount > 0 ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {totalBadgeCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notificações</h4>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              title={playNotificationSound ? 'Som ativado — clique para desligar' : 'Som desligado — clique para ativar'}
              onClick={() => setPlayNotificationSound(!playNotificationSound)}
            >
              {playNotificationSound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>

            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                disabled={loading}
                title="Marcar todas como lidas"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {expiringDrafts.length > 0 && (
          <div className="border-b bg-amber-50/60">
            <div className="flex items-center gap-2 px-4 py-2">
              <FileText className="h-3.5 w-3.5 text-amber-700" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                Rascunhos prestes a expirar
              </span>
            </div>
            <div className="divide-y divide-amber-100/60">
              {expiringDrafts.map(draft => {
                const minutesLeft = Math.max(0, Math.round(draft.msUntilExpiration / 60_000));
                return (
                  <div key={draft.key} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 rounded-md bg-amber-100 p-1 text-amber-700">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-700">
                        {draft.label}
                      </p>
                      <p className="text-[10px] text-amber-700">
                        Expira em {minutesLeft} min
                      </p>
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => extendDraft(draft.key)}
                          className="rounded-md bg-amber-600 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-amber-700"
                        >
                          Manter mais 2h
                        </button>
                        <button
                          type="button"
                          onClick={() => discardDraft(draft.key)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-700 transition-colors hover:bg-amber-50"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                          Descartar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <ScrollArea className="h-96">
          {loading && notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando notificações...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !notification.read ? 'bg-blue-50/50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-lg">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-sm ${getNotificationColor(notification.type)}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-4 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => {
                loadNotifications(1, false);
                setIsOpen(false);
              }}
            >
              Ver todas as notificações
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;