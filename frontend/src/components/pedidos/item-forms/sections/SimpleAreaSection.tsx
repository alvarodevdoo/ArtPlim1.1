import React from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import CurrencyInput from '@/components/ui/CurrencyInput';

interface SimpleAreaSectionProps {
    inputVars: any[];
    hiddenFormulaVars: any[];
    dynamicVariables: Record<string, any>;
    handleDynamicVarChange: (id: string, field: 'value' | 'unit', val: any) => void;
    handleIndividualUnitChange: (id: string, newUnit: string) => void;
    globalUnit: string;
    produto: any;
    pricingRule: any;
    composition?: any; // Adicionado para pegar o preço sugerido do m2
}

export const SimpleAreaSection: React.FC<SimpleAreaSectionProps> = ({
    inputVars,
    hiddenFormulaVars,
    dynamicVariables,
    handleDynamicVarChange,
    handleIndividualUnitChange,
    globalUnit,
    produto,
    pricingRule,
    composition
}) => {
    // Busca o preço base para exibição no campo "Valor do M²"
    const getBasePriceDisplay = () => {
        // 1. Se houver composição (ex: Vinil selecionado), o preço sugerido é o valor do m2
        if (composition?.unitSuggestedPrice && composition.unitSuggestedPrice > 0) {
            return composition.unitSuggestedPrice;
        }

        // 2. Prioridade para variáveis da regra
        const priceFromVars = hiddenFormulaVars.find(v => 
            v.role === 'SALE_PRICE' || v.role === 'MONETARY' || v.id.toUpperCase().includes('PRECO')
        );
        if (priceFromVars) {
            const val = dynamicVariables[priceFromVars.id]?.value;
            return typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val || 0);
        }

        // 3. Fallback para pricingRule.salePrice ou produto.salePrice
        return pricingRule?.salePrice ?? produto.salePrice ?? 0;
    };

    const basePrice = getBasePriceDisplay();

    return (
        <>
            {/* Renderiza as variáveis de entrada (Largura, Altura, etc) */}
            {inputVars.map((v: any) => {
                const cleanName = (v.name || v.id || '').replace(/\s*\(.*?\)\s*/g, '').trim();
                const currentUnitDisplay = (dynamicVariables[v.id]?.unit || v.defaultUnit || globalUnit).toUpperCase();
                return (
                <div key={v.id} className="space-y-1 flex-1 min-w-[140px]">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                        {cleanName} ({currentUnitDisplay})
                    </label>
                    <div className="flex rounded-md overflow-hidden border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500 shadow-sm">
                        <Input 
                            type="text" 
                            value={dynamicVariables[v.id]?.value ?? ''} 
                            onChange={(e) => handleDynamicVarChange(v.id, 'value', e.target.value)}
                            placeholder="0,00"
                            className="h-9 border-0 bg-transparent flex-1 text-center text-sm font-bold focus-visible:ring-0 px-2" 
                        />
                        <div className="flex border-l border-slate-200 bg-slate-50 min-w-[50px] items-center justify-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase">
                                {dynamicVariables[v.id]?.unit || v.defaultUnit || globalUnit}
                            </span>
                        </div>
                    </div>
                </div>
                );
            })}

            {/* Valor do M² (Visual apenas) */}
            <div className="space-y-1 flex-1 min-w-[120px]">
                <Label className="text-[10px] font-bold uppercase text-indigo-600 truncate">
                    Valor do M²
                </Label>
                <CurrencyInput
                    value={basePrice}
                    disabled={true}
                    className="h-9 bg-indigo-50/20 border-indigo-100 font-extrabold text-indigo-700 text-center text-sm rounded-md shadow-sm"
                />
            </div>
        </>
    );
};
