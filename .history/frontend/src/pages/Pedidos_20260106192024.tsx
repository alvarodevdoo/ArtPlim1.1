import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
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
  Filter,
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
  Send
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { sendOrderWhatsApp, WhatsAppService } from '@/lib/whatsapp';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Pedido {
  id: string;
  orderNumber: string;
  status: 'DRAFT' | 'APPROVED' | 'IN_PRODUCTION' | 'FINISHED' | 'DELIVERED' | 'CANCELLED';
  total: number;
  createdAt: string;
  validUntil?: string;
  deliveryDate?: string;
  notes?: string;
  customer: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    width: number;
    height: number;
    notes?: string;
    
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
    };
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
  DRAFT: { label: 'Rascunho', color: 'bg-gray-100 text-gray-800', icon: Edit },
  APPROVED: { label: 'Aprovado', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  IN_PRODUCTION: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-800', icon: Package },
  FINISHED: { label: 'Finalizado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  DELIVERED: { label: 'Entregue', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle }
};

const Pedidos: React.FC = () => {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [stats, setStats] = useState<PedidoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPedidos, setSelectedPedidos] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showMaterialCalculator, setShowMaterialCalculator] = useState(false);
  const [calculatorItem, setCalculatorItem] = useState<any>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [showAutomation, setShowAutomation] = useState(false);

  useEffect(() => {
    loadPedidos();
  }, []);

  const loadPedidos = async () => {
    try {
      const [pedidosResponse, statsResponse] = await Promise.all([
        api.get('/api/sales/orders'),
        api.get('/api/sales/orders/stats')
      ]);
      
      setPedidos(pedidosResponse.data.data);
      setStats(statsResponse.data.data);
    } catch (error) {
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (pedidoId: string, newStatus: string) => {
    try {
      await api.patch(`/api/sales/orders/${pedidoId}/status`, { status: newStatus });
      
      // Encontrar o pedido atualizado para enviar WhatsApp
      const updatedPedido = pedidos.find(p => p.id === pedidoId);
      if (updatedPedido && updatedPedido.customer.phone) {
        // Enviar notificação automática via WhatsApp
        sendOrderWhatsApp({
          customerName: updatedPedido.customer.name,
          customerPhone: updatedPedido.customer.phone,
          orderNumber: updatedPedido.orderNumber,
          total: updatedPedido.total,
          status: newStatus,
          validUntil: updatedPedido.validUntil
        });
      }
      
      toast.success('Status atualizado com sucesso!');
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
          date: dateFilter,
          customer: customerFilter
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
        pedido.customer.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !statusFilter || pedido.status === statusFilter;
      
      const matchesCustomer = !customerFilter || 
        pedido.customer.name.toLowerCase().includes(customerFilter.toLowerCase());
      
      const matchesDate = !dateFilter || 
        new Date(pedido.createdAt).toISOString().split('T')[0] === dateFilter;
      
      return matchesSearch && matchesStatus && matchesCustomer && matchesDate;
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
      .reduce((sum, p) => sum + p.total, 0);
  };

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
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <Button variant="outline" onClick={() => setShowAutomation(!showAutomation)}>
            <Bell className="w-4 h-4 mr-2" />
            Automação
          </Button>
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
                    Crescimento: {stats.monthlyGrowth > 0 ? '+' : ''}{stats.monthlyGrowth.toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

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

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                  <p className="text-2xl font-bold">{formatCurrency(getPendingValue())}</p>
                  <p className="text-xs text-muted-foreground">
                    {pedidos.filter(p => ['APPROVED', 'IN_PRODUCTION'].includes(p.status)).length} pedidos
                  </p>
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
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros Avançados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Número ou cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value="">Todos os status</option>
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <option key={status} value={status}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Data</label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cliente</label>
                <Input
                  placeholder="Nome do cliente..."
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">Ordenar por:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="h-8 px-2 text-sm border border-input rounded bg-background"
                  >
                    <option value="date">Data</option>
                    <option value="value">Valor</option>
                    <option value="customer">Cliente</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('');
                    setDateFilter('');
                    setCustomerFilter('');
                    setSortBy('date');
                    setSortOrder('desc');
                  }}
                >
                  Limpar Filtros
                </Button>
                <Button onClick={() => setShowFilters(false)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Automation Panel */}
      {showAutomation && (
        <OrderAutomation 
          orders={pedidos}
          onRuleExecute={(ruleId, orderIds) => {
            console.log(`Executando regra ${ruleId} para pedidos:`, orderIds);
            toast.success(`Automação executada para ${orderIds.length} pedido(s)!`);
          }}
        />
      )}

      {/* Bulk Actions */}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusChange('APPROVED')}
                >
                  Aprovar Selecionados
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusChange('IN_PRODUCTION')}
                >
                  Enviar para Produção
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusChange('CANCELLED')}
                >
                  Cancelar Selecionados
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(statusConfig).map(([status, config]) => {
            const statusPedidos = filteredPedidos.filter(p => p.status === status);
            
            return (
              <Card key={status} className="min-h-[500px]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <config.icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{config.label}</span>
                    </div>
                    <span className="bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs">
                      {statusPedidos.length}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {statusPedidos.map((pedido) => (
                    <Card key={pedido.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-sm">{pedido.orderNumber}</h4>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(pedido.total)}
                            </span>
                          </div>
                          
                          <p className="text-xs text-muted-foreground truncate">
                            {pedido.customer.name}
                          </p>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                              {new Date(pedido.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                            <div className="flex space-x-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => setSelectedPedido(pedido)}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              {pedido.status === 'DRAFT' && pedido.validUntil && 
                               new Date(pedido.validUntil) < new Date() && (
                                <AlertTriangle className="w-3 h-3 text-red-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* List Header */}
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
            const StatusIcon = statusInfo.icon;
            const isOverdue = pedido.status === 'DRAFT' && pedido.validUntil && 
                             new Date(pedido.validUntil) < new Date();
            
            return (
              <Card key={pedido.id} className={isOverdue ? 'border-red-200 bg-red-50' : ''}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedPedidos.includes(pedido.id)}
                        onChange={() => handleSelectPedido(pedido.id)}
                        className="rounded border-input"
                      />
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-lg">{pedido.orderNumber}</h3>
                          {isOverdue && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                              Vencido
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground">{pedido.customer.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(pedido.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-semibold text-lg">{formatCurrency(pedido.total)}</p>
                        <p className="text-sm text-muted-foreground">
                          {pedido.items.length} item(s)
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
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

                        <Button
                          size="icon"
                          variant="ghost"
                          title="Imprimir"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>

                        {pedido.status !== 'DELIVERED' && pedido.status !== 'CANCELLED' && (
                          <select
                            value={pedido.status}
                            onChange={(e) => handleStatusChange(pedido.id, e.target.value)}
                            className="h-8 px-2 text-sm border border-input rounded bg-background"
                          >
                            {Object.entries(statusConfig).map(([status, config]) => (
                              <option key={status} value={status}>
                                {config.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="mt-4 pt-4 border-t">
                    {/* Datas do Orçamento */}
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
                            {item.width} × {item.height}mm • {item.quantity}un
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
                    <span className={`px-2 py-1 rounded text-sm ${statusConfig[selectedPedido.status].color}`}>
                      {statusConfig[selectedPedido.status].label}
                    </span>
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
                  <Button
                    variant="outline"
                    onClick={() => setSelectedPedido(null)}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Customer Info */}
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
                            <Button size="sm" variant="outline">
                              Email
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Datas do Orçamento no Modal */}
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

                  {/* Items */}
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
                                  <p><span className="font-medium">Dimensões:</span> {item.width} × {item.height} mm</p>
                                  <p><span className="font-medium">Quantidade:</span> {item.quantity} unidade(s)</p>
                                  
                                  {/* Mostrar área apenas para produtos por m² */}
                                  {item.product?.pricingMode === 'SIMPLE_AREA' && (
                                    <>
                                      <p><span className="font-medium">Área:</span> {((item.width * item.height) / 1000000).toFixed(4)} m²</p>
                                      <p><span className="font-medium">Área Total:</span> {((item.width * item.height * item.quantity) / 1000000).toFixed(4)} m²</p>
                                    </>
                                  )}
                                </div>
                                
                                {/* Campos específicos por tipo de produto */}
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
                              </div>
                              <div className="text-right ml-4">
                                <p className="font-medium">
                                  {formatCurrency(item.unitPrice)}
                                  {item.product?.pricingMode === 'SIMPLE_AREA' ? '/m²' : '/un'}
                                </p>
                                <p className="text-lg font-bold">{formatCurrency(item.totalPrice)}</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2"
                                  onClick={() => openMaterialCalculator(item)}
                                >
                                  <Calculator className="w-3 h-3 mr-1" />
                                  Material
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Production Timeline */}
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
                            { status: 'APPROVED', label: 'Pedido Aprovado', icon: CheckCircle, color: 'text-green-500' },
                            { status: 'IN_PRODUCTION', label: 'Em Produção', icon: Package, color: 'text-blue-500' },
                            { status: 'FINISHED', label: 'Produção Finalizada', icon: CheckCircle, color: 'text-green-500' },
                            { status: 'DELIVERED', label: 'Entregue', icon: CheckCircle, color: 'text-green-500' }
                          ].map((step, index) => {
                            const isCompleted = Object.keys(statusConfig).indexOf(selectedPedido.status) >= Object.keys(statusConfig).indexOf(step.status);
                            const isCurrent = selectedPedido.status === step.status;
                            const StepIcon = step.icon;
                            
                            return (
                              <div key={step.status} className="flex items-center space-x-3">
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                  isCompleted ? 'bg-green-100' : isCurrent ? 'bg-blue-100' : 'bg-gray-100'
                                }`}>
                                  <StepIcon className={`w-4 h-4 ${
                                    isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'
                                  }`} />
                                </div>
                                <div className="flex-1">
                                  <p className={`font-medium ${
                                    isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'
                                  }`}>
                                    {step.label}
                                  </p>
                                  {isCurrent && (
                                    <p className="text-sm text-muted-foreground">Em andamento...</p>
                                  )}
                                  {isCompleted && step.status !== selectedPedido.status && (
                                    <p className="text-sm text-muted-foreground">Concluído</p>
                                  )}
                                </div>
                                {index < 3 && (
                                  <div className={`w-px h-8 ${
                                    isCompleted ? 'bg-green-200' : 'bg-gray-200'
                                  }`} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Profitability Analysis */}
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
                            <p className="text-lg font-bold text-red-600">
                              {formatCurrency(selectedPedido.total * 0.6)} {/* Estimativa de 60% de custo */}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium">Margem Bruta:</span>
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(selectedPedido.total * 0.4)} {/* 40% de margem */}
                            </p>
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

                        {/* Profit Indicator */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">
                              Margem saudável - Pedido rentável
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                  {/* Status Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Ações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedPedido.status === 'DRAFT' && (
                        <Button 
                          className="w-full" 
                          onClick={() => handleStatusChange(selectedPedido.id, 'APPROVED')}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Aprovar Pedido
                        </Button>
                      )}
                      
                      {selectedPedido.status === 'APPROVED' && (
                        <Button 
                          className="w-full" 
                          onClick={() => handleStatusChange(selectedPedido.id, 'IN_PRODUCTION')}
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Iniciar Produção
                        </Button>
                      )}
                      
                      {selectedPedido.status === 'IN_PRODUCTION' && (
                        <Button 
                          className="w-full" 
                          onClick={() => handleStatusChange(selectedPedido.id, 'FINISHED')}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Finalizar Produção
                        </Button>
                      )}
                      
                      {selectedPedido.status === 'FINISHED' && (
                        <Button 
                          className="w-full" 
                          onClick={() => handleStatusChange(selectedPedido.id, 'DELIVERED')}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Marcar como Entregue
                        </Button>
                      )}

                      {!['DELIVERED', 'CANCELLED'].includes(selectedPedido.status) && (
                        <Button 
                          variant="outline" 
                          className="w-full text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleStatusChange(selectedPedido.id, 'CANCELLED')}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancelar Pedido
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Order Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Informações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium">Criado em:</span>
                        <p>{formatDateTime(selectedPedido.createdAt)}</p>
                      </div>
                      
                      {selectedPedido.deliveryDate && (
                        <div>
                          <span className="font-medium">Entrega prevista:</span>
                          <p>{formatDateTime(selectedPedido.deliveryDate)}</p>
                        </div>
                      )}
                      
                      <div>
                        <span className="font-medium">Itens:</span>
                        <p>{selectedPedido.items.length} produto(s)</p>
                      </div>
                      
                      <div>
                        <span className="font-medium">Área total:</span>
                        <p>
                          {selectedPedido.items.reduce((total, item) => 
                            total + ((item.width * item.height * item.quantity) / 1000000), 0
                          ).toFixed(2)} m²
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Observações</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedPedido.notes ? (
                        <p className="text-sm">{selectedPedido.notes}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma observação</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Communication History */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <MessageSquare className="w-5 h-5" />
                        <span>Comunicação</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-start space-x-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">Pedido criado</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(selectedPedido.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {selectedPedido.status !== 'DRAFT' && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-start space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">Pedido aprovado</p>
                                <p className="text-xs text-muted-foreground">
                                  Cliente notificado por email
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t">
                        <Button size="sm" className="w-full mb-2">
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Enviar Mensagem
                        </Button>
                        <Button size="sm" variant="outline" className="w-full">
                          <Calendar className="w-4 h-4 mr-2" />
                          Agendar Contato
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Material Calculator Modal */}
      {showMaterialCalculator && calculatorItem && (
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
                  <Button
                    variant="outline"
                    onClick={() => setShowMaterialCalculator(false)}
                  >
                    Fechar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MaterialCalculator
                  width={calculatorItem.width}
                  height={calculatorItem.height}
                  quantity={calculatorItem.quantity}
                  onCalculationComplete={(result) => {
                    console.log('Cálculo de material:', result);
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* WhatsApp Message Modal */}
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
                  <CardDescription>
                    Para: {selectedPedido.customer.name}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWhatsAppModal(false)}
                >
                  Fechar
                </Button>
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
                <Button 
                  onClick={sendCustomWhatsApp}
                  disabled={!whatsAppMessage.trim()}
                  className="flex-1"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowWhatsAppModal(false)}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
  );
};

export default Pedidos;