import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { X, History, ArrowRight, FileText } from 'lucide-react';

interface OrderHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string;
}

export const OrderHistoryModal: React.FC<OrderHistoryModalProps> = ({
    isOpen,
    onClose,
    orderId
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <History className="w-5 h-5 text-blue-600" />
                            Histórico de Origem de Saldo
                        </h2>
                        <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                            Referência: {orderId}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                        <div className="bg-blue-600 p-2 rounded-full text-white">
                            <FileText className="w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-blue-900">Como este saldo foi gerado?</h4>
                            <p className="text-sm text-blue-700 mt-1">
                                O cliente possuía um pagamento registrado de <strong>R$ 200,00</strong>.
                                Após a edição do pedido {orderId}, o valor total caiu para <strong>R$ 150,00</strong>.
                            </p>
                            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-blue-800 bg-white/50 w-fit px-2 py-1 rounded border border-blue-200">
                                <span>R$ 200,00</span>
                                <ArrowRight className="w-3 h-3" />
                                <span>R$ 150,00</span>
                                <span className="ml-2 bg-green-500 text-white px-1.5 rounded">+ R$ 50,00 Crédito</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Linha do Tempo de Alterações</h4>
                        <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                            <div className="relative">
                                <span className="absolute -left-[19px] top-1 w-3 h-3 rounded-full border-2 border-white bg-blue-600 shadow-sm" />
                                <div className="text-xs font-bold text-slate-400 mb-1">Hoje, 14:20</div>
                                <p className="text-sm font-medium text-slate-800">Pedido {orderId} alterado por <strong>Admin</strong></p>
                                <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded mt-2 border border-slate-100 italic">
                                    "Quantidades reduzidas conforme solicitação via WhatsApp. Removido 2x Placas Personalizadas."
                                </p>
                            </div>

                            <div className="relative">
                                <span className="absolute -left-[19px] top-1 w-3 h-3 rounded-full border-2 border-white bg-slate-300 shadow-sm" />
                                <div className="text-xs font-bold text-slate-400 mb-1">Ontem, 09:15</div>
                                <p className="text-sm font-medium text-slate-800">Pagamento Pix Confirmado</p>
                                <div className="text-xs text-green-600 font-bold mt-1">Valor: R$ 200,00</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t flex justify-end">
                    <Button onClick={onClose} className="bg-slate-800 hover:bg-slate-900">
                        Fechar Detalhes
                    </Button>
                </div>
            </div>
        </div>
    );
};
