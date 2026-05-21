import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, TrendingUp, TrendingDown, ShoppingCart, Receipt, Users, Package, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';

interface SalesReportData {
  summary: {
    totalSales: number;
    totalOrders: number;
    avgTicket: number;
    growthSales: number;
    growthOrders: number;
  };
  byStatus: Array<{ status: string; count: number; value: number }>;
  timeline: Array<{ date: string; sales: number; orders: number }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    orders: number;
    revenue: number;
  }>;
  topSellers: Array<{
    sellerId: string;
    sellerName: string;
    orders: number;
    revenue: number;
    avgTicket: number;
  }>;
  availableSellers: Array<{ sellerId: string; sellerName: string }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: '#94a3b8' },
  APPROVED: { label: 'Aprovado', color: '#3b82f6' },
  IN_PRODUCTION: { label: 'Em Produção', color: '#f59e0b' },
  FINISHED: { label: 'Finalizado', color: '#10b981' },
  DELIVERED: { label: 'Entregue', color: '#7c3aed' },
  CANCELLED: { label: 'Cancelado', color: '#ef4444' },
};

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export function RelatorioVendas() {
  const [dates, setDates] = useState(getDefaultDateRange);
  const [sellerId, setSellerId] = useState<string>('');
  const [data, setData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        startDate: dates.startDate,
        endDate: dates.endDate,
      };
      if (sellerId) params.sellerId = sellerId;

      const res = await api.get('/api/sales/reports/sales', { params });
      setData(res.data.data);
    } catch {
      toast.error('Erro ao carregar relatório de vendas');
    } finally {
      setLoading(false);
    }
  }, [dates, sellerId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const activeSeller = data?.availableSellers.find(s => s.sellerId === sellerId);

  return (
    <div className="space-y-4">
      <FilterCard
        dates={dates}
        setDates={setDates}
        sellerId={sellerId}
        setSellerId={setSellerId}
        availableSellers={data?.availableSellers ?? []}
        activeSellerName={activeSeller?.sellerName}
        loading={loading}
        onRefresh={loadReport}
      />

      {loading && <LoadingState />}
      {!loading && data && (
        <ReportContent
          data={data}
          onSellerClick={setSellerId}
        />
      )}
      {!loading && !data && (
        <Card><CardContent className="py-16 text-center text-muted-foreground text-sm">
          Selecione um período e clique em Atualizar.
        </CardContent></Card>
      )}
    </div>
  );
}

interface FilterCardProps {
  dates: { startDate: string; endDate: string };
  setDates: (updater: (prev: { startDate: string; endDate: string }) => { startDate: string; endDate: string }) => void;
  sellerId: string;
  setSellerId: (id: string) => void;
  availableSellers: Array<{ sellerId: string; sellerName: string }>;
  activeSellerName?: string;
  loading: boolean;
  onRefresh: () => void;
}

function FilterCard({
  dates, setDates, sellerId, setSellerId, availableSellers, activeSellerName, loading, onRefresh,
}: FilterCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatório de Vendas</CardTitle>
        <CardDescription>Análise consolidada de vendas, pedidos e ranking de produtos/clientes/vendedores</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Início</label>
            <Input type="date" value={dates.startDate} onChange={e => setDates(p => ({ ...p, startDate: e.target.value }))} className="w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fim</label>
            <Input type="date" value={dates.endDate} onChange={e => setDates(p => ({ ...p, endDate: e.target.value }))} className="w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendedor</label>
            <select
              value={sellerId}
              onChange={e => setSellerId(e.target.value)}
              className="h-10 px-3 py-2 border border-input rounded-md bg-background text-sm w-56"
            >
              <option value="">Todos os vendedores</option>
              {availableSellers.map(s => (
                <option key={s.sellerId} value={s.sellerId}>{s.sellerName}</option>
              ))}
            </select>
          </div>
          <Button onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {sellerId && activeSellerName && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full text-sm">
            <UserCheck className="w-4 h-4 text-primary" />
            <span>Filtrado por: <strong>{activeSellerName}</strong></span>
            <button
              onClick={() => setSellerId('')}
              className="p-0.5 hover:bg-primary/20 rounded-full transition-colors"
              title="Remover filtro"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ReportContent({
  data,
  onSellerClick,
}: {
  data: SalesReportData;
  onSellerClick: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <SummaryCards summary={data.summary} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TimelineChart timeline={data.timeline} />
        </div>
        <StatusDistribution byStatus={data.byStatus} />
      </div>
      <TopSellersTable sellers={data.topSellers} onSellerClick={onSellerClick} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopProductsTable products={data.topProducts} />
        <TopCustomersTable customers={data.topCustomers} />
      </div>
    </div>
  );
}

function SummaryCards({ summary }: { summary: SalesReportData['summary'] }) {
  const cards = [
    {
      label: 'Total Vendido',
      value: formatCurrency(summary.totalSales),
      icon: Receipt,
      color: 'text-emerald-500',
      growth: summary.growthSales,
    },
    {
      label: 'Pedidos',
      value: summary.totalOrders.toString(),
      icon: ShoppingCart,
      color: 'text-blue-500',
      growth: summary.growthOrders,
    },
    {
      label: 'Ticket Médio',
      value: formatCurrency(summary.avgTicket),
      icon: TrendingUp,
      color: 'text-violet-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <Card key={card.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{card.label}</p>
                  <p className="text-xl font-bold tabular-nums">{card.value}</p>
                  {card.growth !== undefined && (
                    <p className={`text-xs font-medium flex items-center gap-1 ${card.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {card.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {card.growth >= 0 ? '+' : ''}{card.growth.toFixed(1)}% vs período anterior
                    </p>
                  )}
                </div>
                <Icon className={`w-7 h-7 opacity-80 ${card.color}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TimelineChart({ timeline }: { timeline: SalesReportData['timeline'] }) {
  const chartData = timeline.map(t => ({
    date: new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    Vendas: t.sales,
    Pedidos: t.orders,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Evolução Diária</CardTitle>
        <CardDescription>Vendas e pedidos por dia no período</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Sem dados no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={(v: any, name: string) =>
                name === 'Vendas' ? formatCurrency(Number(v)) : v
              } />
              <Area type="monotone" dataKey="Vendas" stroke="#10b981" fill="url(#colorVendas)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function StatusDistribution({ byStatus }: { byStatus: SalesReportData['byStatus'] }) {
  const chartData = byStatus.map(s => ({
    name: STATUS_CONFIG[s.status]?.label || s.status,
    count: s.count,
    value: s.value,
    fill: STATUS_CONFIG[s.status]?.color || '#94a3b8',
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Pedidos por Status</CardTitle>
        <CardDescription>Distribuição no período</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Sem pedidos</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => v} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

interface RankingTableProps<T> {
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  rows: T[];
  columns: Array<{ label: string; key: keyof T; align?: 'left' | 'right'; format?: (v: any) => string }>;
  emptyMessage: string;
  onRowClick?: (row: T) => void;
  rowTooltip?: string;
}

function RankingTable<T extends Record<string, any>>({
  title, description, icon: Icon, iconColor, rows, columns, emptyMessage, onRowClick, rowTooltip,
}: RankingTableProps<T>) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2 w-8">#</th>
                  {columns.map(col => (
                    <th key={String(col.key)} className={`py-2 px-2 ${col.align === 'right' ? 'text-right' : 'text-left'} font-medium`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onRowClick?.(row)}
                    title={onRowClick ? rowTooltip : undefined}
                    className={`border-b last:border-0 transition-colors ${
                      onRowClick ? 'cursor-pointer hover:bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                  >
                    <td className="py-2 px-2 text-muted-foreground tabular-nums">{idx + 1}</td>
                    {columns.map(col => (
                      <td key={String(col.key)} className={`py-2 px-2 ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                        {col.format ? col.format(row[col.key]) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopSellersTable({
  sellers,
  onSellerClick,
}: {
  sellers: SalesReportData['topSellers'];
  onSellerClick: (id: string) => void;
}) {
  return (
    <RankingTable
      title="Top Vendedores"
      description="Ranking de vendedores no período — clique em um para filtrar"
      icon={UserCheck}
      iconColor="text-amber-500"
      rows={sellers}
      emptyMessage="Nenhum pedido com vendedor atribuído no período"
      onRowClick={row => onSellerClick(row.sellerId)}
      rowTooltip="Clique para filtrar todo o relatório por este vendedor"
      columns={[
        { label: 'Vendedor', key: 'sellerName' },
        { label: 'Pedidos', key: 'orders', align: 'right' },
        { label: 'Ticket Médio', key: 'avgTicket', align: 'right', format: formatCurrency },
        { label: 'Receita', key: 'revenue', align: 'right', format: formatCurrency },
      ]}
    />
  );
}

function TopProductsTable({ products }: { products: SalesReportData['topProducts'] }) {
  return (
    <RankingTable
      title="Top 10 Produtos"
      description="Produtos mais vendidos no período"
      icon={Package}
      iconColor="text-purple-500"
      rows={products}
      emptyMessage="Nenhum produto vendido no período"
      columns={[
        { label: 'Produto', key: 'productName' },
        { label: 'Qtd', key: 'quantity', align: 'right' },
        { label: 'Receita', key: 'revenue', align: 'right', format: formatCurrency },
      ]}
    />
  );
}

function TopCustomersTable({ customers }: { customers: SalesReportData['topCustomers'] }) {
  return (
    <RankingTable
      title="Top 10 Clientes"
      description="Clientes com maior faturamento"
      icon={Users}
      iconColor="text-blue-500"
      rows={customers}
      emptyMessage="Nenhum cliente com pedidos no período"
      columns={[
        { label: 'Cliente', key: 'customerName' },
        { label: 'Pedidos', key: 'orders', align: 'right' },
        { label: 'Receita', key: 'revenue', align: 'right', format: formatCurrency },
      ]}
    />
  );
}
