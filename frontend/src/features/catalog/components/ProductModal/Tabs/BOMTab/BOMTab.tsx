import React, { useState } from 'react';
import { Package, Plus, Trash2, Info, Layers, Settings, Ruler, Check, X as CloseIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/Combobox';
import { useInsumos } from '@/features/insumos/useInsumos';
import { DraftBOMItem, DraftVariationGroup } from '../../types';
import { nanoid } from 'nanoid';

interface BOMTabProps {
  productName: string;
  items: DraftBOMItem[];
  variationGroups: DraftVariationGroup[];
  targetMarkup?: number;
  onChange: (items: DraftBOMItem[]) => void;
}

export const BOMTab: React.FC<BOMTabProps> = ({ productName, items, variationGroups, targetMarkup, onChange }) => {
  const { insumos } = useInsumos();
  const [showAddForm, setShowAddForm] = useState(false);

  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [slotName, setSlotName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [qty, setQty] = useState('1');
  const [itemsPerUnit, setItemsPerUnit] = useState('1');
  const [isSlot, setIsSlot] = useState(false);

  const resetForm = () => {
    setSelectedMaterialId('');
    setSlotName('');
    setSelectedGroup('');
    setQty('1');
    setItemsPerUnit('1');
    setIsSlot(false);
    setShowAddForm(false);
  };

  const handleAdd = () => {
    const ipu = parseFloat(itemsPerUnit) || 1;
    const quantity = parseFloat(qty) || 1;

    if (isSlot) {
      if (!slotName.trim() || !selectedGroup) return;
      const newItem: DraftBOMItem = {
        id: nanoid(),
        materialId: null,
        materialName: `${slotName.trim()} (Variável)`,
        unit: 'un',
        quantity,
        itemsPerUnit: ipu,
        costPerUnit: 0,
        effectiveCost: 0,
        subtotal: 0,
        isFixed: false,
        configurationGroupId: selectedGroup,
      };
      onChange([...items, newItem]);
    } else {
      const material = insumos.find((i) => i.id === selectedMaterialId);
      if (!material) {
        alert('Selecione um material!');
        return;
      }
      // useInsumos mapeia costPerUnit → custoUnitario
      const costPerUnit = Number((material as any).custoUnitario || (material as any).costPerUnit || (material as any).averageCost || 0);
      const effectiveCost = costPerUnit / ipu;

      const newItem: DraftBOMItem = {
        id: nanoid(),
        materialId: selectedMaterialId,
        materialName: (material as any).name || (material as any).nome,
        unit: (material as any).unit || (material as any).unidadeBase,
        quantity,
        itemsPerUnit: ipu,
        costPerUnit,
        effectiveCost,
        subtotal: effectiveCost * quantity,
        isFixed: true,
      };
      onChange([...items, newItem]);
    }
    resetForm();
  };

  const handleRemove = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };

  const updateQty = (id: string, newQty: number) => {
    onChange(items.map((i) => i.id === id
      ? { ...i, quantity: newQty, subtotal: i.effectiveCost * newQty }
      : i
    ));
  };

  const updateItemsPerUnit = (id: string, newIpu: number) => {
    onChange(items.map((i) => {
      if (i.id !== id) return i;
      const eff = i.costPerUnit / (newIpu || 1);
      return { ...i, itemsPerUnit: newIpu || 1, effectiveCost: eff, subtotal: eff * i.quantity };
    }));
  };

  const fixedItems = items.filter((i) => i.isFixed);
  const slotItems = items.filter((i) => !i.isFixed);
  
  // Calcular o custo de previsão, igual ao render!
  const computedItems = items.map(item => {
    let displayCost = item.effectiveCost;
    if (!item.isFixed && item.configurationGroupId) {
      const group = variationGroups.find(g => g.id === item.configurationGroupId);
      if (group && group.options.length > 0) {
        const matCosts = group.options
          .filter(o => o.materialId)
          .map(o => {
            const m = insumos.find(ins => ins.id === o.materialId);
            if (!m) return 0;
            return Number((m as any).custoUnitario || (m as any).costPerUnit || (m as any).averageCost || 0);
          })
          .filter(c => c > 0);
          
        if (matCosts.length > 0) {
          const minCost = Math.min(...matCosts);
          displayCost = minCost / (item.itemsPerUnit || 1);
        }
      }
    }
    return { ...item, effectiveCost: displayCost, subtotal: displayCost * item.quantity };
  });

  const totalCost = computedItems.reduce((sum, i) => sum + i.subtotal, 0);

  const canConfirm = isSlot
    ? (slotName.trim().length > 0 && selectedGroup !== "")
    : (selectedMaterialId !== "");

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-300 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Ficha Técnica Base (BOM)</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Defina o que compõe {productName || '...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Custo Total</p>
            <p className="text-sm font-black text-slate-800">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCost)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase text-emerald-500 tracking-wider">Venda Sugerida</p>
            <p className="text-sm font-black text-emerald-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCost * (targetMarkup || 1))}
            </p>
          </div>
          <Button onClick={() => setShowAddForm(true)} className="rounded-xl font-bold shadow-md shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" /> Adicionar Item
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="border-2 border-indigo-100 bg-indigo-50/30 overflow-hidden shrink-0 animate-in slide-in-from-top duration-200">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase text-indigo-700">
                  {isSlot ? 'Nome do Slot' : 'Material do Estoque'}
                </Label>
                {isSlot ? (
                  <Input
                    autoFocus
                    value={slotName}
                    onChange={(e) => setSlotName(e.target.value)}
                    placeholder="Ex: Carcaça, Tampa, Acabamento..."
                    className="h-10 font-bold border-2 focus:border-indigo-400 bg-white"
                  />
                ) : (
                  <Combobox
                    value={selectedMaterialId}
                    onChange={setSelectedMaterialId}
                    placeholder="Buscar material..."
                    options={insumos.map((i) => ({
                      id: i.id,
                      label: (i as any).name || (i as any).nome,
                      sublabel: `${(i as any).unit || (i as any).unidadeBase} • R$ ${Number((i as any).custoUnitario || (i as any).costPerUnit || (i as any).averageCost || 0).toFixed(2)}`,
                    }))}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-indigo-700">Qtd. Base</Label>
                <Input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="h-10 font-black border-2 focus:border-indigo-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-indigo-700">
                  Rendimento (itens/unid.)
                  <span className="ml-1 text-[8px] text-indigo-400 normal-case">(1 folha = N peças)</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={itemsPerUnit}
                  onChange={(e) => setItemsPerUnit(e.target.value)}
                  className="h-10 font-black border-2 focus:border-indigo-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-indigo-100">
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setIsSlot(!isSlot)}
                    className={cn('w-10 h-5 rounded-full transition-all flex items-center p-1', isSlot ? 'bg-indigo-600' : 'bg-slate-300')}
                  >
                    <div className={cn('w-3 h-3 bg-white rounded-full transition-all', isSlot ? 'translate-x-5' : 'translate-x-0')} />
                  </div>
                  <span className="text-xs font-black text-indigo-900 uppercase tracking-tighter">Item SLOT (vinculado a variação)</span>
                </label>

                {isSlot && (
                  <div className="animate-in slide-in-from-left-4 flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-indigo-400" />
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      className="text-[10px] font-black uppercase bg-white border-2 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400"
                    >
                      <option value="">Vincular a Grupo...</option>
                      {variationGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={resetForm} className="text-indigo-600 font-bold">Cancelar</Button>
                <Button onClick={handleAdd} disabled={!canConfirm} className="bg-indigo-600 hover:bg-indigo-700 font-black disabled:opacity-50">
                  Confirmar Item
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items List */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-2 pb-8">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-20 opacity-30 border-4 border-dashed rounded-3xl">
            <Package className="w-16 h-16 mb-4" />
            <p className="font-black uppercase tracking-widest text-lg">Ficha técnica vazia</p>
            <p className="text-xs font-bold mt-1">Adicione materiais fixos ou slots para variações</p>
          </div>
        ) : (
          <>
            {fixedItems.length > 0 && (
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" /> Itens Fixos (Sempre incluídos)
                </h4>
                {fixedItems.map((item) => (
                  <BOMCard 
                    key={item.id} 
                    item={item} 
                    targetMarkup={targetMarkup || 1} 
                    onRemove={handleRemove} 
                    onQtyChange={updateQty} 
                    onIpuChange={updateItemsPerUnit} 
                  />
                ))}
              </div>
            )}
            {slotItems.length > 0 && (
              <div className="space-y-3 pt-4">
                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 px-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" /> Slots Variáveis (Por Variação Selecionada)
                </h4>
                {computedItems.filter(i => !i.isFixed).map((item) => (
                  <BOMCard 
                    key={item.id} 
                    item={item} 
                    targetMarkup={targetMarkup || 1} 
                    onRemove={handleRemove} 
                    onQtyChange={updateQty} 
                    onIpuChange={updateItemsPerUnit} 
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 border border-blue-100 shrink-0">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase tracking-tighter">
          O campo <strong>Rendimento</strong> define quantas peças saem de uma unidade do material (ex: 1 folha A3 = 4 cartões).
          <span className="block mt-1 text-blue-500 font-medium normal-case">
            O custo efetivo = Custo do Material ÷ Rendimento. Todas as alterações são salvas ao clicar em "Salvar" no rodapé.
          </span>
        </p>
      </div>
    </div>
  );
};

// ─── BOM Card ─────────────────────────────────────────────────────────────────
const BOMCard = ({
  item,
  targetMarkup,
  onRemove,
  onQtyChange,
  onIpuChange,
}: {
  item: DraftBOMItem;
  targetMarkup: number;
  onRemove: (id: string) => void;
  onQtyChange: (id: string, qty: number) => void;
  onIpuChange: (id: string, ipu: number) => void;
}) => {
  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcWidth, setCalcWidth] = useState('0');
  const [calcHeight, setCalcHeight] = useState('0');

  // Determinar se o material é baseado em área (M2)
  const isAreaUnit = item.unit?.toLowerCase().includes('m²') || item.unit?.toLowerCase().includes('m2');

  const applyCalculation = () => {
    const w = parseFloat(calcWidth) || 0;
    const h = parseFloat(calcHeight) || 0;
    if (w > 0 && h > 0) {
      const areaM2 = (w * h) / 1000000;
      onQtyChange(item.id, areaM2);
    }
    setShowCalculator(false);
  };

  return (
    <div className={cn(
      'p-4 flex flex-col gap-3 group bg-white rounded-2xl border-2 transition-all hover:shadow-md',
      item.isFixed ? 'border-blue-100 hover:border-blue-200' : 'border-indigo-100 hover:border-indigo-200'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            item.isFixed ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'
          )}>
            {item.isFixed ? <Package className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
          </div>
          <div>
            <h5 className="text-sm font-black text-slate-800">{item.materialName}</h5>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                {item.unit}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                Custo unit.: {fmt(item.effectiveCost)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Quantity with Calculator */}
          <div className="text-center">
            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Qtd.</p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                step="0.0001"
                value={item.quantity}
                onChange={(e) => onQtyChange(item.id, parseFloat(e.target.value) || 0)}
                className="w-20 h-8 border rounded-lg text-center text-xs font-black focus:outline-none focus:border-indigo-400"
              />
              {isAreaUnit && (
                <button
                  type="button"
                  onClick={() => setShowCalculator(!showCalculator)}
                  className={cn(
                    "p-1.5 rounded-lg border transition-colors",
                    showCalculator ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-400 hover:bg-slate-50 border-slate-200"
                  )}
                  title="Calcular área (Largura x Altura)"
                >
                  <Ruler className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Items-per-unit inline edit */}
          <div className="text-center">
            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Rend.</p>
            <input
              type="number"
              min={1}
              value={item.itemsPerUnit}
              onChange={(e) => onIpuChange(item.id, parseFloat(e.target.value) || 1)}
              className="w-16 h-8 border rounded-lg text-center text-xs font-black focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Subtotal Cost */}
          <div className="text-right min-w-[90px]">
            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Custo Total</p>
            <p className="text-xs font-bold text-slate-500">{fmt(item.subtotal)}</p>
          </div>

          {/* Subtotal Sale (Target) */}
          <div className="text-right min-w-[100px] bg-emerald-50/50 p-2 rounded-xl border border-emerald-100/50">
            <p className="text-[9px] font-black uppercase text-emerald-600 mb-1">Venda Sugerida</p>
            <p className="text-sm font-black text-emerald-700">{fmt(item.subtotal * targetMarkup)}</p>
          </div>

          <button
            onClick={() => onRemove(item.id)}
            className="p-2 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-300"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row-level Calculator Panel */}
      {showCalculator && (
        <div className="flex items-center gap-4 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Label className="text-[9px] font-black text-indigo-700 uppercase">Largura (mm)</Label>
            <input
              type="number"
              value={calcWidth}
              onChange={(e) => setCalcWidth(e.target.value)}
              className="w-16 h-7 text-xs font-bold border rounded bg-white text-center"
            />
          </div>
          <div className="text-slate-300 text-xs font-bold">×</div>
          <div className="flex items-center gap-2">
            <Label className="text-[9px] font-black text-indigo-700 uppercase">Altura (mm)</Label>
            <input
              type="number"
              value={calcHeight}
              onChange={(e) => setCalcHeight(e.target.value)}
              className="w-16 h-7 text-xs font-bold border rounded bg-white text-center"
            />
          </div>
          <div className="flex-1" />
          <div className="flex gap-1">
            <button onClick={() => setShowCalculator(false)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg">
              <CloseIcon className="w-4 h-4" />
            </button>
            <button onClick={applyCalculation} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
