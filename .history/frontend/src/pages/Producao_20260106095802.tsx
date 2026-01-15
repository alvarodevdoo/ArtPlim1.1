import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Play, 
  Pause, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Settings,
  BarChart3,
  Users,
  Wrench
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface ProductionItem {
  id: string;
  priority: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  scheduledStart?: string;
  actualStart?: string;
  estimatedEnd?: string;
  actualEnd?: string;
  assignedTo?: string;
  machineId?: string;
  notes?: string;
  order: {
    id: string;
    orderNumber: string;
    total: number;
    customer: {
      id: string;
      name: string;
    };
    items: Array<{
      id: string;
      quantity: number;
      product: {
        id: string;
        name: string;
      };
    }>;
  };
}

interface Machine {
  id: string;
  name: string;
  type: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'BROKEN';
  model?: string;
}

interface Dashboard {
  queue: {
    total: number;
    inProgress: number;
    completed: number;
    paused: number;
  };
  machines: {
    available: number;
    busy: number;
    total: number;
  };
}

const statusConfig = {
  PENDING: { label: 'Pendente', color: 'bg-gray-100 text-gray-800', icon: Clock },
  IN_PROGRESS: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800', icon: Play },
  PAUSED: { label: 'Pausado', color: 'bg-yellow-100 text-yellow-800', icon: Pause },
  COMPLETED: { label: 'Concluído', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: AlertCircle }
};

const machineStatusConfig = {
  AVAILABLE: { label: 'Disponível', color: 'bg-green-100 text-green-800' },
  IN_USE: { label: 'Em Uso', color: 'bg-blue-100 text-blue-800' },
  MAINTENANCE: { label: 'Manutenção', color: 'bg-yellow-100 text-yellow-800' },
  BROKEN: { label: 'Quebrada', color: 'bg-red-100 text-red-800' }
};

const Producao: React.FC = () => {
  const [productionQueue, setProductionQueue] = useState<ProductionItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('kanban');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [queueResponse, machinesResponse, dashboardResponse] = await Promise.all([
        api.get('/api/production/queue'),
        api.get('/api/production/machines'),
        api.get('/api/production/dashboard')
      ]);

      setProductionQueue(queueResponse.data.data);
      setMachines(machinesResponse.data.data);
      setDashboard(dashboardResponse.data.data);
    } catch (error) {
      toast.error('Erro ao carregar dados de produção');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, action: 'start' | 'pause' | 'complete') => {
    try {
      await api.post(`/api/production/queue/${id}/${action}`);
      toast.success(`Produção ${action === 'start' ? 'iniciada' : action === 'pause' ? 'pausada' : 'finalizada'}!`);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao atualizar status');
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'border-l-red-500 bg-red-50';
      case 2: return 'border-l-orange-500 bg-orange-50';
      case 3: return 'border-l-yellow-500 bg-yellow-50';
      case 4: return 'border-l-blue-500 bg-blue-50';
      case 5: return 'border-l-gray-500 bg-gray-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const groupedQueue = {
    PENDING: productionQueue.filter(item => item.status === 'PENDING'),
    IN_PROGRESS: productionQueue.filter(item => item.status === 'IN_PROGRESS'),
    PAUSED: productionQueue.filter(item => item.status === 'PAUSED'),
    COMPLETED: productionQueue.filter(item => item.status === 'COMPLETED')
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
          <h1 className="text-3xl font-bold text-foreground">Produção</h1>
          <p className="text-muted-foreground">
            Controle de chão de fábrica e filas de produção
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
          <Button variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            Relatórios
          </Button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Clock className="w-8 h-8 text-gray-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.queue.total}</p>
                  <p className="text-sm text-muted-foreground">Na Fila</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Play className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.queue.inProgress}</p>
                  <p className="text-sm text-muted-foreground">Em Andamento</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.queue.completed}</p>
                  <p className="text-sm text-muted-foreground">Concluídos Hoje</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Wrench className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.machines.available}/{dashboard.machines.total}</p>
                  <p className="text-sm text-muted-foreground">Máquinas Disponíveis</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('kanban')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'kanban'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setActiveTab('machines')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'machines'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Máquinas
          </button>
        </nav>
      </div>

      {/* Kanban Board */}
      {activeTab === 'kanban' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {Object.entries(groupedQueue).map(([status, items]) => {
            const config = statusConfig[status as keyof typeof statusConfig];
            const Icon = config.icon;
            
            return (
              <div key={status} className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Icon className="w-5 h-5" />
                  <h3 className="font-semibold">{config.label}</h3>
                  <span className="bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs">
                    {items.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <Card key={item.id} className={`border-l-4 ${getPriorityColor(item.priority)}`}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-sm">{item.order.orderNumber}</CardTitle>
                            <CardDescription className="text-xs">
                              {item.order.customer.name}
                            </CardDescription>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${config.color}`}>
                            P{item.priority}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">
                            {item.order.items.length} item(s) • {formatCurrency(item.order.total)}
                          </div>
                          
                          {item.scheduledStart && (
                            <div className="text-xs">
                              <span className="font-medium">Início:</span> {formatDateTime(item.scheduledStart)}
                            </div>
                          )}

                          <div className="flex space-x-1 pt-2">
                            {item.status === 'PENDING' && (
                              <Button 
                                size="sm" 
                                onClick={() => handleStatusChange(item.id, 'start')}
                                className="flex-1"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Iniciar
                              </Button>
                            )}
                            
                            {item.status === 'IN_PROGRESS' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleStatusChange(item.id, 'pause')}
                                  className="flex-1"
                                >
                                  <Pause className="w-3 h-3 mr-1" />
                                  Pausar
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={() => handleStatusChange(item.id, 'complete')}
                                  className="flex-1"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Finalizar
                                </Button>
                              </>
                            )}
                            
                            {item.status === 'PAUSED' && (
                              <Button 
                                size="sm"
                                onClick={() => handleStatusChange(item.id, 'start')}
                                className="flex-1"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Retomar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {items.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Icon className="w-6 h-6" />
                      </div>
                      <p className="text-sm">Nenhum item</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Machines Tab */}
      {activeTab === 'machines' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((machine) => {
            const statusInfo = machineStatusConfig[machine.status];
            
            return (
              <Card key={machine.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{machine.name}</CardTitle>
                      <CardDescription>{machine.type}</CardDescription>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {machine.model && (
                      <p className="text-sm">
                        <span className="font-medium">Modelo:</span> {machine.model}
                      </p>
                    )}
                    
                    <div className="pt-2 border-t">
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Settings className="w-3 h-3 mr-1" />
                          Configurar
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <BarChart3 className="w-3 h-3 mr-1" />
                          Relatório
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty States */}
      {activeTab === 'kanban' && productionQueue.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum item na fila de produção</h3>
            <p className="text-muted-foreground mb-4">
              Pedidos aprovados aparecerão aqui automaticamente
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'machines' && machines.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma máquina cadastrada</h3>
            <p className="text-muted-foreground mb-4">
              Cadastre suas máquinas para controlar a produção
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Máquina
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Producao;