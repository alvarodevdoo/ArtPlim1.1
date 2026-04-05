import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { X, Package, ArrowUpCircle, History, Save, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Combobox } from '@/components/ui/Combobox';
import { 
  ProductiveIntelligence, 
  type ProductiveIntelligenceData, 
  type ControlUnit, 
  type ConsumptionRule 
} from '@/components/catalog/ProductiveIntelligence/ProductiveIntelligence';
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
  ncm?: string;
  ean?: string;
  currentStock?: number;
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
  const [movements, setMovements] = useState<any[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  const { control, handleSubmit, register, reset, watch } = useForm({
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
    }
  });

  const [productiveData, setProductiveData] = useState<ProductiveIntelligenceData>({
    controlUnit: 'M2',
    defaultConsumptionRule: 'PRODUCT_AREA',
    conversionFactor: 1,
    width: 0,
    height: 0,
  });

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
          });
          setProductiveData({
            controlUnit: initialData.controlUnit || 'M2',
            defaultConsumptionRule: initialData.defaultConsumptionRule || 'PRODUCT_AREA',
            conversionFactor: initialData.conversionFactor ?? 1,
            width: initialData.width || 0,
            height: initialData.height || 0,
          });
        } else {
          reset({
            name: '', categoryId: '', description: '', format: 'SHEET',
            costPerUnit: '', unit: 'm²',
            minStockQuantity: '', sellWithoutStock: true, trackStock: true,
            ncm: '', ean: ''
          });
          setProductiveData({ controlUnit: 'M2', defaultConsumptionRule: 'PRODUCT_AREA', conversionFactor: 1, width: 0, height: 0 });
        }
        setSelectedMaterial(null);
        return;
      }

      try {
        const resp = await api.get(`/api/catalog/materials/${materialId}`);
        const full = resp.data.data;
        setSelectedMaterial(full);
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
        });
        setProductiveData({
          controlUnit: full.controlUnit || 'M2',
          defaultConsumptionRule: full.defaultConsumptionRule || 'PRODUCT_AREA',
          conversionFactor: full.conversionFactor ?? 1,
          width: full.width ?? 0,
          height: full.height ?? 0,
        });
        loadHistory(materialId);
      } catch (err) {
        toast.error('Erro ao carregar detalhes.');
      }
    };

    if (isOpen) loadMaterial();
  }, [isOpen, materialId, initialData, reset]);


  const loadHistory = async (id: string) => {
    try {
      const resp = await api.get(`/api/wms/stock-movements?materialId=${id}&limit=50`);
      setMovements(resp.data.data || []);
    } catch (e) {}
  };

  const onSubmit = async (formData: any, andNext = false) => {
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
            { id: 'cadastro', label: 'Cadastro', icon: Save },
            { id: 'movimentar', label: 'Ajuste Estoque', icon: ArrowUpCircle, disabled: !materialId && !selectedMaterial },
            { id: 'historico', label: 'Logs / Histórico', icon: History, disabled: !materialId && !selectedMaterial }
          ].map(t => (
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
            <form id="material-form" onSubmit={handleSubmit((d) => onSubmit(d))} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <section className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Nome Comercial</label>
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
                  <Controller control={control} name="categoryId" render={({ field }) => (
                    <Combobox 
                      value={field.value} 
                      onChange={field.onChange} 
                      options={categories.map(c => ({ id: c.id, label: c.name }))}
                      placeholder="Selecione a categoria..."
                    />
                  )} />
                  <p className="text-[9px] text-muted-foreground px-1 italic">* Define as contas contábeis padrão para este item.</p>
                </div>

                <div className="bg-muted/20 rounded-2xl p-4 border border-dashed border-primary/20">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings2 className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-tighter">Inteligência de Cálculo</h3>
                  </div>
                  <ProductiveIntelligence value={productiveData} onChange={setProductiveData} format={watch('format')} />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Custo Unitário (Base)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                      <Input type="number" step="0.0001" {...register('costPerUnit')} className="h-11 pl-9 font-bold text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Estoque de Alerta (Mín)</label>
                    <Input type="number" {...register('minStockQuantity')} className="h-11 font-bold" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <div className="space-y-0.5">
                    <p className="text-xs font-black uppercase">Monitoramento Ativo</p>
                    <p className="text-[10px] text-muted-foreground">Gerir saldo no WMS e lançar no Plano de Contas.</p>
                  </div>
                  <Controller control={control} name="trackStock" render={({ field }) => (
                    <input type="checkbox" className="w-5 h-5 rounded border-primary transition-all cursor-pointer" checked={field.value} onChange={e => field.onChange(e.target.checked)} />
                  )} />
                </div>

              </div>
            </form>
          )}

          {activeTab === 'movimentar' && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
               <ArrowUpCircle className="w-12 h-12" />
               <p className="text-sm font-medium">Lógica de Ajuste Manual será migrada em breve para este componente unificado.</p>
            </div>
          )}

          {activeTab === 'historico' && (
            <div className="space-y-4">
              {movements.map((m: any) => (
                <div key={m.id} className="p-3 bg-muted/20 rounded-lg border flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold">{m.type === 'INPUT' ? 'Entrada' : 'Saída'}</p>
                    <p className="text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</p>
                  </div>
                  <p className={cn("font-black text-sm", m.type === 'INPUT' ? "text-green-500" : "text-red-500")}>
                    {m.type === 'INPUT' ? '+' : '-'}{m.quantity} {selectedMaterial?.unit}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-muted/20 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-12 uppercase font-black text-xs">Cancelar</Button>
          
          {hasNext ? (
             <Button 
                onClick={handleSubmit((d) => onSubmit(d, true))} 
                className="flex-[2] h-12 bg-primary text-primary-foreground uppercase font-black text-xs shadow-lg shadow-primary/20 group"
             >
                Salvar e Próximo
                <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </Button>
          ) : (
            <Button form="material-form" type="submit" className="flex-[2] h-12 bg-primary text-primary-foreground uppercase font-black text-xs shadow-lg shadow-primary/20">
              Confirmar Cadastro
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const Settings2 = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
