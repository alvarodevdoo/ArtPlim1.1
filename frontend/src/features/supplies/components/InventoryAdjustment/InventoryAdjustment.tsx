import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { 
  ArrowUpCircle, 
  History, 
  Plus, 
  Minus, 
  RefreshCw, 
  AlertCircle, 
  Trash2, 
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  Calculator,
  Zap
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MovementHistory } from './MovementHistory';
import styles from './InventoryAdjustment.module.scss';

interface Props {
  materialId: string;
  unit: string;
  purchaseUnit: string;
  multiplier: number;
  conversionFactor: number;
  currentStock: number;
  averageCost: number;
  minStock?: number;
  onSuccess?: () => void;
  onDiscardOffcut?: (quantityToDiscard: number) => void;
}

type AdjustmentType = 'ENTRY' | 'INTERNAL_CONSUMPTION' | 'ADJUSTMENT';

interface AdjustmentFormData {
  type: AdjustmentType;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes: string;
  justification: string;
  file?: File;
}

export const InventoryAdjustment: React.FC<Props> = ({ 
  materialId, 
  unit, 
  purchaseUnit,
  multiplier,
  conversionFactor,
  currentStock: initialStock, 
  averageCost: initialCost,
  minStock,
  onSuccess,
  onDiscardOffcut 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshHistory, setRefreshHistory] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [entryMode, setEntryUnit] = useState<'purchase' | 'control'>('purchase');
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<AdjustmentFormData>({
    defaultValues: {
      type: 'ENTRY',
      quantity: 0,
      unitCost: 0,
      totalCost: 0,
      notes: '',
      justification: ''
    }
  });

  const watchType = watch('type');
  const watchQty = watch('quantity');
  const watchUnitCost = watch('unitCost');

  const parseSafe = (val: any) => {
    if (val === undefined || val === null || val === '') return 0;
    const str = val.toString().replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const handleModeSwitch = (newMode: 'purchase' | 'control') => {
    if (newMode === entryMode) return;
    
    const currentQty = parseSafe(watchQty);
    const currentUnitCost = parseSafe(watchUnitCost);
    const totalCost = currentQty * currentUnitCost;
    const factor = parseSafe(multiplier) * parseSafe(conversionFactor);

    if (newMode === 'control') {
      // UN -> M2
      const newQty = currentQty * factor;
      // Para manter o total exato (ex: 156), o novo unitCost deve ser totalCost / newQty
      const newUnitCost = totalCost / (newQty || 1);
      
      setValue('quantity', Number(newQty.toFixed(6)));
      setValue('unitCost', Number(newUnitCost.toFixed(6)));
    } else {
      // M2 -> UN
      const newQty = currentQty / (factor || 1);
      const newUnitCost = totalCost / (newQty || 1);
      
      setValue('quantity', Number(newQty.toFixed(6)));
      setValue('unitCost', Number(newUnitCost.toFixed(6)));
    }

    setEntryUnit(newMode);
  };

  // Projeção em Tempo Real
  const currentStockValue = parseSafe(initialStock);
  const factorValue = parseSafe(conversionFactor);
  
  // Projeção em Tempo Real
  const isMeasurementUnit = ['M2', 'M', 'ML'].includes(unit.toUpperCase());
  
  // Carregar lotes via PEPS
  const fetchBatches = async () => {
    try {
      const resp = await api.get(`/api/insumos/${materialId}/batches`);
      setBatches(resp.data.data || []);
    } catch (err) {
      console.error('Erro ao carregar lotes:', err);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [materialId]);

  // Projeção em Tempo Real
  let projectedStock = currentStockValue;
  const inputQty = parseSafe(watchQty);
  
  if (watchType === 'ENTRY') {
    // Se for entrada em modo compra, precisamos saber quanto isso adiciona à unidade de controle
    if (entryMode === 'purchase') {
      const internalUnitsCount = inputQty * parseSafe(multiplier);
      const qtyToAdd = isMeasurementUnit ? internalUnitsCount * factorValue : internalUnitsCount;
      projectedStock = currentStockValue + qtyToAdd;
    } else {
      projectedStock = currentStockValue + inputQty;
    }
  } else if (watchType === 'INTERNAL_CONSUMPTION') {
    projectedStock = currentStockValue - inputQty;
  } else if (watchType === 'ADJUSTMENT') {
    projectedStock = inputQty;
  }

  // Se a unidade de controle é medida (M2, M, ML), dividimos pela área da peça para ter total de peças
  // Se a unidade já é contagem (CH, UN), total de peças é o próprio saldo
  const totalPieces = isMeasurementUnit ? (projectedStock / (factorValue || 1)) : projectedStock;
  
  // Para saber quantas chapas inteiras, dividimos o total de peças pelo multiplicador
  // Proteção contra valores negativos no monitor
  const unitsInBoards = Math.max(0, totalPieces / (parseSafe(multiplier) || 1));
  
  const wholeUnits = Math.min(1000000, Math.floor(unitsInBoards + 0.00001)); 
  const fractionalPart = Math.max(0, unitsInBoards - wholeUnits); 
  const consumptionPercent = Math.min(100, fractionalPart > 0.00001 ? Math.round((1 - fractionalPart) * 100) : 0);
  const hasOffcut = fractionalPart > 0.00001;

  // Ajustar campos ao mudar o tipo
  useEffect(() => {
    if (watchType === 'INTERNAL_CONSUMPTION') {
      setEntryUnit('control');
      setValue('unitCost', initialCost);
    } else if (watchType === 'ADJUSTMENT') {
      setEntryUnit('control');
      setValue('quantity', initialStock);
      setValue('unitCost', initialCost);
    } else if (watchType === 'ENTRY') {
      // Ao mudar para Entrada, voltamos para o modo compra por padrão
      setEntryUnit('purchase');
      // Sugerir o custo médio atual em vez de zero para facilitar o preenchimento
      setValue('unitCost', initialCost);
      setValue('quantity', 0);
    }
  }, [watchType, initialStock, initialCost, setValue]);

  // Cálculo automático do valor total e unitário interno
  useEffect(() => {
    const qty = parseFloat(watchQty?.toString()) || 0;
    const cost = parseFloat(watchUnitCost?.toString()) || 0;
    
    // Valor total sempre é qty * cost (independente da unidade informada)
    const total = Number((qty * cost).toFixed(2));
    setValue('totalCost', total);
  }, [watchQty, watchUnitCost, setValue]);

  const handleEdit = (m: any) => {
    setEditingMovementId(m.id);
    setEntryUnit('control'); // Edição sempre em modo controle para evitar erros de conversão dupla
    reset({
      type: m.type,
      quantity: parseFloat(m.quantity),
      unitCost: parseFloat(m.unitCost),
      justification: `[CORREÇÃO do lançamento #${m.movementNumber || m.id.slice(0,8)}] ` + (m.justification || ''),
      notes: m.notes
    });
    // Scroll para o topo do formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info('Formulário preenchido com os dados do lançamento. Ao confirmar, o lançamento anterior será estornado automaticamente.');
  };

  const onSubmit = async (data: AdjustmentFormData) => {
    try {
      setIsSubmitting(true);
      
      // Se estiver editando, estornar o anterior primeiro
      if (editingMovementId) {
        await api.post(`/api/wms/movements/${editingMovementId}/cancel`, { 
          justification: `Estornado para correção (novo lançamento #${Date.now().toString().slice(-6)})` 
        });
      }

      let finalQty = data.quantity;
      let finalUnitCost = data.unitCost;

      // Se estiver no modo de compra, converter para unidades internas
      if (entryMode === 'purchase') {
        // 1 Unidade de compra gera [multiplier] unidades de estoque (ex: 1 chapa -> 4 pedaços)
        const internalUnitsCount = data.quantity * (multiplier || 1);
        
        // Só multiplicamos pela área se a unidade de controle (unit) for baseada em medida
        // Nota: Assumindo que 'M2', 'M', 'ML' são as unidades de medida padrão
        const isMeasurementUnit = ['M2', 'M', 'ML'].includes(unit.toUpperCase());
        
        // Se for CH/UN, finalQty é apenas a contagem. Se for M2, é contagem * área unitária.
        finalQty = isMeasurementUnit ? internalUnitsCount * (conversionFactor || 1) : internalUnitsCount;
        
        // O custo unitário interno é o Valor Total / Quantidade Final que efetivamente entrou no estoque
        finalUnitCost = data.totalCost / (finalQty || 1);
      }

      const formData = new FormData();
      formData.append('materialId', materialId);
      formData.append('type', data.type);
      formData.append('quantity', finalQty.toString());
      formData.append('unitCost', finalUnitCost.toString());
      formData.append('notes', data.notes);
      formData.append('justification', data.justification);
      if (file) formData.append('file', file);

      await api.post('/api/wms/movements/adjustment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(editingMovementId ? 'Lançamento corrigido com sucesso!' : 'Ajuste de estoque realizado com sucesso!');
      reset();
      setFile(null);
      setEditingMovementId(null);
      setRefreshHistory(prev => prev + 1);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao realizar ajuste');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Cabeçalho de Saldo Simplificado */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="uppercase tracking-widest text-[9px] font-black opacity-50 mb-1">Saldo Atual em Estoque</span>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-black text-primary">{initialStock.toFixed(3)} <small className="text-xs opacity-60">{unit}</small></h2>
            <span className="text-[10px] font-bold text-muted-foreground">— {(initialStock / (parseSafe(multiplier) || 1)).toFixed(2)} {purchaseUnit}s</span>
          </div>
        </div>
        <div className="text-right">
          <span className="uppercase tracking-widest text-[9px] font-black text-blue-600 mb-1">Custo do Lote Atual</span>
          <div className="font-black text-xl text-blue-700">
            R$ {batches[0]?.unitCost ? (batches[0].unitCost * (entryMode === 'purchase' ? multiplier : 1)).toFixed(2) : initialCost.toFixed(2)}
          </div>
        </div>
      </div>



      {/* Formulário de Ajuste */}
      <section className={styles.formSection}>
        <div className={styles.header}>
          <Plus size={14} className="text-primary" />
          <h3>Novo Ajuste Manual</h3>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.grid}>
          <div className={cn(styles.field, styles.fullWidth)}>
            <label>Tipo de Operação</label>
            <div className="flex gap-2">
              {[
                { id: 'ENTRY', label: 'Entrada / Compra', icon: Plus, color: 'text-green-500' },
                { id: 'INTERNAL_CONSUMPTION', label: 'Saída / Consumo', icon: Minus, color: 'text-red-500' },
                { id: 'ADJUSTMENT', label: 'Acerto de Saldo', icon: RefreshCw, color: 'text-yellow-600' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setValue('type', t.id as any)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase rounded-lg border-2 transition-all",
                    watchType === t.id 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <t.icon size={12} className={watchType === t.id ? 'text-primary' : t.color} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {watchType === 'ENTRY' && (
            <div className={cn(styles.field, styles.fullWidth)}>
              <label>Unidade de Entrada</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('purchase')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase rounded-lg border-2 transition-all",
                    entryMode === 'purchase' ? "bg-primary/10 border-primary text-primary" : "bg-muted/30 border-transparent text-muted-foreground"
                  )}
                >
                  Modo Compra ({purchaseUnit})
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('control')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase rounded-lg border-2 transition-all",
                    entryMode === 'control' ? "bg-primary/10 border-primary text-primary" : "bg-muted/30 border-transparent text-muted-foreground"
                  )}
                >
                  Modo Estoque ({unit})
                </button>
              </div>
            </div>
          )}

          {watchType !== 'ADJUSTMENT' && (
            <>
              <div className={styles.field}>
                <label>
                  {`Quantidade (${entryMode === 'purchase' ? purchaseUnit : unit})`}
                </label>
                <Input 
                  type="number" 
                  step="any"
                  {...register('quantity', { required: true, min: 0.0001 })} 
                  className={cn(errors.quantity && "border-red-500")}
                />
                {errors.quantity && <span className="text-[10px] text-red-500 font-bold block mt-1">Quantidade é obrigatória</span>}
              </div>

              <div className={styles.field}>
                <label>
                  {`Custo Unitário (R$ / ${entryMode === 'purchase' ? purchaseUnit : unit})`}
                </label>
                <Input 
                  type="number" 
                  step="0.0001"
                  readOnly={watchType === 'INTERNAL_CONSUMPTION'}
                  {...register('unitCost', { required: true })} 
                  className={cn(watchType === 'INTERNAL_CONSUMPTION' && "bg-muted opacity-70 cursor-not-allowed")}
                />
                {errors.unitCost && <span className="text-[10px] text-red-500 font-bold block mt-1">Custo é obrigatório</span>}
              </div>
            </>
          )}

          {watchType === 'ADJUSTMENT' && (
            <>
              <div className={styles.field}>
                <label>Novo Saldo Total</label>
                <Input 
                  type="number" 
                  step="any"
                  {...register('quantity', { required: true, min: 0.0001 })} 
                  className={cn(errors.quantity && "border-red-500")}
                />
              </div>

              <div className={styles.field}>
                <label>Novo Custo Médio (R$)</label>
                <Input 
                  type="number" 
                  step="0.0001"
                  {...register('unitCost', { required: true })} 
                  className={cn(errors.unitCost && "border-red-500")}
                />
              </div>
            </>
          )}

          {watchType === 'ENTRY' && entryMode === 'purchase' && (
            <div className={cn(styles.field, styles.fullWidth)}>
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary">
                  <RefreshCw size={12} className="animate-spin-slow" />
                  <span className="text-[9px] font-black uppercase">Conversão Automática</span>
                </div>
                <p className="text-[10px] font-medium text-muted-foreground leading-tight">
                  {Number(watchQty) || 0} {purchaseUnit} × {Number(multiplier) || 1} (fator) = {Number((Number(watchQty) || 0) * (Number(multiplier) || 1))} unidades internas.
                  <br/>
                  Totalizando: <strong className="text-primary">{Number(((Number(watchQty) || 0) * (Number(multiplier) || 1) * (Number(conversionFactor) || 1)).toFixed(4))} {unit}</strong> no estoque.
                </p>
              </div>
            </div>
          )}

          <div className={cn(styles.field, styles.fullWidth)}>
            <div className="p-3 bg-muted/30 rounded-xl flex items-center justify-between border border-dashed">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calculator size={14} />
                <span className="text-[10px] font-black uppercase">Valor Total da Operação</span>
              </div>
              <span className="text-sm font-black text-primary">
                R$ {watch('totalCost')?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className={cn(styles.field, styles.fullWidth)}>
            <label>Justificativa do Ajuste</label>
            <textarea 
              {...register('justification', { required: true })} 
              placeholder="Ex: Compra manual sem NF, Ajuste de inventário rotativo..."
              className={cn(errors.justification && "border-red-500")}
            />
            {errors.justification && <span className="text-[10px] text-red-500 font-bold block mt-1">A justificativa é obrigatória para este ajuste</span>}
          </div>

          <div className={cn(styles.field, styles.fullWidth)}>
            <label>Documento / Comprovante (Opcional)</label>
            {!file ? (
              <div className={styles.uploadArea} onClick={() => document.getElementById('adj-file')?.click()}>
                <Upload size={14} className="mr-2" />
                <p>Clique para anexar PDF ou Foto</p>
                <input 
                  id="adj-file"
                  type="file" 
                  className="hidden" 
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            ) : (
              <div className={styles.filePreview}>
                <FileText size={14} />
                <span className="flex-1 truncate">{file.name}</span>
                <button type="button" onClick={() => setFile(null)}><Trash2 size={12} /></button>
              </div>
            )}
          </div>

          <div className={cn("pt-2", styles.fullWidth)}>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full h-11 bg-primary text-primary-foreground font-black uppercase text-xs rounded-xl shadow-lg shadow-primary/20"
            >
              {isSubmitting ? 'Processando...' : 'Confirmar Ajuste'}
            </Button>
          </div>
        </form>
      </section>

      {/* Histórico Recente */}
      <MovementHistory 
        materialId={materialId} 
        unit={unit} 
        conversionFactor={conversionFactor}
        limit={10} 
        refreshTrigger={refreshHistory}
        onRefresh={onSuccess}
        onEdit={handleEdit}
      />
    </div>
  );
};
