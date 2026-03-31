import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plus, Search, Layers, Info, X, ChevronDown,
  ArrowUpCircle, ArrowDownCircle, History, Settings2,
  Package, AlertTriangle, CheckCircle2, Factory,
  FileKey, ClipboardEdit, Trash2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Combobox } from '@/components/ui/Combobox';
import { ProductiveIntelligence, type ProductiveIntelligenceData, type ControlUnit, type ConsumptionRule } from '@/components/catalog/ProductiveIntelligence/ProductiveIntelligence';

// --- Interfaces ---
interface Material {
  id: string;
  name: string;
  category: string;
  description?: string;
  format: 'ROLL' | 'SHEET' | 'UNIT';
  costPerUnit: number;
  averageCost?: number;
  unit: string;
  controlUnit?: ControlUnit;
  conversionFactor?: number;
  width?: number;
  height?: number;
  // Legacy (mantidos por compatibilidade com dados antigos)
  standardWidth?: number;
  standardLength?: number;
  active: boolean;
  defaultConsumptionRule?: ConsumptionRule;
  defaultConsumptionFactor?: number;
  inventoryAccountId?: string;
  expenseAccountId?: string;
  minStockQuantity?: number | null;
  sellWithoutStock?: boolean;
  trackStock: boolean;
  spedType?: string;
  currentStock?: number;
  _count?: {
    components: number;
    inventoryItems: number;
  };
  suppliers?: {
    supplierId: string;
    costPrice: number | string;
    supplierCode?: string;
    paymentTerms?: string;
    preferredPaymentDay?: number | string;
  }[];
}

const Insumos: React.FC = () => {
  // --- States ---
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Sidebar State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'cadastro' | 'movimentar' | 'historico'>('cadastro');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  // Form States
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [requireNF, setRequireNF] = useState(false);

  // Form Data (Cadastro)
  const [formData, setFormData] = useState({
    name: '',
    category: 'Outros',
    description: '',
    format: 'SHEET' as Material['format'],
    costPerUnit: '',
    unit: 'm²',
    inventoryAccountId: '',
    expenseAccountId: '',
    minStockQuantity: '',
    sellWithoutStock: true,
    trackStock: true,
    spedType: '',
    suppliers: [] as {
      supplierId: string;
      costPrice: string | number;
      supplierCode: string;
      paymentTerms?: string;
      preferredPaymentDay?: string | number;
    }[]
  });

  // Estado exclusivo da Inteligência Produtiva
  const [productiveData, setProductiveData] = useState<ProductiveIntelligenceData>({
    controlUnit: 'M2',
    defaultConsumptionRule: 'PRODUCT_AREA',
    conversionFactor: 1,
    width: 0,
    height: 0,
  });

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isPopoverFmtOpen, setIsPopoverFmtOpen] = useState(false);

  // Categorias únicas extraídas dos materiais
  const existingCategories = useMemo(() => {
    const cats = materiais.map(m => m.category).filter(Boolean);
    return Array.from(new Set(cats)).sort();
  }, [materiais]);

  // Movimentação State
  const [movType, setMovType] = useState<'ENTRADA' | 'CONSUMO'>('ENTRADA');
  const [movData, setMovData] = useState({
    quantity: '',
    unitCost: '',
    documentKey: '',
    description: '',
    machineId: '',
  });

  // --- Effects ---
  useEffect(() => {
    loadData();
    loadConfig();
  }, []);

  // Inteligência Sugerida: SPED baseado na Conta
  useEffect(() => {
    if (formData.inventoryAccountId && !selectedMaterial) {
      const acc = chartOfAccounts.find(a => a.id === formData.inventoryAccountId);
      if (acc && acc.code.startsWith('1')) {
        setFormData(p => ({ ...p, spedType: '01' }));
      }
    }
  }, [formData.inventoryAccountId, chartOfAccounts]);

  useEffect(() => {
    if (formData.expenseAccountId && !selectedMaterial) {
      const acc = chartOfAccounts.find(a => a.id === formData.expenseAccountId);
      if (acc && (acc.code.startsWith('3') || acc.code.startsWith('4'))) {
        setFormData(p => ({ ...p, spedType: '07' }));
      }
    }
  }, [formData.expenseAccountId, chartOfAccounts]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [matsRes, accsRes, supsRes, machRes] = await Promise.all([
        api.get('/api/catalog/materials'),
        api.get('/api/finance/chart-of-accounts'),
        api.get('/api/profiles/suppliers/list'),
        api.get('/api/catalog/machines').catch(() => ({ data: { data: [] } }))
      ]);

      setMateriais(matsRes.data.data || []);
      setChartOfAccounts(accsRes.data.data || []);
      setFornecedores(supsRes.data.data || []);
      setMachines(machRes.data.data || []);
    } catch (error) {
      toast.error('Erro ao carregar dados do módulo.');
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const resp = await api.get('/api/organization/settings');
      setRequireNF(resp.data.data.requireDocumentKeyForEntry || false);
    } catch (e) {
      console.warn('Não foi possível carregar config fiscal.');
    }
  };

  const loadHistory = async (materialId: string) => {
    try {
      const resp = await api.get(`/api/wms/stock-movements?materialId=${materialId}&limit=50`);
      setMovements(resp.data.data || []);
    } catch (e) {
      console.error('Erro ao histórico');
    }
  };

  // --- Actions ---
  const handleOpenDrawer = async (material: Material | null) => {
    if (material) {
      setIsDrawerOpen(true);
      setActiveTab('cadastro');
      try {
        // Busca dados COMPLETOS do material (a listagem pode omitir campos)
        const resp = await api.get(`/api/catalog/materials/${material.id}`);
        const full = resp.data.data;

        // ====== [LOG 5] DADOS COMPLETOS DO MATERIAL ======
        console.log('[DRAWER] material completo:', JSON.stringify({
          id: full.id, costPerUnit: full.costPerUnit, trackStock: full.trackStock,
          spedType: full.spedType, inventoryAccountId: full.inventoryAccountId,
          expenseAccountId: full.expenseAccountId,
        }, null, 2));

        setSelectedMaterial(full);
        setFormData({
          name: full.name,
          category: full.category || 'Outros',
          description: full.description || '',
          format: full.format,
          costPerUnit: (parseFloat(full.costPerUnit) || 0).toString(),
          unit: full.unit,
          inventoryAccountId: full.inventoryAccountId || '',
          expenseAccountId: full.expenseAccountId || '',
          minStockQuantity: full.minStockQuantity?.toString() || '',
          sellWithoutStock: full.sellWithoutStock ?? true,
          trackStock: full.trackStock ?? true,
          spedType: full.spedType || '',
          suppliers: (full.suppliers || []).map((s: any) => ({
            supplierId: s.supplierId,
            costPrice: s.costPrice.toString(),
            supplierCode: s.supplierCode || '',
            paymentTerms: s.paymentTerms || '',
            preferredPaymentDay: s.preferredPaymentDay?.toString() || ''
          }))
        });
        // Sincronizar estado da Inteligência Produtiva
        setProductiveData({
          controlUnit: full.controlUnit || 'M2',
          defaultConsumptionRule: full.defaultConsumptionRule || 'PRODUCT_AREA',
          conversionFactor: full.conversionFactor ?? full.defaultConsumptionFactor ?? 1,
          width: full.width ?? full.standardWidth ?? 0,
          height: full.height ?? full.standardLength ?? 0,
        });
        setMovData(prev => ({
          ...prev,
          unitCost: (full.averageCost || full.costPerUnit || 0).toString().replace('.', ','),
          quantity: ''
        }));
        loadHistory(full.id);
      } catch (err) {
        toast.error('Erro ao carregar detalhes do material.');
      }
    } else {
      setSelectedMaterial(null);
      resetForm();
      setActiveTab('cadastro');
      setIsDrawerOpen(true);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Outros',
      description: '',
      format: 'SHEET',
      costPerUnit: '',
      unit: 'm²',
      inventoryAccountId: '',
      expenseAccountId: '',
      minStockQuantity: '',
      sellWithoutStock: true,
      trackStock: true,
      spedType: '01',
      suppliers: []
    });
    setProductiveData({
      controlUnit: 'M2',
      defaultConsumptionRule: 'PRODUCT_AREA',
      conversionFactor: 1,
      width: 0,
      height: 0,
    });
    setMovData({
      quantity: '',
      unitCost: '',
      documentKey: '',
      description: '',
      machineId: '',
    });
  };

  const handleSubmitCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      costPerUnit: parseFloat(formData.costPerUnit) || 0,
      // Campos da Inteligência Produtiva (novos campos do schema)
      controlUnit: productiveData.controlUnit,
      defaultConsumptionRule: productiveData.defaultConsumptionRule,
      conversionFactor: productiveData.conversionFactor,
      width: productiveData.width || undefined,
      height: productiveData.height || undefined,
      // Compat. legado: manter standardWidth/standardLength para o backend
      standardWidth: productiveData.width || undefined,
      standardLength: productiveData.height || undefined,
      defaultConsumptionFactor: productiveData.conversionFactor,
      minStockQuantity: formData.minStockQuantity ? parseFloat(formData.minStockQuantity) : null,
      suppliers: formData.suppliers
        .filter(s => s.supplierId)
        .map(s => ({
          supplierId: s.supplierId,
          costPrice: parseFloat(s.costPrice as string) || 0,
          supplierCode: s.supplierCode || undefined,
          paymentTerms: s.paymentTerms || undefined,
          preferredPaymentDay: s.preferredPaymentDay ? parseInt(s.preferredPaymentDay as string) : undefined
        }))
    };

    // ====== [LOG 0] PAYLOAD FRONTEND ======
    console.log('[INSUMOS] PAYLOAD ENVIADO:', JSON.stringify(payload, null, 2));
    console.log('[INSUMOS] trackStock:', payload.trackStock, '| spedType:', payload.spedType, '| costPerUnit:', payload.costPerUnit);

    try {
      if (selectedMaterial) {
        const resp = await api.put(`/api/catalog/materials/${selectedMaterial.id}`, payload);
        console.log('[INSUMOS] RESPOSTA DO SERVIDOR:', JSON.stringify(resp.data?.data ? { id: resp.data.data.id, trackStock: resp.data.data.trackStock, spedType: resp.data.data.spedType, costPerUnit: resp.data.data.costPerUnit } : resp.data, null, 2));
        toast.success('Material atualizado com sucesso!');
      } else {
        const resp = await api.post('/api/catalog/materials', payload);
        console.log('[INSUMOS] CRIADO:', JSON.stringify(resp.data?.data?.id, null, 2));
        toast.success('Novo material cadastrado!');
      }
      loadData();
      setIsDrawerOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Erro ao salvar material');
    }
  };

  const handleMovimentar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;

    if (movType === 'ENTRADA') {
      if (requireNF && !movData.documentKey) {
        return toast.warning('A chave da nota/cupom é obrigatória para entradas conforme as configurações do sistema.');
      }
      try {
        await api.post('/api/wms/stock-movements/entry', {
          materialId: selectedMaterial.id,
          quantity: parseFloat(movData.quantity.toString().replace(',', '.')) || 0,
          unitCost: parseFloat(movData.unitCost.toString().replace(',', '.')) || selectedMaterial.costPerUnit,
          documentKey: movData.documentKey,
          description: movData.description
        });
        toast.success('Entrada de estoque registrada!');
        loadData();
        loadHistory(selectedMaterial.id);
        setMovData(prev => ({ ...prev, quantity: '', documentKey: '', unitCost: '' }));
      } catch (err: any) {
        toast.error('Erro ao registrar entrada.');
      }
    } else {
      try {
        await api.post('/api/wms/stock-movements/consumption', {
          materialId: selectedMaterial.id,
          quantity: parseFloat(movData.quantity.toString().replace(',', '.')) || 0,
          machineId: movData.machineId,
          description: movData.description
        });
        toast.success('Baixa por consumo registrada!');
        loadData();
        loadHistory(selectedMaterial.id);
        setMovData(prev => ({ ...prev, quantity: '', machineId: '' }));
      } catch (err: any) {
        toast.error('Erro ao registrar consumo.');
      }
    }
  };

  const getStockStatus = (material: Material) => {
    if (material.trackStock === false) {
      return { label: 'Sob Demanda', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Info };
    }
    const stock = material.currentStock || 0;
    const min = material.minStockQuantity || 0;
    if (stock <= 0) return { label: 'Zerado', color: 'bg-red-50 text-red-600 border-red-100', icon: AlertTriangle };
    if (min > 0 && stock < min) return { label: 'Baixo', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: AlertTriangle };
    return { label: 'Ok', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 };
  };

  const filtered = materiais.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCategory === 'ALL' || m.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  const categories = ['ALL', ...new Set(materiais.map(m => m.category || 'Outros'))];

  // --- Render ---
  return (
    <div className="h-full flex flex-col space-y-4 relative overflow-hidden">
      {/* Header Centralizado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestão de Insumos</h1>
          <p className="text-muted-foreground">Controle técnico, movimentações e fluxo de estoque integrado.</p>
        </div>
        <Button onClick={() => handleOpenDrawer(null)} className="h-12 px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
          <Plus className="w-5 h-5 mr-2" /> Novo Insumo
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por nome ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 border-border/40 focus:ring-primary/20"
          />
        </div>
        {/* Filtro de Categorias Responsivo (Alterna em 1140px) */}
        <div className="flex-shrink-0">
          <div className="min-[1140px]:hidden w-[210px]">
             <Combobox
                value={filterCategory}
                onChange={setFilterCategory}
                options={categories.map(cat => ({
                  id: cat,
                  label: cat === 'ALL' ? 'Todos os Materiais' : cat
                }))}
                placeholder="Filtrar categoria..."
             />
          </div>
          
          <div className="hidden min-[1140px]:flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-4 h-11 rounded-lg text-sm font-medium transition-all whitespace-nowrap border ${filterCategory === cat
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                  }`}
              >
                {cat === 'ALL' ? 'Todos' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="flex-1 bg-card rounded-xl border border-border/50 shadow-inner overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10 border-b border-border/50">
              <tr className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Insumo</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Estoque Atual</th>
                <th className="px-6 py-4">Custo Médio</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map(material => {
                const status = getStockStatus(material);
                return (
                  <tr
                    key={material.id}
                    className="group hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleOpenDrawer(material)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg group-hover:bg-primary/10 transition-colors">
                          <Package className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{material.name}</div>
                          <div className="text-xs text-muted-foreground">{material.unit} • {material.format}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium px-2.5 py-1 bg-muted rounded-md text-muted-foreground">
                        {material.category || 'Outros'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-center">
                      {material.trackStock !== false ? (
                        <div className="flex items-baseline gap-1 justify-start">
                          <span className="text-lg font-bold">{material.currentStock || 0}</span>
                          <span className="text-xs text-muted-foreground">{material.unit}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                      {formatCurrency(
                        (parseFloat(material.averageCost as any) > 0
                          ? parseFloat(material.averageCost as any)
                          : parseFloat(material.costPerUnit as any)) || 0
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                        <status.icon className="w-3.5 h-3.5" />
                        {status.label}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" className="group-hover:bg-primary/20 group-hover:text-primary">
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && (
            <div className="py-20 text-center flex flex-col items-center justify-center space-y-4">
              <Layers className="w-16 h-16 text-muted-foreground/30" />
              <div className="text-muted-foreground font-medium">Nenhum insumo encontrado.</div>
              <Button variant="outline" onClick={resetForm}>Limparfiltros</Button>
            </div>
          )}
        </div>
      </div>

      {/* SLIDE-OVER DRAWER (PAINEL LATERAL) */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />

        <div
          className={`absolute inset-y-0 right-0 w-full max-w-xl bg-background shadow-2xl transition-transform duration-300 transform flex flex-col ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
          {/* Drawer Header */}
          <div className="p-6 border-b flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {selectedMaterial ? selectedMaterial.name : 'Novo Insumo'}
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {selectedMaterial ? (
                    <>
                      <span className="font-bold text-primary">{selectedMaterial.currentStock || 0} {selectedMaterial.unit}</span> em estoque
                    </>
                  ) : (
                    'Criação de novo item no catálogo'
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsDrawerOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Drawer Tabs Trigger */}
          <div className="flex border-b bg-card">
            <button
              onClick={() => setActiveTab('cadastro')}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 ${activeTab === 'cadastro'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:bg-muted/50'
                }`}
            >
              <ClipboardEdit className="w-4 h-4" /> Cadastro
            </button>
            <button
              onClick={() => setActiveTab('movimentar')}
              disabled={!selectedMaterial}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 disabled:opacity-30 ${activeTab === 'movimentar'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:bg-muted/50'
                }`}
            >
              <ArrowUpCircle className="w-4 h-4" /> Movimentar
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              disabled={!selectedMaterial}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 disabled:opacity-30 ${activeTab === 'historico'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:bg-muted/50'
                }`}
            >
              <History className="w-4 h-4" /> Histórico
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-muted-foreground/20">

            {/* TAB: CADASTRO */}
            {activeTab === 'cadastro' && (
              <form onSubmit={handleSubmitCadastro} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Nome do Insumo</label>
                    <Input
                      value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      required
                      className="h-11 border-border/60"
                      placeholder="Ex: Lona Frontlight 440g"
                    />
                  </div>

                  {/* CATEGORIA - Usando o novo Combobox Padronizado */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Categoria</label>
                    <Combobox
                      value={formData.category}
                      onChange={(val) => setFormData(p => ({ ...p, category: val }))}
                      options={existingCategories.map(cat => ({ id: cat, label: cat }))}
                      placeholder="Selecione ou digite a categoria..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Formato</label>
                    <Popover open={isPopoverFmtOpen} onOpenChange={setIsPopoverFmtOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          type="button"
                          className="w-full justify-between h-11 text-sm bg-background border-border/60 hover:bg-muted/30"
                        >
                          <span className="font-medium">
                            {formData.format === 'ROLL' ? 'Linear' :
                              formData.format === 'SHEET' ? 'Área' :
                                'Unidade'}
                          </span>
                          <ChevronDown className="w-4 h-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[240px]" align="start">
                        <div className="p-1">
                          {[
                            { label: 'Linear', value: 'ROLL', unit: 'm' },
                            { label: 'Área', value: 'SHEET', unit: 'm²' },
                            { label: 'Unidade', value: 'UNIT', unit: 'un' }
                          ].map(opt => (
                            <div
                              key={opt.value}
                              className="px-3 py-2 text-xs hover:bg-primary/10 cursor-pointer rounded-md transition-colors flex items-center justify-between"
                              onClick={() => {
                                setFormData(p => ({ ...p, format: opt.value as any, unit: opt.unit }));
                                setIsPopoverFmtOpen(false);
                              }}
                            >
                              <span className="font-semibold">{opt.label}</span>
                              <span className="text-[10px] opacity-40 uppercase">{opt.unit}</span>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Inteligência Produtiva — Componente Modular ocupando largura total */}
                  <div className="col-span-2">
                    <ProductiveIntelligence
                      value={productiveData}
                      onChange={setProductiveData}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border/30">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase">Inteligência Financeira e Fiscal</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground">Custo Unit. Inicial (R$)</label>
                      <Input
                        type="number" step="0.0001"
                        value={formData.costPerUnit}
                        onChange={e => setFormData(p => ({ ...p, costPerUnit: e.target.value }))}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Estoque Mínimo</label>
                      <Input
                        type="number"
                        value={formData.minStockQuantity}
                        onChange={e => setFormData(p => ({ ...p, minStockQuantity: e.target.value }))}
                        className="h-11 border-border/60"
                        placeholder="Qtd. p/ aviso"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/40">
                    <div>
                      <p className="text-sm font-semibold">Controlar Estoque Físico</p>
                      <p className="text-[10px] text-muted-foreground">Alerta automático de saldo zerado.</p>
                    </div>
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary rounded"
                      checked={formData.trackStock}
                      onChange={(e) => setFormData({ ...formData, trackStock: e.target.checked })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Tipo Item (SPED)</label>
                      <select
                        className="w-full h-11 px-3 border border-border/60 rounded-md bg-background text-sm"
                        value={formData.spedType}
                        onChange={(e) => setFormData({ ...formData, spedType: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        <option value="00">0 Mercadoria Revenda</option>
                        <option value="01">01 Matéria-prima</option>
                        <option value="10">10 Outros Insumos</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Venda s/ Estoque</label>
                      <select
                        className="w-full h-11 px-3 border border-border/60 rounded-md bg-background text-sm"
                        value={formData.sellWithoutStock ? 'true' : 'false'}
                        onChange={(e) => setFormData({ ...formData, sellWithoutStock: e.target.value === 'true' })}
                      >
                        <option value="true">Permitir</option>
                        <option value="false">Bloquear</option>
                      </select>
                    </div>
                  </div>

                  {/* Contas Contábeis */}
                  <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Conta de Estoque</label>
                        <Popover open={isGuideOpen} onOpenChange={setIsGuideOpen}>
                          <PopoverTrigger asChild>
                            <button type="button" className="text-primary hover:text-primary/70">
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="top" className="bg-[#0f172a] border-slate-700 p-4 text-white w-[400px] z-[120]">
                            <p className="text-xs italic opacity-90">Preencha se for armazenar o material. Deixe em branco se for compra spot sob demanda.</p>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Combobox
                        value={formData.inventoryAccountId}
                        onChange={(val) => setFormData(p => ({ ...p, inventoryAccountId: val }))}
                        options={chartOfAccounts
                          .filter(a => a.type === 'ANALYTIC' && a.code?.startsWith('1'))
                          .map(acc => ({ id: acc.id, label: acc.name, sublabel: acc.code }))
                        }
                        placeholder="Selecione a conta..."
                        allowClear
                      />
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Conta de Despesa/Custo</label>
                      <Combobox
                        value={formData.expenseAccountId}
                        onChange={(val) => setFormData(p => ({ ...p, expenseAccountId: val }))}
                        options={chartOfAccounts
                          .filter(a => a.type === 'ANALYTIC' && (a.code?.startsWith('3') || a.code?.startsWith('4')))
                          .map(acc => ({ id: acc.id, label: acc.name, sublabel: acc.code }))
                        }
                        placeholder="Selecione a conta..."
                        allowClear
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border/30">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase">Fornecedores Vinculados</h4>
                    <Button
                      type="button" variant="outline" size="sm" className="h-7 text-[10px]"
                      onClick={() => setFormData(p => ({ ...p, suppliers: [...p.suppliers, { supplierId: '', costPrice: '', supplierCode: '', paymentTerms: 'Mensal', preferredPaymentDay: '10' }] }))}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Adicionar
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {formData.suppliers.map((s, idx) => (
                      <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg border border-border/40 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <select
                            value={s.supplierId}
                            onChange={e => {
                              const newSuppliers = [...formData.suppliers];
                              newSuppliers[idx].supplierId = e.target.value;
                              setFormData(prev => ({ ...prev, suppliers: newSuppliers }));
                            }}
                            className="flex-1 h-9 px-3 border border-border/60 rounded-md bg-background text-sm"
                          >
                            <option value="">Selecione...</option>
                            {fornecedores.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <Button
                            type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive"
                            onClick={() => setFormData(p => ({ ...p, suppliers: p.suppliers.filter((_, i) => i !== idx) }))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  <Button type="submit" className="w-full h-12 text-lg font-bold">
                    {selectedMaterial ? 'Salvar Alterações' : 'Cadastrar Material'}
                  </Button>
                </div>
              </form>
            )}

            {/* TAB: MOVIMENTAR */}
            {activeTab === 'movimentar' && selectedMaterial && (
              <div className="space-y-8 animate-in slide-in-from-right-2 duration-300">
                {/* Switch Tipo Movimentação */}
                <div className="flex p-1 bg-muted rounded-xl gap-1">
                  <button
                    onClick={() => setMovType('ENTRADA')}
                    className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${movType === 'ENTRADA' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:bg-background/50'
                      }`}
                  >
                    <ArrowUpCircle className="w-5 h-5 text-emerald-500" /> Registrar Entrada (NF)
                  </button>
                  <button
                    onClick={() => setMovType('CONSUMO')}
                    className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${movType === 'CONSUMO' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:bg-background/50'
                      }`}
                  >
                    <ArrowDownCircle className="w-5 h-5 text-red-500" /> Consumo Interno
                  </button>
                </div>

                <form onSubmit={handleMovimentar} className="space-y-6 bg-card p-6 rounded-2xl border border-border/50 shadow-sm relative group overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${movType === 'ENTRADA' ? 'bg-emerald-500' : 'bg-red-500'}`} />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Quantidade ({selectedMaterial.unit})</label>
                      <Input 
                        type="text" required
                        value={movData.quantity}
                        onChange={e => {
                          const val = e.target.value.replace(/[^\d.,]/g, '');
                          setMovData(p => ({ ...p, quantity: val }));
                        }}
                        className="h-16 text-4xl text-center font-mono font-bold tracking-tighter"
                        placeholder="0"
                      />
                    </div>

                    {movType === 'ENTRADA' ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                            <FileKey className="w-3.5 h-3.5" /> Chave da Nota {requireNF && <span className="text-red-500">*</span>}
                          </label>
                          <Input
                            value={movData.documentKey}
                            onChange={e => setMovData(p => ({ ...p, documentKey: e.target.value }))}
                            className="h-11 border-border/60"
                            placeholder="Chave NF-e ou Cupom"
                            required={requireNF}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-muted-foreground font-mono">Custo Unit. (R$)</label>
                          <Input
                            type="text"
                            value={movData.unitCost}
                            onChange={e => {
                              const val = e.target.value.replace(/[^\d.,]/g, '');
                              setMovData(p => ({ ...p, unitCost: val }));
                            }}
                            className="h-11 font-mono border-border/60"
                            placeholder={formatCurrency(selectedMaterial.averageCost || selectedMaterial.costPerUnit || 0)}
                          />
                        </div>
                        <div className="col-span-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex justify-between items-center animate-in fade-in slide-in-from-top-1 duration-300">
                             <div className="text-[10px] uppercase font-bold text-emerald-700">Total Previsto da Operação:</div>
                             <div className="text-lg font-mono font-bold text-emerald-700">
                               {formatCurrency(
                                 (parseFloat(movData.quantity.toString().replace(',', '.')) || 0) * 
                                 (parseFloat(movData.unitCost.toString().replace(',', '.') || (selectedMaterial?.averageCost || selectedMaterial?.costPerUnit || 0).toString()))
                               )}
                             </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 col-span-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <Factory className="w-3.5 h-3.5" /> Máquina Atribuída
                        </label>
                        <select
                          value={movData.machineId}
                          onChange={e => setMovData(p => ({ ...p, machineId: e.target.value }))}
                          className="w-full h-11 px-3 border border-border/60 rounded-md bg-background text-sm font-bold"
                          required
                        >
                          <option value="">Selecione a máquina responsável...</option>
                          {machines.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Observações / Motivo</label>
                    <Input
                      value={movData.description}
                      onChange={e => setMovData(p => ({ ...p, description: e.target.value }))}
                      className="h-11 border-border/60"
                      placeholder="Ex: Compra mensal reposição / Teste de impressão"
                    />
                  </div>

                  <Button type="submit" className={`w-full h-12 font-bold shadow-lg transition-all ${movType === 'ENTRADA' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                    }`}>
                    Confirmar Registro de {movType === 'ENTRADA' ? 'Entrada' : 'Baixa'}
                  </Button>
                </form>

                {/* Info Card */}
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 text-xs text-primary leading-relaxed">
                  <div className="flex items-center gap-2 mb-1 font-bold">
                    <Info className="w-4 h-4" /> Importante:
                  </div>
                  Ao confirmar, o sistema recalculará o custo médio e o saldo financeiro do estoque atual automaticamente.
                  Esta operação não pode ser deletada, apenas estornada via ajuste manual.
                </div>
              </div>
            )}

            {/* TAB: HISTÓRICO */}
            {activeTab === 'historico' && selectedMaterial && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center justify-between">
                  Movimentações Recentes
                  <span className="text-primary">{movements.length} total</span>
                </h4>
                <div className="space-y-3">
                  {movements.map((mov) => (
                    <div key={mov.id} className="p-4 bg-muted/20 rounded-xl border border-border/30 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${mov.type === 'ENTRY' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {mov.type === 'ENTRY' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                        </div>
                        <div>
                          <div className="text-sm font-bold flex items-center gap-1">
                            {mov.type === 'ENTRY' ? 'Entrada (NF)' : 'Consumo (Baixa)'}
                            {mov.documentKey && <span className="text-[10px] bg-muted px-1 rounded text-muted-foreground">NF: {mov.documentKey.slice(-6)}</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{new Date(mov.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold font-mono ${mov.type === 'ENTRY' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {mov.type === 'ENTRY' ? '+' : '-'}{mov.quantity}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{selectedMaterial.unit}</div>
                      </div>
                    </div>
                  ))}
                  {movements.length === 0 && (
                    <div className="text-center py-20 text-muted-foreground">
                      <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      Sem registros anteriores.
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Insumos;
