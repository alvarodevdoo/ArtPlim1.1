import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, DollarSign, Wallet, ArrowRight, History, Trash, Pencil } from 'lucide-react';

interface OrderFinancialStatusProps {
    totalOrder: number;
    paidAmount: number;
    payments?: any[];
    clientBalance?: number;
    balanceSourceOrder?: string;
    onViewOrigin?: (orderId: string) => void;
    onAddPayment: () => void;
    onRemovePayment: (index: number) => void;
    onEditPayment?: (index: number, payment: any) => void;
}

export const OrderFinancialStatus: React.FC<OrderFinancialStatusProps> = ({
    totalOrder,
    paidAmount,
    payments = [],
    clientBalance = 0,
    balanceSourceOrder,
    onViewOrigin,
    onAddPayment,
    onRemovePayment,
    onEditPayment
}) => {
    // ... (rest of the code unchanged until payments list)
    const pendingAmount = totalOrder - paidAmount;
    const isPaid = pendingAmount <= 0;
    const overPaid = pendingAmount < 0;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(Math.abs(value));
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

                    {clientBalance > 0 && (
                        <div className="mt-2 p-2 bg-blue-50 rounded-md border border-blue-100 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-blue-600">Saldo do Cliente</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-blue-800">{formatCurrency(clientBalance)}</span>
                                    {balanceSourceOrder && (
                                        <button
                                            onClick={() => onViewOrigin?.(balanceSourceOrder)}
                                            className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-200 transition-colors cursor-pointer flex items-center gap-1 font-bold"
                                        >
                                            Origem: {balanceSourceOrder}
                                            <ArrowRight className="w-2 h-2" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] text-blue-700 hover:bg-blue-100 p-1">
                                Usar Saldo <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                        </div>
                    )}
                </div>

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

                {/* Botão de Ação */}
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
