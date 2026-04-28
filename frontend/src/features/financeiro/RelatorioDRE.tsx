import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronRight, AlertTriangle, PackageX } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, ComposedChart, Line
} from 'recharts';

interface CategoryStat {
  categoryId: string | null;
  categoryName: string;
  total: number;
}

interface DREData {
  grossRevenue: number;
  totalCMV: number;
  contributionMargin: number;
  fixedExpenses: number;
  netResult: number;
  profitMargin: number;
  incomeByCategory: CategoryStat[];
  cmvByCategory: CategoryStat[];
  fixedExpensesByCategory: CategoryStat[];
}

interface CNQParetoItem {
  reason: string;
  cost: number;
  occurrences: number;
  percentage: number;
}

interface CNQData {
  totalWasteCost: number;
  totalOrdersAffected: number;
  pareto: CNQParetoItem[];
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

function ExpandableItem({ label, value, color, items }: {
  label: string;
  value: number;
  color: string;
  items?: CategoryStat[];
}) {
  const [open, setOpen] = useState(false);
  const hasItems = items && items.length > 0;

  return (
    <div className="border-b last:border-0">
      <div
        className={`flex items-center justify-between py-2.5 px-3 ${hasItems ? 'cursor-pointer hover:bg-muted/30' : ''}`}
        onClick={() => hasItems && setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          {hasItems
            ? open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />
            : <div className="w-3" />
          }
          <span className="text-sm text-foreground">{label}</span>
        </div>
        <span className={`text-sm font-bold tabular-nums ${color}`}>{formatCurrency(value)}</span>
      </div>
      {open && hasItems && (
        <div className="bg-muted/20 border-t border-dashed pb-1">
          {items!.map((c, i) => (
            <div key={i} className="flex justify-between px-8 py-1">
              <span className="text-xs text-muted-foreground">{c.categoryName}</span>
              <span className="text-xs font-medium tabular-nums">{formatCurrency(c.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold mb-1">{payload[0].payload.name}</p>
      <p className="tabular-nums">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export function RelatorioDRE() {
  const [data, setData] = useState<DREData | null>(null);
  const [cnqData, setCnqData] = useState<CNQData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState(getMonthRange());

  const loadDRE = useCallback(async () => {
    setLoading(true);
    try {
      const [resDre, resCnq] = await Promise.all([
        api.get('/api/finance/reports/dre', { params: { startDate: dates.startDate, endDate: dates.endDate } }),
        api.get('/api/finance/reports/cnq', { params: { startDate: dates.startDate, endDate: dates.endDate } })
      ]);
      setData(resDre.data.data);
      setCnqData(resCnq.data.data);
    } catch {
      toast.error('Erro ao carregar relatórios financeiros');
    } finally {
      setLoading(false);
    }
  }, [dates]);

  useEffect(() => { loadDRE(); }, [loadDRE]);

  const isProfit = (data?.netResult ?? 0) >= 0;
  const marginPct = data?.profitMargin?.toFixed(1) ?? '0.0';

  const chartData = data ? [
    { name: 'Receita', value: data.grossRevenue, fill: '#10b981' },
    { name: 'CMV', value: data.totalCMV, fill: '#f97316' },
    { name: 'Despesas Fixas', value: data.fixedExpenses, fill: '#ef4444' },
    { name: 'Lucro', value: Math.abs(data.netResult), fill: isProfit ? '#7c3aed' : '#dc2626' },
  ] : [];

  return (
    <div className="space-y-4 mt-4">

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Input type="date" value={dates.startDate} onChange={e => setDates(p => ({ ...p, startDate: e.target.value }))} className="h-8 text-sm w-36" />
        <span className="text-muted-foreground text-xs">→</span>
        <Input type="date" value={dates.endDate} onChange={e => setDates(p => ({ ...p, endDate: e.target.value }))} className="h-8 text-sm w-36" />
        <Button onClick={loadDRE} disabled={loading} size="sm" className="h-8">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {data && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* === COLUNA ESQUERDA: DRE Compacto (o que o usuário gostou) === */}
          <div className="lg:col-span-2 flex flex-col gap-3">

            {/* Card resultado final */}
            <div className={`rounded-xl p-4 text-white shadow-md ${isProfit ? 'bg-gradient-to-br from-violet-600 to-violet-800' : 'bg-gradient-to-br from-red-500 to-red-700'}`}>
              <p className="text-[11px] font-bold uppercase opacity-70 tracking-wider mb-1">Lucro Líquido</p>
              <p className="text-3xl font-black tabular-nums">{formatCurrency(data.netResult)}</p>
              <div className="flex items-center gap-1.5 mt-2 opacity-80">
                {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-xs">Margem {marginPct}% sobre a Receita Bruta</span>
              </div>
            </div>

            {/* Linhas do DRE */}
            <div className="bg-card border rounded-xl overflow-hidden">
              <ExpandableItem label="(+) Receita Bruta" value={data.grossRevenue} color="text-emerald-600" items={data.incomeByCategory} />
              <ExpandableItem label="(-) CMV — Custo Direto" value={data.totalCMV} color="text-orange-500" items={data.cmvByCategory} />

              {/* Margem de Contribuição */}
              <div className="flex items-center justify-between py-2.5 px-3 bg-blue-50 border-y border-blue-100">
                <span className="text-sm font-bold text-blue-700">(=) Margem de Contribuição</span>
                <span className="text-sm font-black tabular-nums text-blue-700">{formatCurrency(data.contributionMargin)}</span>
              </div>

              <ExpandableItem label="(-) Despesas Fixas" value={data.fixedExpenses} color="text-red-500" items={data.fixedExpensesByCategory} />

              {/* Resultado Final */}
              <div className={`flex items-center justify-between py-2.5 px-3 border-t ${isProfit ? 'bg-violet-50 border-violet-100' : 'bg-red-50 border-red-100'}`}>
                <span className={`text-sm font-bold ${isProfit ? 'text-violet-700' : 'text-red-700'}`}>(=) Resultado do Exercício</span>
                <span className={`text-sm font-black tabular-nums ${isProfit ? 'text-violet-700' : 'text-red-700'}`}>{formatCurrency(data.netResult)}</span>
              </div>
            </div>
          </div>

          {/* === COLUNA DIREITA: Gráfico (complemento visual) === */}
          <div className="lg:col-span-3 bg-card border rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b bg-muted/10">
              <h3 className="text-sm font-semibold text-foreground">Composição do Resultado</h3>
              <p className="text-[11px] text-muted-foreground">Visualização comparativa dos componentes financeiros</p>
            </div>

            <div className="flex-1 p-4">
              {chartData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} barSize={48} margin={{ top: 20, bottom: 0, left: 10, right: 10 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(v: number) => formatCurrency(v)}
                        style={{ fontSize: 10, fill: '#374151', fontWeight: 600 }}
                      />
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Sem dados para o período selecionado
                </div>
              )}
            </div>

            {/* Legenda */}
            <div className="grid grid-cols-4 border-t divide-x text-center">
              {[
                { label: 'Receita', value: data.grossRevenue, color: 'text-emerald-600' },
                { label: 'CMV', value: data.totalCMV, color: 'text-orange-500' },
                { label: 'Desp. Fixas', value: data.fixedExpenses, color: 'text-red-500' },
                { label: 'Lucro', value: data.netResult, color: isProfit ? 'text-violet-600' : 'text-red-600' },
              ].map(item => (
                <div key={item.label} className="py-2 px-1">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className={`text-xs font-bold tabular-nums ${item.color}`}>{formatCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* DASHBOARD DE CNQ (Pareto) */}
      {data && cnqData && !loading && (
        <div className="bg-card border rounded-xl overflow-hidden mt-6 shadow-sm border-rose-100">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 border-b border-rose-50 bg-rose-50/30">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-5 h-5" /> 
                Radar de Eficiência: Custo da Não Qualidade (CNQ)
              </h3>
              <p className="text-xs text-rose-600/80 mt-1 max-w-xl">
                O valor abaixo representa exatamente o <b>lucro potencial que foi para o lixo</b> devido a perdas e retrabalhos durante este período de faturamento. Custos congelados no ato da perda para evitar distorções no relatório.
              </p>
            </div>
            <div className="text-right mt-4 md:mt-0 flex flex-col items-end">
               <span className="text-xs font-semibold uppercase text-rose-500 tracking-widest">Prejuízo Acumulado</span>
               <span className="text-3xl font-black text-rose-700 tabular-nums">
                 {formatCurrency(cnqData.totalWasteCost)}
               </span>
               <div className="flex gap-2 text-[11px] text-rose-600 mt-1 bg-white px-2 py-0.5 rounded shadow-sm border border-rose-100">
                  <span className="font-semibold">{cnqData.totalOrdersAffected}</span> Ordens Afetadas
               </div>
            </div>
          </div>
          
          <div className="p-5 flex flex-col lg:flex-row gap-6">
            {cnqData.totalWasteCost > 0 ? (
              <>
                <div className="flex-[2_2_0%] h-64">
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4 px-2">Top Ofensores Operacionais</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={cnqData.pareto} margin={{ top: 20, bottom: 20, left: -20, right: 0 }}>
                      <XAxis dataKey="reason" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" hide />
                      <Tooltip 
                        cursor={{fill: 'transparent'}}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload as CNQParetoItem;
                          return (
                            <div className="bg-white border shadow-lg rounded-lg p-3 text-sm min-w-40 border-rose-100">
                              <p className="font-bold text-slate-800 mb-1">{data.reason}</p>
                              <div className="flex items-center justify-between text-rose-600 font-semibold mb-1 border-b border-rose-50 pb-1">
                                 R$ Perdas: <span>{formatCurrency(data.cost)}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500 text-xs">
                                 Ocorrências: <span>{data.occurrences}x</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500 text-xs">
                                 Representação: <span>{data.percentage.toFixed(1)}%</span>
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Bar yAxisId="left" dataKey="cost" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={50} >
                         <LabelList dataKey="cost" position="top" formatter={(v: number) => formatCurrency(v)} style={{ fontSize: 10, fill: '#e11d48', fontWeight: 600 }} />
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex-1 flex flex-col max-h-64 overflow-y-auto pr-2 gap-2">
               <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Tabela Analítica</h4>
               {cnqData.pareto.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                     <div className="flex items-center gap-3">
                       <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-bold">
                         {idx + 1}
                       </div>
                       <div>
                         <p className="font-bold text-slate-700 text-xs leading-none">{item.reason}</p>
                         <p className="text-[10px] text-slate-500 mt-1">{item.occurrences} incidente{item.occurrences > 1 ? 's' : ''}</p>
                       </div>
                     </div>
                     <div className="text-right">
                       <p className="font-black text-rose-600 text-sm">{formatCurrency(item.cost)}</p>
                       <p className="text-[10px] font-semibold text-slate-400">{item.percentage.toFixed(1)}% do CNQ</p>
                     </div>
                  </div>
               ))}
            </div>
          </>
         ) : (
            <div className="w-full py-10 flex flex-col items-center justify-center border-2 border-dashed border-rose-100 rounded-lg bg-rose-50/50 text-rose-400">
                <PackageX className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm font-semibold uppercase tracking-widest">Nenhuma perda cadastrada</p>
                <p className="text-xs mt-1">Sua produção ocorreu perfeitamente neste faturamento!</p>
            </div>
         )}
         </div>
      </div>
      )}

      {!data && !loading && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Selecione um período e clique em Atualizar.
        </div>
      )}
    </div>
  );
}
