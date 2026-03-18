import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import { 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import { InlineLoader } from '../ui/loading-states';

interface PerformanceMetric {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: string;
}

interface PerformanceSummary {
  totalRequests: number;
  averageResponseTime: number;
  slowRequests: number;
  errorRequests: number;
  topEndpoints: Array<{
    endpoint: string;
    count: number;
    avgTime: number;
  }>;
  hourlyStats: Array<{
    hour: string;
    count: number;
    avgTime: number;
  }>;
}

const fetchPerformanceData = async (): Promise<PerformanceSummary> => {
  const response = await fetch('/api/admin/performance', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Erro ao carregar dados de performance');
  }

  const result = await response.json();
  return result.data;
};

export const PerformanceMonitor: React.FC = () => {
  const [data, setData] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const performanceData = await fetchPerformanceData();
      setData(performanceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto refresh a cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (avgTime: number) => {
    if (avgTime < 200) return 'text-green-600';
    if (avgTime < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (avgTime: number) => {
    if (avgTime < 200) return <Badge variant="default" className="bg-green-100 text-green-800">Excelente</Badge>;
    if (avgTime < 500) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Bom</Badge>;
    return <Badge variant="destructive">Lento</Badge>;
  };

  // Configuração do gráfico de resposta por hora
  const hourlyChartData = data ? {
    labels: data.hourlyStats.map(stat => stat.hour),
    datasets: [
      {
        label: 'Tempo de Resposta (ms)',
        data: data.hourlyStats.map(stat => stat.avgTime),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        yAxisID: 'y',
      },
      {
        label: 'Requisições',
        data: data.hourlyStats.map(stat => stat.count),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        yAxisID: 'y1',
      },
    ],
  } : null;

  // Configuração do gráfico de top endpoints
  const endpointsChartData = data ? {
    labels: data.topEndpoints.slice(0, 10).map(ep => ep.endpoint.split(' ')[1] || ep.endpoint),
    datasets: [
      {
        label: 'Tempo Médio (ms)',
        data: data.topEndpoints.slice(0, 10).map(ep => ep.avgTime),
        backgroundColor: data.topEndpoints.slice(0, 10).map(ep => 
          ep.avgTime < 200 ? 'rgba(34, 197, 94, 0.8)' :
          ep.avgTime < 500 ? 'rgba(234, 179, 8, 0.8)' :
          'rgba(239, 68, 68, 0.8)'
        ),
        borderColor: data.topEndpoints.slice(0, 10).map(ep => 
          ep.avgTime < 200 ? 'rgb(34, 197, 94)' :
          ep.avgTime < 500 ? 'rgb(234, 179, 8)' :
          'rgb(239, 68, 68)'
        ),
        borderWidth: 1,
      },
    ],
  } : null;

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
        title: {
          display: true,
          text: 'Tempo de Resposta (ms)'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Número de Requisições'
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Tempo Médio (ms)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Endpoints'
        }
      }
    },
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Monitor de Performance</h2>
          <p className="text-gray-600">Acompanhe a performance da API em tempo real</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'text-green-600' : 'text-gray-400'}`} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Requisições</p>
                <p className="text-2xl font-bold">
                  {loading ? <InlineLoader size="sm" /> : data?.totalRequests.toLocaleString() || '0'}
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tempo Médio</p>
                <p className={`text-2xl font-bold ${data ? getStatusColor(data.averageResponseTime) : ''}`}>
                  {loading ? <InlineLoader size="sm" /> : `${Math.round(data?.averageResponseTime || 0)}ms`}
                </p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-2">
              {data && getStatusBadge(data.averageResponseTime)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Requisições Lentas</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {loading ? <InlineLoader size="sm" /> : data?.slowRequests || '0'}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-gray-500">
                {data && data.totalRequests > 0 
                  ? `${((data.slowRequests / data.totalRequests) * 100).toFixed(1)}% do total`
                  : '0% do total'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Erros</p>
                <p className="text-2xl font-bold text-red-600">
                  {loading ? <InlineLoader size="sm" /> : data?.errorRequests || '0'}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-gray-500">
                {data && data.totalRequests > 0 
                  ? `${((data.errorRequests / data.totalRequests) * 100).toFixed(1)}% do total`
                  : '0% do total'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Performance por Hora */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance por Hora (Últimas 24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <InlineLoader text="Carregando gráfico..." />
              </div>
            ) : hourlyChartData ? (
              <Line data={hourlyChartData} options={chartOptions} />
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Top Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Top 10 Endpoints por Tempo de Resposta
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <InlineLoader text="Carregando gráfico..." />
              </div>
            ) : endpointsChartData ? (
              <Bar data={endpointsChartData} options={barChartOptions} />
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes dos Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : data?.topEndpoints.length ? (
            <div className="space-y-2">
              {data.topEndpoints.slice(0, 10).map((endpoint, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{endpoint.endpoint}</p>
                    <p className="text-sm text-gray-600">
                      {endpoint.count} requisições
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${getStatusColor(endpoint.avgTime)}`}>
                      {Math.round(endpoint.avgTime)}ms
                    </p>
                    {getStatusBadge(endpoint.avgTime)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Nenhum endpoint encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status da Conexão */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium">Sistema Online</span>
            </div>
            <div className="text-sm text-gray-500">
              Última atualização: {new Date().toLocaleTimeString('pt-BR')}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};