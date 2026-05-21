import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import type { DashboardStats } from '../types';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
  loading: boolean;
  sub?: React.ReactNode;
}

function StatCard({ label, value, icon: Icon, iconColor, loading, sub }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            {loading ? (
              <div className="h-7 w-28 bg-muted animate-pulse rounded" />
            ) : (
              <p className="text-xl font-bold tabular-nums">{formatCurrency(value)}</p>
            )}
            {!loading && sub}
          </div>
          <Icon className={`w-7 h-7 shrink-0 opacity-80 ${iconColor}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function GrowthBadge({ growth, invert = false }: { growth: number; invert?: boolean }) {
  const isPositive = invert ? growth <= 0 : growth >= 0;
  return (
    <p className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {growth >= 0 ? '+' : ''}{growth.toFixed(1)}% vs mês anterior
    </p>
  );
}

interface Props {
  stats: DashboardStats | null;
  loading: boolean;
}

export function QuickStats({ stats, loading }: Props) {
  const g = stats?.monthlyComparison?.growth;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Receitas do Mês"
        value={stats?.summary.totalIncome ?? 0}
        icon={TrendingUp}
        iconColor="text-green-500"
        loading={loading}
        sub={g && <GrowthBadge growth={g.income} />}
      />
      <StatCard
        label="Despesas do Mês"
        value={stats?.summary.totalExpense ?? 0}
        icon={TrendingDown}
        iconColor="text-red-500"
        loading={loading}
        sub={g && <GrowthBadge growth={g.expense} invert />}
      />
      <StatCard
        label="Lucro do Mês"
        value={stats?.summary.profit ?? 0}
        icon={DollarSign}
        iconColor="text-violet-500"
        loading={loading}
        sub={
          !loading && stats && (
            <p className="text-xs text-muted-foreground">
              Margem {stats.summary.profitMargin.toFixed(1)}%
            </p>
          )
        }
      />
      <StatCard
        label="Saldo Total (Contas)"
        value={stats?.accounts?.totalBalance ?? 0}
        icon={Wallet}
        iconColor="text-blue-500"
        loading={loading}
        sub={
          !loading && stats && (
            <p className="text-xs text-muted-foreground">
              A receber: {formatCurrency(stats.pending.receivables)}
            </p>
          )
        }
      />
    </div>
  );
}
