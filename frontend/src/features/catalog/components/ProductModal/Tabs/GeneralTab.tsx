import React from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/switch';
import { ShoppingBag, Briefcase, Info, TrendingUp } from 'lucide-react';
import { ProductDraft } from '../types';

interface GeneralTabProps {
  draft: ProductDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProductDraft>>;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ draft, setDraft }) => {
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
              value={draft.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ex: Cartão de Visita Premium"
              className="h-12 font-bold text-lg border-2 focus:border-primary"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Descrição para Catálogo</Label>
            <textarea 
              value={draft.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full min-h-[120px] p-4 border-2 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium"
              placeholder="Descreva as características técnicas e benefícios..."
            />
          </div>
        </div>

        <div className="space-y-8">
           <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <h4 className="font-black text-emerald-900 uppercase text-xs tracking-widest">Alvo de Lucratividade</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-emerald-700">Markup Sugerido (x)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      value={draft.targetMarkup || ''}
                      onChange={(e) => handleChange('targetMarkup', parseFloat(e.target.value) || 2.0)}
                      className="bg-white border-emerald-200 font-black text-emerald-800"
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-emerald-700">Margem Alvo (%)</Label>
                    <Input 
                      type="number"
                      step="1"
                      value={(draft.targetMargin || 0) * 100}
                      onChange={(e) => handleChange('targetMargin', (parseFloat(e.target.value) || 0) / 100)}
                      className="bg-white border-emerald-200 font-black text-emerald-800"
                    />
                 </div>
              </div>
              <p className="text-[10px] text-emerald-600 leading-relaxed italic">
                 Define o lucro alvo base para este produto. O sistema utilizará esses valores para sinalizar na aba de precificação se a venda está saudável.
              </p>
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
