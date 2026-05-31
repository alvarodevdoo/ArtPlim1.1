import { useEffect, useState } from 'react';
import { Loader2, RotateCw, Factory, Clock } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface RecentProduction {
  id: string;
  productId: string;
  quantity: string;
  variables: Record<string, any> | null;
  machineMinutes: any | null;
  totalCost: string | null;
  unitCost: string | null;
  finishedAt: string;
  notes: string | null;
  product: { id: string; name: string; stockUnit: string | null; stockQuantity: number | null };
}

interface RecentProductionsPanelProps {
  refreshKey: number;
  onProduced: () => void;
}

const formatCurrency = (v: number | string | null | undefined) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
};

/**
 * Lista as últimas produções internas. Cada uma tem um botão "Repetir"
 * que abre input rápido de quantidade e reusa as mesmas variáveis.
 */
export function RecentProductionsPanel({ refreshKey, onProduced }: RecentProductionsPanelProps) {
  const [productions, setProductions] = useState<RecentProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [repeatingId, setRepeatingId] = useState<string | null>(null);
  const [repeatQty, setRepeatQty] = useState<string>('1');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/wms/manufacture/recent?limit=20')
      .then(res => setProductions(res.data.data || []))
      .catch(() => setProductions([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleRepeat = async (presetId: string) => {
    const qty = parseFloat(repeatQty.replace(',', '.'));
    if (!qty || qty <= 0) {
      toast.error('Quantidade inválida.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/api/wms/manufacture/repeat/${presetId}`, { quantity: qty });
      const result = res.data.data;
      toast.success(`Produção repetida! ${qty} un. × ${formatCurrency(result.unitCost)}.`);
      setRepeatingId(null);
      setRepeatQty('1');
      onProduced();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao repetir produção.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={20} /></div>;
  }

  if (productions.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground italic">
        Nenhuma produção interna ainda. Clique em "Nova Produção" acima para começar.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {productions.map(p => {
        const isRepeating = repeatingId === p.id;
        const varEntries = p.variables ? Object.entries(p.variables) : [];
        return (
          <div key={p.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Factory size={14} className="text-purple-600 flex-shrink-0" />
                  <p className="font-semibold text-sm truncate">{p.product.name}</p>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-mono">
                    × {Number(p.quantity)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(p.finishedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {p.unitCost && (
                    <span>Custo unit: <strong className="text-foreground">{formatCurrency(p.unitCost)}</strong></span>
                  )}
                  {p.totalCost && (
                    <span>Total: <strong className="text-foreground">{formatCurrency(p.totalCost)}</strong></span>
                  )}
                </div>
                {varEntries.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {varEntries.map(([k, v]) => (
                      <span key={k} className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono">
                        {k}={v?.value ?? v}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-shrink-0">
                {isRepeating ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.001"
                      className="w-20 h-8"
                      value={repeatQty}
                      onChange={e => setRepeatQty(e.target.value)}
                      placeholder="Qtd"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-8 bg-purple-600 hover:bg-purple-700"
                      onClick={() => handleRepeat(p.id)}
                      disabled={submitting}
                    >
                      {submitting ? <Loader2 className="animate-spin" size={14} /> : 'OK'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setRepeatingId(null)}
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => { setRepeatingId(p.id); setRepeatQty('1'); }}
                  >
                    <RotateCw size={12} /> Repetir
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
