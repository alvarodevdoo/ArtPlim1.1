import React from 'react';
import { 
  BarChart3, TrendingUp, DollarSign, Wallet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { ProductDraft } from '../../types';
import { SimulationResult } from '../../useProductSimulation';

interface PricingTabProps {
  draft: ProductDraft;
  simResult: SimulationResult | null;
}

export const PricingTab: React.FC<PricingTabProps> = ({ draft, simResult }) => {
  const currentCost = simResult?.totalCost || draft.costPrice || 0;
  const currentSalePrice = draft.salePrice || 0;
  const currentMarkup = currentCost > 0 ? currentSalePrice / currentCost : 0;
  const currentMargin = currentSalePrice > 0 ? (currentSalePrice - currentCost) / currentSalePrice : 0;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-300">
      
      {/* Header BI */}
      <div className="flex items-center gap-3">
         <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
            <BarChart3 className="w-5 h-5" />
         </div>
         <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Matriz de Lucratividade</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Snapshot financeiro em tempo real</p>
         </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <MetricCard 
           label="Custo Direto (Médio)" 
           value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentCost)}
           icon={<DollarSign className="w-4 h-4" />}
           subLabel="Soma de Insumos + Variáveis"
         />
         <MetricCard 
           label="Markup Comercial" 
           value={`${currentMarkup.toFixed(2)}x`}
           icon={<TrendingUp className="w-4 h-4" />}
           subLabel="Multiplicador de Custo"
           variant="primary"
         />
         <MetricCard 
           label="Margem de Contribuição" 
           value={`${(currentMargin * 100).toFixed(1)}%`}
           icon={<BarChart3 className="w-4 h-4" />}
           subLabel="Percentual sobre Venda"
         />
         <MetricCard 
           label="Resultado Operacional" 
           value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentSalePrice - currentCost)}
           icon={<Wallet className="w-4 h-4" />}
           subLabel="Lucro Bruto por Unidade"
         />
      </div>


      {/* Breakdown de Custos (Composição) */}
      {simResult && simResult.breakdown.length > 0 && (
        <div className="space-y-4">
           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-2 flex items-center gap-2">
             <ArrowUpRight className="w-3.5 h-3.5" /> Detalhamento da Composição Atual
           </h4>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {simResult.breakdown.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border rounded-xl hover:bg-white transition-all cursor-default group">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center text-[10px] font-black text-slate-400">
                        {item.quantity}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-700">{item.materialName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {item.source === 'OPTION_SLOT' ? `Opção: ${item.optionLabel}` : 'Ficha Fixa'}
                        </p>
                      </div>
                   </div>
                   <p className="text-xs font-black text-slate-600 group-hover:text-primary transition-colors">
                     {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal)}
                   </p>
                </div>
              ))}
           </div>
        </div>
      )}

    </div>
  );
};

// Componente Interno - Metric Card
const MetricCard = ({ label, value, icon, subLabel, variant = 'neutral', status }: any) => (
  <div className={cn(
    "p-6 rounded-3xl border-2 transition-all",
    variant === 'primary' ? "border-indigo-500 bg-indigo-900 text-white shadow-xl shadow-indigo-200" : "bg-white border-slate-100",
    status === 'success' && "border-emerald-500 bg-emerald-50",
    status === 'warning' && "border-amber-500 bg-amber-50",
  )}>
     <div className="flex items-center gap-2 mb-4">
        <div className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center",
          variant === 'primary' ? "bg-indigo-400 text-indigo-900" : "bg-slate-100 text-slate-500",
        )}>
           {icon}
        </div>
        <span className={cn(
          "text-[10px] font-black uppercase tracking-widest",
          variant === 'primary' ? "text-indigo-300" : "text-slate-400"
        )}>{label}</span>
     </div>
     <p className="text-2xl font-black">{value}</p>
     <p className={cn(
       "text-[10px] mt-1 font-bold",
       variant === 'primary' ? "text-indigo-400" : "text-slate-400"
     )}>{subLabel}</p>
  </div>
);

