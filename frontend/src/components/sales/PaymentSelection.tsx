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
import { Calculator, AlertCircle, Info, X } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';

interface PaymentMethod {
    id: string;
    name: string;
    type: 'PIX' | 'CARD' | 'CASH' | 'TRANSFER' | 'BOLETO' | 'OTHER';
    feePercentage: number | string;
    active: boolean;
}

interface PaymentSelectionProps {
    isOpen: boolean;
    onClose: () => void;
    onAddPayment: (payment: any) => void;
    remainingAmount: number;
    initialPayment?: any;
    onUpdatePayment?: (payment: any) => void;
}

export const PaymentSelection: React.FC<PaymentSelectionProps> = ({
    isOpen,
    onClose,
    onAddPayment,
    remainingAmount,
    initialPayment,
    onUpdatePayment
}) => {
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [amount, setAmount] = useState<number>(remainingAmount);
    const [installments, setInstallments] = useState<number>(1);
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
                    setMethods(response.data.data.filter((m: PaymentMethod) => m.active));
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
                setJustification(initialPayment.justification || '');
                setShowJustification(!!initialPayment.justification);
            } else {
                setAmount(remainingAmount);
                setSelectedMethod('');
                setInstallments(1);
                setJustification('');
                setShowJustification(false);
            }
        }
    }, [isOpen, remainingAmount, initialPayment]);

    const method = methods.find(m => m.id === selectedMethod);
    const feePercent = method ? Number(method.feePercentage) : 0;
    const calculatedFee = method ? (amount * feePercent) / 100 : 0;
    const netAmount = amount - calculatedFee;

    const isReduction = initialPayment && amount < initialPayment.amount;

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = parseFloat(e.target.value) || 0;
        setAmount(newVal);
    };

    const handleConfirm = () => {
        if (!selectedMethod) {
            toast.error('Selecione um método de pagamento');
            return;
        }

        if (amount <= 0) {
            toast.error('Valor deve ser maior que zero');
            return;
        }

        // Regra de Fraude: Justificativa obrigatória se valor for REDUZIDO na edição
        const isReductionCheck = initialPayment && amount < initialPayment.amount;
        if (isReductionCheck && !justification.trim()) {
            setShowJustification(true);
            toast.error('Para redução de valores, é OBRIGATÓRIO informar uma justificativa (Auditoria Financeira)');
            return;
        }

        // Se o usuário abriu o campo manualmente, exige preenchimento
        if (showJustification && !justification.trim() && !isReductionCheck) {
            toast.error('Por favor, informe a observação ou feche o campo');
            return;
        }

        const paymentData = {
            methodId: selectedMethod,
            methodName: method?.name,
            amount,
            fee: calculatedFee,
            netAmount,
            installments,
            justification: (showJustification || isReductionCheck) ? justification : null,
            date: initialPayment?.date || new Date().toISOString() // Preservar data original na edição
        };

        if (initialPayment && onUpdatePayment) {
            onUpdatePayment(paymentData);
            toast.success('Pagamento atualizado com sucesso!');
        } else {
            onAddPayment(paymentData);
            toast.success('Pagamento registrado com sucesso!');
        }

        onClose();
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
                    {/* Método de Pagamento */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Forma de Pagamento</label>
                        <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="z-[999999]">
                                {methods.map(m => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.name} {Number(m.feePercentage) > 0 && `(${m.feePercentage}%)`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Valor */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Valor do Pagamento</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-medium">R$</span>
                                <Input
                                    type="number"
                                    className="pl-9"
                                    value={amount}
                                    onChange={handleAmountChange}
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
                                <span className="flex items-center gap-1">Taxas ({method?.feePercentage}%) <Info className="w-3 h-3" /></span>
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
                    <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 font-bold">
                        {initialPayment ? 'Atualizar Pagamento' : 'Confirmar Pagamento'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
