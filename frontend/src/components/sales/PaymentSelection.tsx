import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calculator, AlertCircle, Info, X, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';

interface PaymentMethod {
    id: string;
    name: string;
    type: 'PIX' | 'CARD' | 'CASH' | 'TRANSFER' | 'BOLETO' | 'OTHER';
    feePercentage: number | string;
    feeCategoryId?: string | null;
    accountId?: string | null;
    installmentRules?: {
        maxInstallments: number;
        interestFreeInstallments: number;
        installmentFees?: { installment: number; fee: number }[];
        brands?: {
            name: string;
            installmentFees?: { installment: number; fee: number }[];
        }[];
    };
    active: boolean;
}

interface PaymentSelectionProps {
    isOpen: boolean;
    onClose: () => void;
    onAddPayment: (payment: any) => void;
    remainingAmount: number;
    initialPayment?: any;
    onUpdatePayment?: (payment: any) => void;
    receivableId?: string;
    receivableAccountId?: string;
    onSuccess?: () => void;
    availableBalance?: number;
    defaultMethodId?: string;
}

export const PaymentSelection: React.FC<PaymentSelectionProps> = ({
    isOpen,
    onClose,
    onAddPayment,
    remainingAmount,
    initialPayment,
    onUpdatePayment,
    receivableId,
    receivableAccountId,
    onSuccess,
    availableBalance = 0,
    defaultMethodId
}) => {
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [amount, setAmount] = useState<number>(remainingAmount);
    const [installments, setInstallments] = useState<number>(1);
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [justification, setJustification] = useState<string>('');
    const [showJustification, setShowJustification] = useState(false);
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Carregar métodos de pagamento ao abrir o modal ou montar componente
    useEffect(() => {
        const fetchMethods = async () => {
            try {
                setIsLoading(true);
                const response = await api.get('/api/payment-methods');
                if (response.data?.data) {
                    const fetchedMethods = response.data.data.filter((m: PaymentMethod) => m.active);
                    
                    // Adicionar opção virtual de saldo se houver saldo disponível
                    if (availableBalance > 0) {
                        const balanceMethod: any = {
                            id: 'BALANCE',
                            name: 'Saldo do Cliente',
                            type: 'CUSTOMER_BALANCE',
                            feePercentage: 0,
                            active: true
                        };
                        setMethods([balanceMethod, ...fetchedMethods]);
                    } else {
                        setMethods(fetchedMethods);
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar métodos de pagamento:', error);
                toast.error('Erro ao carregar métodos de pagamento');
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen) {
            fetchMethods(); // Recarrega sempre que abrir para garantir dados frescos

            if (initialPayment) {
                setAmount(initialPayment.amount);
                setSelectedMethod(initialPayment.methodId);
                setInstallments(initialPayment.installments || 1);
                setSelectedBrand(initialPayment.brand || '');
                setJustification(initialPayment.justification || '');
                setShowJustification(!!initialPayment.justification);
            } else {
                setAmount(Number(remainingAmount.toFixed(2)));
                setSelectedMethod(defaultMethodId || '');
                setInstallments(1);
                setSelectedBrand('');
                setJustification('');
                setShowJustification(false);
            }
        }
    }, [isOpen, remainingAmount, initialPayment, defaultMethodId]);

    const method = methods.find(m => m.id === selectedMethod);
    
    // Buscar a taxa específica para a bandeira e parcela selecionada
    const getFeePercent = () => {
        if (!method) return 0;
        
        // Se for cartão e tiver bandeiras configuradas
        if (method.type === 'CARD' && method.installmentRules?.brands && selectedBrand) {
            const brand = method.installmentRules.brands.find(b => b.name === selectedBrand);
            if (brand?.installmentFees) {
                const specificFee = brand.installmentFees.find(f => f.installment === installments);
                if (specificFee) return specificFee.fee;
            }
        }
        
        // Fallback para taxas gerais por parcela
        if (method.type === 'CARD' && method.installmentRules?.installmentFees) {
            const specificFee = method.installmentRules.installmentFees.find(f => f.installment === installments);
            if (specificFee) return specificFee.fee;
        }
        
        return Number(method.feePercentage);
    };

    const feePercent = getFeePercent();
    const calculatedFee = method ? (amount * feePercent) / 100 : 0;
    const netAmount = amount - calculatedFee;

    const isReduction = initialPayment && amount < initialPayment.amount;

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = parseFloat(e.target.value) || 0;
        setAmount(newVal);
    };

    const handleConfirm = async () => {
        if (!selectedMethod) {
            toast.error('Selecione um método de pagamento');
            return;
        }

        if (amount <= 0) {
            toast.error('Valor deve ser maior que zero');
            return;
        }

        if (method?.type === 'CARD' && method.installmentRules?.brands && !selectedBrand) {
            toast.error('Selecione uma bandeira');
            return;
        }

        // Regra de Fraude: Justificativa obrigatória se valor for REDUZIDO na edição
        const isReductionCheck = initialPayment && amount < initialPayment.amount;
        if (isReductionCheck && !justification.trim()) {
            setShowJustification(true);
            toast.error('Para redução de valores, é OBRIGATÓRIO informar uma justificativa (Auditoria Financeira)');
            return;
        }

        const paymentData = {
            methodId: selectedMethod,
            methodName: method?.name,
            amount,
            fee: calculatedFee,
            netAmount,
            installments,
            brand: selectedBrand || null,
            justification: (showJustification || isReductionCheck) ? justification : null,
            date: initialPayment?.date || new Date().toISOString()
        };

        setIsLoading(true);
        try {
            // Se tivermos um receivableId, persistimos direto no backend (Fluxo de Liquidação)
            if (receivableId) {
                if (!receivableAccountId) {
                    toast.error('Erro de configuração: conta de recebíveis não encontrada. Reabra o pedido e tente novamente.');
                    return;
                }
                await api.post(`/api/finance/receivables/${receivableId}/pay`, {
                    paymentAccountId: method?.accountId, // Onde o dinheiro entra (Configurado no Método)
                    receivableAccountId: receivableAccountId, // Ativo que é baixado
                    paymentMethodId: selectedMethod,
                    amountPaid: amount,
                    feeAmount: calculatedFee,
                    feeCategoryId: method?.feeCategoryId,
                    notes: (paymentData.brand ? `Bandeira: ${paymentData.brand}. ` : '') + (paymentData.justification || '')
                });
                toast.success('Pagamento liquidado e registrado no plano de contas!');
                if (onSuccess) onSuccess();
            } else {
                // Fluxo em memória (Criação de Pedido)
                if (initialPayment && onUpdatePayment) {
                    onUpdatePayment(paymentData);
                    toast.success('Pagamento atualizado com sucesso!');
                } else {
                    onAddPayment(paymentData);
                    toast.success('Pagamento registrado com sucesso!');
                }
            }
            onClose();
        } catch (error: any) {
            console.error('Erro ao processar pagamento:', error);
            toast.error(error.response?.data?.error?.message || 'Erro ao processar pagamento');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-blue-600">
                        <Calculator className="w-5 h-5" />
                        {initialPayment ? 'Editar Pagamento' : 'Registrar Pagamento'}
                    </h2>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>


                <div className="p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Forma de Pagamento</label>
                        <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="z-[999999]">
                                {methods.map(m => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.name} 
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Bandeira (apenas se o método de cartão tiver bandeiras configuradas) */}
                    {method?.type === 'CARD' && method.installmentRules?.brands && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                            <label className="text-sm font-medium">Bandeira do Cartão</label>
                            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione a bandeira..." />
                                </SelectTrigger>
                                <SelectContent className="z-[999999]">
                                    {method.installmentRules.brands.map(b => (
                                        <SelectItem key={b.name} value={b.name}>
                                            {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {/* Valor */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Valor do Pagamento</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-medium">R$</span>
                                <Input
                                    type="text"
                                    className="pl-9"
                                    value={amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '');
                                      setAmount(Number(val) / 100);
                                    }}
                                />
                            </div>
                        </div>

                        {/* Parcelas (apenas se for cartão) */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Parcelas</label>
                            <Input
                                type="number"
                                min={1}
                                max={12}
                                disabled={method?.type !== 'CARD'}
                                value={installments}
                                onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
                            />
                        </div>
                    </div>

                    {/* Toggle de Justificativa */}
                    {!showJustification && !isReduction && (
                        <div className="flex justify-end">
                            <Button
                                variant="link"
                                size="sm"
                                onClick={() => setShowJustification(true)}
                                className="text-blue-600 h-auto p-0 text-xs"
                            >
                                + Adicionar observação
                            </Button>
                        </div>
                    )}

                    {/* Justificativa */}
                    {(showJustification || isReduction) && (
                        <div className={`space-y-2 p-3 rounded-md animate-in fade-in slide-in-from-top-1 border ${isReduction ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex justify-between items-center">
                                <label className={`flex items-center gap-1 text-[11px] font-bold uppercase ${isReduction ? 'text-amber-800' : 'text-slate-700'}`}>
                                    {isReduction ? <AlertCircle className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                                    {isReduction ? 'Justificativa de Redução (Obrigatório)' : 'Observação / Justificativa'}
                                </label>
                                {!isReduction && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setShowJustification(false);
                                            setJustification('');
                                        }}
                                        className="h-5 w-5 p-0 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                            <Input
                                placeholder={isReduction ? "Explique o motivo da redução do valor..." : "Ex: Desconto autorizado, Sinal pago em dobro..."}
                                value={justification}
                                onChange={(e) => setJustification(e.target.value)}
                                className={`focus-visible:ring-offset-0 bg-white ${isReduction ? 'border-amber-300 focus-visible:ring-amber-500' : 'border-slate-300 focus-visible:ring-slate-500'}`}
                            />
                        </div>
                    )}

                    {/* Resumo do Lançamento */}
                    {selectedMethod && (
                        <div className="bg-slate-50 p-4 rounded-lg border text-sm space-y-2 shadow-inner">
                            <div className="flex justify-between items-center text-slate-500">
                                <span>Valor Bruto</span>
                                <span>R$ {amount.toFixed(2).replace('.', ',')}</span>
                            </div>
                            <div className="flex justify-between items-center text-red-500">
                                <span className="flex items-center gap-1">Taxas ({feePercent.toFixed(2)}%) <Info className="w-3 h-3" /></span>
                                <span>- R$ {calculatedFee.toFixed(2).replace('.', ',')}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t font-bold text-blue-800 text-base">
                                <span>Líquido a Receber</span>
                                <span>R$ {netAmount.toFixed(2).replace('.', ',')}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button 
                        onClick={handleConfirm} 
                        className="bg-blue-600 hover:bg-blue-700 font-bold"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Wait...' : (initialPayment ? 'Atualizar Pagamento' : 'Confirmar Pagamento')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
