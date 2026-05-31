import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader2, X, Factory, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  stockQuantity?: number | null;
  stockUnit?: string | null;
  averageCost?: number;
  fichasTecnicas?: Array<{
    id: string;
    quantidade: number;
    linkedQuantityVariable?: string | null;
    material: { id: string; name: string; unit: string; currentStock: number; averageCost: number };
  }>;
}

interface Machine {
  id: string;
  name: string;
  type?: string;
}

interface ManufactureModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Se fornecido, pré-seleciona o produto e bloqueia troca */
  presetProductId?: string;
  /** Variáveis dinâmicas pré-preenchidas (vindas de uma produção anterior) */
  presetVariables?: Record<string, { value: any; unit: string | null }>;
  presetTitle?: string;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL'
}).format(val);

/**
 * Modal para registrar uma Produção Interna.
 * — Lê BOM do produto e mostra ao usuário o que vai ser consumido
 * — Permite override de quantidades variáveis (linkedQuantityVariable)
 * — Permite registrar tempo gasto em máquinas (apenas histórico)
 * — Ao confirmar, chama POST /api/wms/manufacture
 */
export function ManufactureModal({
  open, onClose, onSuccess,
  presetProductId, presetVariables, presetTitle
}: ManufactureModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [productId, setProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [machineTimes, setMachineTimes] = useState<Array<{ machineId: string; minutes: string }>>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset form quando abre
  useEffect(() => {
    if (!open) return;
    setQuantity('1');
    setNotes('');
    setMachineTimes([]);
    setProductId(presetProductId ?? '');

    if (presetVariables) {
      const flat: Record<string, string> = {};
      Object.entries(presetVariables).forEach(([k, v]) => {
        flat[k] = String(v?.value ?? '');
      });
      setVariables(flat);
    } else {
      setVariables({});
    }
  }, [open, presetProductId, presetVariables]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      api.get('/api/catalog/products?withBOM=1').catch(() => ({ data: { data: [] } })),
      api.get('/api/catalog/machines').catch(() => ({ data: { data: [] } })),
    ]).then(([pRes, mRes]) => {
      setProducts(pRes.data.data || []);
      setMachines(mRes.data.data || []);
    }).finally(() => setLoading(false));
  }, [open]);

  const selectedProduct = useMemo(
    () => products.find(p => p.id === productId),
    [products, productId]
  );

  // Variáveis dinâmicas detectadas na BOM do produto
  const dynamicVarNames = useMemo(() => {
    const set = new Set<string>();
    selectedProduct?.fichasTecnicas?.forEach(ft => {
      if (ft.linkedQuantityVariable) set.add(ft.linkedQuantityVariable);
    });
    return Array.from(set);
  }, [selectedProduct]);

  // Preview de consumo (estimativa local — backend é fonte da verdade)
  const consumoPreview = useMemo(() => {
    if (!selectedProduct?.fichasTecnicas) return [];
    const qty = parseFloat(quantity.replace(',', '.')) || 0;
    return selectedProduct.fichasTecnicas.map(ft => {
      const baseQty = ft.linkedQuantityVariable && variables[ft.linkedQuantityVariable]
        ? parseFloat(variables[ft.linkedQuantityVariable].replace(',', '.')) || 0
        : Number(ft.quantidade);
      const totalQty = baseQty * qty;
      const totalCost = totalQty * Number(ft.material.averageCost || 0);
      const insufficient = totalQty > Number(ft.material.currentStock || 0);
      return {
        ...ft,
        totalQty,
        totalCost,
        insufficient,
      };
    });
  }, [selectedProduct, quantity, variables]);

  const totalCostPreview = consumoPreview.reduce((s, c) => s + c.totalCost, 0);
  const hasInsufficientStock = consumoPreview.some(c => c.insufficient);

  const handleAddMachineTime = () => {
    setMachineTimes(t => [...t, { machineId: '', minutes: '' }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      toast.error('Selecione um produto.');
      return;
    }
    const qty = parseFloat(quantity.replace(',', '.'));
    if (!qty || qty <= 0) {
      toast.error('Quantidade inválida.');
      return;
    }

    setSubmitting(true);
    try {
      // Monta payload de variáveis no formato esperado pelo PricingEngine
      const varsPayload: Record<string, { value: any; unit: string | null }> = {};
      Object.entries(variables).forEach(([k, v]) => {
        if (v !== '') {
          varsPayload[k] = { value: parseFloat(v.replace(',', '.')) || 0, unit: null };
        }
      });

      const machineMinutes = machineTimes
        .filter(m => m.machineId && m.minutes)
        .map(m => ({ machineId: m.machineId, minutes: parseFloat(m.minutes.replace(',', '.')) || 0 }));

      const res = await api.post('/api/wms/manufacture', {
        productId,
        quantity: qty,
        variables: Object.keys(varsPayload).length > 0 ? varsPayload : undefined,
        machineMinutes: machineMinutes.length > 0 ? machineMinutes : undefined,
        notes,
      });

      const result = res.data.data;
      toast.success(
        `Produção registrada! ${qty} un. adicionada(s) ao estoque por ${formatCurrency(result.totalCost)} (custo unit. ${formatCurrency(result.unitCost)}).`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao registrar produção.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ maxWidth: '52rem' }}>
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Factory size={22} className="text-purple-600" />
            <h2 className="text-lg font-semibold">{presetTitle ?? 'Nova Produção Interna'}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Banner explicativo */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                <strong>Como funciona:</strong> consumir insumos da ficha técnica e gerar estoque de produto acabado.
                Não gera receita nem despesa no financeiro — o custo só será realizado na venda.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium block mb-1">Produto a fabricar</label>
                  <select
                    className="w-full p-2 border rounded-md bg-background text-sm"
                    value={productId}
                    onChange={e => setProductId(e.target.value)}
                    disabled={!!presetProductId}
                  >
                    <option value="">Selecione um produto...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.stockQuantity !== null && p.stockQuantity !== undefined ? `(estoque: ${p.stockQuantity})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Quantidade</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    placeholder="3"
                  />
                </div>
              </div>

              {/* Variáveis dinâmicas */}
              {dynamicVarNames.length > 0 && (
                <div className="border rounded-lg p-3 bg-amber-50/50">
                  <p className="text-xs font-bold uppercase text-amber-700 mb-2">
                    Variáveis dinâmicas (preencha o valor real desta produção)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {dynamicVarNames.map(varName => (
                      <div key={varName}>
                        <label className="text-xs font-mono text-muted-foreground">{varName}</label>
                        <Input
                          type="number"
                          step="0.001"
                          value={variables[varName] ?? ''}
                          onChange={e => setVariables(v => ({ ...v, [varName]: e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview de consumo */}
              {selectedProduct && consumoPreview.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 text-xs font-bold uppercase flex justify-between">
                    <span>Insumos a debitar</span>
                    <span className="text-purple-700">Custo estimado: {formatCurrency(totalCostPreview)}</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="p-2 text-left">Material</th>
                        <th className="p-2 text-right">Quantidade</th>
                        <th className="p-2 text-right">Custo Unit.</th>
                        <th className="p-2 text-right">Subtotal</th>
                        <th className="p-2 text-center">Estoque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {consumoPreview.map(c => (
                        <tr key={c.id} className={c.insufficient ? 'bg-red-50' : ''}>
                          <td className="p-2">{c.material.name} <span className="text-muted-foreground">({c.material.unit})</span></td>
                          <td className="p-2 text-right font-mono">{c.totalQty.toFixed(3)}</td>
                          <td className="p-2 text-right text-muted-foreground">{formatCurrency(Number(c.material.averageCost))}</td>
                          <td className="p-2 text-right font-mono font-bold">{formatCurrency(c.totalCost)}</td>
                          <td className={`p-2 text-center font-mono ${c.insufficient ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                            {Number(c.material.currentStock).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {hasInsufficientStock && (
                    <div className="bg-red-50 text-red-700 text-xs p-2 border-t border-red-200">
                      ⚠️ Alguns insumos estão com estoque insuficiente. A produção pode ser registrada mesmo assim se "Vender sem estoque" estiver habilitado para o material.
                    </div>
                  )}
                </div>
              )}

              {/* Tempos de máquina */}
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Tempo gasto por máquina (opcional)</p>
                  <button type="button" onClick={handleAddMachineTime} className="text-xs text-primary hover:underline">
                    + Adicionar
                  </button>
                </div>
                {machineTimes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sem registros de tempo.</p>
                ) : (
                  <div className="space-y-2">
                    {machineTimes.map((mt, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2">
                        <select
                          className="col-span-2 p-1.5 border rounded text-sm"
                          value={mt.machineId}
                          onChange={e => setMachineTimes(ts => ts.map((t, i) => i === idx ? { ...t, machineId: e.target.value } : t))}
                        >
                          <option value="">Selecione máquina...</option>
                          {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <Input
                          type="number"
                          placeholder="Minutos"
                          value={mt.minutes}
                          onChange={e => setMachineTimes(ts => ts.map((t, i) => i === idx ? { ...t, minutes: e.target.value } : t))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Observação</label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: lote do dia, cor azul/amarelo..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button
                  type="submit"
                  disabled={submitting || !productId}
                  className="gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Factory size={16} />}
                  Confirmar Produção <ArrowRight size={14} />
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
