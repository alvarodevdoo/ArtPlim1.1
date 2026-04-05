import React from 'react';
import { 
  BarChart3, TrendingUp, DollarSign, Wallet, 
  ArrowUpRight, AlertTriangle, CheckCircle2, 
  Target
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

  const targetMarkup = draft.targetMarkup || 2.0;
  const targetMargin = draft.targetMargin || 0.5;

  // Calculando Saúde Financeira
  const isHealthy = currentMarkup >= targetMarkup;

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <MetricCard 
           label="Custo Direto (Médio)" 
           value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentCost)}
           icon={<DollarSign className="w-4 h-4" />}
           subLabel="Soma de Insumos + Variáveis"
         />
         <MetricCard 
           label="Preço de Venda Atual" 
           value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentSalePrice)}
           icon={<ArrowUpRight className="w-4 h-4" />}
           subLabel="Valor cadastrado no banco"
           variant="primary"
         />
         <MetricCard 
           label="Resultado Operacional" 
           value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentSalePrice - currentCost)}
           icon={<Wallet className="w-4 h-4" />}
           subLabel="Lucro Bruto por Unidade"
           status={isHealthy ? 'success' : 'warning'}
         />
      </div>

      {/* Tabela de BI / Comparativo Alvo */}
      <Card className="border-2 shadow-xl shadow-slate-200/50 overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-4">
           <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
             <Target className="w-4 h-4" /> Comparativo vs Alvos Estratégicos
           </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
           <table className="w-full pricing-matrix">
              <thead>
                 <tr className="bg-slate-50/50 border-b">
                    <th className="px-6 py-4 text-left">Métrica</th>
                    <th className="px-6 py-4 text-center">Valor Atual</th>
                    <th className="px-6 py-4 text-center">Alvo (Target)</th>
                    <th className="px-6 py-4 text-center">Status</th>
                 </tr>
              </thead>
              <tbody>
                 <tr className="border-b hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5 font-bold text-slate-800">
                       <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-indigo-400" /> Markup Comercial
                       </div>
                    </td>
                    <td className="px-6 py-5 text-center font-black">{currentMarkup.toFixed(2)}x</td>
                    <td className="px-6 py-5 text-center text-slate-400 font-bold">{targetMarkup.toFixed(2)}x</td>
                    <td className="px-6 py-5">
                       <div className="flex justify-center">
                          <StatusBadge healthy={currentMarkup >= targetMarkup} />
                       </div>
                    </td>
                 </tr>
                 <tr className="border-b hover:bg-slate-50/50 transition-colors font-bold text-slate-800">
                    <td className="px-6 py-5">
                       <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-emerald-400" /> Margem de Contribuição
                       </div>
                    </td>
                    <td className="px-6 py-5 text-center font-black">{(currentMargin * 100).toFixed(1)}%</td>
                    <td className="px-6 py-5 text-center text-slate-400 font-bold">{(targetMargin * 100).toFixed(1)}%</td>
                    <td className="px-6 py-5">
                       <div className="flex justify-center">
                          <StatusBadge healthy={currentMargin >= targetMargin} />
                       </div>
                    </td>
                 </tr>
              </tbody>
           </table>
        </CardContent>
      </Card>

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

      {/* Mensagem de Alerta ou Sucesso Final */}
      {!isHealthy ? (
        <div className="bg-red-50 border-2 border-red-100 p-6 rounded-3xl flex items-start gap-4">
           <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
              <AlertTriangle className="w-6 h-6" />
           </div>
           <div>
              <h5 className="font-black text-red-800 uppercase text-xs tracking-wider mb-1">Atenção: Margem Abaixo do Alvo</h5>
              <p className="text-[10px] text-red-600 font-bold leading-relaxed uppercase tracking-tighter">
                O preço de venda atual (R$ {currentSalePrice.toFixed(2)}) não atende ao markup alvo de {targetMarkup.toFixed(2)}x. 
                Para atingir o objetivo, o preço sugerido deveria ser de <span className="underline">R$ {simResult?.suggestedPrice.toFixed(2)}</span>.
              </p>
           </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border-2 border-emerald-100 p-6 rounded-3xl flex items-start gap-4">
           <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl animate-pulse">
              <CheckCircle2 className="w-6 h-6" />
           </div>
           <div>
              <h5 className="font-black text-emerald-800 uppercase text-xs tracking-wider mb-1">Precificação Saudável</h5>
              <p className="text-[10px] text-emerald-600 font-bold leading-relaxed uppercase tracking-tighter">
                Este produto está operando com um markup de {currentMarkup.toFixed(2)}x, superando o alvo estratégico de {targetMarkup.toFixed(2)}x. 
                A lucratividade está garantida para este mix de insumos.
              </p>
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

// Componente Interno - Badge de Status
const StatusBadge = ({ healthy }: { healthy: boolean }) => (
  <div className={cn(
    "flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider",
    healthy ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
  )}>
     {healthy ? (
       <><CheckCircle2 className="w-3.5 h-3.5" /> Meta Atingida</>
     ) : (
       <><AlertTriangle className="w-3.5 h-3.5" /> Revisar Preço</>
     )}
  </div>
);
