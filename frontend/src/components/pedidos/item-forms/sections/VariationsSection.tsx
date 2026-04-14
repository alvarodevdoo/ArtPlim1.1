import React from 'react';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VariationsSectionProps {
    configuracoes: any[];
    opcoesSelecionadas: Record<string, string>;
    setOpcoesSelecionadas: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    blockedIds: string[];
}

export const VariationsSection: React.FC<VariationsSectionProps> = ({
    configuracoes,
    opcoesSelecionadas,
    setOpcoesSelecionadas,
    blockedIds
}) => {
    if (!Array.isArray(configuracoes) || configuracoes.length === 0) return null;

    return (
        <>
            {configuracoes.map(config => (
                <div key={config.id} className="space-y-1 flex-1 min-w-[150px]">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase truncate">
                        {config.name}
                    </Label>
                    <Select
                        value={opcoesSelecionadas[config.id] || ''}
                        onValueChange={(val) => setOpcoesSelecionadas(prev => ({ ...prev, [config.id]: val }))}
                    >
                        <SelectTrigger className="bg-white border-slate-300 h-9 rounded-md text-sm shadow-sm focus:ring-1 focus:ring-indigo-500">
                            <SelectValue placeholder="Opção..." />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.isArray(config.options) && config.options.map((opt: any) => (
                                <SelectItem key={opt.id} value={opt.id} disabled={blockedIds.includes(opt.id) || !opt.isAvailable}>
                                    <div className="flex justify-between items-center w-full min-w-[180px] text-xs">
                                        <span>{opt.label}</span>
                                        {Number(opt.priceModifier) !== 0 && (
                                            <span className="text-[9px] text-emerald-600 ml-2">
                                                {Number(opt.priceModifier) > 0 ? '+' : ''} R$ {Number(opt.priceModifier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ))}
        </>
    );
};
