import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, DollarSign, Wallet, History, Trash, Pencil, Sparkles, Check, ArrowRight } from 'lucide-react';

interface OrderFinancialStatusProps {
    totalOrder: number;
    paidAmount: number;
    payments?: any[];
    onAddPayment: () => void;
    onRemovePayment: (index: number) => void;
    onEditPayment?: (index: number, payment: any) => void;
    /** Saldo disponível do cliente */
    customerBalance?: number;
    /** Último movimento de saldo (para exibir origem) */
    lastBalanceMovement?: {
        order?: { orderNumber: string };
        description?: string;
    } | null;
    /** Callback para usar o saldo do cliente como pagamento */
    onUseBalance?: (amount: number) => void;
}

export const OrderFinancialStatus: React.FC<OrderFinancialStatusProps> = ({
    totalOrder,
    paidAmount,
    payments = [],
    onAddPayment,
    onRemovePayment,
    onEditPayment,
    customerBalance = 0,
    lastBalanceMovement,
    onUseBalance
}) => {
    const pendingAmount = totalOrder - paidAmount;
    const isPaid = pendingAmount <= 0;
    const overPaid = pendingAmount < 0;
    const hasBalance = customerBalance > 0;
    // Quanto do saldo pode ser usado (limitado ao pendente)
    const usableBalance = Math.min(customerBalance, Math.max(pendingAmount, 0));
    const [applyingBalance, setApplyingBalance] = useState(false);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(Math.abs(value));
    };

    const handleUseBalance = () => {
        if (!onUseBalance || usableBalance <= 0) return;
        setApplyingBalance(true);
        onUseBalance(usableBalance);
        // O estado será resetado pelo re-render após o pagamento ser processado
        setTimeout(() => setApplyingBalance(false), 2000);
    };

    return (
        <Card className="border-blue-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b py-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        Situação Financeira
                    </CardTitle>
                    {isPaid ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                            {overPaid ? 'Pago em Excesso' : 'Pago'}
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                            Pendente
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {/* Métricas Financeiras */}
                <div className="grid grid-cols-1 gap-3">
                    <div className="flex justify-between items-center pb-2 border-b border-dashed">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <History className="w-3 h-3" /> Valor Total Pago
                        </span>
                        <span className="text-sm font-semibold text-green-600 text-right">
                            {formatCurrency(paidAmount)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Wallet className="w-3 h-3" /> Saldo Pendente
                        </span>
                        <span className={`text-sm font-bold text-right ${pendingAmount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {overPaid ? `(Sobressalente: ${formatCurrency(pendingAmount)})` : formatCurrency(pendingAmount)}
                        </span>
                    </div>
                </div>

                {/* ─── SALDO DO CLIENTE (Integrado) ─── */}
                {hasBalance && !isPaid && (
                    <div className="relative rounded-xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 p-4 overflow-hidden">
                        {/* Decoração de fundo */}
                        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100/50 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-12 h-12 bg-teal-100/40 rounded-full translate-y-1/2 -translate-x-1/2" />
                        
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm">
                                        <Wallet className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                            Crédito do Cliente
                                        </span>
                                        {lastBalanceMovement?.order && (
                                            <span className="ml-2 text-[10px] text-emerald-500 font-medium">
                                                via {lastBalanceMovement.order.orderNumber}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-xl font-black text-emerald-700 tabular-nums">
                                    {formatCurrency(customerBalance)}
                                </span>
                            </div>

                            {/* Botão de Usar Saldo */}
                            <Button
                                onClick={handleUseBalance}
                                disabled={applyingBalance || usableBalance <= 0}
                                className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 gap-2 rounded-lg"
                            >
                                {applyingBalance ? (
                                    <>
                                        <Check className="w-4 h-4 animate-bounce" />
                                        Aplicando...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Usar {formatCurrency(usableBalance)} do Saldo
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </Button>

                            {usableBalance < customerBalance && (
                                <p className="text-[10px] text-emerald-600/70 mt-2 text-center italic">
                                    Será aplicado apenas {formatCurrency(usableBalance)} (valor pendente). Restante de {formatCurrency(customerBalance - usableBalance)} ficará disponível.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Saldo já quitado - confirmação visual */}
                {hasBalance && isPaid && (
                    <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs text-emerald-700 font-medium">
                            Cliente possui {formatCurrency(customerBalance)} em crédito disponível para outros pedidos.
                        </span>
                    </div>
                )}

                {/* Histórico de Pagamentos */}
                {payments.length > 0 && (
                    <div className="space-y-2 border-t pt-4">
                        <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pagamentos Realizados</h4>
                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                            {payments.map((p, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded border border-slate-100 group">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-700">{p.methodName}</span>
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(p.date).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="text-right mr-2">
                                            <div className="font-bold text-slate-800">
                                                {formatCurrency(p.amount)}
                                            </div>
                                            {p.installments > 1 && (
                                                <div className="text-[10px] text-blue-600 font-medium">
                                                    {p.installments}x de {formatCurrency(p.amount / p.installments)}
                                                </div>
                                            )}
                                        </div>
                                        {onEditPayment && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => onEditPayment(idx, p)}
                                                title="Editar pagamento"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => onRemovePayment(idx)}
                                            title="Remover pagamento"
                                        >
                                            <Trash className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Botão de Ação - Registrar Pagamento */}
                {!isPaid && (
                    <Button
                        onClick={onAddPayment}
                        variant="outline"
                        className="w-full h-9 text-sm border-blue-200 text-blue-700 hover:bg-blue-50 gap-2"
                    >
                        <CreditCard className="w-4 h-4" />
                        Registrar Pagamento
                    </Button>
                )}

                {overPaid && (
                    <div className="space-y-2">
                        <Button
                            variant="outline"
                            className="w-full h-9 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                            Lançar como Crédito
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full h-8 text-[11px] text-slate-500 hover:text-slate-700"
                        >
                            Devolver ao Cliente
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
