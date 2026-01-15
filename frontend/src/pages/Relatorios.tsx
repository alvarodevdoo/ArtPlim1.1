import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Package, 
  FileText,
  Download,
  Calendar,
  Filter,
  Eye
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const Relatorios: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  const [selectedReport, setSelectedReport] = useState('');

  // Mock data para demonstração
  const reportData = {
    vendas: {
      total: 125430.50,
      pedidos: 89,
      ticketMedio: 1409.33,
      crescimento: 12.5
    },
    clientes: {
      total: 156,
      novos: 23,
      ativos: 134,
      inativos: 22
    },
    produtos: {
      maisVendidos: [
        { nome: 'Adesivo Vinil', quantidade: 45, valor: 15230.00 },
        { nome: 'Banner Lona', quantidade: 32, valor: 12450.00 },
        { nome: 'Placa ACM', quantidade: 28, valor: 18900.00 }
      ]
    }
  };

  const reportTypes = [
    {
      id: 'vendas',
      title: 'Relatório de Vendas',
      description: 'Análise completa das vendas por período',
      icon: DollarSign,
      color: 'text-green-500'
    },
    {
      id: 'clientes',
      title: 'Relatório de Clientes',
      description: 'Estatísticas e análise da base de clientes',
      icon: Users,
      color: 'text-blue-500'
    },
    {
      id: 'produtos',
      title: 'Relatório de Produtos',
      description: 'Performance e ranking dos produtos',
      icon: Package,
      color: 'text-purple-500'
    },
    {
      id: 'financeiro',
      title: 'Relatório Financeiro',
      description: 'Fluxo de caixa e análise financeira',
      icon: TrendingUp,
      color: 'text-orange-500'
    },
    {
      id: 'producao',
      title: 'Relatório de Produção',
      description: 'Eficiência e capacidade produtiva',
      icon: BarChart3,
      color: 'text-indigo-500'
    },
    {
      id: 'estoque',
      title: 'Relatório de Estoque',
      description: 'Movimentação e níveis de estoque',
      icon: Package,
      color: 'text-red-500'
    }
  ];

  const handleGenerateReport = () => {
    if (!selectedReport) {
      alert('Selecione um tipo de relatório');
      return;
    }
    
    // Aqui seria implementada a geração do relatório
    alert(`Gerando relatório: ${reportTypes.find(r => r.id === selectedReport)?.title}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">
          Análises e insights do seu negócio
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(reportData.vendas.total)}</p>
                <p className="text-sm text-muted-foreground">Vendas do Mês</p>
                <p className="text-xs text-green-600">+{reportData.vendas.crescimento}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileText className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{reportData.vendas.pedidos}</p>
                <p className="text-sm text-muted-foreground">Pedidos</p>
                <p className="text-xs text-muted-foreground">
                  Ticket: {formatCurrency(reportData.vendas.ticketMedio)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{reportData.clientes.total}</p>
                <p className="text-sm text-muted-foreground">Clientes</p>
                <p className="text-xs text-green-600">+{reportData.clientes.novos} novos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{reportData.clientes.ativos}</p>
                <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                <p className="text-xs text-muted-foreground">
                  {((reportData.clientes.ativos / reportData.clientes.total) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Generator */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Gerador de Relatórios</CardTitle>
              <CardDescription>
                Selecione o tipo de relatório e período para análise
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Inicial</label>
                  <Input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Final</label>
                  <Input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Formato</label>
                  <select className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background">
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
              </div>

              {/* Report Types */}
              <div className="space-y-4">
                <h4 className="font-medium">Tipo de Relatório</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reportTypes.map((report) => {
                    const Icon = report.icon;
                    return (
                      <div
                        key={report.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedReport === report.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedReport(report.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <Icon className={`w-5 h-5 ${report.color} mt-0.5`} />
                          <div>
                            <h5 className="font-medium text-sm">{report.title}</h5>
                            <p className="text-xs text-muted-foreground">{report.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleGenerateReport} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Gerar Relatório
                </Button>
                <Button variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  Visualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Products */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Produtos Mais Vendidos</CardTitle>
              <CardDescription>
                Ranking do mês atual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.produtos.maisVendidos.map((produto, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{produto.nome}</p>
                        <p className="text-xs text-muted-foreground">{produto.quantidade} vendas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatCurrency(produto.valor)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Recentes</CardTitle>
          <CardDescription>
            Últimos relatórios gerados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum relatório gerado ainda</p>
            <p className="text-sm">Use o gerador acima para criar seu primeiro relatório</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Relatorios;