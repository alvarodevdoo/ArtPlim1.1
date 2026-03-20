import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Bell, Clock, CheckCircle, Package, AlertTriangle, DollarSign, BarChart3, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Pedido, PedidoStats } from '@/types/pedidos';

interface PedidosStatsProps {
  stats: PedidoStats | null;
  pendingValue: number;
  overduePedidos: Pedido[];
  pedidos: Pedido[];
  hasFinancialAccess: () => boolean;
  sendOverdueReminders: () => void;
}

const PedidosStats: React.FC<PedidosStatsProps> = React.memo(({
  stats, pendingValue, overduePedidos, pedidos, hasFinancialAccess, sendOverdueReminders,
}) => {
  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Pedidos</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                  <p className="text-xs text-muted-foreground">Crescimento: {stats?.monthlyGrowth > 0 ? '+' : ''}{(stats?.monthlyGrowth || 0).toFixed(1)}%</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full"><BarChart3 className="w-6 h-6 text-blue-600" /></div>
              </div>
            </CardContent>
          </Card>

          {hasFinancialAccess() && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                    <p className="text-2xl font-bold">{formatCurrency(stats?.totalValue || 0)}</p>
                    <p className="text-xs text-muted-foreground">Ticket médio: {formatCurrency(stats?.avgOrderValue || 0)}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full"><DollarSign className="w-6 h-6 text-green-600" /></div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                  {hasFinancialAccess() ? (
                    <>
                      <p className="text-2xl font-bold">{formatCurrency(pendingValue)}</p>
                      <p className="text-xs text-muted-foreground">{(pedidos || []).filter(p => ['APPROVED', 'IN_PRODUCTION'].includes(p?.status)).length} pedidos</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold">{(pedidos || []).filter(p => ['APPROVED', 'IN_PRODUCTION'].includes(p?.status)).length}</p>
                      <p className="text-xs text-muted-foreground">pedidos na fila</p>
                    </>
                  )}
                </div>
                <div className="p-3 bg-yellow-100 rounded-full"><Activity className="w-6 h-6 text-yellow-600" /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vencidos</p>
                  <p className="text-2xl font-bold text-red-600">{overduePedidos.length}</p>
                  <p className="text-xs text-muted-foreground">Orçamentos expirados</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Ações Rápidas</p>
                  <p className="text-sm text-blue-700">Acelere seu fluxo de trabalho</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-100">
                <CheckCircle className="w-4 h-4 mr-2" /> Aprovar Pendentes ({(pedidos || []).filter(p => p?.status === 'DRAFT').length})
              </Button>
              <Button size="sm" variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-100" onClick={sendOverdueReminders} disabled={overduePedidos.length === 0}>
                <Bell className="w-4 h-4 mr-2" /> Lembrar Vencidos ({overduePedidos.length})
              </Button>
              <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-100">
                <Package className="w-4 h-4 mr-2" /> Produção ({(pedidos || []).filter(p => p?.status === 'IN_PRODUCTION').length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

PedidosStats.displayName = 'PedidosStats';
export default PedidosStats;
