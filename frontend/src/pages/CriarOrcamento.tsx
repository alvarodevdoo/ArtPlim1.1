import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import {
    Save,
    ArrowLeft,
    FileText,
    Calculator,
    Send,
    AlertCircle,
    RefreshCw
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import AddItemModalFlow from '@/components/pedidos/AddItemModalFlow';
import { ItemType } from '@/types/item-types';
import { Cliente, Produto, ItemPedido } from '@/types/sales';
import { CustomerSelection } from '@/components/sales/CustomerSelection';
import { OrderItemsList } from '@/components/sales/OrderItemsList';
import { calculatePricingResult } from '@/lib/pricing/formulaUtils';

const CriarOrcamento: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('edit');
    const isEditing = !!editId;
    const [loading, setLoading] = useState(false);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [produtos, setProdutos] = useState<Produto[]>([]);

    // Dados do orcamento
    const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
    const [loadingClientes, setLoadingClientes] = useState(false);

    const [itens, setItens] = useState<ItemPedido[]>([]);
    const [validityDate, setValidityDate] = useState('');
    const [notes, setNotes] = useState('');

    // Edição de item
    const [editingItem, setEditingItem] = useState<ItemPedido | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        loadClientes();
        loadProdutos();
        loadSettings();

        if (isEditing && editId) {
            loadOrcamento(editId);
        }
    }, [isEditing, editId]);

    const loadSettings = async () => {
        try {
            const response = await api.get('/api/organization/settings');
            const data = response.data.data;
            setSettings(data);
            
            // Se for novo orçamento, aplicar validade padrão das configurações
            if (!isEditing && data?.validadeOrcamento) {
                const date = new Date();
                date.setDate(date.getDate() + data.validadeOrcamento);
                
                const formattedDate = date.getFullYear() + '-' + 
                    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(date.getDate()).padStart(2, '0');
                
                setValidityDate(formattedDate);
            } else if (!isEditing) {
                // Fallback padrão se não houver configuração
                const date = new Date();
                date.setDate(date.getDate() + 15);
                
                const formattedDate = date.getFullYear() + '-' + 
                    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(date.getDate()).padStart(2, '0');
                
                setValidityDate(formattedDate);
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    };

    const loadOrcamento = async (id: string) => {
        setLoading(true);
        try {
            const response = await api.get(`/api/sales/budgets/${id}`);
            const orcamento = response.data.data;

            if (orcamento.customer) {
                setClienteSelecionado(orcamento.customer);
            }

            if (orcamento.validUntil) {
                setValidityDate(new Date(orcamento.validUntil).toISOString().split('T')[0]);
            }

            if (orcamento.notes) {
                setNotes(orcamento.notes);
            }

            // Mapear itens do backend para o formato ItemPedido
            if (orcamento.items) {
                const itensMapeados: ItemPedido[] = orcamento.items.map((item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    product: item.product,
                    itemType: item.itemType || 'PRODUCT',
                    width: Number(item.width),
                    height: Number(item.height),
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    totalPrice: Number(item.totalPrice),
                    notes: item.notes,
                    attributes: item.attributes || {},
                    pricingRuleId: item.pricingRuleId,
                    customSizeName: item.customSizeName,
                    isCustomSize: item.isCustomSize
                }));
                setItens(itensMapeados);
            }

        } catch (error) {
            console.error('Erro ao carregar orçamento:', error);
            toast.error('Erro ao carregar dados do orçamento');
            navigate('/orcamentos');
        } finally {
            setLoading(false);
        }
    };

    const loadClientes = async () => {
        setLoadingClientes(true);
        try {
            const response = await api.get('/api/profiles?isCustomer=true');
            setClientes(response.data.data || []);
        } catch (error) {
            toast.error('Erro ao carregar clientes');
        } finally {
            setLoadingClientes(false);
        }
    };

    const loadProdutos = async () => {
        try {
            const response = await api.get('/api/catalog/products?include=standardSizes');
            const produtosData = response.data.data || [];

            // Converter productType string para ItemType enum
            const produtosComTipoCorreto = produtosData.map((produto: any) => ({
                ...produto,
                productType: produto.productType as ItemType
            }));

            setProdutos(produtosComTipoCorreto);
        } catch (error) {
            toast.error('Erro ao carregar produtos');
        }
    };

    const handleAddItem = (item: ItemPedido) => {
        const itemWithProduct = {
            ...item,
            product: item.product || produtos.find(p => p.id === item.productId)
        };
        setItens(prev => [...prev, itemWithProduct]);
        setShowAddModal(false);
    };

    const handleUpdateItem = (item: ItemPedido) => {
        const itemWithProduct = {
            ...item,
            product: item.product || produtos.find(p => p.id === item.productId)
        };
        setItens(prev => prev.map(existingItem =>
            existingItem.id === itemWithProduct.id ? itemWithProduct : existingItem
        ));
        setEditingItem(null);
        setShowEditModal(false);
    };

    const abrirModalAdicionar = () => {
        if (produtos.length === 0) {
            toast.error('Não é possível adicionar itens sem produtos cadastrados.');
            return;
        }
        setShowAddModal(true);
    };

    const removerItem = (itemId: string) => {
        setItens(prev => prev.filter(item => item.id !== itemId));
        toast.success('Item removido do orçamento');
    };

    const editarItem = (item: ItemPedido) => {
        const itemWithProduct = {
            ...item,
            product: item.product || produtos.find(p => p.id === item.productId)
        };
        setEditingItem(itemWithProduct);
        setShowEditModal(true);
    };

    const isExpiredFlag = validityDate && new Date(validityDate + 'T23:59:59').getTime() < new Date().setHours(0,0,0,0);

    const handleRecalculateAll = async () => {
        setLoading(true);
        try {
            const updatedItems = await Promise.all(itens.map(async (item) => {
                if (!item.productId) return item;
                
                const prodRes = await api.get(`/api/catalog/products/${item.productId}`);
                const product = prodRes.data.data;
                if (!product || !product.pricingRule) return item;

                const pricingRule = product.pricingRule;
                let formulaStr = '';
                let variables = [];

                try {
                    const formulaData = typeof pricingRule.formula === 'string' 
                        ? JSON.parse(pricingRule.formula) 
                        : (pricingRule.formula || {});
                    
                    formulaStr = formulaData.formulaString || formulaData.current || pricingRule.formula || '';
                    variables = formulaData.variables || [];
                    
                    if (variables.length === 0) {
                        const config = typeof pricingRule.config === 'string' 
                            ? JSON.parse(pricingRule.config) 
                            : (pricingRule.config || {});
                        variables = config.variables || [];
                    }
                } catch (e) {
                    formulaStr = typeof pricingRule.formula === 'string' ? pricingRule.formula : '';
                }

                const inputs: Record<string, any> = {};
                if (item.width) {
                    inputs['largura'] = inputs['width'] = Number(item.width);
                }
                if (item.height) {
                    inputs['altura'] = inputs['height'] = Number(item.height);
                }

                if (item.attributes?.dynamicVariables) {
                    Object.entries(item.attributes.dynamicVariables).forEach(([id, data]: [string, any]) => {
                        const idLow = id.toLowerCase();
                        inputs[idLow] = data.value;
                        inputs[`${idLow}_unit`] = data.unit;
                        inputs[id] = data.value;
                        inputs[`${id}_unit`] = data.unit;
                    });
                }
                inputs['quantidade'] = item.quantity;
                inputs['custo_materiais'] = item.attributes?.CUSTO_MATERIAIS || 0;

                const result = calculatePricingResult(formulaStr, variables, inputs);

                return {
                    ...item,
                    unitPrice: result.value,
                    totalPrice: result.value * item.quantity,
                    pricingRuleId: pricingRule.id
                };
            }));

            setItens(updatedItems);
            
            // Renovar validade baseado nas configurações
            const daysToExtend = settings?.validadeOrcamento || 7;
            const newDate = new Date();
            newDate.setDate(newDate.getDate() + daysToExtend);
            
            const formattedDate = newDate.getFullYear() + '-' + 
                String(newDate.getMonth() + 1).padStart(2, '0') + '-' + 
                String(newDate.getDate()).padStart(2, '0');
            
            setValidityDate(formattedDate);

            toast.success('Preços atualizados com base nas fórmulas atuais!');
        } catch (error) {
            console.error('Erro ao recalcular:', error);
            toast.error('Erro ao atualizar preços');
        } finally {
            setLoading(false);
        }
    };

    const salvarOrcamento = async () => {
        if (!clienteSelecionado) {
            toast.error('Selecione um cliente para salvar o orçamento');
            return;
        }

        if (itens.length === 0) {
            toast.error('Adicione pelo menos um item ao orçamento');
            return;
        }

        setLoading(true);
        try {
            const orcamentoData = {
                customerId: clienteSelecionado.id,
                items: itens.map(item => ({
                    productId: item.productId,
                    itemType: item.itemType,
                    width: (item.width != null) ? Number(item.width) : undefined,
                    height: (item.height != null) ? Number(item.height) : undefined,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    costPrice: 0,
                    calculatedPrice: 0,
                    notes: item.notes,
                    attributes: item.attributes || {},
                    pricingRuleId: item.pricingRuleId,
                    customSizeName: item.customSizeName,
                    isCustomSize: item.isCustomSize
                })),
                validUntil: validityDate,
                notes
            };

            if (isEditing && editId) {
                await api.put(`/api/sales/budgets/${editId}`, orcamentoData);
                toast.success('Orçamento atualizado com sucesso!');
            } else {
                await api.post('/api/sales/budgets', orcamentoData);
                toast.success('Orçamento salvo com sucesso!');
            }

            navigate('/orcamentos');

        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            const message = error.response?.data?.message || 'Erro ao salvar orçamento';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    // Funcao para cálculo rápido total (Simulação)
    const totalOrcamento = itens.reduce((total, item) => total + item.totalPrice, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button variant="outline" onClick={() => navigate('/orcamentos')}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
                            <span>{isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}</span>
                            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                                Simulação
                            </span>
                        </h1>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <Button variant="outline" onClick={() => toast.info('Impressão em desenvolvimento')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Gerar PDF
                    </Button>
                    <Button onClick={salvarOrcamento} disabled={loading || itens.length === 0}>
                        <Save className="w-4 h-4 mr-2" />
                        {loading ? 'Salvando...' : 'Salvar Orçamento'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Formulário Principal */}
                <div className="lg:col-span-2 space-y-6">
                    {isExpiredFlag && isEditing && (
                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start space-x-3 text-orange-800 animate-in slide-in-from-top-4 duration-300">
                            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="font-bold">Atenção: Este orçamento está vencido!</p>
                                <p className="text-sm mt-1">Os preços originais podem estar desatualizados devido a mudanças nas fórmulas ou tabelas de preços.</p>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleRecalculateAll}
                                    disabled={loading}
                                    className="mt-3 bg-white border-orange-300 text-orange-700 hover:bg-orange-100 font-bold"
                                >
                                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                    Atualizar Preços do Orçamento
                                </Button>
                            </div>
                        </div>
                    )}
                    {/* Seleção de Cliente */}
                    <CustomerSelection
                        selectedCustomer={clienteSelecionado}
                        onSelect={setClienteSelecionado}
                        onClear={() => setClienteSelecionado(null)}
                        customers={clientes}
                        loading={loadingClientes}
                    />

                    {/* Lista de Itens */}
                    <OrderItemsList
                        items={itens}
                        onAdd={abrirModalAdicionar}
                        onEdit={editarItem}
                        onRemove={removerItem}
                        editingItemId={editingItem?.id}
                        produtos={produtos}
                    />

                    {/* Observações */}
                    <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
                        <h3 className="text-lg font-medium">Condições do Orçamento</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Validade da Proposta
                                </label>
                                <input
                                    type="date"
                                    className="w-full border rounded-md px-3 py-2"
                                    value={validityDate}
                                    onChange={(e) => setValidityDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Observações para o Cliente
                                </label>
                                <textarea
                                    className="w-full border rounded-md px-3 py-2"
                                    rows={3}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Detalhes sobre pagamento, prazos, etc..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resumo Lateral e Ações Rápidas */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg border shadow-sm sticky top-6">
                        <div className="flex items-center space-x-2 mb-4 text-primary">
                            <Calculator className="w-5 h-5" />
                            <h3 className="text-lg font-medium">Resumo Financeiro</h3>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Itens</span>
                                <span>{itens.length}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Quantidade Total</span>
                                <span>{itens.reduce((sum, item) => sum + item.quantity, 0)}</span>
                            </div>
                            <div className="border-t pt-3 flex justify-between font-bold text-2xl text-primary">
                                <span>Total</span>
                                <span>{formatCurrency(totalOrcamento)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground text-right mt-1">
                                * Valores sujeitos a alteração conforme validade
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => toast.success('Link de aprovação copiado!')}
                            >
                                <Send className="w-4 h-4 mr-2" />
                                Enviar
                            </Button>
                            <Button
                                className="w-full"
                                onClick={salvarOrcamento}
                                disabled={loading || itens.length === 0}
                            >
                                Salvar
                            </Button>
                        </div>

                        {!clienteSelecionado && itens.length > 0 && (
                            <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-md border border-yellow-200">
                                Dica: Você pode fazer simulações rápidas sem selecionar um cliente, mas precisa selecionar um para salvar.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modais de Fluxo de Itens (Reutilizados do Pedido) */}
            <AddItemModalFlow
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAddItem={handleAddItem}
                produtos={produtos}
            />

            {editingItem && (
                <AddItemModalFlow
                    isOpen={showEditModal}
                    onClose={() => {
                        setShowEditModal(false);
                        setEditingItem(null);
                    }}
                    onAddItem={() => { }}
                    onUpdateItem={handleUpdateItem}
                    produtos={produtos}
                    editingItem={editingItem}
                />
            )}
        </div>
    );
};

export default CriarOrcamento;
