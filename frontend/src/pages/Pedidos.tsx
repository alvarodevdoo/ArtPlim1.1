import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { DatasOrcamento } from '@/components/ui/DatasOrcamento';
import { MaterialCalculator } from '@/components/ui/MaterialCalculator';
import { OrderAutomation } from '@/components/ui/OrderAutomation';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  Calendar,
  DollarSign,
  User,
  BarChart3,
  Kanban,
  List,
  FileText,
  Printer,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Calculator,
  Bell,
  Send,
  Phone
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { sendOrderWhatsApp, WhatsAppService } from '@/lib/whatsapp';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ... imports

interface ProcessStatus {
  id: string;
  name: string;
  color: string;
  icon?: string;
  mappedBehavior: string;
  scope?: 'ORDER' | 'ITEM' | 'BOTH';
}

interface Pedido {
  id: string;
  orderNumber: string;
  status: 'DRAFT' | 'APPROVED' | 'IN_PRODUCTION' | 'FINISHED' | 'DELIVERED' | 'CANCELLED';
  processStatusId?: string;
  processStatus?: ProcessStatus;
  total: number;
  createdAt: string;
  validUntil?: string;
  deliveryDate?: string;
  notes?: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  productionQueue?: Array<{
    actualStart?: string;
    actualEnd?: string;
    createdAt?: string;
  }>;
  approvedAt?: string;
  inProductionAt?: string;
  finishedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancelledById?: string;
  cancellationReason?: string;
  cancellationPaymentAction?: string;
  cancellationRefundAmount?: number;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    width: number;
    height: number;
    notes?: string;
    processStatusId?: string;
    processStatus?: ProcessStatus;

    // Campos específicos por tipo
    area?: number;
    paperSize?: string;
    paperType?: string;
    printColors?: string;
    finishing?: string;
    machineTime?: number;
    setupTime?: number;
    complexity?: string;

    // Tamanho personalizado
    customSizeName?: string;
    isCustomSize?: boolean;

    product: {
      id: string;
      name: string;
      description?: string;
      pricingMode?: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
      productType?: 'PRODUCT' | 'SERVICE' | 'PRINT_SHEET' | 'PRINT_ROLL' | 'LASER_CUT';
    };
  }>;
  transactions: Array<{
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    status: 'PENDING' | 'PAID' | 'CANCELLED' | 'FAILED';
  }>;
}

interface PedidoStats {
  total: number;
  totalValue: number;
  byStatus: Record<string, { count: number; value: number }>;
  avgOrderValue: number;
  monthlyGrowth: number;
  pendingValue: number;
  overdueCount: number;
}


const statusConfig = {
  DRAFT: { label: 'Pedido Criado', color: 'bg-gray-100 text-gray-800', icon: Edit, border: 'border-l-gray-400' },
  APPROVED: { label: 'Aguardando Aprovação', color: 'bg-blue-100 text-blue-800', icon: CheckCircle, border: 'border-l-blue-500' },
  IN_PRODUCTION: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-800', icon: Package, border: 'border-l-yellow-500' },
  FINISHED: { label: 'Aguardando Retirada', color: 'bg-green-100 text-green-800', icon: CheckCircle, border: 'border-l-green-500' },
  DELIVERED: { label: 'Entregue', color: 'bg-green-100 text-green-800', icon: CheckCircle, border: 'border-l-green-600' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle, border: 'border-l-red-500' }
};

// Função helper para determinar se deve exibir unidades de medida
const shouldShowDimensions = (
  item: Pedido['items'][0],
  enableEngineering?: boolean
): boolean => {
  // Garantir conversão numérica para evitar problemas com tipos Decimal/String
  const width = Number(item.width || 0);
  const height = Number(item.height || 0);

  // Se não houver dimensões válidas (maiores que zero), não exibe
  if (width <= 0 || height <= 0) {
    return false;
  }

  // Se o item for explicitamente um serviço, não exibe dimensões
  const isService = (item as any).itemType === 'SERVICE' || item.product.productType === 'SERVICE';
  if (isService) {
    return false;
  }

  // Placas com modo engenharia desabilitado têm corte dinâmico
  if (
    item.product.pricingMode === 'DYNAMIC_ENGINEER' &&
    enableEngineering === false
  ) {
    return false;
  }

  return true;
};

// --- DND Components for Orders ---

const SortableItemCard = ({
  item,
  onView,
  onItemStatusChange
}: {
  item: any;
  onView: (pedidoId: string) => void;
  onItemStatusChange: (itemId: string, newStatus: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: item.id,
    data: {
      type: 'Item',
      item,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow mb-3">
        <CardContent className="p-3">
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-sm flex flex-col">
                <span className="text-primary">{item.orderNumber}</span>
                <span className="mt-1 text-base">{item.product.name}</span>
              </h4>
              <Badge variant="outline" className="text-[10px]">
                {item.quantity}un
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground truncate font-medium">
              {item.customerName}
            </p>

            {item.status && statusConfig[item.status as keyof typeof statusConfig] && (
              <div className="flex items-center gap-1.5 mt-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${statusConfig[item.status as keyof typeof statusConfig].color}`}
                >
                  {statusConfig[item.status as keyof typeof statusConfig].label}
                </Badge>
              </div>
            )}

            {/* Delivery Button for FINISHED items */}
            {item.status === 'FINISHED' && (
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 text-green-600 border-green-200 hover:bg-green-50 text-[10px] h-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onItemStatusChange(item.id, 'DELIVERED');
                }}
              >
                ✓ Marcar como Entregue
              </Button>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-dashed mt-2">
              <span className="text-[10px] text-muted-foreground flex items-center">
                <Calendar className="w-3 h-3 mr-1" />
                {new Date(item.orderCreatedAt).toLocaleDateString('pt-BR')}
              </span>
              <div className="flex items-center space-x-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(item.parentOrderId);
                  }}
                >
                  <Eye className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const KanbanColumnPedido = ({
  status,
  config,
  items,
  onView,
  onItemStatusChange
}: {
  status: string;
  config: any;
  items: any[];
  onView: (id: string) => void;
  onItemStatusChange: (itemId: string, newStatus: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <Card
      ref={setNodeRef}
      className={`flex-1 min-h-[500px] transition-colors ${isOver ? 'bg-primary/5 ring-2 ring-primary/20' : 'bg-background'}`}
    >
      <CardHeader className="pb-3 sticky top-0 bg-background/80 backdrop-blur z-10 rounded-t-lg border-b mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <config.icon className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm tracking-tight">{config.label}</span>
          </div>
          <Badge variant="secondary" className="text-[10px] h-5">
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-2 min-h-[150px]">
        <SortableContext
          id={status}
          items={items.map(i => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1 min-h-[100px]">
            {items.map((item) => (
              <SortableItemCard
                key={item.id}
                item={item}
                onView={onView}
                onItemStatusChange={onItemStatusChange}
              />
            ))}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
};


const Pedidos: React.FC = () => {
  const navigate = useNavigate();
  const { settings, hasPermission } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [processStatuses, setProcessStatuses] = useState<ProcessStatus[]>([]); // New state
  const [stats, setStats] = useState<PedidoStats | null>(null);
  const [loading, setLoading] = useState(true);

  // ... filters state

  useEffect(() => {
    loadProcessStatuses();
  }, []);

  const loadProcessStatuses = async () => {
    try {
      const response = await api.get('/api/organization/config/process-statuses');
      if (response.data.success) {
        setProcessStatuses(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load process statuses', error);
    }
  };

  // Helper to get display info
  const getStatusDisplay = (pedido: Pedido) => {
    // Always use workflow status (aggregated from items), not processStatus
    return statusConfig[pedido.status] || statusConfig.DRAFT;
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedPedidos, setSelectedPedidos] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [showMaterialCalculator, setShowMaterialCalculator] = useState(false);
  const [calculatorItem, setCalculatorItem] = useState<any>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [showAutomation, setShowAutomation] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [paymentAction, setPaymentAction] = useState('NONE');
  const [refundAmount, setRefundAmount] = useState<number>(0);

  // Função para verificar se o usuário tem acesso a informações financeiras
  const hasFinancialAccess = () => {
    return hasPermission('finance.view');
  };


  useEffect(() => {
    const timer = setTimeout(() => {
      loadPedidos(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadPedidos = async (search?: string) => {
    try {
      const params: any = {};
      if (search) params.search = search;

      const [pedidosResponse, statsResponse] = await Promise.all([
        api.get('/api/sales/orders', { params }),
        api.get('/api/sales/orders/stats')
      ]);

      const freshPedidos = pedidosResponse.data.data;
      setPedidos(freshPedidos);
      setStats(statsResponse.data.data);
      return freshPedidos;
    } catch (error) {
      toast.error('Erro ao carregar pedidos');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeItemId = active.id as string;
    const overId = over.id as string;

    const activeItem = kanbanItems.find(i => i.id === activeItemId);
    if (!activeItem) return;

    let targetStatus: string | null = null;

    // Se dropou em cima de uma coluna (ID da coluna é o status)
    if (Object.keys(statusConfig).includes(overId)) {
      targetStatus = overId;
    } else {
      // Se dropou em cima de outro card de item, pegamos o status desse item
      const overItem = kanbanItems.find(i => i.id === overId);
      if (overItem) {
        targetStatus = overItem.status;
      }
    }

    if (targetStatus && activeItem.status !== targetStatus) {
      handleItemOrderStatusChange(activeItemId, targetStatus);
    }

    setActiveId(null);
  };

  const handleItemOrderStatusChange = async (itemId: string, newStatus: string) => {
    try {
      const response = await api.patch(`/api/sales/orders/items/${itemId}/status`, { status: newStatus });
      const updatedPedido = response.data.data;

      // Atualiza a lista local de pedidos imediatamente com o pedido pai completo retornado
      setPedidos(prev => prev.map(p => p.id === updatedPedido.id ? updatedPedido : p));

      // Se o modal do pedido estiver aberto, atualiza também
      if (selectedPedido?.id === updatedPedido.id) {
        setSelectedPedido(updatedPedido);
      }

      toast.success('Status do item atualizado');
      loadPedidos(); // Recarrega stats
    } catch (error: any) {
      toast.error('Erro ao atualizar status do item');
    }
  };

  const handleStatusChange = async (pedidoId: string, newStatus: string, details?: any) => {
    try {
      // Determinar se é um ID de ProcessStatus ou um Status legado
      const isProcessStatus = processStatuses.some(s => s.id === newStatus);
      const payload: any = { ...details };

      if (isProcessStatus) {
        payload.processStatusId = newStatus;
      } else {
        payload.status = newStatus;
      }

      const response = await api.patch(`/api/sales/orders/${pedidoId}/status`, payload);
      const updatedPedido = response.data.data;

      // Atualiza a lista local de pedidos imediatamente
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, ...updatedPedido } : p));

      // Atualiza o estado do pedido selecionado para refletir no modal aberto
      if (selectedPedido?.id === pedidoId) {
        // Combinamos os dados recebidos com os dados atuais para não perder campos
        // que talvez o retorno simplificado da API não traga (como customer detalhado)
        setSelectedPedido(prev => prev ? { ...prev, ...updatedPedido } : null);
      }

      if (updatedPedido.customer?.phone && settings?.enableAutomation) {
        sendOrderWhatsApp({
          customerName: updatedPedido.customer.name,
          customerPhone: updatedPedido.customer.phone,
          orderNumber: updatedPedido.orderNumber,
          total: updatedPedido.total,
          status: updatedPedido.status, // Usa o status base para notificação por enquanto
          validUntil: updatedPedido.validUntil
        });
      }

      toast.success('Status atualizado com sucesso!');

      // Recarrega estatísticas e garante integridade da lista em segundo plano
      loadPedidos();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao atualizar status');
    }
  };



  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedPedidos.length === 0) {
      toast.error('Selecione pelo menos um pedido');
      return;
    }

    try {
      await Promise.all(
        selectedPedidos.map(id =>
          api.patch(`/api/sales/orders/${id}/status`, { status: newStatus })
        )
      );
      toast.success(`${selectedPedidos.length} pedido(s) atualizado(s) com sucesso!`);
      setSelectedPedidos([]);
      loadPedidos();
    } catch (error: any) {
      toast.error('Erro ao atualizar pedidos em lote');
    }
  };

  const handleSelectPedido = (pedidoId: string) => {
    setSelectedPedidos(prev =>
      prev.includes(pedidoId)
        ? prev.filter(id => id !== pedidoId)
        : [...prev, pedidoId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPedidos.length === filteredPedidos.length) {
      setSelectedPedidos([]);
    } else {
      setSelectedPedidos(filteredPedidos.map(p => p.id));
    }
  };

  const sendOverdueReminders = async () => {
    const overduePedidos = getOverduePedidos();
    let sentCount = 0;

    for (const pedido of overduePedidos) {
      if (pedido.customer.phone) {
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
  };

  const openMaterialCalculator = (item: any) => {
    setCalculatorItem(item);
    setShowMaterialCalculator(true);
  };

  const openWhatsAppModal = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setWhatsAppMessage('');
    setShowWhatsAppModal(true);
  };

  const sendCustomWhatsApp = () => {
    if (selectedPedido && selectedPedido.customer.phone && whatsAppMessage.trim()) {
      WhatsAppService.sendCustomMessage(
        selectedPedido.customer.phone,
        selectedPedido.customer.name,
        whatsAppMessage
      );
      setShowWhatsAppModal(false);
      toast.success('Mensagem enviada via WhatsApp!');
    }
  };

  const exportPedidos = async () => {
    try {
      const response = await api.get('/api/sales/orders/export', {
        responseType: 'blob',
        params: {
          status: statusFilter,
          search: searchTerm,
          date: dateFilter
        }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pedidos_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar relatório');
    }
  };

  const filteredPedidos = pedidos
    .filter(pedido => {
      const matchesSearch =
        pedido.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pedido.customer.phone && pedido.customer.phone.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = !statusFilter || pedido.status === statusFilter;

      const matchesDate = !dateFilter ||
        new Date(pedido.createdAt).toISOString().split('T')[0] === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    })
    .sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'value':
          aValue = a.total;
          bValue = b.total;
          break;
        case 'customer':
          aValue = a.customer.name.toLowerCase();
          bValue = b.customer.name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const getOverduePedidos = () => {
    return pedidos.filter(pedido =>
      pedido.status === 'DRAFT' &&
      pedido.validUntil &&
      new Date(pedido.validUntil) < new Date()
    );
  };

  const getPendingValue = () => {
    return pedidos
      .filter(p => ['DRAFT', 'APPROVED', 'IN_PRODUCTION'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.total), 0);
  };

  // Transformar Pedidos em Itens para o Kanban (Visão Granular)
  const kanbanItems = useMemo(() => {
    const items: any[] = [];
    filteredPedidos.forEach(pedido => {
      pedido.items.forEach(item => {
        items.push({
          ...item,
          parentOrderId: pedido.id,
          orderNumber: pedido.orderNumber,
          customerName: pedido.customer.name,
          orderCreatedAt: pedido.createdAt,
          // Se o item não tem status (backfill não rodou ou item novo), usa o do pedido por enquanto
          status: (item as any).status || pedido.status
        });
      });
    });
    return items;
  }, [filteredPedidos]);

  if (loading) {
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
          <p className="text-muted-foreground">
            Gerencie pedidos e ordens de serviço
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={exportPedidos}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          {settings?.enableAutomation && (
            <Button variant="outline" onClick={() => setShowAutomation(!showAutomation)}>
              <Bell className="w-4 h-4 mr-2" />
              Automação
            </Button>
          )}
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
            >
              <Kanban className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={() => navigate('/pedidos/criar')}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Pedido
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[300px] space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Buscar Pedido</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Número, cliente ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 border-muted-foreground/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="w-48 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 px-3 border border-muted-foreground/20 rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              >
                <option value="">Todos</option>
                {Object.entries(statusConfig).map(([status, config]) => (
                  <option key={status} value={status}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-44 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Data</label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-10 border-muted-foreground/20"
              />
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
                  <Button
                    variant="outline"
                    className="h-10 w-10 p-0 border-muted-foreground/20"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="pb-0.5">
              <Button
                variant="ghost"
                className="h-10 text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setDateFilter('');
                  setSortBy('date');
                  setSortOrder('desc');
                }}
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats and Quick Actions - Hidden when filtering */}
      {!(searchTerm || statusFilter || dateFilter) && (
        <div className="space-y-6">
          {/* Stats Dashboard */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total de Pedidos</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                      <p className="text-xs text-muted-foreground">
                        Crescimento: {stats.monthlyGrowth > 0 ? '+' : ''}{(stats.monthlyGrowth || 0).toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <BarChart3 className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {hasFinancialAccess() && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                        <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                        <p className="text-xs text-muted-foreground">
                          Ticket médio: {formatCurrency(stats.avgOrderValue)}
                        </p>
                      </div>
                      <div className="p-3 bg-green-100 rounded-full">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
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
                          <p className="text-2xl font-bold">{formatCurrency(getPendingValue())}</p>
                          <p className="text-xs text-muted-foreground">
                            {pedidos.filter(p => ['APPROVED', 'IN_PRODUCTION'].includes(p.status)).length} pedidos
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-bold">
                            {pedidos.filter(p => ['APPROVED', 'IN_PRODUCTION'].includes(p.status)).length}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            pedidos na fila
                          </p>
                        </>
                      )}
                    </div>
                    <div className="p-3 bg-yellow-100 rounded-full">
                      <Activity className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Vencidos</p>
                      <p className="text-2xl font-bold text-red-600">{getOverduePedidos().length}</p>
                      <p className="text-xs text-muted-foreground">
                        Orçamentos expirados
                      </p>
                    </div>
                    <div className="p-3 bg-red-100 rounded-full">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
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
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprovar Pendentes ({pedidos.filter(p => p.status === 'DRAFT').length})
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="border-orange-200 text-orange-700 hover:bg-orange-100"
                    onClick={sendOverdueReminders}
                    disabled={getOverduePedidos().length === 0}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Lembrar Vencidos ({getOverduePedidos().length})
                  </Button>

                  <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-100">
                    <Package className="w-4 h-4 mr-2" />
                    Produção ({pedidos.filter(p => p.status === 'IN_PRODUCTION').length})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showAutomation && settings?.enableAutomation && (
        <OrderAutomation
          orders={pedidos}
          onRuleExecute={(_, orderIds) => {
            toast.success(`Automação executada para ${orderIds.length} pedido(s)!`);
          }}
        />
      )}

      {selectedPedidos.length > 0 && (
        <Card className="border-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="font-medium">
                  {selectedPedidos.length} pedido(s) selecionado(s)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPedidos([])}
                >
                  Limpar Seleção
                </Button>
              </div>

              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('APPROVED')}>
                  Aprovar Selecionados
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('IN_PRODUCTION')}>
                  Enviar para Produção
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('CANCELLED')}>
                  Cancelar Selecionados
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'kanban' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-[calc(100vh-250px)] gap-4 pb-4">
            {Object.entries(statusConfig)
              .filter(([status]) => status !== 'DELIVERED' && status !== 'CANCELLED')
              .map(([status, config]) => (
                <KanbanColumnPedido
                  key={status}
                  status={status}
                  config={config}
                  items={kanbanItems.filter(i => i.status === status)}
                  onView={(id) => {
                    const pedido = pedidos.find(p => p.id === id);
                    if (pedido) setSelectedPedido(pedido);
                  }}
                  onItemStatusChange={handleItemOrderStatusChange}
                />
              ))}
          </div>

          <DragOverlay dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.4',
                },
              },
            }),
          }}>
            {activeId ? (() => {
              const activeItem = kanbanItems.find(i => i.id === activeId);
              if (!activeItem) return null;
              return (
                <div className="rotate-2 cursor-grabbing w-[280px]">
                  <Card className="shadow-2xl border-primary/50 ring-2 ring-primary/20">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-sm">#{activeItem.orderNumber}</span>
                        <Badge variant="outline" className="text-[10px]">{activeItem.quantity}un</Badge>
                      </div>
                      <p className="text-sm font-medium truncate mb-1">{activeItem.product.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{activeItem.customerName}</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>
      )}

      {viewMode === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedPedidos.length === filteredPedidos.length && filteredPedidos.length > 0}
                onChange={handleSelectAll}
                className="rounded border-input"
              />
              <span className="text-sm text-muted-foreground">
                {filteredPedidos.length} pedido(s) encontrado(s)
              </span>
            </div>
          </div>

          {filteredPedidos.map((pedido) => {
            const statusInfo = statusConfig[pedido.status];
            const isOverdue = pedido.status === 'DRAFT' && pedido.validUntil &&
              new Date(pedido.validUntil) < new Date();

            return (
              <Card
                key={pedido.id}
                className={`
                  transition-all duration-200 shadow-sm hover:shadow-md border-l-[4px] 
                  ${(statusInfo as any).border || 'border-l-muted'} 
                  ${isOverdue ? 'bg-red-50/50 border-red-200' : 'bg-card hover:border-slate-300'}
                `}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedPedidos.includes(pedido.id)}
                        onChange={() => handleSelectPedido(pedido.id)}
                        className="rounded border-input"
                      />

                      <div className="flex flex-col">
                        <h3 className="font-bold text-lg text-foreground leading-tight flex items-center space-x-2">
                          <span>{pedido.customer.name}</span>
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {pedido.orderNumber}
                          </span>
                          {isOverdue && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-bold uppercase">
                              Vencido
                            </span>
                          )}
                        </h3>
                        {pedido.customer.phone && (
                          <p className="text-sm font-semibold text-blue-700 flex items-center mt-1">
                            <Phone className="w-3.5 h-3.5 mr-1.5" />
                            {pedido.customer.phone}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDateTime(pedido.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-semibold text-lg">{formatCurrency(pedido.total)}</p>
                        {(() => {
                          const totalPaid = pedido.transactions?.reduce((sum, t) => {
                            if (t.type === 'INCOME' && t.status === 'PAID') return sum + Number(t.amount);
                            return sum;
                          }, 0) || 0;
                          const pendingAmount = pedido.total - totalPaid;
                          const isPaid = totalPaid >= pedido.total - 0.01;
                          const isPartial = totalPaid > 0 && !isPaid;

                          if (isPaid) {
                            return <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block mt-1">Pago</span>;
                          }

                          return (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${isPartial ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50'}`}>
                              {isPartial ? 'Parcial: ' : 'Pendente: '}{pendingAmount > 0 ? formatCurrency(pendingAmount) : 'R$ 0,00'}
                            </span>
                          );
                        })()}
                        <p className="text-xs text-muted-foreground mt-1">
                          {pedido.items.length} item(s)
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {(() => {
                          const statusDisplay = getStatusDisplay(pedido);
                          const isDynamic = !!pedido.processStatus;
                          const isInteractive = pedido.status !== 'DELIVERED' && pedido.status !== 'CANCELLED';

                          if (!isInteractive) {
                            return isDynamic ? (
                              <span
                                className="px-3 py-1 rounded-full text-xs font-medium border"
                                style={{
                                  backgroundColor: (statusDisplay as any).badgeColor?.startsWith('#')
                                    ? `${(statusDisplay as any).badgeColor}20`
                                    : '#f3f4f6',
                                  color: (statusDisplay as any).badgeColor || '#374151',
                                  borderColor: (statusDisplay as any).badgeColor || '#d1d5db'
                                }}
                              >
                                {statusDisplay.label}
                              </span>
                            ) : (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${(statusDisplay as any).color}`}>
                                {statusDisplay.label}
                              </span>
                            );
                          }

                          return (
                            <div className="relative">
                              <select
                                value={pedido.processStatusId || pedido.status}
                                onChange={(e) => {
                                  const newStatus = e.target.value;
                                  const targetProcessStatus = processStatuses.find(s => s.id === newStatus);
                                  const isCancelled = newStatus === 'CANCELLED' || targetProcessStatus?.mappedBehavior === 'CANCELLED';

                                  if (isCancelled) {
                                    setSelectedPedido(pedido);
                                    setCancelReason('');
                                    setPaymentAction('NONE');
                                    setRefundAmount(Number(pedido.total));
                                    setShowCancelModal(true);
                                  } else {
                                    handleStatusChange(pedido.id, newStatus);
                                  }
                                }}
                                className={`appearance-none pl-3 pr-8 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${!isDynamic ? (statusDisplay as any).color : ''
                                  }`}
                                style={{
                                  backgroundColor: isDynamic && (statusDisplay as any).badgeColor?.startsWith('#')
                                    ? `${(statusDisplay as any).badgeColor}20`
                                    : isDynamic ? '#f3f4f6' : undefined,
                                  color: isDynamic ? (statusDisplay as any).badgeColor || '#374151' : undefined,
                                  borderColor: isDynamic ? (statusDisplay as any).badgeColor || '#d1d5db' : undefined,
                                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'currentColor\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'right 8px center'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {processStatuses.length > 0 ? (
                                  <>
                                    {!pedido.processStatusId && !processStatuses.some(s => s.id === pedido.processStatusId) && (
                                      <option value={pedido.status} disabled hidden>
                                        {statusConfig[pedido.status]?.label || pedido.status}
                                      </option>
                                    )}
                                    {processStatuses.map(status => (
                                      <option key={status.id} value={status.id}>{status.name}</option>
                                    ))}
                                  </>
                                ) : (
                                  Object.entries(statusConfig).map(([status, config]) => (
                                    <option key={status} value={status}>
                                      {config.label}
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex space-x-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setSelectedPedido(pedido)}
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {pedido.status === 'DRAFT' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => navigate(`/pedidos/criar?edit=${pedido.id}`)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}

                        <Button size="icon" variant="ghost" title="Imprimir">
                          <Printer className="w-4 h-4" />
                        </Button>


                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    {pedido.status === 'DRAFT' && pedido.validUntil && (
                      <div className="mb-4">
                        <DatasOrcamento
                          criadoEm={pedido.createdAt}
                          validadeEm={pedido.validUntil}
                          className="p-3 bg-muted rounded-lg"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {pedido.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="text-sm bg-muted p-2 rounded">
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-muted-foreground">
                            {shouldShowDimensions(item, settings?.enableEngineering) ? (
                              `${item.width} × ${item.height}mm • ${item.quantity}un`
                            ) : (
                              `${item.quantity}un`
                            )}
                          </p>
                          <p className="font-medium">{formatCurrency(item.totalPrice)}</p>
                        </div>
                      ))}
                      {pedido.items.length > 3 && (
                        <div className="text-sm bg-muted p-2 rounded flex items-center justify-center">
                          <span className="text-muted-foreground">
                            +{pedido.items.length - 3} item(s)
                          </span>
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
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter ? 'Tente ajustar os filtros' : 'Comece criando seu primeiro pedido'}
                </p>
                {!searchTerm && !statusFilter && (
                  <Button onClick={() => navigate('/pedidos/criar')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Pedido
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pedido Detail Modal */}
      {selectedPedido && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <span>{selectedPedido.orderNumber}</span>
                    {(() => {
                      const statusDisplay = getStatusDisplay(selectedPedido);
                      return (
                        <span className={`px-2 py-1 rounded text-sm ${(statusDisplay as any).color}`}>
                          {statusDisplay.label}
                        </span>
                      );
                    })()}
                  </CardTitle>
                  <CardDescription>
                    Cliente: {selectedPedido.customer.name}
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedPedido(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <User className="w-5 h-5" />
                        <span>Informações do Cliente</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p><span className="font-medium">Nome:</span> {selectedPedido.customer.name}</p>
                          {selectedPedido.customer.email && (
                            <p><span className="font-medium">Email:</span> {selectedPedido.customer.email}</p>
                          )}
                          {selectedPedido.customer.phone && (
                            <p><span className="font-medium">Telefone:</span> {selectedPedido.customer.phone}</p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          {selectedPedido.customer.phone && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendOrderWhatsApp({
                                  customerName: selectedPedido.customer.name,
                                  customerPhone: selectedPedido.customer.phone!,
                                  orderNumber: selectedPedido.orderNumber,
                                  total: selectedPedido.total,
                                  status: selectedPedido.status,
                                  validUntil: selectedPedido.validUntil
                                })}
                              >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Status WhatsApp
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openWhatsAppModal(selectedPedido)}
                              >
                                <Send className="w-4 h-4 mr-2" />
                                Mensagem
                              </Button>
                            </>
                          )}
                          {selectedPedido.customer.email && (
                            <Button size="sm" variant="outline">Email</Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedPedido.status === 'DRAFT' && selectedPedido.validUntil && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <Calendar className="w-5 h-5" />
                          <span>Validade do Orçamento</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <DatasOrcamento
                          criadoEm={selectedPedido.createdAt}
                          validadeEm={selectedPedido.validUntil}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {selectedPedido.status === 'CANCELLED' && (
                    <Card className="border-red-200 bg-red-50 mb-4">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg text-red-700 flex items-center">
                          <AlertTriangle className="w-5 h-5 mr-2" />
                          Pedido Cancelado
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-red-800">
                        <p><span className="font-bold">Motivo:</span> {selectedPedido.cancellationReason || 'Não informado'}</p>
                        <p><span className="font-bold">Ação Financeira:</span> {
                          selectedPedido.cancellationPaymentAction === 'REFUND' ? 'Reembolso Solicitado' :
                            selectedPedido.cancellationPaymentAction === 'CREDIT' ? 'Convertido em Crédito' :
                              'Nenhuma ação financeira'
                        }</p>
                        {selectedPedido.cancellationRefundAmount && (
                          <p><span className="font-bold">Valor:</span> {formatCurrency(selectedPedido.cancellationRefundAmount)}</p>
                        )}
                        <p><span className="font-bold">Data:</span> {selectedPedido.cancelledAt ? formatDateTime(selectedPedido.cancelledAt as any) : 'Não informada'}</p>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <Package className="w-5 h-5" />
                        <span>Itens do Pedido</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedPedido.items.map((item, index) => (
                          <div key={item.id} className="border border-border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-sm">
                                    #{index + 1}
                                  </span>
                                  <h5 className="font-medium">{item.product.name}</h5>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                  {shouldShowDimensions(item, settings?.enableEngineering) && (
                                    <p><span className="font-medium">Dimensões:</span> {item.width} × {item.height} mm</p>
                                  )}
                                  <p><span className="font-medium">Quantidade:</span> {item.quantity} unidade(s)</p>
                                  {item.product?.pricingMode === 'SIMPLE_AREA' && (
                                    <>
                                      <p><span className="font-medium">Área:</span> {(((item.width || 0) * (item.height || 0)) / 1000000).toFixed(4)} m²</p>
                                      <p><span className="font-medium">Área Total:</span> {(((item.width || 0) * (item.height || 0) * (item.quantity || 0)) / 1000000).toFixed(4)} m²</p>
                                    </>
                                  )}
                                </div>

                                {item.product?.pricingMode === 'SIMPLE_UNIT' && (item.paperSize || item.paperType || item.printColors) && (
                                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                                    <p className="font-medium text-green-800 mb-1">Especificações de Impressão:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {item.isCustomSize && item.customSizeName && (
                                        <p><span className="font-medium">Tamanho:</span> {item.customSizeName}</p>
                                      )}
                                      {!item.isCustomSize && item.paperSize && (
                                        <p><span className="font-medium">Papel:</span> {item.paperSize}</p>
                                      )}
                                      {item.paperType && <p><span className="font-medium">Tipo:</span> {item.paperType}</p>}
                                      {item.printColors && (
                                        <>
                                          <p><span className="font-medium">Cores:</span> {item.printColors}</p>
                                          <p><span className="font-medium">Lados:</span> {item.printColors?.includes('x1') || item.printColors?.includes('x4') ? 'Frente e Verso' : 'Apenas Frente'}</p>
                                        </>
                                      )}
                                      {item.finishing && <p><span className="font-medium">Acabamento:</span> {item.finishing}</p>}
                                    </div>
                                  </div>
                                )}

                                {item.product?.pricingMode === 'DYNAMIC_ENGINEER' && (item.machineTime || item.setupTime || item.complexity) && (
                                  <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-sm">
                                    <p className="font-medium text-purple-800 mb-1">Especificações de Produção:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {item.machineTime && <p><span className="font-medium">Tempo Máquina:</span> {item.machineTime} min</p>}
                                      {item.setupTime && <p><span className="font-medium">Setup:</span> {item.setupTime} min</p>}
                                      {item.complexity && <p><span className="font-medium">Complexidade:</span> {item.complexity}</p>}
                                    </div>
                                  </div>
                                )}

                                {item.notes && (
                                  <div className="mt-2 p-2 bg-muted rounded text-sm">
                                    <span className="font-medium">Observações:</span> {item.notes}
                                  </div>
                                )}

                                {/* Item Status Selector - Badge Style */}
                                <div className="mt-4 flex items-center space-x-2">
                                  <select
                                    value={(item as any).status || 'DRAFT'}
                                    onChange={(e) => handleItemOrderStatusChange(item.id, e.target.value as any)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${statusConfig[(item as any).status as keyof typeof statusConfig]?.color || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                                    style={{ appearance: 'none', paddingRight: '28px', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'currentColor\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                                  >
                                    <option value="DRAFT">Pedido Criado</option>
                                    <option value="APPROVED">Aguardando Aprovação</option>
                                    <option value="IN_PRODUCTION">Em Produção</option>
                                    <option value="FINISHED">Aguardando Retirada</option>
                                  </select>

                                  {/* Delivery Button for FINISHED items */}
                                  {(item as any).status === 'FINISHED' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-green-600 border-green-200 hover:bg-green-50"
                                      onClick={() => handleItemOrderStatusChange(item.id, 'DELIVERED')}
                                    >
                                      ✓ Marcar como Entregue
                                    </Button>
                                  )}

                                  {/* Show delivered badge */}
                                  {(item as any).status === 'DELIVERED' && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                      ✓ Entregue
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="font-medium">
                                  {formatCurrency(item.unitPrice)}
                                  {item.product?.pricingMode === 'SIMPLE_AREA' ? '/m²' : '/un'}
                                </p>
                                <p className="text-lg font-bold">{formatCurrency(item.totalPrice)}</p>

                                {hasFinancialAccess() && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-2"
                                    onClick={() => openMaterialCalculator(item)}
                                  >
                                    <Calculator className="w-3 h-3 mr-1" />
                                    Material
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {selectedPedido.status !== 'DRAFT' && selectedPedido.status !== 'CANCELLED' && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <Activity className="w-5 h-5" />
                          <span>Timeline de Produção</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {[
                            { status: 'APPROVED', label: 'Pedido Aprovado', icon: CheckCircle },
                            { status: 'IN_PRODUCTION', label: 'Em Produção', icon: Package },
                            { status: 'FINISHED', label: 'Produção Finalizada', icon: CheckCircle },
                            { status: 'DELIVERED', label: 'Entregue', icon: CheckCircle }
                          ].map((step) => {
                            const isCompleted = Object.keys(statusConfig).indexOf(selectedPedido.status) >= Object.keys(statusConfig).indexOf(step.status);
                            const isCurrent = selectedPedido.status === step.status;
                            const StepIcon = step.icon;

                            return (
                              <div key={step.status} className="flex items-center space-x-3">
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-100' : isCurrent ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                  <StepIcon className={`w-4 h-4 ${isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`} />
                                </div>
                                <div className="flex-1">
                                  <p className={`font-medium ${isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {step.label}
                                  </p>
                                  {(() => {
                                    let eventDate = null;
                                    if (step.status === 'APPROVED') eventDate = selectedPedido.approvedAt || selectedPedido.createdAt;
                                    if (step.status === 'IN_PRODUCTION') eventDate = selectedPedido.inProductionAt;
                                    if (step.status === 'FINISHED') eventDate = selectedPedido.finishedAt;
                                    if (step.status === 'DELIVERED') eventDate = selectedPedido.deliveredAt || (selectedPedido.status === 'DELIVERED' ? selectedPedido.updatedAt : null);

                                    if (eventDate && isCompleted) {
                                      return (
                                        <p className="text-xs text-muted-foreground flex items-center mt-0.5">
                                          <Calendar className="w-3 h-3 mr-1" />
                                          {formatDateTime(eventDate)}
                                        </p>
                                      );
                                    }

                                    if (isCurrent) {
                                      return <p className="text-sm text-muted-foreground mt-0.5 italic">Em andamento...</p>;
                                    }

                                    return null;
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {hasFinancialAccess() && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <Target className="w-5 h-5" />
                          <span>Análise Financeira</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Subtotal:</span>
                              <p className="text-lg font-bold">{formatCurrency(selectedPedido.total)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Custo Estimado:</span>
                              <p className="text-lg font-bold text-red-600">{formatCurrency(selectedPedido.total * 0.6)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Margem Bruta:</span>
                              <p className="text-lg font-bold text-green-600">{formatCurrency(selectedPedido.total * 0.4)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Margem %:</span>
                              <p className="text-lg font-bold text-green-600">40%</p>
                            </div>
                          </div>
                          <div className="border-t pt-4">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Total do Pedido:</span>
                              <span className="text-2xl font-bold">{formatCurrency(selectedPedido.total)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Ações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedPedido.status === 'DRAFT' && (
                        <Button className="w-full" onClick={() => handleStatusChange(selectedPedido.id, 'APPROVED')}>
                          <CheckCircle className="w-4 h-4 mr-2" /> Aprovar Pedido
                        </Button>
                      )}
                      {selectedPedido.status === 'APPROVED' && (
                        <Button className="w-full" onClick={() => handleStatusChange(selectedPedido.id, 'IN_PRODUCTION')}>
                          <Package className="w-4 h-4 mr-2" /> Iniciar Produção
                        </Button>
                      )}
                      {selectedPedido.status === 'IN_PRODUCTION' && (
                        <Button className="w-full" onClick={() => handleStatusChange(selectedPedido.id, 'FINISHED')}>
                          <CheckCircle className="w-4 h-4 mr-2" /> Finalizar Produção
                        </Button>
                      )}
                      {selectedPedido.status === 'FINISHED' && (
                        <Button className="w-full" onClick={() => handleStatusChange(selectedPedido.id, 'DELIVERED')}>
                          <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Entregue
                        </Button>
                      )}
                      {!['DELIVERED', 'CANCELLED'].includes(selectedPedido.status) && (
                        <Button
                          variant="outline"
                          className="w-full text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            setCancelReason('');
                            setPaymentAction('NONE');
                            setRefundAmount(Number(selectedPedido.total));
                            setShowCancelModal(true);
                          }}
                        >
                          <XCircle className="w-4 h-4 mr-2" /> Cancelar Pedido
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Informações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div><span className="font-medium">Criado em:</span><p>{formatDateTime(selectedPedido.createdAt)}</p></div>
                      {selectedPedido.deliveryDate && (
                        <div><span className="font-medium">Entrega prevista:</span><p>{formatDateTime(selectedPedido.deliveryDate)}</p></div>
                      )}
                      <div><span className="font-medium">Itens:</span><p>{selectedPedido.items.length} produto(s)</p></div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Observações</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedPedido.notes ? (<p className="text-sm">{selectedPedido.notes}</p>) : (<p className="text-sm text-muted-foreground">Nenhuma observação</p>)}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showCancelModal && selectedPedido && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center">
                <XCircle className="w-5 h-5 mr-2" />
                Confirmar Cancelamento
              </CardTitle>
              <CardDescription>
                Pedido #{selectedPedido.orderNumber} - {selectedPedido.customer.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo do Cancelamento:</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Explique o motivo do cancelamento..."
                  className="w-full h-24 p-2 border border-input rounded-md resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ação Financeira:</label>
                <select
                  value={paymentAction}
                  onChange={(e) => setPaymentAction(e.target.value)}
                  className="w-full p-2 border border-input rounded-md bg-transparent"
                >
                  <option value="NONE">Ninhuma (Apenas cancelar)</option>
                  <option value="REFUND">Solicitar Estorno/Devolução</option>
                  <option value="CREDIT">Converter em Crédito para o Cliente</option>
                </select>
              </div>

              {paymentAction !== 'NONE' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valor a Estornar/Creditar (R$):</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Math.min(Number(e.target.value), Number(selectedPedido.total)))}
                    max={Number(selectedPedido.total)}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground italic">
                    Valor total do pedido: {formatCurrency(selectedPedido.total)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground italic">
                  * A ação definitiva será processada no módulo financeiro.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex space-x-2">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!cancelReason.trim()}
                onClick={() => {
                  handleStatusChange(selectedPedido.id, 'CANCELLED', {
                    reason: cancelReason,
                    paymentAction: paymentAction,
                    refundAmount: refundAmount
                  });
                  setShowCancelModal(false);
                }}
              >
                Confirmar Cancelamento
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelModal(false)}
              >
                Voltar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {showMaterialCalculator && calculatorItem && hasFinancialAccess() && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Calculadora de Materiais</CardTitle>
                    <CardDescription>
                      {calculatorItem.product.name} - {calculatorItem.width} × {calculatorItem.height}mm
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setShowMaterialCalculator(false)}>Fechar</Button>
                </div>
              </CardHeader>
              <CardContent>
                <MaterialCalculator
                  width={calculatorItem.width}
                  height={calculatorItem.height}
                  quantity={calculatorItem.quantity}
                  onCalculationComplete={() => { }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {showWhatsAppModal && selectedPedido && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>Enviar WhatsApp</span>
                  </CardTitle>
                  <CardDescription>Para: {selectedPedido.customer.name}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowWhatsAppModal(false)}>Fechar</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Mensagem:</label>
                <textarea
                  value={whatsAppMessage}
                  onChange={(e) => setWhatsAppMessage(e.target.value)}
                  placeholder="Digite sua mensagem personalizada..."
                  className="w-full h-32 p-3 border border-input rounded-md resize-none mt-1"
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={sendCustomWhatsApp} disabled={!whatsAppMessage.trim()} className="flex-1">
                  <Send className="w-4 h-4 mr-2" /> Enviar
                </Button>
                <Button variant="outline" onClick={() => setShowWhatsAppModal(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Pedidos;