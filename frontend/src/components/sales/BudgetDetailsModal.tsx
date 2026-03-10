import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { X, FileText, User, ShoppingBag, Calendar as CalendarIcon, ClipboardList } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DatasOrcamento } from '@/components/ui/DatasOrcamento';

interface BudgetItem {
    id: string;
    productId: string;
    product?: { name: string };
    itemType: string;
    width?: number;
    height?: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    isCustomSize?: boolean;
    customSizeName?: string;
}

interface Budget {
    id: string;
    budgetNumber: string;
    customer?: { name: string };
    status: string;
    total: number;
    createdAt: string;
    validUntil?: string;
    notes?: string;
    items: BudgetItem[];
}

interface BudgetDetailsModalProps {
    budget: Budget | null;
    isOpen: boolean;
    onClose: () => void;
}

export const BudgetDetailsModal: React.FC<BudgetDetailsModalProps> = ({ budget, isOpen, onClose }) => {

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen || !budget) return null;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT': return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold uppercase tracking-wider">Orçamento Criado</span>;
            case 'SENT': return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold uppercase tracking-wider">Enviado</span>;
            case 'APPROVED': return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold uppercase tracking-wider">Aprovado</span>;
            case 'REJECTED': return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold uppercase tracking-wider">Rejeitado</span>;
            case 'EXPIRED': return <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold uppercase tracking-wider">Vencido</span>;
            default: return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold uppercase tracking-wider">{status}</span>;
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                <CardHeader className="border-b sticky top-0 bg-white z-10 flex flex-row items-center justify-between pb-4">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl">{budget.budgetNumber}</CardTitle>
                            <div className="mt-1">{getStatusBadge(budget.status)}</div>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={onClose} className="rounded-full h-10 w-10 p-0">
                        <X className="w-5 h-5" />
                    </Button>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Informações Gerais */}
                        <div className="space-y-6">
                            <section>
                                <div className="flex items-center space-x-2 text-primary font-semibold mb-3">
                                    <User className="w-4 h-4" />
                                    <h4>Informações do Cliente</h4>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <p className="text-lg font-bold text-gray-800">{budget.customer?.name || 'Cliente não identificado'}</p>
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center space-x-2 text-primary font-semibold mb-3">
                                    <CalendarIcon className="w-4 h-4" />
                                    <h4>Cronograma e Validade</h4>
                                </div>
                                <DatasOrcamento
                                    criadoEm={budget.createdAt}
                                    validadeEm={budget.validUntil}
                                    className="bg-gray-50 p-4 rounded-xl border border-gray-100"
                                />
                            </section>
                        </div>

                        {/* Resumo Financeiro */}
                        <div>
                            <section>
                                <div className="flex items-center space-x-2 text-primary font-semibold mb-3">
                                    <ShoppingBag className="w-4 h-4" />
                                    <h4>Resumo do Orçamento</h4>
                                </div>
                                <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 flex flex-col items-center justify-center">
                                    <p className="text-sm text-primary/70 uppercase font-bold tracking-widest mb-1">Total Geral</p>
                                    <p className="text-4xl font-black text-primary">{formatCurrency(Number(budget.total))}</p>
                                    <p className="text-xs text-primary/60 mt-2">{budget.items.length} item(ns) incluídos</p>
                                </div>
                            </section>

                            {budget.notes && (
                                <section className="mt-6">
                                    <div className="flex items-center space-x-2 text-primary font-semibold mb-3">
                                        <ClipboardList className="w-4 h-4" />
                                        <h4>Observações</h4>
                                    </div>
                                    <div className="bg-yellow-50/50 p-4 rounded-xl border border-yellow-100 text-sm text-gray-700 whitespace-pre-wrap italic">
                                        {budget.notes}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>

                    {/* Lista de Itens */}
                    <section className="mt-10">
                        <div className="flex items-center space-x-2 text-primary font-semibold mb-4 border-b pb-2">
                            <ShoppingBag className="w-4 h-4" />
                            <h4>Itens do Orçamento</h4>
                        </div>
                        <div className="overflow-x-auto rounded-xl border shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Item</th>
                                        <th className="px-4 py-3 text-center">Qtd</th>
                                        <th className="px-4 py-3">Dimensões</th>
                                        <th className="px-4 py-3 text-right">Unitário</th>
                                        <th className="px-4 py-3 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {budget.items.map((item, index) => (
                                        <tr key={item.id || index} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-gray-900">{item.product?.name || 'Produto'}</p>
                                                {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
                                                {item.itemType === 'SERVICE' && (
                                                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] uppercase font-bold">Serviço</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center font-medium">{item.quantity}</td>
                                            <td className="px-4 py-4 text-gray-600 font-mono text-xs">
                                                {item.width && item.height && Number(item.width) > 0 ? (
                                                    `${Number(item.width)} x ${Number(item.height)} mm`
                                                ) : item.isCustomSize ? (
                                                    item.customSizeName || 'Medida Especial'
                                                ) : (
                                                    '--'
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right tabular-nums">{formatCurrency(Number(item.unitPrice))}</td>
                                            <td className="px-4 py-4 text-right font-bold tabular-nums text-primary">{formatCurrency(Number(item.totalPrice))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </CardContent>

                <div className="border-t p-4 bg-gray-50 flex justify-end space-x-3 gap-2 rounded-b-xl">
                    <Button variant="outline" onClick={onClose} className="hover:bg-gray-100">
                        Fechar
                    </Button>
                    <Button onClick={() => window.location.href = `/orcamentos/criar?edit=${budget.id}`}>
                        Editar Orçamento
                    </Button>
                </div>
            </Card>
        </div>
    );
};
