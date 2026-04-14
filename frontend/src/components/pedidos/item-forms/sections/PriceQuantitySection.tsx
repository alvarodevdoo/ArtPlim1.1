import React from 'react';
import { Input } from '@/components/ui/Input';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { Unlock, Edit3 } from 'lucide-react';

interface PriceQuantitySectionProps {
    quantity: number;
    setQuantity: (q: number) => void;
    unitPrice: number | string;
    setUnitPrice: (p: number | string) => void;
    isPriceLocked: boolean;
    isPriceUnlocked: boolean;
    setIsPriceUnlocked: (u: boolean) => void;
    setShowAuthModal: (s: boolean) => void;
    isPriceManualRef: React.MutableRefObject<boolean>;
    compLoading: boolean;
}

export const PriceQuantitySection: React.FC<PriceQuantitySectionProps> = ({
    quantity,
    setQuantity,
    unitPrice,
    setUnitPrice,
    isPriceLocked,
    isPriceUnlocked,
    setIsPriceUnlocked,
    setShowAuthModal,
    isPriceManualRef,
    compLoading
}) => {
    return (
        <>
            {/* Quantity */}
            <div className="space-y-1 w-20 shrink-0">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Qtde</label>
                <Input 
                    type="number" 
                    value={quantity || ''} 
                    onChange={(e) => setQuantity(Number(e.target.value))} 
                    placeholder="1" 
                    min="1" 
                    className="h-9 border-slate-300 bg-white text-center font-black text-sm shadow-sm" 
                />
            </div>

            {/* Unit Price */}
            <div className="space-y-1 flex-1 min-w-[150px]">
                <label className="text-[10px] font-bold text-indigo-700 uppercase flex items-center justify-between">
                    <span>Unitário (R$)</span>
                </label>
                <div className="relative flex items-center gap-1">
                    <div className="relative flex-1">
                        <CurrencyInput 
                            value={unitPrice} 
                            onValueChange={(val) => {
                                setUnitPrice(val || 0);
                                isPriceManualRef.current = true;
                            }}
                            disabled={isPriceLocked} 
                            className={`h-9 border-indigo-400 bg-indigo-50/20 text-center font-black text-sm rounded-md text-indigo-900 shadow-sm focus:ring-2 focus:ring-indigo-500 w-full transition-all ${isPriceLocked ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-300 text-slate-500' : ''}`} 
                        />
                        {compLoading && (
                            <div className="absolute inset-y-0 right-2 flex items-center">
                                <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>
                    {isPriceLocked && (
                        <button 
                            type="button"
                            onClick={() => setShowAuthModal(true)}
                            className="shrink-0 h-9 w-9 flex justify-center items-center rounded-md border bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                            title="Solicitar liberação gerencial"
                        >
                            <Edit3 className="w-4 h-4" />
                        </button>
                    )}
                    {!isPriceLocked && isPriceUnlocked && (
                         <button 
                            type="button"
                            onClick={() => setIsPriceUnlocked(false)}
                            className="shrink-0 h-9 w-9 flex justify-center items-center rounded-md border bg-indigo-50 border-indigo-200 text-indigo-600"
                            title="Bloquear novamente"
                        >
                            <Unlock className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};
