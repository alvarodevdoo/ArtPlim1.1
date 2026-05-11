import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import type { CommissionRow } from '../types';

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export function RelatorioComissoes() {
  const [dates, setDates] = useState(getDefaultDateRange);
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    if (!dates.startDate || !dates.endDate) {
      toast.error('Selecione o período (data inicial e final)');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/api/finance/reports/commissions', {
        params: { startDate: dates.startDate, endDate: dates.endDate },
      });
      setRows(res.data.data);
      setGenerated(true);
      toast.success('Relatório de comissões gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar relatório de comissões');
    } finally {
      setLoading(false);
    }
  };

  const totals = rows.reduce(
    (acc, r) => ({
      items: acc.items + r.totalItems,
      sales: acc.sales + r.totalSales,
      commission: acc.commission + r.totalCommission,
    }),
    { items: 0, sales: 0, commission: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatório de Comissões</CardTitle>
        <CardDescription>Cálculo de comissões por vendedor no período selecionado</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg border">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Data Inicial
            </label>
            <Input
              type="date"
              value={dates.startDate}
              onChange={e => setDates(p => ({ ...p, startDate: e.target.value }))}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Data Final
            </label>
            <Input
              type="date"
              value={dates.endDate}
              onChange={e => setDates(p => ({ ...p, endDate: e.target.value }))}
              className="w-40"
            />
          </div>
          <Button onClick={handleGenerate} disabled={loading}>
            <Download className={`w-4 h-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
            {loading ? 'Gerando...' : 'Gerar Relatório'}
          </Button>
        </div>

        {/* Tabela de resultados */}
        {generated && (
          rows.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma comissão encontrada para o período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Vendedor</th>
                    <th className="text-right px-4 py-3 font-semibold">Qtd. Itens</th>
                    <th className="text-right px-4 py-3 font-semibold">Total Vendido</th>
                    <th className="text-right px-4 py-3 font-semibold">Comissão Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{row.sellerName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.totalItems}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.totalSales)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-green-600">
                        {formatCurrency(row.totalCommission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 bg-muted/20 font-bold">
                  <tr>
                    <td className="px-4 py-3">TOTAL GERAL</td>
                    <td className="px-4 py-3 text-right tabular-nums">{totals.items}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totals.sales)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">
                      {formatCurrency(totals.commission)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}

        {!generated && !loading && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Selecione o período e clique em "Gerar Relatório" para visualizar as comissões.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
