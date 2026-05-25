import React, { useState } from 'react';
import { PlusCircle, CheckCircle2, ChevronRight, Trash2, Info, AlertCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { Checkbox } from '@/components/ui/Checkbox';
import { NFeData, NFeItem } from '../types';
import { NFeBulkActions } from './NFeBulkActions';
import { MaterialDrawer, type Material } from '@/features/supplies/components/MaterialDrawer';
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
  onUpdateQuantity: (index: number, qty: number) => void;
  onUpdateNewItemField: (index: number, field: 'minStockQuantity' | 'width' | 'height', value: number | undefined) => void;
  onSetItemCategory: (index: number, categoryId: string) => void;
  onSetItemDimensionUnit: (index: number, unit: 'm' | 'cm' | 'mm') => void;
  onCopyNewItemDefaultsToSelected: (sourceIndex: number) => void;
  onBulkUpdate: (data: Partial<NFeItem>) => void;
  onSetDistributionMode: (mode: 'STRICT' | 'REDISTRIBUTE') => void;
  onSetExtraCost: (field: 'extraFreightCost' | 'extraTaxesCost' | 'extraOtherCost', value: number | undefined) => void;
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
  onUpdateQuantity,
  onUpdateNewItemField,
  onSetItemCategory,
  onSetItemDimensionUnit,
  onCopyNewItemDefaultsToSelected,
  onBulkUpdate,
  onSetDistributionMode,
  onSetExtraCost,
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

  const distributionHint = distributionMode === 'STRICT'
    ? 'Cada item mantém o custo exato do XML. Itens descartados não distribuem seus impostos/frete.'
    : 'Frete e impostos dos itens descartados são rateados entre os itens importados, proporcional ao valor.';

  // Agregados de frete e impostos a partir dos itens
  const taxes = nfeData.items.reduce(
    (acc, it) => {
      const c = it.custosAcessorios;
      if (c) {
        acc.frete += c.frete || 0;
        acc.ipi += c.ipi || 0;
        acc.st += c.st || 0;
        acc.difal += c.difal || 0;
      }
      return acc;
    },
    { frete: 0, ipi: 0, st: 0, difal: 0 }
  );

  // Quando o agregado por item de frete vier zerado, usar o total da nota como referência
  const freteTotal = taxes.frete > 0 ? taxes.frete : (nfeData.valorFrete || 0);
  const valorOutros = nfeData.valorOutros || 0;
  const valorDesconto = nfeData.valorDesconto || 0;
  const valorTotalProdutos = nfeData.valorTotalProdutos || 0;
  const valorTotalNota = nfeData.valorTotalNota || 0;

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const extraFreight = nfeData.extraFreightCost || 0;
  const extraTaxes = nfeData.extraTaxesCost || 0;
  const extraOther = nfeData.extraOtherCost || 0;
  const totalExtras = extraFreight + extraTaxes + extraOther;
  const valorTotalReal = valorTotalNota + totalExtras;

  const summaryEntries: Array<{ label: string; value: number; tone?: 'neutral' | 'amber' | 'red' | 'emerald' }> = [
    { label: 'Produtos', value: valorTotalProdutos },
    { label: 'Frete', value: freteTotal, tone: freteTotal > 0 ? 'amber' : 'neutral' },
    { label: 'IPI', value: taxes.ipi, tone: taxes.ipi > 0 ? 'amber' : 'neutral' },
    { label: 'ST', value: taxes.st, tone: taxes.st > 0 ? 'amber' : 'neutral' },
    { label: 'DIFAL', value: taxes.difal, tone: taxes.difal > 0 ? 'amber' : 'neutral' },
    { label: 'Outras Desp.', value: valorOutros, tone: valorOutros > 0 ? 'amber' : 'neutral' },
    { label: 'Descontos', value: valorDesconto, tone: valorDesconto > 0 ? 'red' : 'neutral' },
  ];

  return (
    <Card className="shadow-sm border-slate-200 overflow-hidden flex flex-col">
      <div className="shrink-0 px-6 py-5 border-b border-slate-100 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Mapeamento de Insumos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vincule cada item da nota a um insumo do catálogo ou crie um novo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Rateio de Custos</span>
                <span className="relative group">
                  <Info className="w-3 h-3 text-slate-400 cursor-help" />
                  <span className="absolute right-0 top-5 z-10 hidden group-hover:block w-64 p-2 text-[11px] font-normal normal-case tracking-normal text-slate-700 bg-white border border-slate-200 rounded-lg shadow-lg">
                    {distributionHint}
                  </span>
                </span>
              </div>
              <div className="inline-flex bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => onSetDistributionMode('STRICT')}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all",
                    distributionMode === 'STRICT'
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Custos Originais
                </button>
                <button
                  type="button"
                  onClick={() => onSetDistributionMode('REDISTRIBUTE')}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all",
                    distributionMode === 'REDISTRIBUTE'
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Ratear Descartados
                </button>
              </div>
            </div>

            <Button onClick={onImport} disabled={isLoading} className="h-10 px-5">
              <CheckCircle2 className="mr-2 w-4 h-4" /> Importar para o Sistema
            </Button>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-6 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {summaryEntries.map(entry => {
            const isZero = !entry.value;
            const toneClass =
              isZero ? 'text-slate-400'
                : entry.tone === 'amber' ? 'text-amber-700'
                : entry.tone === 'red' ? 'text-red-600'
                : entry.tone === 'emerald' ? 'text-emerald-700'
                : 'text-slate-700';
            return (
              <div key={entry.label} className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{entry.label}</span>
                <span className={cn('text-sm font-bold tabular-nums', toneClass)}>
                  R$ {fmt(entry.value)}
                </span>
              </div>
            );
          })}
          <div className="ml-auto flex flex-col items-end">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700/70">
              {totalExtras > 0 ? 'Total Real (com extras)' : 'Valor da Nota'}
            </span>
            <span className="text-lg font-black text-emerald-700 tabular-nums">
              R$ {fmt(valorTotalReal)}
            </span>
            {totalExtras > 0 && (
              <span className="text-[10px] text-slate-500 tabular-nums">
                Nota R$ {fmt(valorTotalNota)} + extras R$ {fmt(totalExtras)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ajustes pagos fora da nota</span>
            <span className="relative group">
              <Info className="w-3 h-3 text-slate-400 cursor-help" />
              <span className="absolute left-0 top-5 z-10 hidden group-hover:block w-72 p-2 text-[11px] font-normal normal-case tracking-normal text-slate-700 bg-white border border-slate-200 rounded-lg shadow-lg">
                Use estes campos para informar frete ou impostos que você pagou em separado e que não vieram na NF-e. O valor é rateado proporcionalmente ao valor de cada item importado e somado ao custo unitário efetivo.
              </span>
            </span>
          </div>

          {([
            { key: 'extraFreightCost' as const, label: 'Frete extra', value: extraFreight },
            { key: 'extraTaxesCost' as const, label: 'Impostos extras', value: extraTaxes },
            { key: 'extraOtherCost' as const, label: 'Outras taxas', value: extraOther },
          ]).map(field => (
            <label key={field.key} className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-600 font-medium">{field.label}</span>
              <span className="text-[10px] text-slate-400">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={field.value || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onSetExtraCost(field.key, v === '' ? undefined : parseFloat(v));
                }}
                className="w-24 h-7 px-2 rounded border border-slate-200 bg-white text-slate-700 text-xs outline-none focus:border-primary tabular-nums"
                placeholder="0,00"
              />
            </label>
          ))}

          {totalExtras > 0 && (
            <span className="text-[10px] text-blue-700 italic ml-auto">
              + R$ {fmt(totalExtras)} serão rateados proporcionalmente entre os {nfeData.items.filter(i => !i.skip).length} itens importados.
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 bg-slate-50/50">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
              <th className="px-3 py-2 w-10">
                <Checkbox
                  checked={allSelected ? true : partialSelected ? "indeterminate" : false}
                  onCheckedChange={() => onSelectAll(allSelected ? 'NONE' : 'ALL')}
                />
              </th>
              <th className="px-2 py-2 w-12 text-center">Nº</th>
              <th className="px-3 py-2">Descrição do Fornecedor</th>
              <th className="px-3 py-2 w-32 text-center">Quantidade</th>
              <th className="px-3 py-2 w-28 text-right">Custo Unit.</th>
              <th className="px-3 py-2 w-[300px]">Vínculo</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {nfeData.items.map((item, idx) => {
              const isSelected = selectedIndexes.includes(idx);
              const isMapped = !!item.mappedMaterialId;
              const isNew = item.createNew;
              const isSkip = item.skip;

              const isUnbound = !isMapped && !isNew && !isSkip;

              const cellBase = "py-3 border-y transition-colors";
              const cellBg = isSelected
                ? "border-primary/40 bg-primary/5"
                : isUnbound
                  ? "border-amber-200 bg-amber-50/60 group-hover:bg-amber-50"
                  : "border-slate-100 bg-white group-hover:bg-slate-50";

              return (
                <React.Fragment key={idx}>
                <tr
                  onClick={() => handleRowClick(idx)}
                  className="group cursor-pointer transition-all duration-200"
                >
                  <td
                    className={cn(cellBase, cellBg, "px-3 rounded-l-xl border-l")}
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(idx); }}
                  >
                    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(idx)}
                      />
                    </span>
                  </td>
                  <td className={cn(cellBase, cellBg, "px-2 text-center")}>
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{item.itemNumber}</span>
                  </td>
                  <td className={cn(cellBase, cellBg, "px-3")}>
                    <div className="flex flex-col">
                      <span className={cn("font-semibold text-sm", isSkip ? "text-slate-400 line-through" : "text-slate-800")}>
                        {item.descricao}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono uppercase">SKU: {item.codigo}</span>
                        {item.ean && <span className="text-[9px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-mono uppercase">EAN: {item.ean}</span>}
                      </div>
                    </div>
                  </td>
                  <td className={cn(cellBase, cellBg, "px-3 text-center")} onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-baseline gap-1">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="w-14 font-bold text-sm text-right text-slate-700 bg-transparent outline-none ring-0 p-0 border-none m-0"
                        value={item.quantidade}
                        onChange={(e) => onUpdateQuantity(idx, parseFloat(e.target.value) || 0)}
                      />
                      <span className="text-[10px] font-medium text-slate-400 uppercase">{item.unidade}</span>
                    </div>
                  </td>
                  <td className={cn(cellBase, cellBg, "px-3 text-right")}>
                    <span
                      className="text-xs font-semibold text-emerald-700 tabular-nums"
                      title="Custo unitário efetivo, já com rateio de frete e impostos"
                    >
                      R$ {(item.custoEfetivoUnitario || item.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </span>
                  </td>
                  <td className={cn(cellBase, cellBg, "px-3")} onClick={(e) => e.stopPropagation()}>
                    {isSkip ? (
                      <div className="flex items-center gap-2 text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100">
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] font-bold uppercase tracking-wide">Descartado</span>
                        <Button variant="ghost" size="sm" onClick={() => onToggleSkip(idx)} className="h-6 ml-auto text-[10px] font-semibold underline hover:bg-transparent">Restaurar</Button>
                      </div>
                    ) : isNew ? (
                      <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100">
                        <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] font-bold uppercase tracking-wide">Novo no Catálogo</span>
                        <Button variant="ghost" size="sm" onClick={() => onToggleNew(idx)} className="h-6 ml-auto text-[10px] font-semibold underline hover:bg-transparent">Trocar</Button>
                      </div>
                    ) : isMapped ? (
                      <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-[9px] font-bold uppercase tracking-wide leading-none opacity-60">Vinculado a</span>
                          <span className="text-xs font-semibold leading-tight truncate" title={availableMaterials.find(m => m.id === item.mappedMaterialId)?.name}>
                            {availableMaterials.find(m => m.id === item.mappedMaterialId)?.name || 'Insumo Selecionado'}
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => onBindExisting(idx, '')} className="h-6 text-[10px] font-semibold underline hover:bg-transparent text-slate-400">Trocar</Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-amber-700">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-[10px] font-bold uppercase tracking-wide">Sem Vínculo</span>
                        </div>
                        <div className="flex gap-1.5">
                          <Combobox
                            value=""
                            onChange={(val) => onBindExisting(idx, val)}
                            options={availableMaterials.map(m => ({ id: m.id, label: m.name, sublabel: m.category }))}
                            placeholder="Buscar insumo existente..."
                            className="flex-1 h-8 text-xs"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => onToggleNew(idx)}
                            className="h-8 w-8 border-blue-300 text-blue-600 hover:bg-blue-50 shrink-0"
                            title="Criar como novo insumo"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className={cn(cellBase, cellBg, "px-2 rounded-r-xl border-r")}>
                    <ChevronRight className={cn("w-4 h-4 text-slate-300 group-hover:text-primary transition-all", isSelected && "text-primary")} />
                  </td>
                </tr>
                {isNew && (() => {
                  const normalized = (item.descricao || '').trim().toLowerCase();
                  const duplicate = normalized
                    ? availableMaterials.find(m => m.name.trim().toLowerCase() === normalized)
                    : undefined;
                  return (
                  <tr onClick={(e) => e.stopPropagation()}>
                    <td colSpan={7} className="px-3 pb-2 pt-0">
                      {duplicate && (
                        <div className="ml-12 mr-2 mb-1 flex flex-wrap items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="text-amber-800">
                            Já existe um insumo com este nome:
                            <strong className="ml-1">{duplicate.name}</strong>
                            <span className="text-amber-600/80"> ({duplicate.category})</span>.
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onBindExisting(idx, duplicate.id)}
                            className="h-7 ml-auto border-amber-300 text-amber-800 hover:bg-amber-100"
                          >
                            Vincular ao existente
                          </Button>
                        </div>
                      )}
                      <div
                        className="ml-12 mr-2 flex flex-nowrap items-center gap-3 px-3 py-1.5 bg-blue-50/60 border border-blue-100 rounded-lg text-[11px] overflow-x-auto"
                        title="Não preencheu? O sistema usa os padrões da categoria."
                      >
                        <span className="font-bold uppercase tracking-wider text-blue-700/80 text-[10px] shrink-0">
                          Novo insumo
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-slate-500 font-medium">Cat.</span>
                          <select
                            value={item.categoryId || ''}
                            onChange={(e) => onSetItemCategory(idx, e.target.value)}
                            className={cn(
                              "h-7 px-1.5 rounded border bg-white text-xs outline-none focus:border-blue-400 max-w-[150px]",
                              item.categoryId ? "border-blue-200 text-slate-700" : "border-amber-300 text-amber-700"
                            )}
                          >
                            <option value="">— selecione —</option>
                            {categories.map((cat: any) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-slate-500 font-medium">Estoque mín.</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.minStockQuantity ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              onUpdateNewItemField(idx, 'minStockQuantity', v === '' ? undefined : parseFloat(v));
                            }}
                            className="w-16 h-7 px-2 rounded border border-blue-200 bg-white text-slate-700 text-xs outline-none focus:border-blue-400"
                            placeholder="1"
                            title="Padrão: 1. Use 0 para desabilitar o alerta."
                          />
                          <span className="text-slate-400 text-[10px] uppercase">{item.unidade}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-slate-500 font-medium">Larg.</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.width ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              onUpdateNewItemField(idx, 'width', v === '' ? undefined : parseFloat(v));
                            }}
                            className="w-16 h-7 px-2 rounded border border-blue-200 bg-white text-slate-700 text-xs outline-none focus:border-blue-400"
                            placeholder="—"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-slate-500 font-medium">Alt.</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.height ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              onUpdateNewItemField(idx, 'height', v === '' ? undefined : parseFloat(v));
                            }}
                            className="w-16 h-7 px-2 rounded border border-blue-200 bg-white text-slate-700 text-xs outline-none focus:border-blue-400"
                            placeholder="—"
                          />
                        </div>

                        <select
                          value={item.dimensionUnit || 'm'}
                          onChange={(e) => onSetItemDimensionUnit(idx, e.target.value as 'm' | 'cm' | 'mm')}
                          className="h-7 px-1.5 rounded border border-blue-200 bg-white text-slate-700 text-xs outline-none focus:border-blue-400 shrink-0"
                          title="Unidade aplicada a largura e altura"
                        >
                          <option value="m">m</option>
                          <option value="cm">cm</option>
                          <option value="mm">mm</option>
                        </select>

                        {(() => {
                          const otherSelectedCount = selectedIndexes.filter(i => i !== idx).length;
                          const isRowSelected = selectedIndexes.includes(idx);
                          const disabled = !isRowSelected || otherSelectedCount === 0;
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                onCopyNewItemDefaultsToSelected(idx);
                                toast.success(`Categoria e dimensões aplicadas a ${otherSelectedCount} ${otherSelectedCount === 1 ? 'item' : 'itens'}.`);
                              }}
                              disabled={disabled}
                              className={cn(
                                "ml-auto h-7 px-2 rounded border text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors",
                                disabled
                                  ? "border-slate-200 text-slate-300 cursor-not-allowed"
                                  : "border-blue-300 text-blue-700 hover:bg-blue-100"
                              )}
                              title={
                                !isRowSelected
                                  ? 'Marque o checkbox desta linha (e outras) para habilitar.'
                                  : otherSelectedCount === 0
                                    ? 'Selecione outros itens (checkbox) para copiar os dados.'
                                    : `Copia categoria, largura, altura e unidade para os outros ${otherSelectedCount} itens selecionados (não copia o estoque mínimo).`
                              }
                            >
                              <Copy className="w-3 h-3" />
                              Copiar p/ selecionados
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                  );
                })()}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <NFeBulkActions
        selectedCount={selectedIndexes.length}
        onClear={() => onSelectAll('NONE')}
        onBulkUpdate={onBulkUpdate}
        categories={categories}
        activeCategoryId={(() => {
          if (selectedIndexes.length === 0) return undefined;
          const ids = new Set(selectedIndexes.map(i => nfeData.items[i]?.categoryId).filter(Boolean));
          if (ids.size === 1) return Array.from(ids)[0] as string;
          if (ids.size > 1) return 'mixed';
          return undefined;
        })()}
      />

      {drawerConfig.isOpen && drawerConfig.index !== null && (
        <MaterialDrawer 
          isOpen={drawerConfig.isOpen}
          onClose={() => setDrawerConfig({ isOpen: false, index: null })}
          materialId={nfeData.items[drawerConfig.index].mappedMaterialId}
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
