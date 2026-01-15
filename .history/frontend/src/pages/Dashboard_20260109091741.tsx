import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { DatePickerWithRange } from '../components/ui/date-range-picker';
import { Skeleton } from '../components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users,
  RefreshCw,
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface DashboardFilters {
  startDate: Date;
  endDate: Date;
  productIds?: string[];
  customerIds?: string[];
}

interface DashboardData {
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    deliveredOrders: number;
    deliveredRevenue: number;
    conversionRate: number;
  };
  sales: {
    date: string;
    revenue: number;
    orderCount: number;
  }[];
  costs: {
    productName: string;
    totalRevenue: number;
    totalMargin: number;
    marginPercentage: number;
  }[];
  materials: {
    materialName: string;
    theoreticalConsumption: number;
    estimatedConsumption: number;
    wastePercentage: number;
    wasteCost: number;
  }[];
  topProducts: {
    productName: string;
    revenue: number;
    margin: number;
    marginPercentage: number;
  }[];
  recentOrders: {
    orderNumber: string;
    customerName: string;
    status: string;
    total: number;
    createdAt: string;
  }[];
  generatedAt: string;
}

// Função para buscar dados do dashboard
const fetchDashboardData = async (filters: DashboardFilters): Promise<DashboardData> => {
  const params = new URLSearchParams({
    startDate: filters.startDate.toISOString(),
    endDate: filters.endDate.toISOString(),
  });

  if (filters.productIds?.length) {
    params.append('productIds', filters.productIds.join(','));
  }
  if (filters.customerIds?.length) {
    params.append('customerIds', filters.customerIds.join(','));
  }

  const response = await fetch(`/api/analytics/dashboard?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Erro ao carregar dados do dashboard');
  }

  const result = await response.json();
  return result.data;
};

// Função para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Função para formatar porcentagem
const formatPercentage = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
};

// Componente de KPI Card
const KPICard: React.FC<{
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  loading?: boolean;
}> = ({ title, value, change, icon, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <Skeleton className="h-4 w-24" />
          </CardTitle>
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p className={`text-xs flex items-center ${
            change >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {change >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {Math.abs(change).toFixed(1)}% em relação ao período anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// Componente principal do Dashboard
const Dashboard: React.FC = () => {
  const [filters, setFilters] = useState<DashboardFilters>({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => fetchDashboardData(filters),
    refetchInterval: 5 * 60 * 1000, // 5 minutos
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  // Configuração do gráfico de vendas
  const salesChartData = useMemo(() => {
    if (!data?.sales) return null;

    return {
      labels: data.sales.map(s => format(new Date(s.date), 'dd/MM', { locale: ptBR })),
      datasets: [
        {
          label: 'Receita (R$)',
          data: data.sales.map(s => s.revenue),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          yAxisID: 'y',
        },
        {
          label: 'Pedidos',
          data: data.sales.map(s => s.orderCount),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    };
  }, [data?.sales]);

  // Configuração do gráfico de produtos
  const productsChartData = useMemo(() => {
    if (!data?.topProducts) return null;

    const colors = [
      'rgba(59, 130, 246, 0.8)',
      'rgba(16, 185, 129, 0.8)',
      'rgba(249, 115, 22, 0.8)',
      'rgba(236, 72, 153, 0.8)',
      'rgba(139, 92, 246, 0.8)',
    ];

    return {
      labels: data.topProducts.map(p => p.productName),
      datasets: [
        {
          label: 'Receita',
          data: data.topProducts.map(p => p.revenue),
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.8', '1')),
          borderWidth: 1,
        },
      ],
    };
  }, [data?.topProducts]);

  // Configuração do gráfico de materiais
  const materialsChartData = useMemo(() => {
    if (!data?.materials) return null;

    const colors = [
      'rgba(239, 68, 68, 0.8)',
      'rgba(245, 158, 11, 0.8)',
      'rgba(34, 197, 94, 0.8)',
      'rgba(59, 130, 246, 0.8)',
      'rgba(147, 51, 234, 0.8)',
    ];

    return {
      labels: data.materials.slice(0, 5).map(m => m.materialName),
      datasets: [
        {
          label: 'Custo de Desperdício',
          data: data.materials.slice(0, 5).map(m => m.wasteCost),
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.8', '1')),
          borderWidth: 1,
        },
      ],
    };
  }, [data?.materials]);

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        ticks: {
          callback: (value: any) => formatCurrency(value),
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.dataset.yAxisID === 'y' 
              ? formatCurrency(context.parsed.y)
              : context.parsed.y;
            return `${label}: ${value}`;
          },
        },
      },
    },
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <Activity className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Erro ao carregar dashboard
          </h3>
          <p className="text-gray-600 mb-4">
            Não foi possível carregar os dados do dashboard.
          </p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Visão geral das métricas e performance do negócio
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <DatePickerWithRange
            value={{
              from: filters.startDate,
              to: filters.endDate,
            }}
            onChange={(range) => {
              if (range?.from && range?.to) {
                setFilters({
                  ...filters,
                  startDate: range.from,
                  endDate: range.to,
                });
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Receita Total"
          value={data ? formatCurrency(data.kpis.totalRevenue) : ''}
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
          loading={isLoading}
        />
        <KPICard
          title="Total de Pedidos"
          value={data ? data.kpis.totalOrders.toString() : ''}
          icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
          loading={isLoading}
        />
        <KPICard
          title="Ticket Médio"
          value={data ? formatCurrency(data.kpis.avgOrderValue) : ''}
          icon={<BarChart3 className="h-4 w-4 text-purple-600" />}
          loading={isLoading}
        />
        <KPICard
          title="Taxa de Conversão"
          value={data ? formatPercentage(data.kpis.conversionRate) : ''}
          icon={<TrendingUp className="h-4 w-4 text-orange-600" />}
          loading={isLoading}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Vendas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Vendas ao Longo do Tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : salesChartData ? (
              <Line data={salesChartData} options={chartOptions} />
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Top Produtos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Top Produtos por Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : productsChartData ? (
              <Bar 
                data={productsChartData} 
                options={{
                  responsive: true,
                  plugins: {
                    tooltip: {
                      callbacks: {
                        label: (context: any) => {
                          return `Receita: ${formatCurrency(context.parsed.y)}`;
                        },
                      },
                    },
                  },
                  scales: {
                    y: {
                      ticks: {
                        callback: (value: any) => formatCurrency(value),
                      },
                    },
                  },
                }}
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabelas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Análise de Materiais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Desperdício de Materiais
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.materials?.length ? (
              <div className="space-y-3">
                {data.materials.slice(0, 5).map((material, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{material.materialName}</p>
                      <p className="text-sm text-gray-600">
                        Desperdício: {formatPercentage(material.wastePercentage)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">
                        {formatCurrency(material.wasteCost)}
                      </p>
                      <p className="text-xs text-gray-500">custo</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pedidos Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Pedidos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.recentOrders?.length ? (
              <div className="space-y-3">
                {data.recentOrders.slice(0, 5).map((order, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-gray-600">{order.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(order.total)}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(order.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nenhum pedido encontrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer com informações */}
      {data && (
        <div className="text-center text-sm text-gray-500">
          Dados atualizados em {format(new Date(data.generatedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
        </div>
      )}
    </div>
  );
};