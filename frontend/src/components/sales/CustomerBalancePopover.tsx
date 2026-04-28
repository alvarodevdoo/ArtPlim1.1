import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DollarSign, ShoppingCart, ArrowUpCircle, ArrowDownCircle, History } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface CustomerBalancePopoverProps {
    customerId: string;
    customerName: string;
    balance: number;
}

export const CustomerBalancePopover: React.FC<CustomerBalancePopoverProps> = ({
    customerId,
    customerName,
    balance
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [movements, setMovements] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalCredits: 0, totalDebits: 0 });
    const [hasLoaded, setHasLoaded] = useState(false);

    const fetchDetails = async () => {
        if (hasLoaded) return;
        try {
            setIsLoading(true);
            const response = await api.get(`/api/profiles/${customerId}`);
            if (response.data?.data) {
                setMovements(response.data.data.balanceMovements || []);
                if (response.data.data.balanceStats) {
                    setStats(response.data.data.balanceStats);
                }
            }
            setHasLoaded(true);
        } catch (error) {
            console.error('Erro ao carregar detalhes do saldo:', error);
            toast.error('Erro ao carregar detalhes do saldo');
        } finally {
            setIsLoading(false);
        }
    };

    // Inteligência de Agrupamento: Consolidar movimentações por pedido
    // Isso evita que o "vai e vem" de saldo (uso e estorno no mesmo pedido) infle os totais.
    const orderGroups = movements.reduce((acc, m) => {
        const key = m.orderId || `manual-${m.id}`;
        if (!acc[key]) {
            acc[key] = {
                id: key,
                order: m.order,
                description: m.description,
                credits: 0,
                debits: 0,
                date: m.createdAt,
                isManual: !m.orderId
            };
        }
        if (m.type === 'CREDIT') acc[key].credits += Number(m.amount);
        else acc[key].debits += Math.abs(Number(m.amount));
        return acc;
    }, {} as Record<string, any>);

    const summaries = Object.values(orderGroups)
        .map((g: any) => ({
            ...g,
            net: g.credits - g.debits
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Totais Reais (Líquidos): Apenas o que realmente sobrou de cada operação
    const totalRealCredits = summaries.filter(s => s.net > 0).reduce((sum, s) => sum + s.net, 0);
    const totalRealDebits = summaries.filter(s => s.net < 0).reduce((sum, s) => sum + Math.abs(s.net), 0);

    // O Saldo Anterior é a diferença do que não está detalhado nestes grupos
    const previousBalance = Number(balance) - (totalRealCredits - totalRealDebits);

    return (
        <Popover onOpenChange={(open) => open && fetchDetails()}>
            <PopoverTrigger asChild>
                <button 
                    className="p-1 rounded-full hover:bg-green-100 text-green-600 transition-colors flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                    title="Ver detalhes do saldo"
                >
                    <DollarSign className="w-4 h-4" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 overflow-hidden z-[99999]" align="end">
                <div className="bg-green-600 p-3 text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-xs opacity-80 uppercase font-bold tracking-wider">Saldo Disponível</div>
                            <div className="text-2xl font-black">{formatCurrency(balance)}</div>
                        </div>
                        {Math.abs(previousBalance) > 0.01 && (
                            <div className="text-right">
                                <div className="text-[10px] opacity-70 uppercase font-bold">Saldo Anterior</div>
                                <div className="text-sm font-bold opacity-90">{formatCurrency(previousBalance)}</div>
                            </div>
                        )}
                    </div>
                    <div className="text-[10px] mt-1 opacity-90 truncate font-medium">{customerName}</div>
                </div>
                
                <div className="p-4 space-y-4 max-h-[350px] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center py-8 space-y-2 text-slate-400">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                            <span className="text-xs">Carregando extrato...</span>
                        </div>
                    ) : summaries.length > 0 ? (
                        <>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div className="bg-green-50 p-2 rounded border border-green-100">
                                    <div className="text-green-600 font-bold flex items-center gap-1 mb-1">
                                        <ArrowUpCircle className="w-3 h-3" /> (+) Saldo Gerado
                                    </div>
                                    <div className="text-sm font-bold text-green-700">{formatCurrency(totalRealCredits)}</div>
                                </div>
                                <div className="bg-red-50 p-2 rounded border border-red-100">
                                    <div className="text-red-600 font-bold flex items-center gap-1 mb-1">
                                        <ArrowDownCircle className="w-3 h-3" /> (-) Saldo Consumido
                                    </div>
                                    <div className="text-sm font-bold text-red-700">{formatCurrency(totalRealDebits)}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    <History className="w-3 h-3" /> Resumo por Pedido/Evento
                                </div>
                                <div className="space-y-1">
                                    {summaries.map((s) => (
                                        <div key={s.id} className="flex justify-between items-start p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
                                                    {s.order?.orderNumber ? (
                                                        <>
                                                            <ShoppingCart className="w-3 h-3 text-slate-400" />
                                                            Pedido #{s.order.orderNumber}
                                                        </>
                                                    ) : (
                                                        s.description || (s.net > 0 ? 'Crédito Manual' : 'Débito Manual')
                                                    )}
                                                </span>
                                                <span className="text-[9px] text-slate-400">
                                                    {new Date(s.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className={`text-xs font-bold whitespace-nowrap ${s.net > 0 ? 'text-green-600' : s.net < 0 ? 'text-red-500' : 'text-slate-500 line-through opacity-80'}`}>
                                                    {s.net !== 0 ? (s.net > 0 ? '+' : '') : ''}
                                                    {formatCurrency(s.net === 0 ? s.credits : s.net)}
                                                </span>
                                                {s.net === 0 && (
                                                    <span className="text-[8px] text-slate-400 uppercase font-bold px-1 bg-slate-100 rounded mt-0.5">Compensado</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-slate-400 text-xs">
                            Nenhuma movimentação encontrada.
                        </div>
                    )}
                </div>
                
                <div className="bg-slate-50 p-2 border-t text-center">
                    <p className="text-[9px] text-slate-500 leading-tight">
                        O saldo pode ser usado para abater valores em novos pedidos ou quitar faturas existentes.
                    </p>
                </div>
            </PopoverContent>
        </Popover>
    );
};