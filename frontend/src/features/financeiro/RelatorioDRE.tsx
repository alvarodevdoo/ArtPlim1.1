import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Percent, RefreshCw } from 'lucide-react';

interface CategoryStat {
  categoryId: string | null;
  categoryName: string;
  total: number;
}

interface DREData {
  grossRevenue: number;
  totalExpenses: number;
  netResult: number;
  profitMargin: number;
  incomeByCategory: CategoryStat[];
  expenseByCategory: CategoryStat[];
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

export function RelatorioDRE() {
  const [data, setData] = useState<DREData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState(getMonthRange());

  const loadDRE = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/finance/reports/dre', {
        params: { startDate: dates.startDate, endDate: dates.endDate }
      });
      setData(res.data.data);
    } catch {
      toast.error('Erro ao carregar DRE');
    } finally {
      setLoading(false);
    }
  }, [dates]);

  useEffect(() => { loadDRE(); }, [loadDRE]);

  const chartData = data ? [
    ...data.incomeByCategory.map(c => ({ name: c.categoryName, value: c.total, type: 'Receita' })),
    ...data.expenseByCategory.map(c => ({ name: c.categoryName, value: c.total, type: 'Despesa' }))
  ] : [];

  const isProfit = (data?.netResult ?? 0) >= 0;

  return (
    <div className="space-y-6 mt-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg border">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Início</label>
          <Input type="date" value={dates.startDate} onChange={e => setDates(p => ({ ...p, startDate: e.target.value }))} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fim</label>
          <Input type="date" value={dates.endDate} onChange={e => setDates(p => ({ ...p, endDate: e.target.value }))} className="w-40" />
        </div>
        <Button onClick={loadDRE} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Receita Bruta</p>
                    <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(data.grossRevenue)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Total de Despesas</p>
                    <p className="text-2xl font-bold text-red-700 mt-1">{formatCurrency(data.totalExpenses)}</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-red-400" />
                </div>
              </CardContent>
            </Card>

            <Card className={`${isProfit ? 'border-blue-200 bg-blue-50/50' : 'border-orange-200 bg-orange-50/50'}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wide ${isProfit ? 'text-blue-600' : 'text-orange-600'}`}>
                      Resultado Líquido
                    </p>
                    <p className={`text-2xl font-bold mt-1 ${isProfit ? 'text-blue-700' : 'text-orange-700'}`}>
                      {formatCurrency(data.netResult)}
                    </p>
                  </div>
                  <DollarSign className={`w-8 h-8 ${isProfit ? 'text-blue-400' : 'text-orange-400'}`} />
                </div>
              </CardContent>
            </Card>

            <Card className={`${isProfit ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">Margem de Lucro</p>
                    <p className="text-2xl font-bold text-purple-700 mt-1">{data.profitMargin.toFixed(1)}%</p>
                  </div>
                  <Percent className="w-8 h-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico + Detalhamento */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receitas e Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={v => formatCurrency(v)} width={100} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.type === 'Receita' ? '#22c55e' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-12">Sem dados no período selecionado</p>
                )}
              </CardContent>
            </Card>

            {/* Tabelas de detalhamento */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-600">Receitas por Categoria</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      {data.incomeByCategory.length === 0 ? (
                        <tr><td className="p-3 text-muted-foreground text-center">Nenhuma receita</td></tr>
                      ) : data.incomeByCategory.map((c, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-4 py-2">{c.categoryName}</td>
                          <td className="px-4 py-2 text-right font-medium text-green-600">{formatCurrency(c.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-600">Despesas por Categoria</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      {data.expenseByCategory.length === 0 ? (
                        <tr><td className="p-3 text-muted-foreground text-center">Nenhuma despesa</td></tr>
                      ) : data.expenseByCategory.map((c, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-4 py-2">{c.categoryName}</td>
                          <td className="px-4 py-2 text-right font-medium text-red-600">{formatCurrency(c.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="text-center py-16 text-muted-foreground">Clique em "Atualizar" para gerar o DRE</div>
      )}
    </div>
  );
}
