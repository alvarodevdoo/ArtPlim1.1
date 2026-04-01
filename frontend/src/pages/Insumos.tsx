import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plus, Search, X, ChevronDown,
  History, Settings2, Package, AlertTriangle, CheckCircle2,
  ClipboardEdit, ArrowUpCircle
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Combobox } from '@/components/ui/Combobox';
import { ProductiveIntelligence, type ProductiveIntelligenceData, type ControlUnit, type ConsumptionRule } from '@/components/catalog/ProductiveIntelligence/ProductiveIntelligence';

// --- Interfaces ---
interface MaterialType {
  id: string;
  name: string;
  spedCode: string;
  mappings: {
    accountId: string;
    mappingType: 'INVENTORY' | 'EXPENSE';
    account: {
      id: string;
      name: string;
      code: string;
      nature: string;
    }
  }[];
}

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
  active: boolean;
  defaultConsumptionRule?: ConsumptionRule;
  defaultConsumptionFactor?: number;
  inventoryAccountId?: string;
  expenseAccountId?: string;
  materialTypeId?: string;
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
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'cadastro' | 'movimentar' | 'historico'>('cadastro');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [inventoryAccounts, setInventoryAccounts] = useState<any[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [requireNF, setRequireNF] = useState(false);

  const { control, handleSubmit, register, setValue, watch, reset } = useForm({
    defaultValues: {
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
      materialTypeId: '',
      spedType: '01',
      suppliers: [] as any[]
    }
  });

  const [productiveData, setProductiveData] = useState<ProductiveIntelligenceData>({
    controlUnit: 'M2',
    defaultConsumptionRule: 'PRODUCT_AREA',
    conversionFactor: 1,
    width: 0,
    height: 0,
  });

  const existingCategories = useMemo(() => {
    const cats = materiais.map(m => m.category).filter(Boolean);
    return Array.from(new Set(cats)).sort();
  }, [materiais]);

  const [movType, setMovType] = useState<'ENTRADA' | 'CONSUMO'>('ENTRADA');
  const [movData, setMovData] = useState({
    quantity: '',
    unitCost: '',
    documentKey: '',
    description: '',
    machineId: '',
  });

  useEffect(() => {
    loadData();
    loadConfig();
  }, []);

  const watchedTypeId = watch('materialTypeId');
  useEffect(() => {
    if (!watchedTypeId) return;
    const activeType = materialTypes.find(t => t.id === watchedTypeId);
    if (!activeType) return;

    setValue('materialTypeId', activeType.id);
    // Removemos a restrição baseada em SPED, pois o usuário quer simplificar.
    // Agora o sistema permite controle de estoque para qualquer classificação criada.
    const canInventory = true;
    
    if (!canInventory) {
      setValue('trackStock', false);
      setValue('inventoryAccountId', '');
      setInventoryAccounts([]);
    } else {
      const invAccs = activeType.mappings.filter(m => m.mappingType === 'INVENTORY').map(m => m.account);
      setInventoryAccounts(invAccs);
      if (invAccs.length === 1 && !selectedMaterial) setValue('inventoryAccountId', invAccs[0].id);
    }

    const expAccs = activeType.mappings.filter(m => m.mappingType === 'EXPENSE').map(m => m.account);
    setExpenseAccounts(expAccs);
    if (expAccs.length === 1 && !selectedMaterial) setValue('expenseAccountId', expAccs[0].id);
  }, [watchedTypeId, materialTypes, setValue, selectedMaterial]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [matsRes, typesRes] = await Promise.all([
        api.get('/api/catalog/materials'),
        api.get('/api/finance/v2/material-types')
      ]);
      setMateriais(matsRes.data.data || []);
      setMaterialTypes(typesRes.data.data || []);
    } catch (error) {
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const resp = await api.get('/api/organization/settings');
      setRequireNF(resp.data.data.requireDocumentKeyForEntry || false);
    } catch (e) {}
  };

  const loadHistory = async (materialId: string) => {
    try {
      const resp = await api.get(`/api/wms/stock-movements?materialId=${materialId}&limit=50`);
      setMovements(resp.data.data || []);
    } catch (e) {}
  };

  const handleOpenDrawer = async (material: Material | null) => {
    if (material) {
      setIsDrawerOpen(true);
      setActiveTab('cadastro');
      try {
        const resp = await api.get(`/api/catalog/materials/${material.id}`);
        const full = resp.data.data;
        setSelectedMaterial(full);
        reset({
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
          materialTypeId: full.materialTypeId || '',
          spedType: full.spedType || '01',
          suppliers: []
        });
        setProductiveData({
          controlUnit: full.controlUnit || 'M2',
          defaultConsumptionRule: full.defaultConsumptionRule || 'PRODUCT_AREA',
          conversionFactor: full.conversionFactor ?? full.defaultConsumptionFactor ?? 1,
          width: full.width ?? full.standardWidth ?? 0,
          height: full.height ?? full.standardLength ?? 0,
        });
        loadHistory(full.id);
      } catch (err) {
        toast.error('Erro ao carregar detalhes.');
      }
    } else {
      setSelectedMaterial(null);
      reset({
        name: '', category: 'Outros', format: 'SHEET',
        costPerUnit: '', unit: 'm²', inventoryAccountId: '', expenseAccountId: '',
        minStockQuantity: '', sellWithoutStock: true, trackStock: true,
        materialTypeId: '', spedType: '01', suppliers: []
      });
      setProductiveData({ controlUnit: 'M2', defaultConsumptionRule: 'PRODUCT_AREA', conversionFactor: 1, width: 0, height: 0 });
      setActiveTab('cadastro');
      setIsDrawerOpen(true);
    }
  };

  const onSubmitCadastro = async (formData: any) => {
    const payload = {
      ...formData,
      costPerUnit: parseFloat(formData.costPerUnit) || 0,
      controlUnit: productiveData.controlUnit,
      defaultConsumptionRule: productiveData.defaultConsumptionRule,
      conversionFactor: productiveData.conversionFactor,
      width: productiveData.width || undefined,
      height: productiveData.height || undefined,
      minStockQuantity: formData.minStockQuantity ? parseFloat(formData.minStockQuantity) : null,
    };

    try {
      if (selectedMaterial) {
        await api.put(`/api/catalog/materials/${selectedMaterial.id}`, payload);
        toast.success('Atualizado com sucesso!');
      } else {
        await api.post('/api/catalog/materials', payload);
        toast.success('Cadastrado com sucesso!');
      }
      loadData();
      setIsDrawerOpen(false);
    } catch (err: any) {
      toast.error('Erro ao salvar material');
    }
  };

  const handleMovimentar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    const url = movType === 'ENTRADA' ? '/api/wms/stock-movements/entry' : '/api/wms/stock-movements/consumption';
    
    if (movType === 'ENTRADA' && requireNF && !movData.documentKey) {
      return toast.warning('Chave da NF é obrigatória.');
    }

    try {
      await api.post(url, {
        materialId: selectedMaterial.id,
        quantity: parseFloat(movData.quantity.replace(',', '.')) || 0,
        unitCost: movType === 'ENTRADA' ? parseFloat(movData.unitCost.replace(',', '.')) : undefined,
        documentKey: movData.documentKey,
        description: movData.description
      });
      toast.success('Movimentação registrada!');
      loadData();
      loadHistory(selectedMaterial.id);
      setMovData({ quantity: '', unitCost: '', documentKey: '', description: '', machineId: '' });
    } catch (err) {
      toast.error('Erro na movimentação.');
    }
  };

  const getStockStatus = (material: Material) => {
    if (!material.trackStock) return { label: 'Sob Demanda', color: 'bg-blue-50 text-blue-600', icon: Package };
    const stock = material.currentStock || 0;
    const min = material.minStockQuantity || 0;
    if (stock <= 0) return { label: 'Zerado', color: 'bg-red-50 text-red-600', icon: AlertTriangle };
    if (min > 0 && stock < min) return { label: 'Baixo', color: 'bg-amber-50 text-amber-600', icon: AlertTriangle };
    return { label: 'Ok', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 };
  };

  const filtered = materiais.filter(m => (
    (m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.category.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterCategory === 'ALL' || m.category === filterCategory)
  ));

  const categories = ['ALL', ...new Set(materiais.map(m => m.category || 'Outros'))];

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Insumos</h1>
          <p className="text-muted-foreground">Controle técnico e financeiro do estoque.</p>
        </div>
        <Button onClick={() => handleOpenDrawer(null)} className="h-12 px-6 shadow-lg"><Plus className="mr-2" /> Novo Insumo</Button>
      </div>

      <div className="flex gap-3 bg-card p-4 rounded-xl border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11" />
        </div>
        <Combobox
          value={filterCategory}
          onChange={setFilterCategory}
          options={categories.map(cat => ({ id: cat, label: cat === 'ALL' ? 'Todos' : cat }))}
          className="w-48"
        />
      </div>

      <div className="flex-1 bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-muted/50 border-b">
            <tr className="text-xs uppercase font-bold text-muted-foreground">
              <th className="px-6 py-4">Insumo</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Estoque</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(m => (
              <tr key={m.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => handleOpenDrawer(m)}>
                <td className="px-6 py-4"><span className="font-bold">{m.name}</span></td>
                <td className="px-6 py-4"><span className="text-sm">{m.category}</span></td>
                <td className="px-6 py-4 font-mono">
                  {m.trackStock ? <div>{m.currentStock || 0} <span className="text-[10px]">{m.unit}</span></div> : '—'}
                </td>
                <td className="px-6 py-4 text-right"><Settings2 className="w-4 h-4 ml-auto opacity-20" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full max-w-xl bg-background shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b flex justify-between items-center bg-muted/10">
              <h2 className="text-xl font-bold">{selectedMaterial ? selectedMaterial.name : 'Novo Insumo'}</h2>
              <Button variant="ghost" onClick={() => setIsDrawerOpen(false)}><X /></Button>
            </div>

            <div className="flex border-b">
              {['cadastro', 'movimentar', 'historico'].map(t => (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-4 text-sm font-bold uppercase ${activeTab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>{t}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'cadastro' && (
                <form onSubmit={handleSubmit(onSubmitCadastro)} className="space-y-6">
                  <div className="space-y-4">
                    <section className="space-y-2">
                       <label className="text-xs font-bold uppercase text-muted-foreground">Nome do Insumo</label>
                       <Input {...register('name', { required: true })} className="h-11" />
                    </section>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Categoria Local</label>
                        <Controller control={control} name="category" render={({ field }) => (
                          <Combobox value={field.value} onChange={field.onChange} options={existingCategories.map(cat => ({ id: cat, label: cat }))} />
                        )} />
                      </div>
                    </div>

                    <ProductiveIntelligence value={productiveData} onChange={setProductiveData} />

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Custo Unitário</label>
                        <Input type="number" step="0.0001" {...register('costPerUnit')} className="h-11" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Estoque Mínimo</label>
                        <Input type="number" {...register('minStockQuantity')} className="h-11" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold">Monitorar Estoque Físico</p>
                        <p className="text-[10px] text-muted-foreground">Habilitar controle de saldo e apropriação contábil.</p>
                      </div>
                      <Controller control={control} name="trackStock" render={({ field }) => (
                        <input type="checkbox" className="w-5 h-5 rounded border-slate-300" checked={field.value} onChange={e => field.onChange(e.target.checked)} />
                      )} />
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground text-primary">Classificação Contábil (Configurada)</label>
                        <Controller control={control} name="materialTypeId" render={({ field }) => (
                          <Combobox value={field.value} onChange={field.onChange} options={materialTypes.map(t => ({ id: t.id, label: t.name }))} placeholder="Selecione a classificação contábil desse insumo..." />
                        )} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Conta de Estoque</label>
                        <Controller control={control} name="inventoryAccountId" render={({ field }) => (
                          <Combobox value={field.value} onChange={field.onChange} options={inventoryAccounts.map(a => ({ id: a.id, label: a.name, sublabel: a.code }))} disabled={!watch('trackStock')} />
                        )} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Conta de Despesa</label>
                        <Controller control={control} name="expenseAccountId" render={({ field }) => (
                          <Combobox value={field.value} onChange={field.onChange} options={expenseAccounts.map(a => ({ id: a.id, label: a.name, sublabel: a.code }))} />
                        )} />
                      </div>
                    </div>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-12 text-base font-black uppercase shadow-xl shadow-primary/20">Salvar Insumo</Button>
                </form>
              )}

              {activeTab === 'movimentar' && (
                <form onSubmit={handleMovimentar} className="space-y-4">
                  <div className="flex gap-2 p-1 bg-muted rounded-xl">
                    <button type="button" onClick={() => setMovType('ENTRADA')} className={`flex-1 py-3 text-xs font-black rounded-lg transition-all ${movType === 'ENTRADA' ? 'bg-white shadow text-primary' : 'text-muted-foreground'}`}>ENTRADA</button>
                    <button type="button" onClick={() => setMovType('CONSUMO')} className={`flex-1 py-3 text-xs font-black rounded-lg transition-all ${movType === 'CONSUMO' ? 'bg-white shadow text-red-500' : 'text-muted-foreground'}`}>SAÍDA / CONSUMO</button>
                  </div>
                  <div className="space-y-4 bg-muted/20 p-5 rounded-2xl border">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2 font-bold"><label className="text-xs">Quantidade</label><Input value={movData.quantity} onChange={e => setMovData(prev => ({...prev, quantity: e.target.value}))} placeholder="0,00" /></div>
                       {movType === 'ENTRADA' && <div className="space-y-2 font-bold"><label className="text-xs">Custo (R$)</label><Input value={movData.unitCost} onChange={e => setMovData(prev => ({...prev, unitCost: e.target.value}))} /></div>}
                    </div>
                    {movType === 'ENTRADA' && <div className="space-y-2 font-bold"><label className="text-xs">Doc / NF</label><Input value={movData.documentKey} onChange={e => setMovData(prev => ({...prev, documentKey: e.target.value}))} /></div>}
                    <div className="space-y-2 font-bold"><label className="text-xs">Observação</label><Input value={movData.description} onChange={e => setMovData(prev => ({...prev, description: e.target.value}))} /></div>
                    <Button type="submit" className={`w-full h-12 font-black ${movType === 'ENTRADA' ? 'bg-emerald-600' : 'bg-red-600'}`}>REGISTRAR AGORA</Button>
                  </div>
                </form>
              )}
              
              {activeTab === 'historico' && (
                <div className="space-y-3">
                  {movements.length === 0 ? <p className="text-center py-10 text-muted-foreground italic text-sm">Nenhuma movimentação registrada.</p> : movements.map(m => (
                    <div key={m.id} className="p-4 bg-muted/30 rounded-xl border flex justify-between items-center shadow-sm">
                      <div><p className="text-xs font-black uppercase text-slate-500">{m.type === 'ENTRY' ? 'Entrada (NF)' : 'Saída (Consumo)'}</p><p className="text-[10px] font-bold text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString()}</p></div>
                      <p className={`text-lg font-black ${m.type === 'ENTRY' ? 'text-emerald-600' : 'text-red-500'}`}>{m.type === 'ENTRY' ? '+' : '-'}{m.quantity}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Insumos;
