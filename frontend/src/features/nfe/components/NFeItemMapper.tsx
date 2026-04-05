import React, { useState } from 'react';
import { PlusCircle, CheckCircle2, ChevronRight, LayoutList, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { Checkbox } from '@/components/ui/Checkbox';
import { NFeData, NFeItem } from '../types';
import { NFeBulkActions } from './NFeBulkActions';
import { MaterialDrawer, type Material } from '@/features/insumos/components/MaterialDrawer';
import { cn } from '@/lib/utils';

interface NFeItemMapperProps {
  nfeData: NFeData;
  isLoading: boolean;
  selectedIndexes: number[];
  availableMaterials: { id: string; name: string; category: string }[];
  onImport: () => void;
  onToggleNew: (index: number) => void;
  onBindExisting: (index: number, materialId: string) => void;
  onToggleSkip: (index: number) => void;
  onToggleSelect: (index: number) => void;
  onSelectAll: (action: 'ALL' | 'NONE') => void;
  onBulkUpdate: (data: Partial<NFeItem>) => void;
  onSetDistributionMode: (mode: 'STRICT' | 'REDISTRIBUTE') => void;
  categories: any[];
}

export const NFeItemMapper: React.FC<NFeItemMapperProps> = ({
  nfeData,
  isLoading,
  selectedIndexes,
  availableMaterials,
  onImport,
  onToggleNew,
  onBindExisting,
  onToggleSkip,
  onToggleSelect,
  onSelectAll,
  onBulkUpdate,
  onSetDistributionMode,
  categories
}) => {
  const [drawerConfig, setDrawerConfig] = useState<{ isOpen: boolean; index: number | null }>({
    isOpen: false,
    index: null
  });

  const distributionMode = nfeData.costDistributionMode || 'STRICT';
  
  const allSelected = selectedIndexes.length === nfeData.items.length;
  const partialSelected = selectedIndexes.length > 0 && selectedIndexes.length < nfeData.items.length;

  const handleRowClick = (index: number) => {
    setDrawerConfig({ isOpen: true, index });
  };

  const getInitialData = (item: NFeItem): Partial<Material> => ({
    name: item.descricao,
    costPerUnit: item.custoEfetivoUnitario || item.valorUnitario,
    unit: item.unidade,
    ncm: item.ncm,
    ean: item.ean,
    categoryId: categories.find(c => c.name.toLowerCase().includes('mídia'))?.id || categories[0]?.id || '',
    trackStock: true,
  });

  return (
    <Card className="shadow-2xl border-0 overflow-hidden flex flex-col bg-slate-50/50">
      <CardHeader className="bg-slate-900 text-white shrink-0 py-8 px-8">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
               <LayoutList className="w-5 h-5 text-primary" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Workflow de Entrada</span>
            </div>
            <CardTitle className="text-3xl font-black tracking-tight">Mapeamento de Insumos</CardTitle>
            <CardDescription className="text-slate-400 text-sm max-w-lg">
              Trate cada item da nota com inteligência. Vincule a insumos existentes ou crie novos com preenchimento automático.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-4">
             <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button 
                  onClick={() => onSetDistributionMode('STRICT')}
                  className={cn("px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all", distributionMode === 'STRICT' ? "bg-white text-slate-900 shadow-lg" : "text-slate-400 hover:text-white")}
                >
                  Strict Mode
                </button>
                <button 
                  onClick={() => onSetDistributionMode('REDISTRIBUTE')}
                  className={cn("px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all", distributionMode === 'REDISTRIBUTE' ? "bg-white text-slate-900 shadow-lg" : "text-slate-400 hover:text-white")}
                >
                  Redistribuir Frete/Imp
                </button>
             </div>
             <Button onClick={onImport} disabled={isLoading} className="bg-primary hover:bg-primary/90 h-14 px-10 text-primary-foreground font-black uppercase text-xs tracking-widest shadow-2xl shadow-primary/20">
               <CheckCircle2 className="mr-2 w-5 h-5" /> Importar para o Sistema
             </Button>
          </div>
        </div>
      </CardHeader>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <table className="w-full text-left border-separate border-spacing-y-3">
          <thead>
            <tr className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
              <th className="px-4 py-2 w-10">
                <Checkbox 
                  checked={allSelected ? true : partialSelected ? "indeterminate" : false}
                  onCheckedChange={() => onSelectAll(allSelected ? 'NONE' : 'ALL')}
                />
              </th>
              <th className="px-4 py-2 w-16 text-center">Nº</th>
              <th className="px-4 py-2">Descrição do Fornecedor</th>
              <th className="px-4 py-2 text-center">Quantitativo</th>
              <th className="px-4 py-2">Ação Sugerida / Vínculo</th>
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {nfeData.items.map((item, idx) => {
              const isSelected = selectedIndexes.includes(idx);
              const isMapped = !!item.mappedMaterialId;
              const isNew = item.createNew;
              const isSkip = item.skip;

              return (
                <tr 
                  key={idx} 
                  onClick={() => handleRowClick(idx)}
                  className={cn(
                    "group cursor-pointer transition-all duration-200",
                    isSelected ? "translate-x-1" : ""
                  )}
                >
                  <td className={cn(
                    "px-4 py-4 rounded-l-2xl border-y border-l bg-white group-hover:bg-slate-50 transition-colors",
                    isSelected ? "border-primary/50 bg-primary/5" : "border-slate-100"
                  )} onClick={(e) => { e.stopPropagation(); onToggleSelect(idx); }}>
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(idx)}
                    />
                  </td>
                  <td className={cn(
                    "px-4 py-4 border-y bg-white group-hover:bg-slate-50 text-center transition-colors",
                    isSelected ? "border-primary/50 bg-primary/5" : "border-slate-100"
                  )}>
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{item.itemNumber}</span>
                  </td>
                  <td className={cn(
                    "px-4 py-4 border-y bg-white group-hover:bg-slate-50 transition-colors",
                    isSelected ? "border-primary/50 bg-primary/5" : "border-slate-100"
                  )}>
                    <div className="flex flex-col">
                      <span className={cn("font-bold text-sm", isSkip ? "text-slate-400 line-through" : "text-slate-800")}>
                        {item.descricao}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono uppercase">SKU: {item.codigo}</span>
                        {item.ean && <span className="text-[9px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-mono uppercase">EAN: {item.ean}</span>}
                      </div>
                    </div>
                  </td>
                  <td className={cn(
                    "px-4 py-4 border-y bg-white group-hover:bg-slate-50 text-center transition-colors",
                    isSelected ? "border-primary/50 bg-primary/5" : "border-slate-100"
                  )}>
                    <div className="flex flex-col items-center">
                       <span className="text-sm font-black text-slate-700">{item.quantidade} <span className="text-[10px] font-normal text-slate-400 uppercase">{item.unidade}</span></span>
                       <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full mt-1">
                          R$ {(item.custoEfetivoUnitario || item.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                       </span>
                    </div>
                  </td>
                  <td className={cn(
                    "px-4 py-4 border-y bg-white group-hover:bg-slate-50 transition-colors",
                    isSelected ? "border-primary/50 bg-primary/5" : "border-slate-100"
                  )} onClick={(e) => e.stopPropagation()}>
                    {isSkip ? (
                      <div className="flex items-center gap-2 text-red-500 bg-red-50 px-3 py-2 rounded-xl border border-red-100 animate-in fade-in zoom-in duration-300">
                        <Trash2 className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-tighter">Item Descartado</span>
                        <Button variant="ghost" size="sm" onClick={() => onToggleSkip(idx)} className="h-6 text-[9px] font-black uppercase underline hover:bg-transparent">Restaurar</Button>
                      </div>
                    ) : isNew ? (
                      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 animate-in fade-in zoom-in duration-300">
                        <PlusCircle className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-tighter">Novo p/ Catálogo</span>
                        <Button variant="ghost" size="sm" onClick={() => onToggleNew(idx)} className="h-6 text-[9px] font-black uppercase underline hover:bg-transparent">Mudar Vínculo</Button>
                      </div>
                    ) : isMapped ? (
                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-4 h-4" />
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black uppercase tracking-tighter leading-none opacity-60">Vinculado a:</span>
                           <span className="text-xs font-bold leading-tight">{availableMaterials.find(m => m.id === item.mappedMaterialId)?.name || 'Insumo Selecionado'}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => onBindExisting(idx, '')} className="h-6 text-[9px] font-black uppercase underline hover:bg-transparent ml-auto text-slate-400">Trocar</Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Combobox 
                          value="" 
                          onChange={(val) => onBindExisting(idx, val)} 
                          options={availableMaterials.map(m => ({ id: m.id, label: m.name, sublabel: m.category }))}
                          placeholder="Vincular agora..."
                          className="flex-1 h-10 rounded-xl"
                        />
                        <Button variant="outline" size="icon" onClick={() => onToggleNew(idx)} className="h-10 w-10 border-dashed rounded-xl text-blue-500 hover:bg-blue-50">
                          <PlusCircle className="w-5 h-5" />
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className={cn(
                    "px-4 py-4 rounded-r-2xl border-y border-r bg-white group-hover:bg-slate-50 transition-colors",
                    isSelected ? "border-primary/50 bg-primary/5" : "border-slate-100"
                  )}>
                    <ChevronRight className={cn("w-5 h-5 text-slate-300 group-hover:text-primary transition-all", isSelected && "text-primary translate-x-1")} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <NFeBulkActions 
        selectedCount={selectedIndexes.length}
        onClear={() => onSelectAll('NONE')}
        onBulkUpdate={onBulkUpdate}
        onBulkSkip={onToggleSkip as any}
        categories={categories}
      />

      {drawerConfig.isOpen && drawerConfig.index !== null && (
        <MaterialDrawer 
          isOpen={drawerConfig.isOpen}
          onClose={() => setDrawerConfig({ isOpen: false, index: null })}
          initialData={getInitialData(nfeData.items[drawerConfig.index])}
          hasNext={drawerConfig.index < nfeData.items.length - 1}
          onSaveAndNext={(newMaterial) => {
            onBindExisting(drawerConfig.index!, newMaterial.id);
            setDrawerConfig(prev => ({ 
              ...prev, 
              index: prev.index! + 1 
            }));
          }}
          onSuccess={(newMaterial) => {
             onBindExisting(drawerConfig.index!, newMaterial.id);
             setDrawerConfig({ isOpen: false, index: null });
          }}
        />
      )}
    </Card>
  );
};
