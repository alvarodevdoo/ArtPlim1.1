import React from 'react';
import type { CompositionResult } from '../../types/composition.types';
import { Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PriceSummaryPanelProps {
  composition: CompositionResult | null;
  loading: boolean;
  negotiatedPrice: number;
  quantity: number;
  discountItem?: number;
}

export const PriceSummaryPanel: React.FC<PriceSummaryPanelProps> = ({
  composition,
  loading,
  negotiatedPrice,
  quantity,
  discountItem = 0,
}) => {
  const { hasPermission } = useAuth();
  const canSeeCosts = hasPermission('finance.costs');

  const totalNegotiated = (negotiatedPrice * quantity) - discountItem;
  const totalCost = composition?.totalCost || 0;

  return (
    <div className="flex items-center gap-5 min-w-0">
      {/* Custo de materiais (apenas quem tem permissão) */}
      {canSeeCosts && (
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Package className="w-2.5 h-2.5" />
            Custo
          </span>
          <span className="text-sm font-black text-slate-600 tabular-nums">
            {loading ? (
              <span className="inline-block h-4 w-16 bg-slate-100 animate-pulse rounded" />
            ) : (
              `R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            )}
          </span>
        </div>
      )}

      {canSeeCosts && (
        <div className="w-px h-8 bg-slate-200 shrink-0" />
      )}

      {/* Valor total */}
      <div className="flex flex-col min-w-0">
        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">
          Total do Item
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-indigo-600 tabular-nums leading-tight">
            R$ {totalNegotiated.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 tabular-nums whitespace-nowrap">
            (R$ {negotiatedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / un)
          </span>
        </div>
      </div>
    </div>
  );
};
