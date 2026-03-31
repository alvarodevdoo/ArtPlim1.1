import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { 
  PackagePlus, ArrowDownToLine, TrendingDown, AlertCircle, Loader2, RefreshCw, 
  Package, X, Settings2, Plus, Trash2 
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Material {
  id: string;
  name: string;
  unit: string;
  category: string;
  averageCost: number;
  currentStock: number;
  minStockQuantity: number | null;
}

interface Machine {
  id: string;
  name: string;
  type: string;
}

interface StockMovement {
  id: string;
  type: 'ENTRY' | 'INTERNAL_CONSUMPTION' | 'ADJUSTMENT';
  quantity: number;
  unitCost: number;
  totalCost: number;
  machineCounter?: number;
  notes?: string;
  createdAt: string;
  material: { id: string; name: string; unit: string; category: string };
  machine?: { id: string; name: string; type: string };
  supplier?: { id: string; name: string };
}

interface Supplier {
  id: string;
  name: string;
  document?: string;
}

const typeLabels: Record<string, { label: string; color: string }> = {
  ENTRY: { label: 'Entrada', color: 'bg-emerald-100 text-emerald-700' },
  INTERNAL_CONSUMPTION: { label: 'Consumo Interno', color: 'bg-orange-100 text-orange-700' },
  ADJUSTMENT: { label: 'Ajuste', color: 'bg-blue-100 text-blue-700' },
};

function Modal({ open, onClose, title, children, maxWidth = "max-w-md" }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ maxWidth: maxWidth === "max-w-md" ? "28rem" : maxWidth === "max-w-2xl" ? "42rem" : maxWidth }}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const formatNumber = (val: number, unit?: string) => {
  const isIntegerUnit = unit?.toLowerCase() === 'un' || unit?.toLowerCase() === 'unidade';
  const decimals = isIntegerUnit ? 0 : 3;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
};

const formatCurrency = (val: number, decimals: number = 2) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
};

export default function EstoqueConsumo() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'materiais' | 'historico'>('materiais');

  // Modais
  const [showEntrada, setShowEntrada] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showConsumo, setShowConsumo] = useState(false);
  const [showAjuste, setShowAjuste] = useState(false);
  const [showQuickMaterial, setShowQuickMaterial] = useState(false);
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);

  // Formulário de Entrada Individual (Simples)
  const [entForm, setEntForm] = useState({ materialId: '', quantity: '', totalCost: '', documentKey: '', notes: '' });
  const [entLoading, setEntLoading] = useState(false);

  // Formulário de Recebimento em Lote (NF)
  const [receiptForm, setReceiptForm] = useState({
    supplierId: '',
    documentKey: '',
    notes: '',
    items: [{ materialId: '', quantity: '', unitCost: '', totalCost: '' }]
  });
  const [receiptLoading, setReceiptLoading] = useState(false);

  // Formulário de Consumo
  const [conForm, setConForm] = useState({ materialId: '', machineId: '', quantity: '', machineCounter: '', notes: '' });
  const [conLoading, setConLoading] = useState(false);
  const [contaError, setContaError] = useState(false);

  // Formulário de Ajuste
  const [adjForm, setAdjForm] = useState({ materialId: '', quantity: '', averageCost: '', notes: '' });
  const [adjLoading, setAdjLoading] = useState(false);

  // Cadastros Rápidos
  const [quickMat, setQuickMat] = useState({ name: '', unit: 'un', category: 'Produção', format: 'UNIT' });
  const [quickSup, setQuickSup] = useState({ name: '', document: '' });

  const refresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [matRes, movRes, machRes, supRes] = await Promise.all([
          api.get('/api/catalog/materials'),
          api.get('/api/wms/stock-movements?limit=100').catch(() => ({ data: { data: [] } })),
          api.get('/api/catalog/machines').catch(() => ({ data: { data: [] } })),
          api.get('/api/profiles/suppliers/list').catch(() => ({ data: { data: [] } }))
        ]);
        
        setMaterials(matRes.data.data || []);
        setMovements(movRes.data.data || []);
        setMachines(machRes.data.data || []);
        setSuppliers(supRes.data.data || []);
      } catch (err) {
        toast.error('Erro ao carregar dados do estoque.');
      }
      setLoading(false);
    };
    fetchAll();
  }, [refreshKey]);

  // Handlers do Recebimento (Lote)
  const addReceiptItem = () => {
    setReceiptForm(f => ({
      ...f,
      items: [...f.items, { materialId: '', quantity: '', unitCost: '', totalCost: '' }]
    }));
  };

  const removeReceiptItem = (index: number) => {
    if (receiptForm.items.length === 1) return;
    setReceiptForm(f => ({
      ...f,
      items: f.items.filter((_, i) => i !== index)
    }));
  };

  const updateReceiptItem = (index: number, field: string, value: string) => {
    const newItems = [...receiptForm.items];
    const item = { ...newItems[index], [field]: value };
    
    // Cálculo automático de total ou unitário
    if (field === 'quantity' || field === 'unitCost') {
      const q = parseFloat(field === 'quantity' ? value : item.quantity);
      const u = parseFloat(field === 'unitCost' ? value : item.unitCost);
      if (q > 0 && u > 0) item.totalCost = (q * u).toFixed(2);
    } else if (field === 'totalCost') {
      const q = parseFloat(item.quantity);
      const t = parseFloat(value);
      if (q > 0 && t > 0) item.unitCost = (t / q).toFixed(4);
    }
    
    newItems[index] = item;
    setReceiptForm(f => ({ ...f, items: newItems }));
  };

  const handleEntradaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entForm.materialId || !entForm.quantity || !entForm.totalCost) return;
    setEntLoading(true);
    try {
      const qty = parseFloat(entForm.quantity.replace(',', '.'));
      const total = parseFloat(entForm.totalCost.replace(',', '.'));
      await api.post('/api/wms/stock-movements/entry', {
        materialId: entForm.materialId,
        quantity: qty,
        unitCost: total / qty,
        totalCost: total,
        documentKey: entForm.documentKey,
        notes: entForm.notes,
      });
      toast.success('Entrada individual registrada!');
      setShowEntrada(false);
      setEntForm({ materialId: '', quantity: '', totalCost: '', documentKey: '', notes: '' });
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Erro ao registrar entrada.');
    } finally {
      setEntLoading(false);
    }
  };

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptForm.supplierId || receiptForm.items.some(i => !i.materialId || !i.quantity || !i.totalCost)) {
      toast.error('Preencha o fornecedor e todos os itens da nota.');
      return;
    }

    setReceiptLoading(true);
    try {
      await api.post('/api/wms/stock-movements/receipt', {
        supplierId: receiptForm.supplierId,
        notes: receiptForm.notes,
        documentKey: receiptForm.documentKey,
        items: receiptForm.items.map(i => ({
          materialId: i.materialId,
          quantity: parseFloat(i.quantity.replace(',', '.')),
          unitCost: parseFloat(i.unitCost.replace(',', '.')),
          totalCost: parseFloat(i.totalCost.replace(',', '.')),
        }))
      });
      toast.success('Recebimento registrado com sucesso!');
      setShowReceipt(false);
      setReceiptForm({ supplierId: '', documentKey: '', notes: '', items: [{ materialId: '', quantity: '', unitCost: '', totalCost: '' }] });
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Erro ao registrar recebimento.');
    } finally {
      setReceiptLoading(false);
    }
  };

  // Handlers de Cadastro Rápido
  const handleQuickMaterial = async () => {
    if (!quickMat.name) return;
    try {
      const res = await api.post('/api/catalog/materials', {
        ...quickMat,
        costPerUnit: 0,
        active: true
      });
      setMaterials(m => [...m, res.data.data]);
      setShowQuickMaterial(false);
      setQuickMat({ name: '', unit: 'un', category: 'Produção', format: 'UNIT' });
      toast.success('Insumo cadastrado!');
    } catch (err) {
      toast.error('Erro ao cadastrar insumo.');
    }
  };

  const handleQuickSupplier = async () => {
    if (!quickSup.name) return;
    try {
      const res = await api.post('/api/profiles', {
        type: 'COMPANY',
        name: quickSup.name,
        document: quickSup.document,
        isSupplier: true
      });
      setSuppliers(s => [...s, res.data.data]);
      setShowQuickSupplier(false);
      setQuickSup({ name: '', document: '' });
      toast.success('Fornecedor cadastrado!');
    } catch (err) {
      toast.error('Erro ao cadastrar fornecedor.');
    }
  };

  // Restante dos Handlers Originais
  const handleConsumoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conForm.materialId || !conForm.machineId || !conForm.quantity) return;
    setConLoading(true);
    setContaError(false);
    try {
      await api.post('/api/wms/stock-movements/consumption', {
        materialId: conForm.materialId,
        machineId: conForm.machineId,
        quantity: parseFloat(conForm.quantity.replace(',', '.')),
        notes: conForm.notes,
        ...(conForm.machineCounter ? { machineCounter: parseInt(conForm.machineCounter) } : {})
      });
      toast.success('Baixa registrada!');
      setShowConsumo(false);
      setConForm({ materialId: '', machineId: '', quantity: '', machineCounter: '', notes: '' });
      refresh();
    } catch (err: any) {
      if (err?.response?.data?.error?.message?.includes('4.1.1.04')) setContaError(true);
      else toast.error('Erro ao registrar baixa.');
    } finally {
      setConLoading(false);
    }
  };

  const handleAjusteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjForm.materialId || adjForm.quantity === '' || adjForm.averageCost === '') return;
    setAdjLoading(true);
    try {
      await api.post('/api/wms/stock-movements/adjustment', {
        materialId: adjForm.materialId,
        quantity: parseFloat(adjForm.quantity.replace(',', '.')),
        averageCost: parseFloat(adjForm.averageCost.replace(',', '.')),
        notes: adjForm.notes,
      });
      toast.success('Inventário ajustado.');
      setShowAjuste(false);
      refresh();
    } catch (err) {
      toast.error('Erro ao ajustar estoque.');
    } finally {
      setAdjLoading(false);
    }
  };

  const totalEntradas = movements.filter(m => m.type === 'ENTRY').reduce((s, m) => s + Number(m.totalCost), 0);
  const totalConsumos = movements.filter(m => m.type === 'INTERNAL_CONSUMPTION').reduce((s, m) => s + Number(m.totalCost), 0);
  const lowStockMaterials = materials.filter(m => m.minStockQuantity !== null && Number(m.currentStock) < Number(m.minStockQuantity));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque & Custos</h1>
          <p className="text-sm text-muted-foreground italic">Controle multilinear de notas fiscais e custos médios</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={refresh} className="p-2 rounded-md hover:bg-muted transition-colors mr-2" title="Atualizar">
            <RefreshCw size={16} />
          </button>
          <Button variant="outline" onClick={() => { setContaError(false); setShowConsumo(true); }} className="gap-2">
            <TrendingDown size={16} /> Consumo Interno
          </Button>
          <Button onClick={() => setShowReceipt(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <PackagePlus size={16} /> Entrada NF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-50/30 border-emerald-100">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600"><Package size={20} /></div>
            <div>
              <p className="text-xs font-medium text-emerald-600 uppercase">Itens em Gestão</p>
              <p className="text-2xl font-bold">{materials.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/30 border-blue-100">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl text-blue-600"><ArrowDownToLine size={20} /></div>
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase">Total Entradas</p>
              <p className="text-2xl font-bold">{formatCurrency(totalEntradas)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50/30 border-orange-100">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-xl text-orange-600"><TrendingDown size={20} /></div>
            <div>
              <p className="text-xs font-medium text-orange-600 uppercase">Consumo Período</p>
              <p className="text-2xl font-bold">{formatCurrency(totalConsumos)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={lowStockMaterials.length > 0 ? 'border-red-200 bg-red-50/30' : ''}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${lowStockMaterials.length > 0 ? 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground'}`}>
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Alertas</p>
              <p className={`text-2xl font-bold ${lowStockMaterials.length > 0 ? 'text-red-600' : ''}`}>{lowStockMaterials.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout */}
      <div className="space-y-4">
        <div className="flex gap-4 border-b">
          <button onClick={() => setActiveTab('materiais')} className={`pb-2 text-sm font-semibold transition-all ${activeTab === 'materiais' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>POSIÇÃO DE ESTOQUE</button>
          <button onClick={() => setActiveTab('historico')} className={`pb-2 text-sm font-semibold transition-all ${activeTab === 'historico' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>HISTÓRICO AUDITÁVEL</button>
        </div>

        {activeTab === 'materiais' && (
          <Card className="overflow-hidden border-none shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="p-4 text-left font-semibold">Material</th>
                    <th className="p-4 text-left font-semibold">Categoria</th>
                    <th className="p-4 text-right font-semibold">Saldo Atual</th>
                    <th className="p-4 text-right font-semibold">Mínimo</th>
                    <th className="p-4 text-right font-semibold">Custo Médio</th>
                    <th className="p-4 text-right font-semibold">Total</th>
                    <th className="p-4 text-center font-semibold text-xs">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {materials.map(m => {
                    const stock = Number(m.currentStock);
                    const avg = Number(m.averageCost);
                    const isLow = m.minStockQuantity !== null && stock < Number(m.minStockQuantity);
                    return (
                      <tr key={m.id} className={`hover:bg-muted/30 transition-colors ${isLow ? 'bg-red-50/40' : ''}`}>
                        <td className="p-4">
                          <p className="font-semibold text-foreground">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{m.unit}</p>
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">{m.category}</td>
                        <td className={`p-4 text-right font-mono font-bold ${isLow ? 'text-red-600' : 'text-emerald-600'}`}>{formatNumber(stock, m.unit)}</td>
                        <td className="p-4 text-right text-muted-foreground font-mono">{m.minStockQuantity || '—'}</td>
                        <td className="p-4 text-right font-mono text-xs">{formatCurrency(avg, 4)}</td>
                        <td className="p-4 text-right font-mono font-bold">{formatCurrency(stock * avg)}</td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-1">
                            <button 
                              onClick={() => { 
                                setEntForm({
                                  materialId: m.id,
                                  quantity: '',
                                  totalCost: '',
                                  documentKey: '',
                                  notes: ''
                                });
                                setShowEntrada(true); 
                              }}
                              className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded-md transition-colors"
                              title="Registrar Entrada Direta"
                            >
                              <Plus size={16} />
                            </button>
                            <button 
                              onClick={() => { 
                                setAdjForm({ 
                                  materialId: m.id, 
                                  quantity: stock.toString(), 
                                  averageCost: avg.toString(), 
                                  notes: 'Ajuste rápido' 
                                }); 
                                setShowAjuste(true); 
                              }}
                              className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-md transition-colors"
                              title="Ajuste de Saldo"
                            >
                              <Settings2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'historico' && (
          <Card className="overflow-hidden border-none shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="p-4 text-left font-semibold">Data</th>
                    <th className="p-4 text-left font-semibold">Material</th>
                    <th className="p-4 text-center font-semibold text-xs">Tipo</th>
                    <th className="p-4 text-right font-semibold">Quantidade</th>
                    <th className="p-4 text-right font-semibold">Custo Uni.</th>
                    <th className="p-4 text-right font-semibold">Total</th>
                    <th className="p-4 text-left font-semibold">Origem/Destino</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map(mv => {
                    const info = typeLabels[mv.type] ?? { label: mv.type, color: 'bg-gray-100 text-gray-700' };
                    return (
                      <tr key={mv.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-muted-foreground text-[10px] whitespace-nowrap">
                          {new Date(mv.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4">
                          <p className="font-medium text-foreground">{mv.material.name}</p>
                          {mv.notes && <p className="text-[10px] text-primary italic">📝 {mv.notes}</p>}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${info.color}`}>{info.label}</span>
                        </td>
                        <td className="p-4 text-right font-mono">{formatNumber(mv.quantity, mv.material.unit)}</td>
                        <td className="p-4 text-right text-muted-foreground font-mono text-xs">{formatCurrency(mv.unitCost, 4)}</td>
                        <td className="p-4 text-right font-bold font-mono text-primary">{formatCurrency(mv.totalCost)}</td>
                        <td className="p-4 text-muted-foreground text-xs italic">
                          {mv.supplier ? `Fornec: ${mv.supplier.name}` : mv.machine ? `Máq: ${mv.machine.name}` : 'Ajuste Manual'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* MODAIS AVANÇADOS */}

      {/* Modal: Entrada Individual Simples */}
      <Modal open={showEntrada} onClose={() => setShowEntrada(false)} title="📦 Entrada Individual de Material">
        {(() => {
          const mat = materials.find(m => m.id === entForm.materialId);
          const isInteger = mat?.unit.toLowerCase() === 'un' || mat?.unit.toLowerCase() === 'unidade';
          
          return (
            <form onSubmit={handleEntradaSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1 uppercase">Material Selecionado</label>
                <div className="flex justify-between items-baseline">
                  <p className="font-bold text-lg">{mat?.name}</p>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{mat?.unit}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Quantidade Comprada ({mat?.unit})</label>
                  <Input 
                    type="number" 
                    step={isInteger ? "1" : "0.001"} 
                    value={entForm.quantity} 
                    onChange={e => setEntForm(f => ({ ...f, quantity: e.target.value }))} 
                    placeholder={isInteger ? "Ex: 10" : "Ex: 10.500"} 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Custo Total (R$)</label>
                  <Input type="number" step="0.01" value={entForm.totalCost} onChange={e => setEntForm(f => ({ ...f, totalCost: e.target.value }))} placeholder="Ex: 250.00" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Chave da Nota / Cupom</label>
                <Input value={entForm.documentKey} onChange={e => setEntForm(f => ({ ...f, documentKey: e.target.value }))} placeholder="Chave de Acesso (44 dígitos)" />
              </div>
              <div>
                <label className="text-sm font-medium">Observação</label>
                <Input value={entForm.notes} onChange={e => setEntForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ex: NF Avulsa" />
              </div>
              <Button type="submit" disabled={entLoading} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {entLoading ? <Loader2 className="animate-spin" /> : 'Confirmar Entrada'}
              </Button>
            </form>
          );
        })()}
      </Modal>

      {/* Modal: Recebimento NF (Multilinear) */}
      <Modal open={showReceipt} onClose={() => setShowReceipt(false)} title="📦 Recebimento de Mercadoria (Nota Fiscal)" maxWidth="max-w-4xl">
        <form onSubmit={handleReceiptSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold">Fornecedor *</label>
                <button type="button" onClick={() => setShowQuickSupplier(true)} className="text-[10px] text-primary flex items-center gap-0.5 hover:underline"><Plus size={10} /> Novo</button>
              </div>
              <select className="w-full p-2 border rounded-md bg-background text-sm" value={receiptForm.supplierId} onChange={e => setReceiptForm(f => ({ ...f, supplierId: e.target.value }))}>
                <option value="">Selecione o fornecedor...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} {s.document ? `(${s.document})` : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold">Chave da Nota / Cupom</label>
              <Input placeholder="Chave de Acesso da NFe" value={receiptForm.documentKey} onChange={e => setReceiptForm(f => ({ ...f, documentKey: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold">Observação Geral</label>
              <Input placeholder="Nº NF, etc" value={receiptForm.notes} onChange={e => setReceiptForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left">Material / Insumo</th>
                  <th className="p-3 text-right w-24">Quant.</th>
                  <th className="p-3 text-right w-32">Custo Unit.</th>
                  <th className="p-3 text-right w-32">Custo Total</th>
                  <th className="p-3 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {receiptForm.items.map((item, idx) => (
                  <tr key={idx} className="bg-card">
                    <td className="p-2">
                       <div className="flex flex-col gap-1">
                          <select 
                            className="w-full p-1.5 border rounded-md text-sm"
                            value={item.materialId}
                            onChange={e => updateReceiptItem(idx, 'materialId', e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                          </select>
                          <button type="button" onClick={() => setShowQuickMaterial(true)} className="text-[9px] text-muted-foreground text-left ml-1 hover:text-primary transition-colors flex items-center gap-0.5"><Plus size={10} /> Não encontrou? Cadastre agora</button>
                       </div>
                    </td>
                    <td className="p-2">
                      <Input type="number" step="0.001" className="text-right h-8" value={item.quantity} onChange={e => updateReceiptItem(idx, 'quantity', e.target.value)} placeholder="0.00" />
                    </td>
                    <td className="p-2">
                      <Input type="number" step="0.0001" className="text-right h-8" value={item.unitCost} onChange={e => updateReceiptItem(idx, 'unitCost', e.target.value)} placeholder="0.0000" />
                    </td>
                    <td className="p-2 font-mono text-emerald-700 font-bold text-right p-3">
                      <Input type="number" step="0.01" className="text-right h-8 font-bold text-emerald-800" value={item.totalCost} onChange={e => updateReceiptItem(idx, 'totalCost', e.target.value)} placeholder="0.00" />
                    </td>
                    <td className="p-2 text-center">
                      <button type="button" onClick={() => removeReceiptItem(idx)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={addReceiptItem} className="w-full p-2 bg-muted/50 text-muted-foreground hover:bg-muted text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5 border-t">
              <Plus size={12} /> Adicionar Item da Nota
            </button>
          </div>

          <div className="flex gap-4">
             <div className="flex-1 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">Total da Nota</p>
                <p className="text-2xl font-bold text-emerald-800">
                  {formatCurrency(receiptForm.items.reduce((acc, i) => acc + (parseFloat(i.totalCost) || 0), 0))}
                </p>
             </div>
             <Button type="submit" disabled={receiptLoading} className="h-auto px-8 bg-emerald-600 hover:bg-emerald-700 text-lg font-bold">
               {receiptLoading ? <Loader2 className="animate-spin" /> : 'Confirmar Recebimento'}
             </Button>
          </div>
        </form>
      </Modal>

     <Modal open={showQuickMaterial} onClose={() => setShowQuickMaterial(false)} title="➕ Cadastro Rápido de Material">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Nome do Material</label>
            <Input value={quickMat.name} onChange={e => setQuickMat(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Tinta Cyan 1L" />
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div>
               <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Unidade</label>
               <Input value={quickMat.unit} onChange={e => setQuickMat(f => ({ ...f, unit: e.target.value }))} placeholder="Ex: un, L, m2" />
             </div>
             <div>
               <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Categoria</label>
               <Input value={quickMat.category} onChange={e => setQuickMat(f => ({ ...f, category: e.target.value }))} placeholder="Ex: Tintas" />
             </div>
          </div>
          <Button onClick={handleQuickMaterial} className="w-full">Salvar e Usar</Button>
        </div>
      </Modal>

      {/* Cadastro Rápido: Fornecedor */}
      <Modal open={showQuickSupplier} onClose={() => setShowQuickSupplier(false)} title="🏪 Cadastro Rápido de Fornecedor">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Nome / Razão Social</label>
            <Input value={quickSup.name} onChange={e => setQuickSup(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">CNPJ / CPF</label>
            <Input value={quickSup.document} onChange={e => setQuickSup(f => ({ ...f, document: e.target.value }))} />
          </div>
          <Button onClick={handleQuickSupplier} className="w-full">Cadastrar Fornecedor</Button>
        </div>
      </Modal>

      {/* Modais Antigos Refatorados (Consumo e Ajuste) */}
      <Modal open={showAjuste} onClose={() => setShowAjuste(false)} title="⚙️ Ajuste de Saldo Individual" maxWidth="max-w-md">
        <form onSubmit={handleAjusteSubmit} className="space-y-4">
           <div>
              <label className="text-xs text-muted-foreground block mb-1 uppercase">Material Alvo</label>
              <p className="font-bold text-lg">{materials.find(m => m.id === adjForm.materialId)?.name || 'Nenhum selecionado'}</p>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Quantidade Real</label>
                <Input value={adjForm.quantity} onChange={e => setAdjForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Custo Atual (R$)</label>
                <Input value={adjForm.averageCost} onChange={e => setAdjForm(f => ({ ...f, averageCost: e.target.value }))} />
              </div>
           </div>
           <div>
              <label className="text-sm font-medium">Motivo</label>
              <Input value={adjForm.notes} onChange={e => setAdjForm(f => ({ ...f, notes: e.target.value }))} placeholder="Inventário rotativo, erro NF anterior..." />
           </div>
           <Button type="submit" disabled={adjLoading} className="w-full bg-blue-600 hover:bg-blue-700">
             {adjLoading ? <Loader2 className="animate-spin" /> : 'Confirmar Ajuste'}
           </Button>
        </form>
      </Modal>

      <Modal open={showConsumo} onClose={() => { setShowConsumo(false); setContaError(false); }} title="⬇️ Baixa de Consumo Interno">
         {contaError ? (
           <div className="bg-red-50 border-red-200 border p-4 rounded-xl text-center space-y-3">
              <p className="text-red-700 font-bold">Erro Contábil</p>
              <p className="text-xs text-red-600">A conta 4.1.1.04 não está ativa. Configure o plano de contas.</p>
           </div>
         ) : (
           <form onSubmit={handleConsumoSubmit} className="space-y-4">
             <div className="space-y-1">
                <label className="text-sm font-medium">Material</label>
                <select className="w-full p-2 border rounded-md text-sm" value={conForm.materialId} onChange={e => setConForm(f => ({ ...f, materialId: e.target.value }))}>
                   <option value="">Selecione...</option>
                   {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({formatNumber(m.currentStock, m.unit)})</option>)}
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-sm font-medium">Máquina</label>
                <select className="w-full p-2 border rounded-md text-sm" value={conForm.machineId} onChange={e => setConForm(f => ({ ...f, machineId: e.target.value }))}>
                   <option value="">Selecione...</option>
                   {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
             </div>
             <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Quantidade</label>
                  <Input value={conForm.quantity} onChange={e => setConForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Contador (opcional)</label>
                  <Input value={conForm.machineCounter} onChange={e => setConForm(f => ({ ...f, machineCounter: e.target.value }))} />
                </div>
             </div>
             <div>
                <label className="text-sm font-medium">Observação</label>
                <Input value={conForm.notes} onChange={e => setConForm(f => ({ ...f, notes: e.target.value }))} />
             </div>
             <Button type="submit" disabled={conLoading} className="w-full bg-orange-600 hover:bg-orange-700">{conLoading ? <Loader2 className="animate-spin" /> : 'Registrar Consumo'}</Button>
           </form>
         )}
      </Modal>
    </div>
  );
}
