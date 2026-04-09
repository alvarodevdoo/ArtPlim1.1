import React from 'react';
import type { CompositionResult } from '../../types/composition.types';
import { Package, Calculator } from 'lucide-react';

interface PriceSummaryPanelProps {
  composition: CompositionResult | null;
  loading: boolean;
  negotiatedPrice: number;
  quantity: number;
}

export const PriceSummaryPanel: React.FC<PriceSummaryPanelProps> = ({
  composition,
  loading,
  negotiatedPrice,
  quantity,
}) => {
  const totalNegotiated = negotiatedPrice * quantity;
  const totalCost = composition?.totalCost || 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="p-3 border-b bg-slate-50/50 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Calculator className="w-3 h-3" />
          Resumo de Custos
        </span>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Custo Total de Insumos */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
            <span>Custo de Materiais</span>
            <Package className="w-3 h-3" />
          </div>
          <div className="text-xl font-black text-slate-700">
            {loading ? (
              <div className="h-7 w-24 bg-slate-100 animate-pulse rounded" />
            ) : (
              `R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            )}
          </div>
          <p className="text-[9px] text-slate-400 font-medium">
            Baseado no custo médio do estoque
          </p>
        </div>

        {/* Valor Total da Venda */}
        <div className="pt-4 border-t border-dashed space-y-1">
          <div className="flex justify-between items-center text-[10px] font-bold text-indigo-400 uppercase">
            <span>Valor Total do Item</span>
          </div>
          <div className="text-2xl font-black text-indigo-600">
            R$ {totalNegotiated.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] font-bold text-slate-400">
            (R$ {negotiatedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / un)
          </div>
        </div>
      </div>
    </div>
  );
};
