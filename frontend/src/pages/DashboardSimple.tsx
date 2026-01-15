import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Users, 
  ShoppingCart, 
  FileText, 
  Search,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';

interface QuickStats {
  pedidosHoje: number;
  clientesAtivos: number;
  produtosDisponiveis: number;
  orcamentosAbertos: number;
}

interface RecentOrder {
  id: string;
  customerName: string;
  status: string;
  total: number;
  createdAt: string;
}

const DashboardSimple: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<QuickStats>({
    pedidosHoje: 0,
    clientesAtivos: 0,
    produtosDisponiveis: 0,
    orcamentosAbertos: 0
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Carregar estatísticas básicas
      const [ordersResponse, productsResponse] = await Promise.allSettled([
        api.get('/api/sales/orders?limit=5'),
        api.get('/api/catalog/products?limit=1')
      ]);

      // Processar pedidos recentes
      if (ordersResponse.status === 'fulfilled') {
        const orders = ordersResponse.value.data.data || [];
        setRecentOrders(orders.slice(0, 5));
        
        // Contar pedidos de hoje
        const today = new Date().toDateString();
        const todayOrders = orders.filter((order: any) => 
          new Date(order.createdAt).toDateString() === today
        );
        setStats(prev => ({ ...prev, pedidosHoje: todayOrders.length }));
      }

      // Processar produtos
      if (productsResponse.status === 'fulfilled') {
        const products = productsResponse.value.data.data || [];
        setStats(prev => ({ ...prev, produtosDisponiveis: products.length }));
      }

      // Dados simulados para outras estatísticas (podem ser implementados depois)
      setStats(prev => ({
        ...prev,
        clientesAtivos: 25,
        orcamentosAbertos: 8
      }));

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'PENDING': { label: 'Pendente', variant: 'secondary' as const },
      'CONFIRMED': { label: 'Confirmado', variant: 'default' as const },
      'IN_PRODUCTION': { label: 'Produção', variant: 'default' as const },
      'DELIVERED': { label: 'Entregue', variant: 'default' as const },
      'CANCELLED': { label: 'Cancelado', variant: 'destructive' as const }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'secondary' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Olá, {user?.name}! 👋</h1>
          <p className="text-muted-foreground">
            Bem-vindo ao sistema. Aqui está um resumo do seu dia.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Busca Rápida */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Busca Rápida
          </CardTitle>
          <CardDescription>
            Encontre rapidamente clientes, produtos ou pedidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Digite o nome do cliente, produto ou número do pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Hoje</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pedidosHoje}</div>
            <p className="text-xs text-muted-foreground">
              Pedidos criados hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientesAtivos}</div>
            <p className="text-xs text-muted-foreground">
              Clientes cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.produtosDisponiveis}</div>
            <p className="text-xs text-muted-foreground">
              Produtos disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orçamentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.orcamentosAbertos}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando aprovação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>
            Acesse rapidamente as funcionalidades mais usadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Plus className="h-6 w-6" />
              <span className="text-sm">Novo Pedido</span>
            </Button>
            
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Users className="h-6 w-6" />
              <span className="text-sm">Clientes</span>
            </Button>
            
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Package className="h-6 w-6" />
              <span className="text-sm">Produtos</span>
            </Button>
            
            <Button variant="outline" className="h-20 flex-col gap-2">
              <FileText className="h-6 w-6" />
              <span className="text-sm">Orçamentos</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pedidos Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pedidos Recentes
          </CardTitle>
          <CardDescription>
            Últimos pedidos criados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{order.customerName || 'Cliente não informado'}</p>
                      <p className="text-sm text-muted-foreground">
                        Pedido #{order.id.slice(-6)} • {formatDate(order.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(order.total || 0)}</p>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum pedido encontrado</p>
              <p className="text-sm">Os pedidos aparecerão aqui quando forem criados</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardSimple;