import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Users, 
  Package, 
  FileText, 
  TrendingUp,
  DollarSign,
  ShoppingCart,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const Dashboard: React.FC = () => {
  // Mock data - em produção viria da API
  const stats = {
    totalClientes: 156,
    totalProdutos: 89,
    orcamentosAbertos: 23,
    faturamentoMes: 45780.50
  };

  const recentOrders = [
    { id: 'PED-000001', cliente: 'João Silva', valor: 1250.00, status: 'Em Produção' },
    { id: 'PED-000002', cliente: 'Maria Santos', valor: 890.00, status: 'Aprovado' },
    { id: 'PED-000003', cliente: 'Carlos Lima', valor: 2100.00, status: 'Orçamento' },
  ];

  const alerts = [
    { type: 'warning', message: 'Estoque baixo: Lona 440g Branca' },
    { type: 'info', message: '5 orçamentos aguardando aprovação' },
    { type: 'success', message: 'Pedido PED-000001 finalizado' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do seu negócio
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClientes}</div>
            <p className="text-xs text-muted-foreground">
              +12% em relação ao mês passado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos Ativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProdutos}</div>
            <p className="text-xs text-muted-foreground">
              +3 novos produtos este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orçamentos Abertos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.orcamentosAbertos}</div>
            <p className="text-xs text-muted-foreground">
              R$ 15.430,00 em potencial
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento do Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(stats.faturamentoMes)}
            </div>
            <p className="text-xs text-muted-foreground">
              +8% em relação ao mês passado
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5" />
              <span>Pedidos Recentes</span>
            </CardTitle>
            <CardDescription>
              Últimos pedidos do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <p className="font-medium">{order.id}</p>
                    <p className="text-sm text-muted-foreground">{order.cliente}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(order.valor)}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.status === 'Em Produção' 
                        ? 'bg-blue-100 text-blue-800' 
                        : order.status === 'Aprovado'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Alertas e Notificações</span>
            </CardTitle>
            <CardDescription>
              Informações importantes do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 border border-border rounded-lg">
                  {alert.type === 'warning' && (
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  )}
                  {alert.type === 'info' && (
                    <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                  )}
                  {alert.type === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  )}
                  <p className="text-sm">{alert.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;