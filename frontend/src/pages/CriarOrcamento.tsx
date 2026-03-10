import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import {
    Save,
    ArrowLeft,
    FileText,
    Calculator,
    Send
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import AddItemModalFlow from '@/components/pedidos/AddItemModalFlow';
import { ItemType } from '@/types/item-types';
import { Cliente, Produto, ItemPedido } from '@/types/sales';
import { CustomerSelection } from '@/components/sales/CustomerSelection';
import { OrderItemsList } from '@/components/sales/OrderItemsList';

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

    useEffect(() => {
        loadClientes();
        loadProdutos();

        if (isEditing && editId) {
            loadOrcamento(editId);
        } else {
            // Set default validity to 15 days from now for new budgets
            const date = new Date();
            date.setDate(date.getDate() + 15);
            setValidityDate(date.toISOString().split('T')[0]);
        }
    }, [isEditing, editId]);

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
                    width: item.width,
                    height: item.height,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    costPrice: 0,
                    calculatedPrice: 0,
                    notes: item.notes,
                    attributes: item.attributes || {},
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
                        <p className="text-muted-foreground">
                            Crie orçamentos e simulações de preço para seus clientes
                        </p>
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
