import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Clock, User, Package } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import PendingChangeCard, { PendingChange } from '@/components/production/PendingChangeCard';
import ChangeDetailsPanel from '@/components/production/ChangeDetailsPanel';
import KanbanBoard from '@/components/production/KanbanBoard';

// Interface moved to imported type
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
  production?: {
    activeItems: { total: number };
    delayedItems: { total: number };
  };
}

interface ProcessStatusOption {
  id: string;
  name: string;
  children?: ProcessStatusOption[];
}

export const Producao: React.FC = () => {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [selectedChange, setSelectedChange] = useState<PendingChange | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProductionStats | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: '',
    tab: 'kanban' // kanban or changes
  });
  const [processStatuses, setProcessStatuses] = useState<ProcessStatusOption[]>([]);

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

      const response = await api.get('/api/production/pending-changes', { params });
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
      const response = await api.get('/api/production/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const loadProcessStatuses = async () => {
    try {
      const response = await api.get('/api/process-statuses/tree');
      setProcessStatuses(response.data);
    } catch (error) {
      console.error('Error fetching process statuses:', error);
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
    loadProcessStatuses();
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

  // Helper functions removed as they are unused here or moved

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Produção</h1>
          <p className="text-muted-foreground">
            Gestão visual de produção e solicitações
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Status only relevant for Pending Changes tab? Or both? */}
          <Badge variant={connected ? 'default' : 'destructive'}>
            {connected ? '🟢 Conectado' : '🔴 Desconectado'}
          </Badge>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex space-x-1 rounded-lg bg-slate-100 p-1 w-fit">
        <button
          onClick={() => setFilters(prev => ({ ...prev, tab: 'kanban' }))}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filters.tab === 'kanban' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:bg-white/50'
            }`}
        >
          Kanban
        </button>
        <button
          onClick={() => setFilters(prev => ({ ...prev, tab: 'changes' }))}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filters.tab === 'changes' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:bg-white/50'
            }`}
        >
          Solicitações de Alteração
          {stats && stats.pendingChanges.pending > 0 && (
            <span className="ml-2 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">
              {stats.pendingChanges.pending}
            </span>
          )}
        </button>
      </div>

      {/* Stats for Kanban */}
      {filters.tab === 'kanban' && stats?.production && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Produção</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.production.activeItems.total}</div>
              <p className="text-xs text-muted-foreground">Itens ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.production.delayedItems.total}</div>
              <p className="text-xs text-muted-foreground">Itens com entrega vencida</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Common Filters for Kanban */}
      {filters.tab === 'kanban' && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filtros de Produção</CardTitle>
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
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por Processo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Processos</SelectItem>
                  {processStatuses.map(status => (
                    <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {filters.tab === 'kanban' ? (
        <KanbanBoard filters={{
          search: filters.search,
          parentStatusId: filters.status === 'ALL' ? undefined : filters.status
        }} />
      ) : (
        <div className="space-y-6">
          {/* Estatísticas Changes */}
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

          {/* Filtros Changes */}
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
      )}
    </div>
  );
};

export default Producao;