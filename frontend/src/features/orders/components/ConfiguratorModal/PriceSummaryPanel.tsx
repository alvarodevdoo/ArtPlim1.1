import React from 'react';
import type { CompositionResult } from '../../types/composition.types';
import { getMarginStatus, type MarginStatus } from '../../types/composition.types';

interface PriceSummaryPanelProps {
  composition: CompositionResult | null;
  loading: boolean;
  negotiatedPrice: number;
  quantity: number;
  targetMarkup?: number;
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatPercent = (v: number) =>
  `${(v * 100).toFixed(1)}%`;

const marginConfig: Record<MarginStatus, { label: string; color: string; border: string; bg: string }> = {
  HEALTHY:  { label: 'Margem saudável',    color: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50/30' },
  WARNING:  { label: 'Margem abaixo do alvo', color: 'text-amber-700',   border: 'border-amber-200',   bg: 'bg-amber-50/30' },
  DANGER:   { label: 'Margem crítica',     color: 'text-red-700',     border: 'border-red-200',     bg: 'bg-red-50/30' },
  NEGATIVE: { label: '⚠ Prejuízo!',        color: 'text-purple-700',  border: 'border-purple-200',  bg: 'bg-purple-50/30' }
};

export const PriceSummaryPanel: React.FC<PriceSummaryPanelProps> = ({
  composition,
  loading,
  negotiatedPrice,
  quantity,
  targetMarkup
}) => {
  const totalCost = composition ? composition.totalCost : 0;
  const suggestedPrice = composition ? composition.suggestedPrice : 0;
  const profit = negotiatedPrice - (totalCost / Math.max(1, quantity));
  const margin = negotiatedPrice > 0 ? (profit / negotiatedPrice) : 0;
  const actualMarkup = (totalCost / Math.max(1, quantity)) > 0 ? negotiatedPrice / (totalCost / Math.max(1, quantity)) : 0;
  
  const status = getMarginStatus(negotiatedPrice, totalCost / Math.max(1, quantity), targetMarkup);
  const cfg = marginConfig[status];

  return (
    <div className={`p-4 rounded-xl border ${cfg.border} ${cfg.bg} space-y-4`}>
      
      {/* Custo vs Sugestão */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Custo Unitário</span>
          <span className="text-sm font-bold text-slate-800">
            {loading ? '...' : formatCurrency(totalCost / Math.max(1, quantity))}
          </span>
          {composition && (
             <span className="text-[9px] text-slate-400">Total: {formatCurrency(totalCost)}</span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Preço Sugerido</span>
          <span className="text-sm font-bold text-blue-600">
            {loading ? '...' : formatCurrency(suggestedPrice / Math.max(1, quantity))}
          </span>
        </div>
      </div>

      <div className="h-[1px] bg-slate-200/50 w-full" />

      {/* Valor do Item */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Valor Total do Item</span>
        <div className="flex items-baseline gap-2">
           <span className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(negotiatedPrice * quantity)}</span>
           <span className="text-[10px] text-slate-500 font-medium">({formatCurrency(negotiatedPrice)} / un)</span>
        </div>
      </div>

      {/* Margem e Resultado */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex justify-between items-center text-xs font-bold">
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Resultado / Margem</span>
           <span className={`${cfg.color}`}>{cfg.label}</span>
        </div>
        <div className={`flex justify-between items-center p-2 rounded-lg border border-white/50 bg-white/40 shadow-sm ${cfg.color}`}>
           <span className="text-sm font-black">{formatCurrency(profit * quantity)}</span>
           <span className="text-[11px] font-bold">{formatPercent(margin)} / {actualMarkup.toFixed(2)}×</span>
        </div>
      </div>

      {/* Alertas de estoque */}
      {composition && composition.insufficientStock.length > 0 && (
        <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-[10px] text-red-800 font-medium">
          <strong>⚠ Estoque insuficiente:</strong>
          <ul className="list-disc pl-3 mt-1">
            {composition.insufficientStock.map((item, idx) => (
              <li key={idx}>{item.materialName}: falta {Number(item.deficit).toFixed(1)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
