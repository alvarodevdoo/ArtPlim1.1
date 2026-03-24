import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Wallet, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface BankAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface TimelineEntry {
  date: string;
  inflow: number;
  outflow: number;
  balance: number;
  isProjeted: boolean;
}

interface CashFlowData {
  openingBalance: number;
  paidInflows: number;
  paidOutflows: number;
  closingBalance: number;
  projectedInflows: number;
  projectedOutflows: number;
  projectedBalance: number;
  timeline: TimelineEntry[];
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

export function RelatorioFluxoCaixa() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState(getMonthRange());

  useEffect(() => {
    api.get('/api/finance/accounts').then(res => {
      const bankAccounts = res.data.data.filter(
        (a: BankAccount) => ['CHECKING', 'SAVINGS', 'CASH'].includes(a.type)
      );
      setAccounts(bankAccounts);
      setSelectedIds(bankAccounts.map((a: BankAccount) => a.id));
    }).catch(() => toast.error('Erro ao carregar contas bancárias'));
  }, []);

  const loadCashFlow = useCallback(async () => {
    if (selectedIds.length === 0) return toast.error('Selecione pelo menos uma conta bancária');
    setLoading(true);
    try {
      const res = await api.get('/api/finance/reports/cash-flow', {
        params: {
          startDate: dates.startDate,
          endDate: dates.endDate,
          bankAccountIds: selectedIds.join(',')
        }
      });
      setData(res.data.data);
    } catch {
      toast.error('Erro ao carregar Fluxo de Caixa');
    } finally {
      setLoading(false);
    }
  }, [dates, selectedIds]);

  const toggleAccount = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const chartData = data?.timeline.map(t => ({
    date: new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    Entradas: t.inflow,
    Saídas: t.outflow,
    Saldo: t.balance,
    projetado: t.isProjeted
  })) ?? [];

  return (
    <div className="space-y-6 mt-6">
      {/* Seleção de contas + filtros */}
      <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Contas Bancárias</p>
          <div className="flex flex-wrap gap-2">
            {accounts.map(a => (
              <button
                key={a.id}
                onClick={() => toggleAccount(a.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedIds.includes(a.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:border-primary'
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Início</label>
            <Input type="date" value={dates.startDate} onChange={e => setDates(p => ({ ...p, startDate: e.target.value }))} className="w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fim</label>
            <Input type="date" value={dates.endDate} onChange={e => setDates(p => ({ ...p, endDate: e.target.value }))} className="w-40" />
          </div>
          <Button onClick={loadCashFlow} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo Inicial</p>
                    <p className="text-xl font-bold mt-1">{formatCurrency(data.openingBalance)}</p>
                  </div>
                  <Wallet className="w-7 h-7 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-600 uppercase tracking-wide">Entradas Reais</p>
                    <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(data.paidInflows)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Projetado: +{formatCurrency(data.projectedInflows)}</p>
                  </div>
                  <TrendingUp className="w-7 h-7 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-red-600 uppercase tracking-wide">Saídas Reais</p>
                    <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(data.paidOutflows)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Projetado: -{formatCurrency(data.projectedOutflows)}</p>
                  </div>
                  <TrendingDown className="w-7 h-7 text-red-400" />
                </div>
              </CardContent>
            </Card>

            <Card className={`${data.projectedBalance >= 0 ? 'border-blue-200 bg-blue-50/50' : 'border-orange-200 bg-orange-50/50'}`}>
              <CardContent className="p-5">
                <div>
                  <p className="text-xs text-blue-600 uppercase tracking-wide">Saldo Projetado</p>
                  <p className={`text-xl font-bold mt-1 ${data.projectedBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                    {formatCurrency(data.projectedBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Realizado: {formatCurrency(data.closingBalance)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fluxo Diário</CardTitle>
              <p className="text-xs text-muted-foreground">Barras sólidas = realizadas · Tracejado = projetado</p>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 10 }} width={90} />
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                    <Area type="monotone" dataKey="Entradas" stroke="#22c55e" fill="none" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Saídas" stroke="#ef4444" fill="none" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Saldo" stroke="#3b82f6" fill="url(#colorSaldo)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">Sem movimentações no período</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!data && !loading && (
        <div className="text-center py-16 text-muted-foreground">Selecione as contas e clique em "Atualizar"</div>
      )}
    </div>
  );
}
