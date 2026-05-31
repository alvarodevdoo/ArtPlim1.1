import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { Lock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tooltip leve via Portal — evita corte por ancestrais com overflow:hidden
 * (modais, cards, etc). Renderiza no document.body com position: fixed.
 */
const PortalTooltip: React.FC<{ content: string; children: React.ReactNode }> = ({ content, children }) => {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLSpanElement | null>(null);

    const show = () => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setPos({ top: r.top - 8, left: r.left + r.width / 2 });
    };
    const hide = () => setPos(null);

    return (
        <>
            <span
                ref={triggerRef}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
                className="inline-flex shrink-0"
            >
                {children}
            </span>
            {pos && createPortal(
                <div
                    role="tooltip"
                    style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
                    className="z-[9999] whitespace-pre bg-slate-900 text-white text-[10px] font-semibold normal-case tracking-normal px-2.5 py-1.5 rounded-md shadow-xl pointer-events-none"
                >
                    {content}
                    <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
                </div>,
                document.body
            )}
        </>
    );
};

interface DynamicRuleSectionProps {
    inputVars: any[];
    hiddenFormulaVars: any[];
    dynamicVariables: Record<string, any>;
    handleDynamicVarChange: (id: string, field: 'value' | 'unit', val: any) => void;
    handleIndividualUnitChange: (id: string, newUnit: string) => void;
    globalUnit: string;
    produto: any;
    pricingRule: any;
    /**
     * Ajustes vindos das opções selecionadas (motor dinâmico):
     *  - replacements: variável → valor que sobrescreve o configurado
     *  - additions:    variável → soma a aplicar sobre o configurado
     *  - finalAddition: soma direto no preço final (não toca em variáveis)
     */
    formulaAdjustments?: {
        replacements: Record<string, number>;
        additions: Record<string, number>;
        finalAddition: number;
    };
}

export const DynamicRuleSection: React.FC<DynamicRuleSectionProps> = ({
    inputVars,
    hiddenFormulaVars,
    dynamicVariables,
    handleDynamicVarChange,
    handleIndividualUnitChange,
    globalUnit,
    formulaAdjustments,
}) => {
    // Aplica os ajustes das opções para exibir o valor efetivo da variável
    // (ex: VALOR_BASE configurado=70 + ADD_VAR=5 → exibe 75).
    const getEffectiveValue = (varId: string, rawVal: any): number => {
        const baseNum = typeof rawVal === 'string'
            ? parseFloat(rawVal.replace(',', '.'))
            : Number(rawVal || 0);
        if (!formulaAdjustments) return baseNum || 0;
        const key = String(varId).toUpperCase();
        const replKey = Object.keys(formulaAdjustments.replacements).find(k => k.toUpperCase() === key);
        if (replKey != null) {
            return Number(formulaAdjustments.replacements[replKey]) || 0;
        }
        const addKey = Object.keys(formulaAdjustments.additions).find(k => k.toUpperCase() === key);
        const addVal = addKey != null ? Number(formulaAdjustments.additions[addKey] || 0) : 0;
        return (baseNum || 0) + addVal;
    };
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

            {/* Variáveis Ocultas (Preços e taxas da fórmula) — exibe o valor
                EFETIVO (configurado + ajustes das opções selecionadas) */}
            {hiddenFormulaVars.map((v: any) => {
                const rawVal = dynamicVariables[v.id]?.value;
                const effective = getEffectiveValue(v.id, rawVal);
                const baseNum = typeof rawVal === 'string'
                    ? parseFloat(rawVal.replace(',', '.'))
                    : Number(rawVal || 0);
                const adjusted = Math.abs(effective - (baseNum || 0)) > 0.001;
                // Respeita o cadeado configurado no produto (formulaData[key].locked).
                // Cadeado aberto → vendedor pode editar o valor base no pedido.
                // Quando há ajuste de opção (REPLACE/ADD), o valor exibido é derivado
                // e não pode ser editado direto (mostra read-only).
                const isLocked = dynamicVariables[v.id]?.locked === true;
                const isEditable = !isLocked && !adjusted;

                // Detecta a operação aplicada (REPLACE ou ADD) para construir o tooltip
                let tooltipContent = '';
                if (adjusted && formulaAdjustments) {
                    const key = String(v.id).toUpperCase();
                    const replKey = Object.keys(formulaAdjustments.replacements).find(k => k.toUpperCase() === key);
                    const addKey = Object.keys(formulaAdjustments.additions).find(k => k.toUpperCase() === key);
                    const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
                    if (replKey != null) {
                        tooltipContent = `Configurado: ${fmt(baseNum)}\nSubstituído por: ${fmt(Number(formulaAdjustments.replacements[replKey]))}\nEfetivo: ${fmt(effective)}`;
                    } else if (addKey != null) {
                        const addVal = Number(formulaAdjustments.additions[addKey] || 0);
                        tooltipContent = `Configurado: ${fmt(baseNum)}\n+ Ajustes: ${fmt(addVal)}\n= Efetivo: ${fmt(effective)}`;
                    }
                }

                return (
                    <div key={v.id} className="space-y-1 flex-1 min-w-[120px]">
                        <Label className="text-[10px] font-bold uppercase text-indigo-600 truncate flex items-center gap-1">
                            <span className="truncate">{v.name || 'Valor Base'}</span>
                            {isLocked && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                            {adjusted && (
                                <PortalTooltip content={tooltipContent}>
                                    <Info className="w-3 h-3 text-violet-500 cursor-help" />
                                </PortalTooltip>
                            )}
                        </Label>
                        <CurrencyInput
                            value={effective}
                            disabled={!isEditable}
                            onValueChange={isEditable
                                ? (val) => handleDynamicVarChange(v.id, 'value', val ?? 0)
                                : undefined}
                            className={cn(
                                'h-9 font-extrabold text-center text-sm rounded-md shadow-sm',
                                adjusted
                                    ? 'bg-violet-50 border-violet-200 text-violet-700'
                                    : isEditable
                                        ? 'bg-white border-indigo-200 text-indigo-700 focus:ring-2 focus:ring-indigo-300'
                                        : 'bg-indigo-50/20 border-indigo-100 text-indigo-700'
                            )}
                        />
                    </div>
                );
            })}
        </>
    );
};
