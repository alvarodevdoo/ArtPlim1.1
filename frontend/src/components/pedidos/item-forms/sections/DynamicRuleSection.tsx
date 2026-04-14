import React from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DynamicRuleSectionProps {
    inputVars: any[];
    hiddenFormulaVars: any[];
    dynamicVariables: Record<string, any>;
    handleDynamicVarChange: (id: string, field: 'value' | 'unit', val: any) => void;
    handleIndividualUnitChange: (id: string, newUnit: string) => void;
    globalUnit: string;
    produto: any;
    pricingRule: any;
}

export const DynamicRuleSection: React.FC<DynamicRuleSectionProps> = ({
    inputVars,
    hiddenFormulaVars,
    dynamicVariables,
    handleDynamicVarChange,
    handleIndividualUnitChange,
    globalUnit,
}) => {
    return (
        <>
            {/* Variáveis de Entrada configuradas na Regra */}
            {inputVars.map((v: any) => {
                const cleanName = (v.name || v.id || '').replace(/\s*\(.*?\)\s*/g, '').trim();
                const isLockedByProduct = dynamicVariables[v.id]?.locked === true;
                const currentUnitRaw = (dynamicVariables[v.id]?.unit || v.defaultUnit || 'mm').toLowerCase();
                const currentUnitDisplay = currentUnitRaw.toUpperCase();
                const allowedUnitsRaw = Array.isArray(v.allowedUnits) && v.allowedUnits.length > 0 
                                    ? v.allowedUnits.map((u: string) => u.toLowerCase())
                                    : [currentUnitRaw];

                return (
                    <div key={v.id} className="space-y-1 flex-1 min-w-[140px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                            {cleanName} ({currentUnitDisplay})
                            {isLockedByProduct && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                        </label>
                        <div className={cn(
                            "flex rounded-md overflow-hidden border transition-all shadow-sm",
                            isLockedByProduct 
                                ? "bg-slate-100 border-slate-200 opacity-80" 
                                : "bg-white border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500"
                        )}>
                            <Input 
                                type="text" 
                                value={dynamicVariables[v.id]?.value ?? ''} 
                                onChange={(e) => {
                                    if (isLockedByProduct) return;
                                    handleDynamicVarChange(v.id, 'value', e.target.value);
                                }}
                                placeholder="0,00"
                                disabled={isLockedByProduct}
                                className={cn(
                                    "h-9 border-0 bg-transparent flex-1 text-center text-sm font-bold focus-visible:ring-0 px-2",
                                    isLockedByProduct && "text-slate-400 cursor-not-allowed"
                                )} 
                            />
                            
                            <div className="flex border-l border-slate-200 bg-slate-50 min-w-[65px] relative items-center">
                                {allowedUnitsRaw.length > 1 ? (
                                    <div className="relative w-full h-full flex items-center">
                                        <select
                                            value={currentUnitRaw}
                                            onChange={(e) => handleIndividualUnitChange(v.id, e.target.value)}
                                            className="w-full h-full bg-white/50 pl-2 pr-4 text-[10px] font-black text-indigo-700 uppercase appearance-none cursor-pointer focus:outline-none hover:bg-white transition-all border-0 ring-0 outline-none"
                                            style={{ border: 'none', background: 'transparent' }}
                                        >
                                            {allowedUnitsRaw.map((u: string) => (
                                                <option key={u} value={u} className="bg-white text-slate-900 font-bold p-2 uppercase">
                                                    {u.toUpperCase()}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-1.5 pointer-events-none text-indigo-500">
                                            <svg width="8" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="flex items-center px-3 text-[10px] font-black text-slate-400 uppercase">
                                        {currentUnitDisplay}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Variáveis Ocultas (Preços e taxas da fórmula) */}
            {hiddenFormulaVars.map((v: any) => {
                const val = dynamicVariables[v.id]?.value;
                return (
                    <div key={v.id} className="space-y-1 flex-1 min-w-[120px]">
                        <Label className="text-[10px] font-bold uppercase text-indigo-600 truncate">
                            {v.name || 'Valor Base'}
                        </Label>
                        <CurrencyInput
                            value={val}
                            disabled={true}
                            className="h-9 bg-indigo-50/20 border-indigo-100 font-extrabold text-indigo-700 text-center text-sm rounded-md shadow-sm"
                        />
                    </div>
                );
            })}
        </>
    );
};
