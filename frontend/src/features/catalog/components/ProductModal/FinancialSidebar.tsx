import React from 'react';
import { FinancialSummary } from './types';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FinancialSidebarProps {
  summary: FinancialSummary;
  selectedOptionLabel?: string;
  isLoading?: boolean;
  onSalePriceChange: (val: number) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const Row = ({
  label,
  value,
  muted,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  highlight?: boolean;
}) => (
  <div className="flex justify-between items-center">
    <span
      className={cn(
        'text-[10px] font-bold uppercase tracking-tighter',
        muted ? 'text-slate-500' : bold ? 'text-slate-200' : 'text-slate-400'
      )}
    >
      {label}
    </span>
    <span className={cn('text-xs font-black', bold ? 'text-white' : highlight ? 'text-amber-400' : 'text-slate-300')}>
      {value}
    </span>
  </div>
);

export const FinancialSidebar: React.FC<FinancialSidebarProps> = ({
  summary,
  selectedOptionLabel,
  isLoading,
  onSalePriceChange,
}) => {
  const healthColor = {
    healthy: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  }[summary.healthStatus];

  const HealthIcon =
    summary.healthStatus === 'healthy' ? TrendingUp :
    summary.healthStatus === 'warning' ? Minus      : TrendingDown;

  const healthBg = {
    healthy: 'bg-emerald-500/10 border-emerald-500/20',
    warning: 'bg-amber-500/10  border-amber-500/20',
    danger:  'bg-red-500/10    border-red-500/20',
  }[summary.healthStatus];

  const iconBg = {
    healthy: 'bg-emerald-500/10',
    warning: 'bg-amber-500/10',
    danger:  'bg-red-500/10',
  }[summary.healthStatus];

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-4 shadow-2xl border border-slate-700/50">
      {/* Title */}
      <div className="flex items-center gap-2">
        <div className={cn('p-1.5 rounded-lg', iconBg)}>
          <HealthIcon className={cn('w-4 h-4', healthColor)} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumo Financeiro</p>
      </div>

      {/* Cost breakdown */}
      <div className="space-y-2 border-b border-slate-700/50 pb-4">
        <Row label="Custo Fixo (BOM)" value={fmt(summary.fixedCost)} muted />
        {selectedOptionLabel && (
          <Row label={selectedOptionLabel} value={`+ ${fmt(summary.variationCost)}`} highlight />
        )}
        <Row label="Custo Total" value={fmt(summary.totalCost)} bold />
      </div>

      {/* Sale price editable */}
      <div className="space-y-1.5">
        <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Preço de Venda</p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">R$</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={summary.salePrice || ''}
            onChange={(e) => {
              if (!summary.isSalePriceOverridden) {
                onSalePriceChange(parseFloat(e.target.value) || 0)
              }
            }}
            disabled={summary.isSalePriceOverridden}
            className={cn(
               "w-full bg-slate-800 rounded-xl py-2 pl-9 pr-3 text-sm font-black text-white focus:outline-none transition-colors",
               summary.isSalePriceOverridden ? "opacity-50 cursor-not-allowed border-dashed border-2 border-amber-500/50 text-amber-100" : "border border-slate-700 focus:border-emerald-500"
            )}
          />
        </div>
        {summary.isSalePriceOverridden && (
           <div className="space-y-1.5 pt-3 mt-3 border-t border-slate-700/50">
             <p className="text-[9px] text-emerald-500 font-bold tracking-widest uppercase">
               Preço Base (Catálogo)
             </p>
             <div className="relative">
               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">R$</span>
               <input
                 type="number"
                 step={0.5}
                 value={summary.baseSalePrice || ''}
                 onChange={(e) => onSalePriceChange(parseFloat(e.target.value) || 0)}
                 className="w-full bg-slate-800/80 border-dashed border-2 border-emerald-500/30 rounded-xl py-1.5 pl-9 pr-3 text-sm font-black text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
               />
             </div>
             <p className="text-[8px] text-slate-500 italic mt-1 leading-tight">Mude este preço para consertar o "388" que aparece no painel principal dos produtos.</p>
           </div>
        )}
      </div>

      {/* Profit */}
      <div className={cn('rounded-xl p-3 space-y-1 border', healthBg)}>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lucro Líquido</p>
        <p className={cn('text-xl font-black', healthColor)}>{fmt(summary.grossProfit)}</p>
        <p className={cn('text-[10px] font-bold', healthColor)}>
          {summary.marginPercent.toFixed(1)}% margem
          {summary.healthStatus === 'healthy' ? ' ✓' : summary.healthStatus === 'warning' ? ' ⚠' : ' ✗'}
        </p>
      </div>

      {isLoading && (
        <p className="text-[9px] text-slate-500 text-center animate-pulse uppercase tracking-widest">
          Calculando...
        </p>
      )}
    </div>
  );
};
