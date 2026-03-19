import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { DatasOrcamento } from '@/components/ui/DatasOrcamento';
import { MaterialCalculator } from '@/components/ui/MaterialCalculator';
import { OrderAutomation } from '@/components/ui/OrderAutomation';
import {
  Plus, Search, Eye, Edit, Package, Clock, CheckCircle, XCircle, Download,
  Calendar, DollarSign, List, Printer, AlertTriangle, TrendingUp, TrendingDown,
  Activity, Bell, Phone, Kanban, BarChart3
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { sendOrderWhatsApp, WhatsAppService } from '@/lib/whatsapp';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragStartEvent, DragEndEvent, useDroppable,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Modais Extra\u00eddos ---
import OrderDetailsModal from '@/components/pedidos/modals/OrderDetailsModal';
import CancelOrderModal from '@/components/pedidos/modals/CancelOrderModal';
import WhatsAppModal from '@/components/pedidos/modals/WhatsAppModal';

// --- Interfaces ---
interface ProcessStatus {
  id: string; name: string; color: string; icon?: string; mappedBehavior: string; scope?: 'ORDER' | 'ITEM' | 'BOTH';
}

interface Pedido {
  id: string; orderNumber: string; status: 'DRAFT' | 'APPROVED' | 'IN_PRODUCTION' | 'FINISHED' | 'DELIVERED' | 'CANCELLED';
  processStatusId?: string; processStatus?: ProcessStatus; total: number; createdAt: string; validUntil?: string;
  deliveryDate?: string; notes?: string; updatedAt: string;
  customer: { id: string; name: string; email?: string; phone?: string; };
  productionQueue?: Array<{ actualStart?: string; actualEnd?: string; createdAt?: string; }>;
  approvedAt?: string; inProductionAt?: string; finishedAt?: string; deliveredAt?: string; cancelledAt?: string;
  cancelledById?: string; cancellationReason?: string; cancellationPaymentAction?: string; cancellationRefundAmount?: number;
  items: Array<any>;
  transactions?: Array<any>;
}

interface PedidoStats {
  total: number; totalValue: number; byStatus: Record<string, { count: number; value: number }>;
  avgOrderValue: number; monthlyGrowth: number; pendingValue: number; overdueCount: number;
}

const statusConfig = {
  DRAFT: { label: 'Pedido Criado', color: 'bg-gray-100 text-gray-800', icon: Edit, border: 'border-l-gray-400' },
  APPROVED: { label: 'Aguardando Aprovação', color: 'bg-blue-100 text-blue-800', icon: CheckCircle, border: 'border-l-blue-500' },
  IN_PRODUCTION: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-800', icon: Package, border: 'border-l-yellow-500' },
  FINISHED: { label: 'Aguardando Retirada', color: 'bg-green-100 text-green-800', icon: CheckCircle, border: 'border-l-green-500' },
  DELIVERED: { label: 'Entregue', color: 'bg-green-100 text-green-800', icon: CheckCircle, border: 'border-l-green-600' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle, border: 'border-l-red-500' }
};

const shouldShowDimensions = (item: any, enableEngineering?: boolean): boolean => {
  const width = Number(item?.width || 0);
  const height = Number(item?.height || 0);
  if (width <= 0 || height <= 0) return false;
  if (item?.itemType === 'SERVICE' || item?.product?.productType === 'SERVICE') return false;
  if (item?.product?.pricingMode === 'DYNAMIC_ENGINEER' && enableEngineering === false) return false;
  return true;
};

// --- Sub-componentes Memoizados do Kanban ---
const SortableItemCard = React.memo(({ item, onView, onItemStatusChange }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id, data: { type: 'Item', item },
  });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : 'auto' };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow mb-3">
        <CardContent className="p-3">
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-sm flex flex-col">
                <span className="text-primary">{item?.orderNumber || 'N/A'}</span>
                <span className="mt-1 text-base">{item?.product?.name || 'Produto sem nome'}</span>
              </h4>
              <Badge variant="outline" className="text-[10px]">{item?.quantity || 0}un</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate font-medium">{item?.customerName || 'Cliente não informado'}</p>
            {item?.status && statusConfig[item.status as keyof typeof statusConfig] && (
              <div className="flex items-center gap-1.5 mt-2">
                <Badge variant="outline" className={`text-[10px] font-bold ${statusConfig[item.status as keyof typeof statusConfig].color}`}>
                  {statusConfig[item.status as keyof typeof statusConfig].label}
                </Badge>
              </div>
            )}
            {item?.status === 'FINISHED' && (
              <Button size="sm" variant="outline" className="w-full mt-2 text-green-600 border-green-200 hover:bg-green-50 text-[10px] h-6" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onItemStatusChange(item.id, 'DELIVERED'); }}>
                ✓ Marcar como Entregue
              </Button>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-dashed mt-2">
              <span className="text-[10px] text-muted-foreground flex items-center">
                <Calendar className="w-3 h-3 mr-1" />
                {item?.orderCreatedAt ? new Date(item.orderCreatedAt).toLocaleDateString('pt-BR') : '-'}
              </span>
              <div className="flex items-center space-x-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); if (item?.parentOrderId) onView(item.parentOrderId); }}>
                  <Eye className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

const KanbanColumnPedido = React.memo(({ status, config, items, onView, onItemStatusChange }: any) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <Card ref={setNodeRef} className={`flex-1 min-h-[500px] transition-colors ${isOver ? 'bg-primary/5 ring-2 ring-primary/20' : 'bg-background'}`}>
      <CardHeader className="pb-3 sticky top-0 bg-background/80 backdrop-blur z-10 rounded-t-lg border-b mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <config.icon className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm tracking-tight">{config.label}</span>
          </div>
          <Badge variant="secondary" className="text-[10px] h-5">{items?.length || 0}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-2 min-h-[150px]">
        <SortableContext id={status} items={(items || []).map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1 min-h-[100px]">
            {(items || []).map((item: any) => (
              <SortableItemCard key={item.id} item={item} onView={onView} onItemStatusChange={onItemStatusChange} />
            ))}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
});

// --- Componente Principal ---
const Pedidos: React.FC = () => {
  const navigate = useNavigate();
  const { settings, hasPermission } = useAuth();

  // Estados Base
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [processStatuses, setProcessStatuses] = useState<ProcessStatus[]>([]);
  const [stats, setStats] = useState<PedidoStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados de Busca e Debounce (PASSO 4)
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filtros de Tabela
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Estados Visuais
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedPedidos, setSelectedPedidos] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Estados dos Modais
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [showMaterialCalculator, setShowMaterialCalculator] = useState(false);
  const [calculatorItem, setCalculatorItem] = useState<any>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const hasFinancialAccess = useCallback(() => hasPermission('finance.view'), [hasPermission]);

  // PASSO 4: Effect do Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 400); // 400ms delay
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Loader dos Status de Processo
  const loadProcessStatuses = useCallback(async () => {
    try {
      const response = await api.get('/api/organization/config/process-statuses');
      if (response?.data?.success) setProcessStatuses(response.data.data || []);
    } catch (error) { console.error('Failed to load process statuses', error); }
  }, []);

  useEffect(() => { loadProcessStatuses(); }, [loadProcessStatuses]);

  // Loader dos Pedidos (Reage ao debouncedSearch)
  const loadPedidos = useCallback(async (searchQuery?: string) => {
    try {
      setLoading(true);
      const params: any = {};
      if (searchQuery) params.search = searchQuery;

      const [pedidosResponse, statsResponse] = await Promise.all([
        api.get('/api/sales/orders', { params }),
        api.get('/api/sales/orders/stats')
      ]);

      setPedidos(pedidosResponse?.data?.data || []);
      setStats(statsResponse?.data?.data || null);
    } catch (error) {
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Dispara o carregamento quando o debounce muda
  useEffect(() => {
    loadPedidos(debouncedSearch);
  }, [debouncedSearch, loadPedidos]);

  // Helper de Status
  const getStatusDisplay = useCallback((pedido: Pedido) => {
    return statusConfig[pedido?.status as keyof typeof statusConfig] || statusConfig.DRAFT;
  }, []);

  // PASSO 3: Derivações Otimizadas com useMemo
  const filteredPedidos = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    return (pedidos || [])
      .filter(pedido => {
        const matchesSearch =
          pedido?.orderNumber?.toLowerCase().includes(term) ||
          pedido?.customer?.name?.toLowerCase().includes(term) ||
          (pedido?.customer?.phone && pedido.customer.phone.toLowerCase().includes(term));
        const matchesStatus = !statusFilter || pedido.status === statusFilter;
        const matchesDate = !dateFilter || (pedido?.createdAt && new Date(pedido.createdAt).toISOString().split('T')[0] === dateFilter);

        return matchesSearch && matchesStatus && matchesDate;
      })
      .sort((a, b) => {
        let aVal: any = 0, bVal: any = 0;
        switch (sortBy) {
          case 'date':
            aVal = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
            bVal = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
            break;
          case 'value':
            aVal = Number(a?.total || 0);
            bVal = Number(b?.total || 0);
            break;
          case 'customer':
            aVal = a?.customer?.name?.toLowerCase() || '';
            bVal = b?.customer?.name?.toLowerCase() || '';
            break;
        }
        if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });
  }, [pedidos, debouncedSearch, statusFilter, dateFilter, sortBy, sortOrder]);

  const kanbanItems = useMemo(() => {
    const items: any[] = [];
    filteredPedidos.forEach(pedido => {
      (pedido?.items || []).forEach(item => {
        items.push({
          ...item,
          parentOrderId: pedido.id,
          orderNumber: pedido.orderNumber,
          customerName: pedido?.customer?.name,
          orderCreatedAt: pedido.createdAt,
          status: (item as any)?.status || pedido.status
        });
      });
    });
    return items;
  }, [filteredPedidos]);

  const overduePedidos = useMemo(() => {
    return (pedidos || []).filter(pedido =>
      pedido?.status === 'DRAFT' && pedido?.validUntil && new Date(pedido.validUntil) < new Date()
    );
  }, [pedidos]);

  const pendingValue = useMemo(() => {
    return (pedidos || [])
      .filter(p => ['DRAFT', 'APPROVED', 'IN_PRODUCTION'].includes(p?.status))
      .reduce((sum, p) => sum + Number(p?.total || 0), 0);
  }, [pedidos]);

  // Funções de Ação (useCallback)
  const handleItemOrderStatusChange = useCallback(async (itemId: string, newStatus: string) => {
    try {
      const response = await api.patch(`/api/sales/orders/items/${itemId}/status`, { status: newStatus });
      const updatedPedido = response?.data?.data;
      if (updatedPedido) {
        setPedidos(prev => prev.map(p => p.id === updatedPedido.id ? updatedPedido : p));
        setSelectedPedido(prev => prev?.id === updatedPedido.id ? updatedPedido : prev);
      }
      toast.success('Status do item atualizado');
      loadPedidos(debouncedSearch);
    } catch (error: any) {
      toast.error('Erro ao atualizar status do item');
    }
  }, [loadPedidos, debouncedSearch]);

  const handleStatusChange = useCallback(async (pedidoId: string, newStatus: string, details?: any) => {
    try {
      const isProcessStatus = processStatuses.some(s => s.id === newStatus);
      const payload: any = { ...details };
      if (isProcessStatus) payload.processStatusId = newStatus;
      else payload.status = newStatus;

      const response = await api.patch(`/api/sales/orders/${pedidoId}/status`, payload);
      const updatedPedido = response?.data?.data;

      if (updatedPedido) {
        setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, ...updatedPedido } : p));
        setSelectedPedido(prev => prev?.id === pedidoId ? { ...prev, ...updatedPedido } : prev);

        if (updatedPedido?.customer?.phone && settings?.enableAutomation) {
          sendOrderWhatsApp({
            customerName: updatedPedido.customer.name,
            customerPhone: updatedPedido.customer.phone,
            orderNumber: updatedPedido.orderNumber,
            total: updatedPedido.total,
            status: updatedPedido.status,
            validUntil: updatedPedido.validUntil
          });
        }
      }
      toast.success('Status atualizado com sucesso!');
      loadPedidos(debouncedSearch);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao atualizar status');
    }
  }, [processStatuses, settings?.enableAutomation, loadPedidos, debouncedSearch]);

  const handleBulkStatusChange = useCallback(async (newStatus: string) => {
    if (selectedPedidos.length === 0) return toast.error('Selecione pelo menos um pedido');
    try {
      await Promise.all(selectedPedidos.map(id => api.patch(`/api/sales/orders/${id}/status`, { status: newStatus })));
      toast.success(`${selectedPedidos.length} pedido(s) atualizado(s) com sucesso!`);
      setSelectedPedidos([]);
      loadPedidos(debouncedSearch);
    } catch (error: any) { toast.error('Erro ao atualizar pedidos em lote'); }
  }, [selectedPedidos, loadPedidos, debouncedSearch]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) { setActiveId(null); return; }

    const activeItemId = active.id as string;
    const overId = over.id as string;
    const activeItem = kanbanItems.find(i => i.id === activeItemId);
    if (!activeItem) return;

    let targetStatus: string | null = null;
    if (Object.keys(statusConfig).includes(overId)) targetStatus = overId;
    else {
      const overItem = kanbanItems.find(i => i.id === overId);
      if (overItem) targetStatus = overItem.status;
    }

    if (targetStatus && activeItem.status !== targetStatus) {
      handleItemOrderStatusChange(activeItemId, targetStatus);
    }
    setActiveId(null);
  }, [kanbanItems, handleItemOrderStatusChange]);

  const handleSelectAll = useCallback(() => {
    if (selectedPedidos.length === filteredPedidos.length && filteredPedidos.length > 0) {
      setSelectedPedidos([]);
    } else {
      setSelectedPedidos(filteredPedidos.map(p => p.id));
    }
  }, [selectedPedidos.length, filteredPedidos]);

  const handleSelectPedido = useCallback((pedidoId: string) => {
    setSelectedPedidos(prev => prev.includes(pedidoId) ? prev.filter(id => id !== pedidoId) : [...prev, pedidoId]);
  }, []);

  const sendOverdueReminders = useCallback(async () => {
    let sentCount = 0;
    for (const pedido of overduePedidos) {
      if (pedido?.customer?.phone) {
        WhatsAppService.sendQuoteReminder({
          customerName: pedido.customer.name,
          customerPhone: pedido.customer.phone,
          orderNumber: pedido.orderNumber,
          total: pedido.total,
          status: pedido.status,
          validUntil: pedido.validUntil
        });
        sentCount++;
      }
    }
    toast.success(`${sentCount} lembrete(s) enviado(s) via WhatsApp!`);
  }, [overduePedidos]);

  const exportPedidos = useCallback(async () => {
    try {
      const response = await api.get('/api/sales/orders/export', {
        responseType: 'blob',
        params: { status: statusFilter, search: debouncedSearch, date: dateFilter }
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pedidos_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Relatório exportado com sucesso!');
    } catch (error) { toast.error('Erro ao exportar relatório'); }
  }, [statusFilter, debouncedSearch, dateFilter]);

  if (loading && pedidos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pedidos</h1>
          <p className="text-muted-foreground">Gerencie pedidos e ordens de serviço</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={exportPedidos}>
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
          {settings?.enableAutomation && (
            <Button variant="outline" onClick={() => setShowAutomation(!showAutomation)}>
              <Bell className="w-4 h-4 mr-2" /> Automação
            </Button>
          )}
          <div className="flex border rounded-lg">
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
              <List className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')}>
              <Kanban className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={() => navigate('/pedidos/criar')}>
            <Plus className="w-4 h-4 mr-2" /> Novo Pedido
          </Button>
        </div>
      </div>

      {/* Filtros - Modificado para usar searchInput (não-blocante) */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[300px] space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Buscar Pedido</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Número, cliente ou telefone..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 h-10 border-muted-foreground/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="w-48 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 px-3 border border-muted-foreground/20 rounded-md bg-background text-sm outline-none transition-all"
              >
                <option value="">Todos</option>
                {Object.entries(statusConfig).map(([status, config]) => (
                  <option key={status} value={status}>{config.label}</option>
                ))}
              </select>
            </div>

            <div className="w-44 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Data</label>
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-10 border-muted-foreground/20" />
            </div>

            <div className="flex items-center space-x-2 pb-0.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Ordem</label>
                <div className="flex items-center space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="h-10 px-3 border border-muted-foreground/20 rounded-md bg-background text-sm outline-none"
                  >
                    <option value="date">Data</option>
                    <option value="value">Valor</option>
                    <option value="customer">Cliente</option>
                  </select>
                  <Button variant="outline" className="h-10 w-10 p-0 border-muted-foreground/20" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                    {sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="pb-0.5">
              <Button
                variant="ghost"
                className="h-10 text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => { setSearchInput(''); setStatusFilter(''); setDateFilter(''); setSortBy('date'); setSortOrder('desc'); }}
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Stats Ocultos se filtrando */}
      {!(debouncedSearch || statusFilter || dateFilter) && (
        <div className="space-y-6">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total de Pedidos</p>
                      <p className="text-2xl font-bold">{stats?.total || 0}</p>
                      <p className="text-xs text-muted-foreground">Crescimento: {stats?.monthlyGrowth > 0 ? '+' : ''}{(stats?.monthlyGrowth || 0).toFixed(1)}%</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full"><BarChart3 className="w-6 h-6 text-blue-600" /></div>
                  </div>
                </CardContent>
              </Card>

              {hasFinancialAccess() && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                        <p className="text-2xl font-bold">{formatCurrency(stats?.totalValue || 0)}</p>
                        <p className="text-xs text-muted-foreground">Ticket médio: {formatCurrency(stats?.avgOrderValue || 0)}</p>
                      </div>
                      <div className="p-3 bg-green-100 rounded-full"><DollarSign className="w-6 h-6 text-green-600" /></div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                      {hasFinancialAccess() ? (
                        <>
                          <p className="text-2xl font-bold">{formatCurrency(pendingValue)}</p>
                          <p className="text-xs text-muted-foreground">{(pedidos || []).filter(p => ['APPROVED', 'IN_PRODUCTION'].includes(p?.status)).length} pedidos</p>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-bold">{(pedidos || []).filter(p => ['APPROVED', 'IN_PRODUCTION'].includes(p?.status)).length}</p>
                          <p className="text-xs text-muted-foreground">pedidos na fila</p>
                        </>
                      )}
                    </div>
                    <div className="p-3 bg-yellow-100 rounded-full"><Activity className="w-6 h-6 text-yellow-600" /></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Vencidos</p>
                      <p className="text-2xl font-bold text-red-600">{overduePedidos.length}</p>
                      <p className="text-xs text-muted-foreground">Orçamentos expirados</p>
                    </div>
                    <div className="p-3 bg-red-100 rounded-full"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Actions Bar */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900">Ações Rápidas</p>
                      <p className="text-sm text-blue-700">Acelere seu fluxo de trabalho</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-100">
                    <CheckCircle className="w-4 h-4 mr-2" /> Aprovar Pendentes ({(pedidos || []).filter(p => p?.status === 'DRAFT').length})
                  </Button>
                  <Button size="sm" variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-100" onClick={sendOverdueReminders} disabled={overduePedidos.length === 0}>
                    <Bell className="w-4 h-4 mr-2" /> Lembrar Vencidos ({overduePedidos.length})
                  </Button>
                  <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-100">
                    <Package className="w-4 h-4 mr-2" /> Produção ({(pedidos || []).filter(p => p?.status === 'IN_PRODUCTION').length})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showAutomation && settings?.enableAutomation && (
        <OrderAutomation orders={pedidos} onComplete={() => loadPedidos(debouncedSearch)} onRuleExecute={(_, orderIds) => { toast.success(`Automação executada para ${orderIds?.length || 0} pedido(s)!`); }} />
      )}

      {selectedPedidos.length > 0 && (
        <Card className="border-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="font-medium">{selectedPedidos.length} pedido(s) selecionado(s)</span>
                <Button variant="outline" size="sm" onClick={() => setSelectedPedidos([])}>Limpar Seleção</Button>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('APPROVED')}>Aprovar Selecionados</Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('IN_PRODUCTION')}>Enviar para Produção</Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('CANCELLED')}>Cancelar Selecionados</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main View: Kanban */}
      {viewMode === 'kanban' && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
          <div className="flex h-[calc(100vh-250px)] gap-4 pb-4 overflow-x-auto">
            {Object.entries(statusConfig)
              .filter(([status]) => status !== 'DELIVERED' && status !== 'CANCELLED')
              .map(([status, config]) => (
                <KanbanColumnPedido
                  key={status} status={status} config={config}
                  items={kanbanItems.filter(i => i?.status === status)}
                  onView={(id: string) => { const p = pedidos.find(p => p.id === id); if (p) setSelectedPedido(p); }}
                  onItemStatusChange={handleItemOrderStatusChange}
                />
              ))}
          </div>

          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
            {activeId ? (() => {
              const activeItem = kanbanItems.find(i => i.id === activeId);
              if (!activeItem) return null;
              return (
                <div className="rotate-2 cursor-grabbing w-[280px]">
                  <Card className="shadow-2xl border-primary/50 ring-2 ring-primary/20">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-sm">#{activeItem?.orderNumber || ''}</span>
                        <Badge variant="outline" className="text-[10px]">{activeItem?.quantity || 0}un</Badge>
                      </div>
                      <p className="text-sm font-medium truncate mb-1">{activeItem?.product?.name || ''}</p>
                      <p className="text-xs text-muted-foreground truncate">{activeItem?.customerName || ''}</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Main View: List */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input type="checkbox" checked={selectedPedidos.length === filteredPedidos.length && filteredPedidos.length > 0} onChange={handleSelectAll} className="rounded border-input" />
              <span className="text-sm text-muted-foreground">{filteredPedidos.length} pedido(s) encontrado(s)</span>
            </div>
          </div>

          {filteredPedidos.map((pedido) => {
            const statusInfo = statusConfig[pedido?.status as keyof typeof statusConfig];
            const isOverdue = pedido?.status === 'DRAFT' && pedido?.validUntil && new Date(pedido.validUntil) < new Date();

            return (
              <Card key={pedido.id} className={`transition-all duration-200 shadow-sm hover:shadow-md border-l-[4px] ${(statusInfo as any)?.border || 'border-l-muted'} ${isOverdue ? 'bg-red-50/50 border-red-200' : 'bg-card hover:border-slate-300'}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <input type="checkbox" checked={selectedPedidos.includes(pedido.id)} onChange={() => handleSelectPedido(pedido.id)} className="rounded border-input" />
                      <div className="flex flex-col">
                        <h3 className="font-bold text-lg text-foreground leading-tight flex items-center space-x-2">
                          <span>{pedido?.customer?.name || 'Cliente'}</span>
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">{pedido?.orderNumber || ''}</span>
                          {isOverdue && <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-bold uppercase">Vencido</span>}
                        </h3>
                        {pedido?.customer?.phone && <p className="text-sm font-semibold text-blue-700 flex items-center mt-1"><Phone className="w-3.5 h-3.5 mr-1.5" />{pedido.customer.phone}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">{pedido?.createdAt ? formatDateTime(pedido.createdAt) : ''}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-semibold text-lg">{formatCurrency(pedido?.total || 0)}</p>
                        {(() => {
                          const totalPaid = pedido?.transactions?.reduce((sum, t) => { if (t?.type === 'INCOME' && t?.status === 'PAID') return sum + Number(t?.amount || 0); return sum; }, 0) || 0;
                          const pendingAmount = Number(pedido?.total || 0) - totalPaid;
                          const isPaid = totalPaid >= Number(pedido?.total || 0) - 0.01;
                          const isPartial = totalPaid > 0 && !isPaid;

                          if (isPaid) return <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block mt-1">Pago</span>;
                          return <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${isPartial ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50'}`}>{isPartial ? 'Parcial: ' : 'Pendente: '}{pendingAmount > 0 ? formatCurrency(pendingAmount) : 'R$ 0,00'}</span>;
                        })()}
                        <p className="text-xs text-muted-foreground mt-1">{(pedido?.items || []).length} item(s)</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {(() => {
                          const statusDisplay = getStatusDisplay(pedido);
                          const isDynamic = !!pedido?.processStatus;
                          const isInteractive = pedido?.status !== 'DELIVERED' && pedido?.status !== 'CANCELLED';

                          if (!isInteractive) {
                            return isDynamic ? (
                              <span className="px-3 py-1 rounded-full text-xs font-medium border" style={{ backgroundColor: (statusDisplay as any)?.badgeColor?.startsWith('#') ? `${(statusDisplay as any).badgeColor}20` : '#f3f4f6', color: (statusDisplay as any)?.badgeColor || '#374151', borderColor: (statusDisplay as any)?.badgeColor || '#d1d5db' }}>{statusDisplay.label}</span>
                            ) : (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${(statusDisplay as any)?.color}`}>{statusDisplay.label}</span>
                            );
                          }

                          return (
                            <div className="relative">
                              <select
                                value={pedido?.processStatusId || pedido?.status || ''}
                                onChange={(e) => {
                                  const newStatus = e.target.value;
                                  const targetProcessStatus = processStatuses.find(s => s.id === newStatus);
                                  const isCancelled = newStatus === 'CANCELLED' || targetProcessStatus?.mappedBehavior === 'CANCELLED';

                                  if (isCancelled) {
                                    setSelectedPedido(pedido);
                                    setShowCancelModal(true);
                                  } else {
                                    handleStatusChange(pedido.id, newStatus);
                                  }
                                }}
                                className={`appearance-none pl-3 pr-8 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${!isDynamic ? (statusDisplay as any)?.color : ''}`}
                                style={{ backgroundColor: isDynamic && (statusDisplay as any)?.badgeColor?.startsWith('#') ? `${(statusDisplay as any).badgeColor}20` : isDynamic ? '#f3f4f6' : undefined, color: isDynamic ? (statusDisplay as any)?.badgeColor || '#374151' : undefined, borderColor: isDynamic ? (statusDisplay as any)?.badgeColor || '#d1d5db' : undefined, backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'currentColor\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {processStatuses.length > 0 ? (
                                  <>
                                    {!pedido?.processStatusId && !processStatuses.some(s => s.id === pedido?.processStatusId) && (<option value={pedido?.status} disabled hidden>{statusConfig[pedido?.status as keyof typeof statusConfig]?.label || pedido?.status}</option>)}
                                    {processStatuses.map(status => <option key={status.id} value={status.id}>{status.name}</option>)}
                                  </>
                                ) : (
                                  Object.entries(statusConfig).map(([status, config]) => <option key={status} value={status}>{config.label}</option>)
                                )}
                              </select>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => setSelectedPedido(pedido)} title="Visualizar"><Eye className="w-4 h-4" /></Button>
                        {pedido?.status === 'DRAFT' && <Button size="icon" variant="ghost" onClick={() => navigate(`/pedidos/criar?edit=${pedido.id}`)} title="Editar"><Edit className="w-4 h-4" /></Button>}
                        <Button size="icon" variant="ghost" title="Imprimir"><Printer className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    {pedido?.status === 'DRAFT' && pedido?.validUntil && (
                      <div className="mb-4"><DatasOrcamento criadoEm={pedido.createdAt} validadeEm={pedido.validUntil} className="p-3 bg-muted rounded-lg" /></div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {(pedido?.items || []).slice(0, 3).map((item) => (
                        <div key={item.id} className="text-sm bg-muted p-2 rounded">
                          <p className="font-medium">{item?.product?.name}</p>
                          <p className="text-muted-foreground">{shouldShowDimensions(item as any, settings?.enableEngineering) ? `${item?.width} × ${item?.height}mm • ${item?.quantity}un` : `${item?.quantity}un`}</p>
                          <p className="font-medium">{formatCurrency(item?.totalPrice || 0)}</p>
                        </div>
                      ))}
                      {(pedido?.items || []).length > 3 && (
                        <div className="text-sm bg-muted p-2 rounded flex items-center justify-center">
                          <span className="text-muted-foreground">+{pedido.items.length - 3} item(s)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredPedidos.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum pedido encontrado</h3>
                <p className="text-muted-foreground mb-4">{debouncedSearch || statusFilter ? 'Tente ajustar os filtros' : 'Comece criando seu primeiro pedido'}</p>
                {!debouncedSearch && !statusFilter && <Button onClick={() => navigate('/pedidos/criar')}><Plus className="w-4 h-4 mr-2" /> Criar Primeiro Pedido</Button>}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* MODAIS COMPONENTIZADOS */}
      <OrderDetailsModal 
        pedido={selectedPedido}
        isOpen={!!selectedPedido && !showCancelModal && !showWhatsAppModal && !showMaterialCalculator}
        onClose={() => setSelectedPedido(null)}
        onStatusChange={handleStatusChange}
        onCancelRequest={() => {
          setShowCancelModal(true);
        }}
        onWhatsAppRequest={() => {
          setShowWhatsAppModal(true);
        }}
        onMaterialRequest={(item) => {
          setCalculatorItem(item);
          setShowMaterialCalculator(true);
        }}
      />

      <CancelOrderModal 
        pedido={selectedPedido}
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={(id, reason, paymentAction, refundAmount) => {
          handleStatusChange(id, 'CANCELLED', { reason, paymentAction, refundAmount });
          setShowCancelModal(false);
        }}
      />

      <WhatsAppModal 
        pedido={selectedPedido}
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        onSend={(phone, name, message) => {
          WhatsAppService.sendCustomMessage(phone, name, message);
          setShowWhatsAppModal(false);
          toast.success('Mensagem enviada!');
        }}
      />

      {/* Modal da Calculadora */}
      {showMaterialCalculator && calculatorItem && hasFinancialAccess() && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Calculadora de Materiais</CardTitle>
                    <CardDescription>{calculatorItem?.product?.name} - {calculatorItem?.width} × {calculatorItem?.height}mm</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setShowMaterialCalculator(false)}>Fechar</Button>
                </div>
              </CardHeader>
              <CardContent>
                <MaterialCalculator width={calculatorItem?.width || 0} height={calculatorItem?.height || 0} quantity={calculatorItem?.quantity || 0} onCalculationComplete={() => { }} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

    </div>
  );
};

export default Pedidos;