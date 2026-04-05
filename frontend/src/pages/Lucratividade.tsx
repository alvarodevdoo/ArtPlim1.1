import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { 
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Line, ComposedChart, Cell, BarChart
} from 'recharts';
import { TrendingUp, AlertTriangle, DollarSign, Percent, RefreshCw, Calendar, PieChart, Layers } from 'lucide-react';
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
  isHealthy: boolean;
  confirmedAt: string;
}

interface CategoryProfit {
  name: string;
  revenue: number;
  profit: number;
  margin: number;
}

export const Lucratividade: React.FC = () => {
  const [metrics, setMetrics] = useState<BIMetrics | null>(null);
  const [report, setReport] = useState<ProfitItem[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryProfit[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mRes, rRes, cRes] = await Promise.all([
        api.get('/api/bi/metrics'),
        api.get('/api/bi/profitability'),
        api.get('/api/bi/categories')
      ]);
      setMetrics(mRes.data.data);
      setReport(rRes.data.data);
      setCategoryData(cRes.data.data);
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
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 border-none">
        <RefreshCw className="h-10 w-10 animate-spin text-indigo-500" />
        <span className="mt-4 font-black uppercase text-xs tracking-widest text-slate-500">Calculando Margens em Tempo Real...</span>
      </div>
    );
  }

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-100 font-sans">
      <div className="flex justify-between items-end border-b border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter text-white flex items-center gap-3">
            <TrendingUp className="h-10 w-10 text-indigo-500" /> CÉREBRO ANALÍTICO
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Inteligência de Lucratividade Real vs Alvo</p>
        </div>
        <Button onClick={loadData} variant="outline" className="flex gap-2 bg-slate-900 border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-bold">
          <RefreshCw className="h-4 w-4" /> Recalcular Tudo
        </Button>
      </div>

      {/* Cards de Métricas de Alta Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-indigo-600 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-500">Faturamento Real</CardTitle>
            <DollarSign className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white">R$ {metrics?.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div className="flex items-center gap-1.5 mt-2">
              <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500">{metrics?.itemCount} itens vendidos</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-emerald-600 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-500">Lucro Líquido</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-500">R$ {metrics?.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Margem Média:</span>
              <span className="text-[10px] font-black text-white">{((metrics?.totalProfit || 0) / (metrics?.totalRevenue || 1) * 100).toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-amber-600 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-500">Markup Médio</CardTitle>
            <Percent className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white">{metrics?.avgMarkup}x</div>
            <p className="text-[10px] font-medium text-slate-500 uppercase mt-2 italic">Sobre o Custo Médio</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "bg-slate-900 border-slate-800 border-l-4 shadow-xl",
          metrics?.lowMarginAlerts && metrics.lowMarginAlerts > 0 ? "border-l-red-600 animate-pulse-slow" : "border-l-slate-700"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-500">Alertas de Margem</CardTitle>
            <AlertTriangle className={cn("h-4 w-4", metrics?.lowMarginAlerts && metrics.lowMarginAlerts > 0 ? "text-red-500" : "text-slate-700")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-black", metrics?.lowMarginAlerts && metrics.lowMarginAlerts > 0 ? "text-red-600" : "text-white")}>
              {metrics?.lowMarginAlerts}
            </div>
            <p className="text-[10px] font-medium text-slate-500 uppercase mt-2">Divergência Crítica</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfico 1: Comparativo por Categoria */}
        <Card className="bg-slate-900 border-slate-800 shadow-2xl">
          <CardHeader className="flex flex-row items-center gap-3">
             <Layers className="h-5 w-5 text-indigo-400" />
             <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-white">Lucro Real por Categoria</CardTitle>
                <p className="text-[10px] text-slate-500">Análise setorial de rentabilidade</p>
             </div>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#1e293b" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 'bold' }} />
                <Tooltip 
                   cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
                   contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                   labelStyle={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '12px' }}
                />
                <Bar dataKey="profit" radius={[0, 4, 4, 0]} barSize={15}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico 2: Divergência de Markup */}
        <Card className="bg-slate-900 border-slate-800 shadow-2xl">
          <CardHeader className="flex flex-row items-center gap-3">
             <PieChart className="h-5 w-5 text-emerald-400" />
             <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-white">Audit de Markups (Top Recentes)</CardTitle>
                <p className="text-[10px] text-slate-500">Markup Real vs Alvo por Item</p>
             </div>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={report.slice(0, 8).map(item => ({ name: item.productName.substring(0, 10), Real: item.realMarkup, Alvo: item.targetMarkup }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
                <YAxis fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} tickFormatter={(v) => `${v}x`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                <Bar dataKey="Real" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
                <Line type="step" dataKey="Alvo" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: '#6366f1' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Snapshots Financial - Versão High-Tech */}
      <Card className="bg-slate-900 border-slate-800 shadow-2xl overflow-hidden">
        <CardHeader className="bg-slate-950/50 border-b border-slate-800 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white">Histórico de Snapshots de Venda</CardTitle>
            <p className="text-[10px] text-slate-500 font-medium">Verificação de integridade financeira por pedido</p>
          </div>
          <Badge className="bg-indigo-500/10 text-indigo-400 border-none font-black text-[9px] uppercase">Rastramento Ativo</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 bg-slate-950/30">
                  <th className="px-6 py-4">Pedido / Data</th>
                  <th className="px-6 py-4">Produto & Cliente</th>
                  <th className="px-6 py-4 text-center">Custo/Preço</th>
                  <th className="px-6 py-4 text-center">Markup</th>
                  <th className="px-6 py-4 text-center">Saúde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {report.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/20 transition-all group">
                    <td className="px-6 py-4">
                      <div className="font-black text-white text-xs group-hover:text-indigo-400 transition-colors">#{item.orderNumber}</div>
                      <div className="text-[9px] text-slate-600 font-bold flex items-center gap-1 mt-1">
                        <Calendar className="h-2.5 w-2.5" /> {format(new Date(item.confirmedAt), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-slate-300">{item.productName}</div>
                      <div className="text-[10px] text-slate-600 uppercase font-black tracking-tighter mt-0.5">{item.customerName}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="text-[10px] text-slate-600 line-through">R$ {item.unitCostAtSale.toFixed(2)}</div>
                       <div className="text-xs font-black text-emerald-500 mt-0.5">R$ {item.unitPriceAtSale.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className={cn(
                         "inline-block px-2 py-1 rounded-lg text-[10px] font-black",
                         item.isHealthy ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                       )}>
                         {item.realMarkup.toFixed(2)}x
                       </div>
                       <div className="text-[9px] text-slate-700 mt-1 font-bold">Target: {item.targetMarkup.toFixed(2)}x</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.isHealthy ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-none hover:bg-emerald-500/20 text-[9px] font-black italic">SAUDÁVEL</Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-none hover:bg-red-500/20 text-[9px] font-black italic">REVISAR PREÇO</Badge>
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
