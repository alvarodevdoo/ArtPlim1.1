import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Loader2, Search, Filter, RefreshCw, Clock, User, Package } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../lib/api';
import { useToast } from '../hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PendingChangeCard from '../components/production/PendingChangeCard';
import ChangeDetailsPanel from '../components/production/ChangeDetailsPanel';

interface PendingChange {
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

interface ProductionStats {
  pendingChanges: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    byPriority: {
      high: number;
      medium: number;
      low: number;
    };
    averageApprovalTimeMinutes: number;
  };
  notifications: {
    total: number;
    unread: number;
    byType: {
      changeRequest: number;
      changeApproved: number;
      changeRejected: number;
    };
    last24Hours: number;
  };
}

export const Producao: React.FC = () => {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [selectedChange, setSelectedChange] = useState<PendingChange | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProductionStats | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: ''
  });

  const { subscribe, connected } = useWebSocket();
  const { toast } = useToast();

  // Carregar alterações pendentes
  const loadPendingChanges = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.search) params.search = filters.search;

      const response = await api.get('/production/pending-changes', { params });
      setPendingChanges(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar alterações pendentes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as alterações pendentes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar estatísticas
  const loadStats = async () => {
    try {
      const response = await api.get('/production/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  // Aprovar alteração
  const handleApprove = async (changeId: string, comments?: string) => {
    try {
      await api.post(`/production/pending-changes/${changeId}/approve`, { comments });
      
      toast({
        title: 'Alteração aprovada',
        description: 'A alteração foi aprovada e aplicada ao pedido',
      });
      
      // Recarregar dados
      await loadPendingChanges();
      await loadStats();
      
      // Limpar seleção se for a alteração atual
      if (selectedChange?.id === changeId) {
        setSelectedChange(null);
      }
    } catch (error: any) {
      console.error('Erro ao aprovar alteração:', error);
      toast({
        title: 'Erro',
        description: error.response?.data?.error || 'Não foi possível aprovar a alteração',
        variant: 'destructive'
      });
    }
  };

  // Rejeitar alteração
  const handleReject = async (changeId: string, comments: string) => {
    try {
      await api.post(`/production/pending-changes/${changeId}/reject`, { comments });
      
      toast({
        title: 'Alteração rejeitada',
        description: 'A alteração foi rejeitada',
      });
      
      // Recarregar dados
      await loadPendingChanges();
      await loadStats();
      
      // Limpar seleção se for a alteração atual
      if (selectedChange?.id === changeId) {
        setSelectedChange(null);
      }
    } catch (error: any) {
      console.error('Erro ao rejeitar alteração:', error);
      toast({
        title: 'Erro',
        description: error.response?.data?.error || 'Não foi possível rejeitar a alteração',
        variant: 'destructive'
      });
    }
  };

  // Configurar listeners WebSocket
  useEffect(() => {
    if (!connected || !subscribe) return;

    console.log('🔔 Configurando listeners do painel de produção...');

    // Listener para novas solicitações
    const unsubscribeChangeRequest = subscribe('change-request', () => {
      console.log('📢 Nova solicitação recebida, recarregando lista...');
      loadPendingChanges();
      loadStats();
    });

    // Listener para decisões
    const unsubscribeChangeDecision = subscribe('change-decision-broadcast', () => {
      console.log('📢 Decisão processada, recarregando lista...');
      loadPendingChanges();
      loadStats();
    });

    return () => {
      unsubscribeChangeRequest?.();
      unsubscribeChangeDecision?.();
    };
  }, [connected, subscribe]);

  // Carregar dados iniciais
  useEffect(() => {
    loadPendingChanges();
    loadStats();
  }, [filters]);

  // Atualizar dados periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      if (connected) {
        loadPendingChanges();
        loadStats();
      }
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [connected, filters]);

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Painel de Produção</h1>
          <p className="text-muted-foreground">
            Gerencie solicitações de alteração em pedidos em produção
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={connected ? 'default' : 'destructive'}>
            {connected ? '🟢 Conectado' : '🔴 Desconectado'}
          </Badge>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              loadPendingChanges();
              loadStats();
            }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingChanges.pending}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingChanges.byPriority.high} alta prioridade
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.pendingChanges.approved}</div>
              <p className="text-xs text-muted-foreground">
                Tempo médio: {Math.round(stats.pendingChanges.averageApprovalTimeMinutes)}min
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.pendingChanges.rejected}</div>
              <p className="text-xs text-muted-foreground">
                Total processadas: {stats.pendingChanges.approved + stats.pendingChanges.rejected}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notificações</CardTitle>
              <Badge variant="secondary">{stats.notifications.unread}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.notifications.last24Hours}</div>
              <p className="text-xs text-muted-foreground">
                Últimas 24 horas
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por pedido ou cliente..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full"
              />
            </div>
            
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="APPROVED">Aprovado</SelectItem>
                <SelectItem value="REJECTED">Rejeitado</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.priority}
              onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
                <SelectItem value="MEDIUM">Média</SelectItem>
                <SelectItem value="LOW">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Alterações Pendentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Alterações Pendentes
              <Badge variant="secondary">
                {pendingChanges.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : pendingChanges.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhuma alteração pendente</p>
                <p className="text-sm">Todas as solicitações foram processadas</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {pendingChanges.map((change) => (
                  <PendingChangeCard
                    key={change.id}
                    change={change}
                    onSelect={setSelectedChange}
                    selected={selectedChange?.id === change.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalhes da Alteração Selecionada */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes da Alteração</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedChange ? (
              <ChangeDetailsPanel
                change={selectedChange}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione uma alteração</p>
                <p className="text-sm">Clique em uma alteração da lista para ver os detalhes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Producao;