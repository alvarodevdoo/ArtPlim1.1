import React from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/switch';
import { ShoppingBag, Briefcase, Info, TrendingUp } from 'lucide-react';
import { ProductDraft } from '../types';

interface GeneralTabProps {
  draft: ProductDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProductDraft>>;
  pricingRules?: { id: string, name: string }[];
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ draft, setDraft, pricingRules = [] }) => {
  const handleChange = (field: keyof ProductDraft, value: any) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-left duration-300">
      
      {/* Tipo e Identificação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-8">
        <div className="space-y-6">
          <div className="space-y-3">
             <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Tipo de Item</Label>
             <div className="flex gap-2 p-1 bg-slate-100 rounded-xl border">
                <button 
                  type="button" 
                  onClick={() => handleChange('productType', 'PRODUCT')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${draft.productType === 'PRODUCT' ? 'bg-white shadow-md text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <ShoppingBag className="w-4 h-4" /> Produto
                </button>
                <button 
                  type="button" 
                  onClick={() => handleChange('productType', 'SERVICE')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${draft.productType === 'SERVICE' ? 'bg-white shadow-md text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Briefcase className="w-4 h-4" /> Serviço
                </button>
             </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Nome Comercial *</Label>
            <Input 
              value={draft.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ex: Cartão de Visita Premium"
              className="h-12 font-bold text-lg border-2 focus:border-primary"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Descrição para Catálogo</Label>
            <textarea 
              value={draft.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full min-h-[120px] p-4 border-2 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium"
              placeholder="Descreva as características técnicas e benefícios..."
            />
          </div>

          {draft.pricingMode !== 'DYNAMIC_ENGINEER' && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <Label className="text-xs font-black uppercase tracking-widest text-emerald-600">Preço Fixo Base (Catálogo)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                <Input 
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.salePrice || ''}
                  onChange={(e) => handleChange('salePrice', parseFloat(e.target.value) || 0)}
                  className="h-12 pl-10 font-black text-lg border-2 focus:border-emerald-500 bg-emerald-50/30"
                />
              </div>
              <p className="text-[10px] text-slate-500 font-medium italic">
                Como seu produto não usa fórmulas vitrine, este é o preço que será exibido no cartão principal do catálogo.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-8">
           {/* Precificação Base */}
           <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-5 h-5 text-indigo-600" />
                <h4 className="font-black text-indigo-900 uppercase text-xs tracking-widest">Motor de Precificação</h4>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">Modo de Cálculo</Label>
                  <select 
                    value={draft.pricingMode}
                    onChange={(e) => {
                      const newMode = e.target.value;
                      handleChange('pricingMode', newMode);
                      
                      // Auto-seleção de regra para modos simples
                      if (newMode === 'SIMPLE_AREA') {
                        const m2Rule = pricingRules.find(r => r.name.toLowerCase().includes('m²'));
                        if (m2Rule) handleChange('pricingRuleId', m2Rule.id);
                      } else if (newMode === 'SIMPLE_UNIT') {
                        const unitRule = pricingRules.find(r => r.name.toLowerCase().includes('unidade'));
                        if (unitRule) handleChange('pricingRuleId', unitRule.id);
                      }
                    }}
                    className="w-full h-11 px-4 bg-white border-2 border-indigo-100 rounded-xl text-sm font-bold text-indigo-900 focus:border-indigo-500 focus:outline-none transition-all"
                  >
                    <option value="SIMPLE_AREA">Preço por M² (Largura x Altura)</option>
                    <option value="SIMPLE_UNIT">Preço por Unidade Fixa</option>
                    <option value="DYNAMIC_ENGINEER">Motor Dinâmico (Fórmulas Customizadas)</option>
                  </select>
                </div>

                {/* Só mostra o seletor de regras se for Modo Dinâmico */}
                {draft.pricingMode === 'DYNAMIC_ENGINEER' && (
                  <div className="space-y-2 animate-in slide-in-from-top duration-300">
                    <Label className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">Regra de Cálculo Específica</Label>
                    <select 
                      value={draft.pricingRuleId || ''}
                      onChange={(e) => handleChange('pricingRuleId', e.target.value || null)}
                      className="w-full h-11 px-4 bg-white border-2 border-indigo-100 rounded-xl text-sm font-bold text-indigo-900 focus:border-indigo-500 focus:outline-none transition-all"
                    >
                      <option value="">— Escolha uma Fórmula —</option>
                      {pricingRules.map(rule => (
                        <option key={rule.id} value={rule.id}>{rule.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-indigo-400 font-bold leading-relaxed">
                      Selecione a lógica de cálculo dinâmica aplicada a este item.
                    </p>
                  </div>
                )}
                
                {draft.pricingMode !== 'DYNAMIC_ENGINEER' && (
                  <p className="text-[10px] text-indigo-400 font-bold italic leading-relaxed">
                    Utilizando motor de cálculo padrão para {draft.pricingMode === 'SIMPLE_AREA' ? 'áreas lineares (M²)' : 'unidades fixas'}.
                  </p>
                )}
              </div>
           </div>

           <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-dashed">
              <h4 className="font-black text-slate-600 uppercase text-xs tracking-widest flex items-center gap-2">
                <Info className="w-4 h-4" /> Controle de Inventário
              </h4>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-slate-800">Monitorar Estoque?</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Reserva materiais após confirmação</p>
                </div>
                <Switch 
                  checked={draft.trackStock}
                  onCheckedChange={(val) => handleChange('trackStock', val)}
                />
              </div>
              
              {draft.trackStock && (
                 <div className="grid grid-cols-2 gap-4 pt-4 border-t animate-in fade-in">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-slate-400">Estoque Mínimo</Label>
                       <Input 
                        type="number"
                        value={draft.stockMinQuantity}
                        onChange={(e) => handleChange('stockMinQuantity', parseFloat(e.target.value) || 0)}
                        className="bg-white font-bold h-10"
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black text-slate-400">Unidade</Label>
                       <Input 
                        value={draft.stockUnit}
                        onChange={(e) => handleChange('stockUnit', e.target.value)}
                        placeholder="un, m2, m..."
                        className="bg-white font-bold h-10"
                       />
                    </div>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
