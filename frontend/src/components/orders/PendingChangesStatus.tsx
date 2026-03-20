import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye,
  RefreshCw,
  User,
  Calendar
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingChange {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  requestedAt: string;
  reviewedAt?: string;
  reviewComments?: string;
  requestedByUser: {
    name: string;
  };
  reviewedByUser?: {
    name: string;
  };
}

interface PendingChangesStatusProps {
  orderId: string;
  orderStatus: string;
  onRefresh?: () => void;
}

export const PendingChangesStatus: React.FC<PendingChangesStatusProps> = ({
  orderId,
  orderStatus,
  onRefresh
}) => {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const { toast } = useToast();

  const loadPendingChanges = async () => {
    try {
      setLoading(true);
      
      // Verificar se há alterações pendentes
      const hasPendingResponse = await api.get(`/production/orders/${orderId}/has-pending-changes`);
      setHasPendingChanges(hasPendingResponse.data.hasPendingChanges);
      
      // Carregar todas as alterações do pedido
      const changesResponse = await api.get(`/production/orders/${orderId}/pending-changes`);
      setPendingChanges(changesResponse.data);
    } catch (error) {
      console.error('Erro ao carregar status de alterações:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      loadPendingChanges();
    }
  }, [orderId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'default';
      case 'APPROVED':
        return 'default';
      case 'REJECTED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Pendente de Revisão';
      case 'APPROVED':
        return 'Aprovada';
      case 'REJECTED':
        return 'Rejeitada';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'default';
      case 'LOW':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'Alta';
      case 'MEDIUM':
        return 'Média';
      case 'LOW':
        return 'Baixa';
      default:
        return priority;
    }
  };

  // Não mostrar se não for pedido em produção
  if (orderStatus !== 'IN_PRODUCTION') {
    return null;
  }

  // Não mostrar se não há alterações
  if (!loading && pendingChanges.length === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-500" />
            Status de Alterações
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {hasPendingChanges && (
              <Badge variant="default" className="animate-pulse">
                Alteração Pendente
              </Badge>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                loadPendingChanges();
                onRefresh?.();
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">
            Carregando status...
          </div>
        ) : pendingChanges.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            Nenhuma alteração solicitada
          </div>
        ) : (
          <div className="space-y-3">
            {pendingChanges.map((change) => (
              <div
                key={change.id}
                className="border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(change.status)}
                    <span className="font-medium">
                      {getStatusLabel(change.status)}
                    </span>
                    <Badge variant={getPriorityColor(change.priority)}>
                      {getPriorityLabel(change.priority)}
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(change.requestedAt), {
                      addSuffix: true,
                      locale: ptBR
                    })}
                  </div>
                </div>
                
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>Solicitado por: {change.requestedByUser.name}</span>
                  </div>
                  
                  {change.reviewedByUser && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>Revisado por: {change.reviewedByUser.name}</span>
                    </div>
                  )}
                  
                  {change.reviewedAt && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Processado em: {format(new Date(change.reviewedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>
                
                {change.reviewComments && (
                  <div className="text-sm">
                    <span className="font-medium">Comentários:</span>
                    <div className="bg-muted p-2 rounded mt-1 text-muted-foreground">
                      {change.reviewComments}
                    </div>
                  </div>
                )}
                
                {change.status === 'PENDING' && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span>Esta alteração está pendente de revisão pela produção</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {hasPendingChanges && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">
                  Edição temporariamente bloqueada
                </p>
                <p className="text-blue-600 mt-1">
                  Este pedido possui alterações pendentes de aprovação. 
                  Novas edições serão bloqueadas até que as alterações sejam processadas pela produção.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PendingChangesStatus;