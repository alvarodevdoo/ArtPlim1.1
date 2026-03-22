import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { 
    AlertCircle, 
    RefreshCw, 
    X,
    User,
    Calendar,
    FileText,
    Calculator,
    Package
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { calculatePricingResult } from '@/lib/pricing/formulaUtils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface BudgetItem {
    id: string;
    productId: string;
    product: {
        name: string;
        pricingRule?: any;
    };
    width?: number;
    height?: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    costPrice?: number;
    calculatedPrice?: number;
    notes?: string;
    attributes?: any;
    pricingRuleId?: string;
    itemType?: string;
}

interface Budget {
    id: string;
    budgetNumber: string;
    customer?: { id: string; name: string };
    status: string;
    total: number;
    subtotal: number;
    validUntil?: string;
    createdAt: string;
    notes?: string;
    items: BudgetItem[];
}

interface BudgetDetailsModalProps {
    budget: Budget | null;
    isOpen: boolean;
    onClose: () => void;
}

export const BudgetDetailsModal: React.FC<BudgetDetailsModalProps> = ({ budget, isOpen, onClose }) => {
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Carregar configurações para saber o prazo de validade
            api.get('/api/organization/settings')
                .then(res => setSettings(res.data.data))
                .catch(err => console.error("Erro ao carregar configurações:", err));
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen || !budget) return null;

    const isExpired = budget.status === 'EXPIRED' || (budget.validUntil && new Date(budget.validUntil).getTime() < new Date().setHours(0,0,0,0));
    console.log('[DEBUG] Budget Status:', budget.status, 'Valid Until:', budget.validUntil, 'isExpired:', isExpired);

    const handleRecalculate = async () => {
        setIsRecalculating(true);
        try {
            const updatedItems = await Promise.all(budget.items.map(async (item) => {
                const prodRes = await api.get(`/api/catalog/products/${item.productId}`);
                const product = prodRes.data.data;
                if (!product) return item;

                const pricingRule = product.pricingRule;
                if (!pricingRule) return item;

                // Parsear a regra (garantir que formula e config sejam objetos manipuláveis)
                let formulaStr = '';
                let variables = [];

                try {
                    const formulaData = typeof pricingRule.formula === 'string' 
                        ? JSON.parse(pricingRule.formula) 
                        : (pricingRule.formula || {});
                    
                    formulaStr = formulaData.formulaString || formulaData.current || pricingRule.formula || '';
                    variables = formulaData.variables || [];
                    
                    // Se não achou na formula, tenta no config (fallback para outros modelos)
                    if (variables.length === 0) {
                        const config = typeof pricingRule.config === 'string' 
                            ? JSON.parse(pricingRule.config) 
                            : (pricingRule.config || {});
                        variables = config.variables || [];
                    }
                } catch (e) {
                    console.error("Erro ao parsear fórmula:", e);
                    formulaStr = typeof pricingRule.formula === 'string' ? pricingRule.formula : '';
                }

                // Preparar inputs (normalização para lowercase para o motor)
                const inputs: Record<string, any> = {};
                
                // Adicionar dimensões base (LARGURA/ALTURA)
                if (item.width) {
                    inputs['largura'] = Number(item.width);
                    inputs['width'] = Number(item.width);
                }
                if (item.height) {
                    inputs['altura'] = Number(item.height);
                    inputs['height'] = Number(item.height);
                }

                if (item.attributes?.dynamicVariables) {
                    Object.entries(item.attributes.dynamicVariables).forEach(([id, data]: [string, any]) => {
                        const idLow = id.toLowerCase();
                        inputs[idLow] = data.value;
                        inputs[`${idLow}_unit`] = data.unit;
                        // Fallback case sensitive
                        inputs[id] = data.value;
                        inputs[`${id}_unit`] = data.unit;
                    });
                }

                // Adicionar variáveis globais de contexto
                inputs['quantidade'] = item.quantity;
                inputs['custo_materiais'] = item.attributes?.CUSTO_MATERIAIS || 0;

                const result = calculatePricingResult(
                    formulaStr,
                    variables,
                    inputs
                );

                return {
                    ...item,
                    unitPrice: result.value,
                    totalPrice: result.value * item.quantity,
                    calculatedPrice: result.value,
                    pricingRuleId: pricingRule.id
                };
            }));

            const daysToExtend = settings?.validadeOrcamento || 7;
            const newDate = new Date();
            newDate.setDate(newDate.getDate() + daysToExtend);
            
            // Usar formato local YYYY-MM-DD para evitar problemas de fuso horário no UTC
            const formattedDate = newDate.getFullYear() + '-' + 
                String(newDate.getMonth() + 1).padStart(2, '0') + '-' + 
                String(newDate.getDate()).padStart(2, '0');

            console.log('[DEBUG] Recalculating with:', updatedItems.length, 'items');

            const payload = {
                customerId: budget.customer?.id || (budget as any).customerId,
                items: updatedItems.map(i => ({
                    productId: i.productId,
                    itemType: i.itemType,
                    width: (i.width != null) ? Number(i.width) : undefined,
                    height: (i.height != null) ? Number(i.height) : undefined,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    totalPrice: i.totalPrice,
                    attributes: i.attributes,
                    pricingRuleId: i.pricingRuleId,
                    notes: i.notes
                })),
                validUntil: formattedDate
            };

            await api.put(`/api/sales/budgets/${budget.id}`, payload);

            toast.success('Preços atualizados com sucesso!');
            onClose();
            window.location.reload();
        } catch (error) {
            console.error('Erro ao recalcular:', error);
            toast.error('Erro ao atualizar preços');
        } finally {
            setIsRecalculating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                <CardHeader className="border-b bg-gray-50 flex flex-row items-center justify-between p-4 rounded-t-xl">
                    <CardTitle className="text-xl flex items-center space-x-2">
                        <Calculator className="w-6 h-6 text-primary" />
                        <span>Detalhes do Orçamento: {budget.budgetNumber}</span>
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-gray-200 rounded-full">
                        <X className="w-5 h-5" />
                    </Button>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    {isExpired && (
                        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start space-x-3 text-orange-800 animate-in slide-in-from-top-4 duration-300">
                            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="font-bold">Este orçamento está vencido!</p>
                                <p className="text-sm mt-1">As fórmulas e preços dos produtos podem ter sido alterados desde a criação desta proposta. Para garantir a precisão, clique no botão de atualizar preços abaixo.</p>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleRecalculate}
                                    disabled={isRecalculating}
                                    className="mt-3 bg-white border-orange-300 text-orange-700 hover:bg-orange-100 font-bold"
                                >
                                    {isRecalculating ? (
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                    )}
                                    Atualizar Todos os Preços Agora
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Informações Gerais */}
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-900 flex items-center border-b pb-2">
                                    <User className="w-4 h-4 mr-2 text-primary" />
                                    Cliente
                                </h3>
                                <div className="bg-white p-4 rounded-lg border shadow-sm">
                                    <p className="font-semibold text-lg text-primary">{budget.customer?.name || 'Cliente Geral'}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-900 flex items-center border-b pb-2">
                                    <Calendar className="w-4 h-4 mr-2 text-primary" />
                                    Datas e Prazos
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                                        <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Criação</p>
                                        <p className="font-medium">{new Date(budget.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                                        <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Validade</p>
                                        <p className={`font-medium ${isExpired ? 'text-red-500 font-bold' : ''}`}>
                                            {budget.validUntil ? new Date(budget.validUntil).toLocaleDateString() : 'Não informada'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Resumo Financeiro */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-900 flex items-center border-b pb-2">
                                <Calculator className="w-4 h-4 mr-2 text-primary" />
                                Resumo Financeiro
                            </h3>
                            <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-200">
                                <div className="space-y-3">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal</span>
                                        <span className="font-medium">{formatCurrency(budget.subtotal || budget.total)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Desconto</span>
                                        <span className="font-medium">R$ 0,00</span>
                                    </div>
                                    <div className="border-t pt-4 flex justify-between">
                                        <span className="text-xl font-bold">Total</span>
                                        <span className="text-2xl font-black text-primary">{formatCurrency(budget.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Itens do Orçamento */}
                    <div className="mt-8">
                        <h3 className="font-bold text-gray-900 flex items-center border-b pb-2 mb-4">
                            <Package className="w-4 h-4 mr-2 text-primary" />
                            Itens do Orçamento ({budget.items.length})
                        </h3>
                        <div className="overflow-hidden border rounded-xl shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 border-b text-gray-700 uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-bold">Item</th>
                                        <th className="px-4 py-3 text-center font-bold">Qtd</th>
                                        <th className="px-4 py-3 text-right font-bold">Unitário</th>
                                        <th className="px-4 py-3 text-right font-bold">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y bg-white">
                                    {budget.items.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-gray-900">{item.product.name}</p>
                                                {item.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{item.notes}"</p>}
                                            </td>
                                            <td className="px-4 py-4 text-center font-medium">{item.quantity}</td>
                                            <td className="px-4 py-4 text-right font-medium">{formatCurrency(item.unitPrice)}</td>
                                            <td className="px-4 py-4 text-right font-bold text-primary">{formatCurrency(item.totalPrice)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Observações */}
                    {budget.notes && (
                        <div className="mt-8 space-y-2">
                            <h3 className="font-bold text-gray-900 flex items-center">
                                <FileText className="w-4 h-4 mr-2 text-primary" />
                                Observações
                            </h3>
                            <div className="bg-gray-50 p-4 rounded-lg border text-sm text-gray-700 leading-relaxed">
                                {budget.notes}
                            </div>
                        </div>
                    )}
                </CardContent>

                <div className="border-t p-4 bg-gray-50 flex justify-end space-x-3 gap-2 rounded-b-xl">
                    <Button variant="outline" onClick={onClose} className="hover:bg-gray-100" disabled={isRecalculating}>
                        Fechar
                    </Button>
                    <Button 
                        variant="secondary"
                        onClick={handleRecalculate}
                        disabled={isRecalculating || !isExpired}
                        className={!isExpired ? 'hidden' : ''}
                    >
                        {isRecalculating ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Recalcular Orçamento
                    </Button>
                    <Button onClick={() => window.location.href = `/orcamentos/criar?edit=${budget.id}`} disabled={isRecalculating}>
                        Editar Orçamento
                    </Button>
                </div>
            </Card>
        </div>
    );
};
