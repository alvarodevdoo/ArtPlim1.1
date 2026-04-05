import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { 
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Line, ComposedChart
} from 'recharts';
import { TrendingUp, AlertTriangle, DollarSign, Percent, RefreshCw, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BIMetrics {
  totalRevenue: number;
  totalProfit: number;
  avgMarkup: number;
  lowMarginAlerts: number;
  itemCount: number;
}

interface ProfitItem {
  orderNumber: string;
  customerName: string;
  productName: string;
  quantity: number;
  unitCostAtSale: number;
  unitPriceAtSale: number;
  realProfitPerUnit: number;
  realMarkup: number;
  targetMarkup: number;
  divergence: number;
  confirmedAt: string;
}

export const Lucratividade: React.FC = () => {
  const [metrics, setMetrics] = useState<BIMetrics | null>(null);
  const [report, setReport] = useState<ProfitItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mRes, rRes] = await Promise.all([
        api.get('/api/bi/metrics'),
        api.get('/api/bi/profitability')
      ]);
      setMetrics(mRes.data.data);
      setReport(rRes.data.data);
    } catch (error) {
      console.error('Erro ao carregar dados de BI:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando inteligência de vendas...</span>
      </div>
    );
  }

  // Preparar dados para o gráfico de barras (Top 10 Itens por Divergência)
  const chartData = report.slice(0, 10).map(item => ({
    name: `${item.orderNumber} - ${item.productName.substring(0, 15)}...`,
    Real: item.realMarkup,
    Alvo: item.targetMarkup,
    Divergencia: item.divergence
  }));

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Análise de Lucratividade Real</h1>
          <p className="text-slate-500">Métricas baseadas em snapshots financeiros de pedidos aprovados (últimos 30 dias)</p>
        </div>
        <Button onClick={loadData} variant="outline" className="flex gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Faturamento Real</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {metrics?.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-slate-400 mt-1">{metrics?.itemCount} itens processados</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Lucro Líquido Real</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">R$ {metrics?.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-slate-400 mt-1">Margem média: {((metrics?.totalProfit || 0) / (metrics?.totalRevenue || 1) * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Markup Médio Real</CardTitle>
            <Percent className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.avgMarkup}x</div>
            <p className="text-xs text-slate-400 mt-1">Acima do custo médio</p>
          </CardContent>
        </Card>

        <Card className={metrics?.lowMarginAlerts && metrics.lowMarginAlerts > 0 ? "border-l-4 border-l-red-500 bg-red-50" : "border-l-4 border-l-slate-300"}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Alertas de Margem</CardTitle>
            <AlertTriangle className={metrics?.lowMarginAlerts && metrics.lowMarginAlerts > 0 ? "h-4 w-4 text-red-500 animate-pulse" : "h-4 w-4 text-slate-300"} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics?.lowMarginAlerts && metrics.lowMarginAlerts > 0 ? "text-red-600" : "text-slate-600"}`}>
              {metrics?.lowMarginAlerts}
            </div>
            <p className="text-xs text-slate-400 mt-1">Divergência {'>'} 20% do alvo</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Divergência */}
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle className="text-lg">Divergência de Markup: Real vs Alvo (Top 10 Itens)</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}x`} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Bar dataKey="Real" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
              <Line type="monotone" dataKey="Alvo" stroke="#6366f1" strokeWidth={3} dot={{ r: 6, fill: '#6366f1' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Snapshots de Venda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3">Pedido/Data</th>
                  <th className="px-4 py-3">Produto/Variação</th>
                  <th className="px-4 py-3">Custo Un.</th>
                  <th className="px-4 py-3">Preço Un.</th>
                  <th className="px-4 py-3">Markup Real</th>
                  <th className="px-4 py-3">Divergência</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-700">#{item.orderNumber}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {format(new Date(item.confirmedAt), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-slate-600 font-medium">{item.productName}</div>
                      <div className="text-xs text-slate-400">{item.customerName}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-500">R$ {item.unitCostAtSale.toFixed(2)}</td>
                    <td className="px-4 py-4 font-bold text-slate-700">R$ {item.unitPriceAtSale.toFixed(2)}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        item.realMarkup >= item.targetMarkup ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                      }`}>
                        {item.realMarkup}x
                      </span>
                    </td>
                    <td className="px-4 py-4">
                       <span className={`font-medium ${item.divergence < 0 ? "text-red-500" : "text-emerald-500"}`}>
                        {item.divergence > 0 ? "+" : ""}{Math.round(item.divergence * 100)}%
                       </span>
                    </td>
                    <td className="px-4 py-4">
                      {item.divergence < -0.2 ? (
                         <Badge variant="destructive" className="flex gap-1 w-fit">
                           <AlertTriangle className="h-3 w-3" /> Revisar Preço
                         </Badge>
                      ) : (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600">Saudável</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Lucratividade;
