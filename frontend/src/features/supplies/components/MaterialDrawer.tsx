import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { X, Package, ArrowUpCircle, History, Save, ChevronRight, Info } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Combobox } from '@/components/ui/Combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  ProductiveIntelligence, 
} from './ProductiveIntelligence/ProductiveIntelligence';
import { InventoryAdjustment } from './InventoryAdjustment/InventoryAdjustment';
import { MovementHistory } from './InventoryAdjustment/MovementHistory';
import { 
  type ProductiveIntelligenceData, 
  type ControlUnit, 
  type ConsumptionRule 
} from './ProductiveIntelligence/types';
import { cn } from '@/lib/utils';

export interface Material {
  id: string;
  name: string;
  categoryId: string;
  category?: { name: string; inventoryAccountId?: string; expenseAccountId?: string };
  description?: string;
  format: 'ROLL' | 'SHEET' | 'UNIT';
  costPerUnit: number;
  unit: string;
  controlUnit?: ControlUnit;
  conversionFactor?: number;
  largura_unitaria?: number;
  altura_unitaria?: number;
  purchaseUnit?: string;
  multiplicador_padrao_entrada?: number;
  active: boolean;
  defaultConsumptionRule?: ConsumptionRule;
  defaultConsumptionFactor?: number;
  inventoryAccountId?: string;
  expenseAccountId?: string;
  materialTypeId?: string;
  minStockQuantity?: number | null;
  sellWithoutStock?: boolean;
  trackStock: boolean;
  ncm?: string;
  ean?: string;
  currentStock?: number;
  purchasePrice?: number;
}

interface MaterialDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  materialId?: string | null;
  initialData?: Partial<Material> | null;
  onSuccess?: (material: Material) => void;
  // Propriedades para o fluxo de "Próximo" da NFe
  onSaveAndNext?: (material: Material) => void;
  hasNext?: boolean;
}

export const MaterialDrawer: React.FC<MaterialDrawerProps> = ({
  isOpen,
  onClose,
  materialId,
  initialData,
  onSuccess,
  onSaveAndNext,
  hasNext
}) => {
  const [activeTab, setActiveTab] = useState<'cadastro' | 'movimentar' | 'historico'>('cadastro');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [batches, setBatches] = useState<any[]>([]);

  const { control, handleSubmit, register, reset, watch, setValue } = useForm({
    defaultValues: {
      name: '',
      categoryId: '',
      description: '',
      format: 'SHEET' as any,
      costPerUnit: '',
      unit: 'm²',
      minStockQuantity: '',
      sellWithoutStock: true,
      trackStock: true,
      ncm: '',
      ean: '',
      // Campos de Inteligência Integrados
      purchaseUnit: 'UN',
      multiplicador_padrao_entrada: 1,
      largura_unitaria: 0,
      altura_unitaria: 0,
      purchasePrice: 0,
      controlUnit: 'M2' as ControlUnit,
      defaultConsumptionRule: 'PRODUCT_AREA' as ConsumptionRule,
      conversionFactor: 1,
    }
  });

  const productiveData = watch(); // Agora a "inteligência" vem direto do formulário oficial
  const trackStock = watch('trackStock');
  const setProductiveData = (data: Partial<ProductiveIntelligenceData>) => {
    Object.entries(data).forEach(([key, val]) => {
      setValue(key as any, val);
    });
  };

  // Quando o monitoramento de estoque é desligado, volta para a aba de cadastro
  useEffect(() => {
    if (!trackStock && (activeTab === 'movimentar' || activeTab === 'historico')) {
      setActiveTab('cadastro');
    }
  }, [trackStock, activeTab]);

  const handleDiscardOffcut = async (quantity: number) => {
    if (!selectedMaterial) return;
    
    try {
      const formData = new FormData();
      formData.append('materialId', selectedMaterial.id);
      formData.append('type', 'CONSUMPTION');
      formData.append('quantity', quantity.toString());
      formData.append('unitCost', (Number(selectedMaterial.averageCost) || 0).toString());
      formData.append('justification', 'Descarte automático de retalhos via monitor de consumo');
      formData.append('notes', 'Ação disparada pelo Monitor de Inteligência Produtiva');

      await api.post('/api/wms/movements/adjustment', formData);
      toast.success('Retalhos descartados com sucesso!');
      
      // Recarregar dados
      const resp = await api.get(`/api/catalog/materials/${selectedMaterial.id}`);
      setSelectedMaterial(resp.data.data);
    } catch (err) {
      toast.error('Erro ao descartar retalhos');
    }
  };

  // Carregar categorias financeiras
  useEffect(() => {
    const loadSelectData = async () => {
      try {
        const catsResp = await api.get('/api/finance/categories?type=EXPENSE');
        setCategories(catsResp.data.data || []);
      } catch (e) {}
    };
    if (isOpen) loadSelectData();
  }, [isOpen]);

  // Carregar dados do material se houver ID
  useEffect(() => {
    const loadMaterial = async () => {
      if (!materialId) {
        if (initialData) {
          reset({
            name: initialData.name || '',
            categoryId: initialData.categoryId || '',
            description: initialData.description || '',
            format: initialData.format || 'SHEET',
            costPerUnit: initialData.costPerUnit?.toString() || '',
            unit: initialData.unit || 'm²',
            minStockQuantity: initialData.minStockQuantity?.toString() || '',
            sellWithoutStock: initialData.sellWithoutStock ?? true,
            trackStock: initialData.trackStock ?? true,
            ncm: initialData.ncm || '',
            ean: initialData.ean || '',
            purchaseUnit: initialData.purchaseUnit || 'UN',
            multiplicador_padrao_entrada: initialData.multiplicador_padrao_entrada || 1,
            largura_unitaria: initialData.largura_unitaria || initialData.width || 0,
            altura_unitaria: initialData.altura_unitaria || initialData.height || 0,
            purchasePrice: initialData.purchasePrice || 0,
            controlUnit: (initialData.controlUnit || 'M2') as ControlUnit,
            defaultConsumptionRule: (initialData.defaultConsumptionRule || 'PRODUCT_AREA') as ConsumptionRule,
            conversionFactor: initialData.conversionFactor ?? 1,
          });
        } else {
          reset({
            name: '', categoryId: '', description: '', format: 'SHEET',
            costPerUnit: '', unit: 'm²',
            minStockQuantity: '', sellWithoutStock: true, trackStock: true,
            ncm: '', ean: '',
            purchaseUnit: 'UN',
            multiplicador_padrao_entrada: 1,
            largura_unitaria: 0,
            altura_unitaria: 0,
            purchasePrice: 0,
            controlUnit: 'M2' as ControlUnit,
            defaultConsumptionRule: 'PRODUCT_AREA' as ConsumptionRule,
            conversionFactor: 1,
          });
        }
        setSelectedMaterial(null);
        return;
      }

      try {
        // Busca paralela para evitar flickering e resets duplos
        const [matResp, batchesResp] = await Promise.all([
          api.get(`/api/catalog/materials/${materialId}`),
          api.get(`/api/insumos/${materialId}/batches`)
        ]);

        const full = matResp.data.data;
        const currentBatches = batchesResp.data.data || [];
        
        setBatches(currentBatches);
        setSelectedMaterial(full);

        // Lógica de Preço Sugerido: Prioriza o que está no banco, 
        // se estiver zerado, usa o custo do lote PEPS atual.
        let finalPurchasePrice = Number(full.purchasePrice) || 0;
        if (finalPurchasePrice === 0 && currentBatches.length > 0) {
          finalPurchasePrice = currentBatches[0].unitCost * (full.multiplicador_padrao_entrada || 1);
        }

        reset({
          name: full.name,
          categoryId: full.categoryId,
          description: full.description || '',
          format: full.format,
          costPerUnit: (parseFloat(full.costPerUnit) || 0).toString(),
          unit: full.unit,
          minStockQuantity: full.minStockQuantity?.toString() || '',
          sellWithoutStock: full.sellWithoutStock ?? true,
          trackStock: full.trackStock ?? true,
          ncm: full.ncm || '',
          ean: full.ean || '',
          purchaseUnit: full.purchaseUnit || 'UN',
          purchasePrice: Number(finalPurchasePrice.toFixed(2)),
          multiplicador_padrao_entrada: full.multiplicador_padrao_entrada || 1,
          largura_unitaria: (full.largura_unitaria || full.width) ?? 0,
          altura_unitaria: (full.altura_unitaria || full.height) ?? 0,
          controlUnit: (full.controlUnit || 'M2') as ControlUnit,
          defaultConsumptionRule: (full.defaultConsumptionRule || 'PRODUCT_AREA') as ConsumptionRule,
          conversionFactor: full.conversionFactor ?? 1,
        });
      } catch (err) {
        toast.error('Erro ao carregar detalhes.');
      }
    };

    if (isOpen) loadMaterial();
  }, [isOpen, materialId, initialData, reset]);

  // Sincronizar Custo Unitário (Interno) automaticamente baseado na Inteligência
  useEffect(() => {
    if (productiveData.purchasePrice && productiveData.purchasePrice > 0) {
      const mult = productiveData.multiplicador_padrao_entrada || 1;
      const calculatedInternalCost = productiveData.purchasePrice / mult;
      
      const currentCost = watch('costPerUnit');
      if (Math.abs(calculatedInternalCost - (Number(currentCost) || 0)) > 0.0001) {
        setValue('costPerUnit', Number(calculatedInternalCost.toFixed(4)).toString());
      }
    }
  }, [productiveData.purchasePrice, productiveData.multiplicador_padrao_entrada, setValue, watch]);

  const onError = (errors: any) => {
    if (errors.name) toast.error('Nome do Insumo é obrigatório!');
    else if (errors.categoryId) toast.error('A Categoria de Apropriação Financeira é obrigatória!');
    else toast.error('Preencha todos os campos obrigatórios listados em vermelho.');
  };

  const onSubmit = async (formData: any, andNext = false) => {
    const payload = {
      ...formData,
      costPerUnit: parseFloat(formData.costPerUnit) || 0,
      width: typeof formData.largura_unitaria === 'number' ? formData.largura_unitaria : undefined,
      height: typeof formData.altura_unitaria === 'number' ? formData.altura_unitaria : undefined,
      minStockQuantity: formData.minStockQuantity ? parseFloat(formData.minStockQuantity) : null,
    };

    try {
      let result;
      if (materialId || selectedMaterial) {
        result = await api.put(`/api/catalog/materials/${materialId || selectedMaterial?.id}`, payload);
        toast.success('Insumo atualizado!');
      } else {
        result = await api.post('/api/catalog/materials', payload);
        toast.success('Insumo cadastrado!');
      }
      
      const material = result.data.data;
      if (andNext && onSaveAndNext) {
        onSaveAndNext(material);
      } else if (onSuccess) {
        onSuccess(material);
      }
      if (!andNext) onClose();
    } catch (err: any) {
      toast.error('Erro ao salvar material');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-background shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b flex justify-between items-center bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{materialId || selectedMaterial ? 'Editar Insumo' : 'Novo Insumo'}</h2>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Catálogo Técnico</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex bg-muted/30 p-1 mx-6 mt-4 rounded-xl border">
          {[
            { id: 'cadastro', label: 'Cadastro', icon: Save, hidden: false },
            { id: 'movimentar', label: 'Ajuste Estoque', icon: ArrowUpCircle, hidden: !trackStock, disabled: !materialId && !selectedMaterial },
            { id: 'historico', label: 'Logs / Histórico', icon: History, hidden: !trackStock, disabled: !materialId && !selectedMaterial }
          ].filter(t => !t.hidden).map(t => (
            <button
              key={t.id}
              disabled={t.disabled}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase rounded-lg transition-all",
                activeTab === t.id ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/50",
                t.disabled && "opacity-30 cursor-not-allowed"
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'cadastro' && (
            <form id="material-form" onSubmit={handleSubmit((d) => onSubmit(d), onError)} className="space-y-6">
                            


                <section className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Nome Comercial do Insumo</label>
                  <Input {...register('name', { required: true })} className="h-12 text-lg font-medium border-2 focus:border-primary/50" placeholder="Ex: Lona Brilho 440g" />
                </section>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">NCM</label>
                    <Input {...register('ncm')} className="h-10 font-mono" placeholder="0000.00.00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">EAN (Código de Barras)</label>
                    <Input {...register('ean')} className="h-10 font-mono" placeholder="789..." />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <History className="w-3 h-3" />
                    Categoria de Insumo (Apropriação Financeira)
                  </label>
                  <Controller control={control} name="categoryId" rules={{ required: true }} render={({ field, fieldState }) => (
                    <div className="flex flex-col gap-1">
                      <Combobox 
                        value={field.value} 
                        onChange={field.onChange} 
                        options={categories.map(c => ({ id: c.id, label: c.name }))}
                        placeholder="Selecione a categoria..."
                        className={cn(fieldState.error && "border-red-500")}
                      />
                      {fieldState.error && <span className="text-[10px] text-red-500">Categoria é obrigatória</span>}
                    </div>
                  )} />
                  <p className="text-[9px] text-muted-foreground px-1 italic">* Define as contas contábeis padrão para este item.</p>
                </div>

                <div className="bg-muted/20 rounded-2xl p-4 border border-dashed border-primary/20">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings2 className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-tighter">Inteligência de Cálculo</h3>
                  </div>
                  <ProductiveIntelligence 
                     value={productiveData} 
                     onChange={setProductiveData} 
                     format={watch('format')} 
                   />
                </div>

                <div className="pt-4 border-t grid grid-cols-2 gap-4 items-center">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Estoque de Alerta (Mínimo)</label>
                    <Input type="number" {...register('minStockQuantity')} className="h-11 font-bold" />
                    <p className="text-[9px] text-muted-foreground italic leading-tight">Avisos automáticos abaixo deste patamar.</p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-primary/5 rounded-2xl border border-primary/10 h-[76px] self-end mb-1">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase">Monitoramento Ativo</p>
                      <p className="text-[9px] text-muted-foreground leading-tight">Gerir saldo no WMS e Financeiro.</p>
                    </div>
                    <Controller control={control} name="trackStock" render={({ field }) => (
                      <input type="checkbox" className="w-5 h-5 rounded border-primary transition-all cursor-pointer" checked={field.value} onChange={e => field.onChange(e.target.checked)} />
                    )} />
                  </div>
                </div>
                {/* Filas de Consumo PEPS (Informativo no Cadastro) - Movido para o final */}
                {batches.length > 0 && (
                  <div className="bg-blue-50/30 border border-blue-200/50 rounded-2xl p-4 mb-2 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <History className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Filas de Consumo Ativas (PEPS)</span>
                    </div>
                    
                    <div className="space-y-2">
                      {batches.slice(0, 3).map((batch, idx) => (
                        <div 
                          key={batch.id} 
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                            idx === 0 ? 'bg-white border-blue-200 shadow-sm' : 'bg-white/40 border-dashed opacity-70'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-600">
                              {idx === 0 ? '✦ EM USO' : `LOTE #${batches.length - idx}`}
                            </span>
                            <span className="text-[9px] text-muted-foreground">Entrada: {new Date(batch.createdAt).toLocaleDateString()}</span>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] uppercase font-black text-slate-400">Saldo</span>
                              <span className="text-xs font-bold text-slate-700">
                                {batch.quantityRemaining.toFixed(2)} {watch('unit')} 
                              </span>
                            </div>
                            
                            <div className="flex flex-col items-end border-l pl-3 border-slate-200">
                              <span className="text-[9px] uppercase font-black text-slate-400">Custo</span>
                              <span className="text-xs font-black text-blue-600">R$ {batch.unitCost.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {batches.length > 3 && (
                        <p className="text-[9px] text-center text-muted-foreground font-medium pt-1 italic">+ {batches.length - 3} outros lotes na fila</p>
                      )}
                    </div>
                  </div>
                )}

            </form>
          )}

          {activeTab === 'movimentar' && selectedMaterial && (
            <InventoryAdjustment 
              materialId={selectedMaterial.id}
              unit={selectedMaterial.unit}
              purchaseUnit={selectedMaterial.purchaseUnit || 'UN'}
              multiplier={selectedMaterial.multiplicador_padrao_entrada || 1}
              conversionFactor={selectedMaterial.conversionFactor || 1}
              currentStock={Number(selectedMaterial.currentStock ?? 0)}
              averageCost={Number(selectedMaterial.averageCost ?? 0)}
              minStock={selectedMaterial.minStockQuantity || undefined}
              onDiscardOffcut={handleDiscardOffcut}
              onSuccess={() => {
                // Recarregar dados do material para atualizar o saldo na UI
                const load = async () => {
                  const resp = await api.get(`/api/catalog/materials/${selectedMaterial.id}`);
                  setSelectedMaterial(resp.data.data);
                };
                load();
              }}
            />
          )}

          {activeTab === 'historico' && selectedMaterial && (
            <MovementHistory 
              materialId={selectedMaterial.id} 
              unit={selectedMaterial.unit} 
              conversionFactor={selectedMaterial.conversionFactor || 1}
              limit={50}
              onRefresh={() => {
                const load = async () => {
                  const resp = await api.get(`/api/catalog/materials/${selectedMaterial.id}`);
                  setSelectedMaterial(resp.data.data);
                };
                load();
              }}
            />
          )}
        </div>

        <div className="p-6 border-t bg-muted/20 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-12 uppercase font-black text-xs">Cancelar</Button>
          
          {activeTab === 'cadastro' && (
            hasNext ? (
              <Button 
                  onClick={handleSubmit((d) => onSubmit(d, true), onError)} 
                  className="flex-[2] h-12 bg-primary text-primary-foreground uppercase font-black text-xs shadow-lg shadow-primary/20 group"
              >
                  Salvar e Próximo
                  <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            ) : (
              <Button form="material-form" type="submit" className="flex-[2] h-12 bg-primary text-primary-foreground uppercase font-black text-xs shadow-lg shadow-primary/20">
                Confirmar Cadastro
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

const Settings2 = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
