import React from 'react';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/badge';
import { Clock, User, Package, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PendingChange {
  id: string;
  orderId: string;
  organizationId: string;
  requestedBy: string;
  requestedAt: string;
  changes: any;
  originalData: any;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComments?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    customer: {
      name: string;
    };
  };
  requestedByUser: {
    id: string;
    name: string;
    email: string;
  };
  reviewedByUser?: {
    id: string;
    name: string;
    email: string;
  };
}

interface PendingChangeCardProps {
  change: PendingChange;
  onSelect: (change: PendingChange) => void;
  selected: boolean;
}

export const PendingChangeCard: React.FC<PendingChangeCardProps> = ({
  change,
  onSelect,
  selected
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'secondary';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'Alta';
      case 'MEDIUM': return 'Média';
      case 'LOW': return 'Baixa';
      default: return priority;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'default';
      case 'APPROVED': return 'default';
      case 'REJECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pendente';
      case 'APPROVED': return 'Aprovado';
      case 'REJECTED': return 'Rejeitado';
      default: return status;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'HIGH': return <AlertTriangle className="h-4 w-4" />;
      case 'MEDIUM': return <Clock className="h-4 w-4" />;
      case 'LOW': return <Package className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${selected ? 'ring-2 ring-primary shadow-md' : ''
        } ${change.priority === 'HIGH' ? 'border-l-4 border-l-red-500' : ''}`}
      onClick={() => onSelect(change)}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={getPriorityColor(change.priority)} className="flex items-center gap-1">
                {getPriorityIcon(change.priority)}
                {getPriorityLabel(change.priority)}
              </Badge>
              <Badge variant={getStatusColor(change.status)}>
                {getStatusLabel(change.status)}
              </Badge>
            </div>

            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(change.requestedAt), {
                addSuffix: true,
                locale: ptBR
              })}
            </div>
          </div>

          {/* Pedido Info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Pedido #{change.order.orderNumber}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{change.order.customer.name}</span>
            </div>
          </div>

          {/* Solicitante */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Solicitado por:</span>
              <span className="font-medium text-foreground">
                {change.requestedByUser.name}
              </span>
            </div>

            {change.reviewedByUser && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Revisado por:</span>
                <span className="font-medium text-foreground">
                  {change.reviewedByUser.name}
                </span>
              </div>
            )}
          </div>

          {/* Status específico para pendentes */}
          {change.status === 'PENDING' && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-blue-600 font-medium">
                Aguardando aprovação
              </span>
            </div>
          )}

          {/* Tempo de revisão para processados */}
          {change.reviewedAt && (
            <div className="text-xs text-muted-foreground">
              Processado {formatDistanceToNow(new Date(change.reviewedAt), {
                addSuffix: true,
                locale: ptBR
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PendingChangeCard;