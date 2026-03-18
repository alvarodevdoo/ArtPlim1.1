import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { 
  Check, 
  X, 
  Clock, 
  User, 
  Package, 
  AlertTriangle,
  FileText,
  Calendar,
  DollarSign,
  Ruler
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api } from '../../lib/api';
import { useToast } from '../../hooks/use-toast';

interface PendingChange {
  id: string;
  orderId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  requestedAt: string;
  reviewedAt?: string;
  reviewComments?: string;
  changes: any;
  originalData: any;
  order: {
    orderNumber: string;
    status: string;
    customer: {
      name: string;
    };
  };
  requestedByUser: {
    name: string;
    email: string;
  };
  reviewedByUser?: {
    name: string;
    email: string;
  };
}

interface ChangeField {
  field: string;
  oldValue: any;
  newValue: any;
  displayName: string;
}

interface ChangeDetailsPanelProps {
  change: PendingChange;
  onApprove: (changeId: string, comments?: string) => Promise<void>;
  onReject: (changeId: string, comments: string) => Promise<void>;
}

export const ChangeDetailsPanel: React.FC<ChangeDetailsPanelProps> = ({
  change,
  onApprove,
  onReject
}) => {
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzedChanges, setAnalyzedChanges] = useState<ChangeField[]>([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const { toast } = useToast();

  // Carregar análise detalhada das alterações
  useEffect(() => {
    const loadAnalyzedChanges = async () => {
      try {
        setLoadingAnalysis(true);
        const response = await api.get(`/production/pending-changes/${change.id}`);
        setAnalyzedChanges(response.data.analyzedChanges || []);
      } catch (error) {
        console.error('Erro ao carregar análise das alterações:', error);
      } finally {
        setLoadingAnalysis(false);
      }
    };

    loadAnalyzedChanges();
  }, [change.id]);

  const handleApprove = async () => {
    try {
      setLoading(true);
      await onApprove(change.id, comments.trim() || undefined);
      setComments('');
    } catch (error) {
      // Erro já tratado no componente pai
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comments.trim()) {
      toast({
        title: 'Comentário obrigatório',
        description: 'É necessário informar o motivo da rejeição',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      await onReject(change.id, comments.trim());
      setComments('');
    } catch (error) {
      // Erro já tratado no componente pai
    } finally {
      setLoading(false);
    }
  };

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

  const formatValue = (value: any, field: string) => {
    if (value === null || value === undefined) return 'N/A';
    
    // Formatação específica por tipo de campo
    if (field.includes('Price') || field.includes('total') || field.includes('subtotal')) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(Number(value));
    }
    
    if (field.includes('Date')) {
      return format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    }
    
    if (field.includes('width') || field.includes('height')) {
      return `${value}mm`;
    }
    
    if (field.includes('quantity')) {
      return `${value} un`;
    }
    
    return String(value);
  };

  const getFieldIcon = (field: string) => {
    if (field.includes('Price') || field.includes('total') || field.includes('subtotal')) {
      return <DollarSign className="h-4 w-4" />;
    }
    if (field.includes('Date')) {
      return <Calendar className="h-4 w-4" />;
    }
    if (field.includes('width') || field.includes('height')) {
      return <Ruler className="h-4 w-4" />;
    }
    if (field.includes('quantity')) {
      return <Package className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={getPriorityColor(change.priority)}>
              {getPriorityLabel(change.priority)}
            </Badge>
            <Badge variant={getStatusColor(change.status)}>
              {getStatusLabel(change.status)}
            </Badge>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(change.requestedAt), {
              addSuffix: true,
              locale: ptBR
            })}
          </div>
        </div>

        {/* Informações do Pedido */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Pedido #{change.order.orderNumber}</span>
            <Badge variant="outline">{change.order.status}</Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{change.order.customer.name}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Alterações Solicitadas */}
      <div className="space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Alterações Solicitadas
        </h3>
        
        {loadingAnalysis ? (
          <div className="text-center p-4 text-muted-foreground">
            Analisando alterações...
          </div>
        ) : analyzedChanges.length === 0 ? (
          <div className="text-center p-4 text-muted-foreground">
            Nenhuma alteração específica detectada
          </div>
        ) : (
          <ScrollArea className="h-48">
            <div className="space-y-3">
              {analyzedChanges.map((changeField, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    {getFieldIcon(changeField.field)}
                    {changeField.displayName}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Valor atual:</span>
                      <div className="font-mono bg-muted p-2 rounded mt-1">
                        {formatValue(changeField.oldValue, changeField.field)}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Novo valor:</span>
                      <div className="font-mono bg-blue-50 p-2 rounded mt-1 border border-blue-200">
                        {formatValue(changeField.newValue, changeField.field)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <Separator />

      {/* Informações do Solicitante */}
      <div className="space-y-2">
        <h3 className="font-medium flex items-center gap-2">
          <User className="h-4 w-4" />
          Solicitante
        </h3>
        
        <div className="text-sm space-y-1">
          <div><strong>Nome:</strong> {change.requestedByUser.name}</div>
          <div><strong>Email:</strong> {change.requestedByUser.email}</div>
          <div><strong>Data:</strong> {format(new Date(change.requestedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
        </div>
      </div>

      {/* Informações da Revisão (se processado) */}
      {change.reviewedByUser && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Revisão
            </h3>
            
            <div className="text-sm space-y-1">
              <div><strong>Revisor:</strong> {change.reviewedByUser.name}</div>
              <div><strong>Email:</strong> {change.reviewedByUser.email}</div>
              {change.reviewedAt && (
                <div><strong>Data:</strong> {format(new Date(change.reviewedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
              )}
            </div>
            
            {change.reviewComments && (
              <div className="mt-2">
                <strong className="text-sm">Comentários:</strong>
                <div className="bg-muted p-3 rounded mt-1 text-sm">
                  {change.reviewComments}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Ações (apenas para pendentes) */}
      {change.status === 'PENDING' && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="font-medium">Ação Necessária</h3>
            
            <div className="space-y-3">
              <Textarea
                placeholder="Comentários (opcional para aprovação, obrigatório para rejeição)"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
              />
              
              <div className="flex gap-2">
                <Button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {loading ? 'Aprovando...' : 'Aprovar'}
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={loading || !comments.trim()}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  {loading ? 'Rejeitando...' : 'Rejeitar'}
                </Button>
              </div>
              
              {!comments.trim() && (
                <p className="text-xs text-muted-foreground">
                  💡 Comentário é obrigatório para rejeição
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChangeDetailsPanel;