import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import {
  Save,
  ArrowLeft,
  FileText,
  AlertCircle
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import AddItemModalFlow from '@/components/pedidos/AddItemModalFlow';
import { ItemType } from '@/types/item-types';
import { Cliente, Produto, ItemPedido } from '@/types/sales';
import { CustomerSelection } from '@/components/sales/CustomerSelection';
import { OrderItemsList } from '@/components/sales/OrderItemsList';
import { OrderFinancialStatus } from '@/components/sales/OrderFinancialStatus';
import { PaymentSelection } from '@/components/sales/PaymentSelection';
import { OrderHistoryModal } from '@/components/sales/OrderHistoryModal';

const CriarPedido: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const fromBudgetId = searchParams.get('fromBudget');
  const isEditing = !!editId;
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);


  // Dados do pedido
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(false);

  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  // Pagamentos (Mock)
  const [payments, setPayments] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedOriginOrder, setSelectedOriginOrder] = useState<string>('');
  const [processStatuses, setProcessStatuses] = useState<any[]>([]);

  // Edição de item
  const [editingItem, setEditingItem] = useState<ItemPedido | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadClientes();
    loadProdutos();
    loadProcessStatuses();

    // Se estiver editando, carregar dados do pedido
    if (isEditing && editId) {
      loadPedidoParaEdicao(editId);
    } else if (fromBudgetId) {
      loadBudgetData(fromBudgetId);
    }
  }, [isEditing, editId, fromBudgetId]);

  const loadProcessStatuses = async () => {
    try {
      const response = await api.get('/api/organization/config/process-statuses');
      setProcessStatuses(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar status de processo:', error);
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
        productType: produto.productType as ItemType // Cast para ItemType
      }));

      setProdutos(produtosComTipoCorreto);

      // Verificar se não há produtos cadastrados
      if (produtosData.length === 0) {
        toast.error('Nenhum produto cadastrado. Cadastre produtos antes de criar pedidos.', {
          duration: 5000,
          action: {
            label: 'Ir para Produtos',
            onClick: () => navigate('/produtos')
          }
        });
        return;
      }

      /*
      // Verificar se há materiais cadastrados (necessário para produtos)
      try {
        const materialsResponse = await api.get('/api/catalog/materials');
        const materialsData = materialsResponse.data.data || [];

        if (materialsData.length === 0) {
          toast.error('Nenhum material cadastrado. Cadastre materiais antes de criar pedidos.', {
            duration: 5000,
            action: {
              label: 'Ir para Materiais',
              onClick: () => navigate('/materiais')
            }
          });
        }
      } catch (error) {
        // Error checking materials
      }
      */
    } catch (error) {
      toast.error('Erro ao carregar produtos');
    }
  };

  const loadPedidoParaEdicao = async (pedidoId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/sales/orders/${pedidoId}`);
      const pedido = response.data.data;

      // Verificar se o pedido pode ser editado
      if (pedido.status === 'DELIVERED') {
        toast.error('Pedidos entregues não podem ser editados');
        navigate('/pedidos');
        return;
      }

      // Carregar dados do cliente
      setClienteSelecionado(pedido.customer);

      // Carregar itens do pedido
      const itensCarregados = pedido.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        product: item.product,
        itemType: item.product?.productType || item.itemType || ItemType.PRODUCT, // Usar productType do produto
        width: item.width,
        height: item.height,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        notes: item.notes,
        attributes: item.attributes || {},
        pricingRuleId: item.pricingRuleId,

        // Legacy fields for backward compatibility
        area: item.area,
        paperSize: item.paperSize,
        paperType: item.paperType,
        printColors: item.printColors,
        finishing: item.finishing,
        machineTime: item.machineTime,
        setupTime: item.setupTime,
        complexity: item.complexity,

        // Tamanho personalizado
        customSizeName: item.customSizeName,
        isCustomSize: item.isCustomSize || false,

        // Status do item
        processStatusId: item.processStatusId,
        processStatus: item.processStatus,
        status: item.status
      }));

      setItens(itensCarregados);
      setDeliveryDate(pedido.deliveryDate ? new Date(pedido.deliveryDate).toISOString().split('T')[0] : '');
      setNotes(pedido.notes || '');

      // Carregar pagamentos (transações)
      if (pedido.transactions && pedido.transactions.length > 0) {
        const pagamentosCarregados = pedido.transactions
          .filter((t: any) => t.status !== 'CANCELLED' && t.type === 'INCOME')
          .map((t: any) => ({
            methodId: t.paymentMethodId,
            methodName: t.paymentMethod?.name || 'Método Desconhecido',
            amount: Number(t.amount),
            installments: 1,
            date: t.paidAt,
            justification: t.auditNotes || undefined,
            fee: 0,
            netAmount: Number(t.amount)
          }));
        setPayments(pagamentosCarregados);
      }

      toast.success('Pedido carregado para edição!');
    } catch (error: any) {
      toast.error('Erro ao carregar pedido para edição');
      navigate('/pedidos');
    } finally {
      setLoading(false);
    }
  };



  // Handle item status change (for workflow status, not production status)
  const handleItemStatusChange = (itemId: string, newStatus: string) => {
    setItens(prev => prev.map(item =>
      item.id === itemId ? { ...item, status: newStatus } as any : item
    ));
    toast.success('Status do item atualizado');
  };

  const loadBudgetData = async (budgetId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/sales/budgets/${budgetId}`);
      const budget = response.data.data;

      // Carregar dados do cliente do orçamento
      setClienteSelecionado(budget.customer);

      // Carregar itens do orçamento e mapear para itens de pedido
      const itensCarregados = budget.items.map((item: any) => ({
        id: `temp-${Math.random().toString(36).substr(2, 9)}`, // Novo ID temporário para o pedido
        productId: item.productId,
        product: item.product,
        itemType: item.product?.productType || item.itemType || ItemType.PRODUCT,
        width: item.width,
        height: item.height,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        notes: item.notes,
        attributes: item.attributes || {},
        pricingRuleId: item.pricingRuleId,
        customSizeName: item.customSizeName,
        isCustomSize: item.isCustomSize || false
      }));

      setItens(itensCarregados);
      setNotes(budget.notes ? `Gerado a partir do orçamento ${budget.budgetNumber}. ${budget.notes}` : `Gerado a partir do orçamento ${budget.budgetNumber}.`);

      toast.success(`Dados carregados do orçamento ${budget.budgetNumber}`);
    } catch (error: any) {
      console.error('Erro ao carregar orçamento:', error);
      toast.error('Erro ao carregar dados do orçamento para gerar o pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (item: ItemPedido) => {
    // Ensure product data is available
    const itemWithProduct = {
      ...item,
      product: item.product || produtos.find(p => p.id === item.productId)
    };
    setItens(prev => [...prev, itemWithProduct]);
    setShowAddModal(false);
  };

  const handleUpdateItem = (item: ItemPedido) => {
    // Ensure product data is preserved
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
    // Verificar se há produtos cadastrados
    if (produtos.length === 0) {
      toast.error('Não é possível adicionar itens sem produtos cadastrados.', {
        duration: 5000,
        action: {
          label: 'Cadastrar Produtos',
          onClick: () => navigate('/produtos')
        }
      });
      return;
    }

    setShowAddModal(true);
  };

  const removerItem = (itemId: string) => {
    setItens(prev => prev.filter(item => item.id !== itemId));
    toast.success('Item removido do pedido');
  };

  const editarItem = (item: ItemPedido) => {
    // Ensure product data is available
    const itemWithProduct = {
      ...item,
      product: item.product || produtos.find(p => p.id === item.productId)
    };
    setEditingItem(itemWithProduct);
    setShowEditModal(true);
  };

  // Edição de pagamento
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editingPaymentIndex, setEditingPaymentIndex] = useState<number>(-1);

  const handleEditPayment = (index: number, payment: any) => {
    setEditingPayment(payment);
    setEditingPaymentIndex(index);
    setShowPaymentModal(true);
  };

  const handleUpdatePayment = (updatedPayment: any) => {
    if (editingPaymentIndex >= 0) {
      setPayments(prev => {
        const newPayments = [...prev];
        newPayments[editingPaymentIndex] = updatedPayment;
        return newPayments;
      });
      setShowPaymentModal(false);
      setEditingPayment(null);
      setEditingPaymentIndex(-1);
    }
  };

  // Remoção de pagamento
  const [paymentToRemoveIndex, setPaymentToRemoveIndex] = useState<number | null>(null);
  const [removalJustification, setRemovalJustification] = useState('');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const handleRemovePayment = (index: number) => {
    setPaymentToRemoveIndex(index);
    setRemovalJustification('');
    setShowRemoveConfirm(true);
  };

  const confirmRemovePayment = () => {
    if (!removalJustification.trim()) {
      toast.error('Justificativa é obrigatória para cancelamento de pagamento');
      return;
    }

    if (paymentToRemoveIndex !== null) {
      setPayments(prev => prev.filter((_, i) => i !== paymentToRemoveIndex));
      toast.success('Pagamento removido e justificado');
      setShowRemoveConfirm(false);
      setPaymentToRemoveIndex(null);
    }
  };

  const salvarPedido = async () => {
    if (!clienteSelecionado) {
      toast.error('Selecione um cliente');
      return;
    }

    if (itens.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido');
      return;
    }

    // Validação robusta: verificar se há produtos cadastrados
    if (produtos.length === 0) {
      toast.error('Não é possível criar pedidos sem produtos cadastrados.', {
        duration: 5000,
        action: {
          label: 'Cadastrar Produtos',
          onClick: () => navigate('/produtos')
        }
      });
      return;
    }

    // Validar se todos os itens têm dados obrigatórios
    const itensInvalidos = itens.filter(item => {
      const problems = [];
      const isService = item.itemType === ItemType.SERVICE;

      if (!item.productId || item.productId.trim() === '') problems.push('productId vazio');
      if (!item.quantity || item.quantity <= 0 || isNaN(item.quantity)) problems.push('quantity inválida');
      if (!item.unitPrice && item.unitPrice !== 0 || item.unitPrice < 0 || isNaN(item.unitPrice)) problems.push('unitPrice inválido');
      if (!item.totalPrice && item.totalPrice !== 0 || item.totalPrice < 0 || isNaN(item.totalPrice)) problems.push('totalPrice inválido');

      // Validar se o produto ainda existe na lista de produtos carregados (apenas para produtos, não serviços)
      if (!isService) {
        const produtoExiste = produtos.find(p => p.id === item.productId);
        if (!produtoExiste) problems.push('produto não encontrado');
      }

      if (problems.length > 0) {
        return true;
      }
      return false;
    });

    if (itensInvalidos.length > 0) {
      // Items with validation problems found
      toast.error(`Existem ${itensInvalidos.length} item(ns) com dados incompletos ou produtos inválidos. Verifique os produtos, quantidades e preços.`);
      return;
    }

    // Validar se todos os produtos dos itens ainda existem no backend (apenas produtos, não serviços)
    const productIds = itens
      .filter(item => item.itemType !== ItemType.SERVICE)
      .map(item => item.productId);
    const uniqueProductIds = [...new Set(productIds)];

    try {
      const validationPromises = uniqueProductIds.map(async (productId) => {
        try {
          const response = await api.get(`/api/catalog/products/${productId}`);
          return { productId, exists: !!response.data.data };
        } catch (error) {
          return { productId, exists: false };
        }
      });

      const validationResults = await Promise.all(validationPromises);
      const invalidProducts = validationResults.filter(result => !result.exists);

      if (invalidProducts.length > 0) {
        const invalidProductNames = invalidProducts.map(result => {
          const item = itens.find(i => i.productId === result.productId);
          return item?.product?.name || result.productId;
        });

        toast.error(`Os seguintes produtos não existem mais: ${invalidProductNames.join(', ')}. Remova estes itens e tente novamente.`);
        return;
      }
    } catch (error) {
      toast.error('Erro ao validar produtos. Tente novamente.');
      return;
    }

    // Prepare order data for submission
    setLoading(true);
    try {
      const pedidoData = {
        customerId: clienteSelecionado.id,
        items: itens.map(item => ({
          productId: item.productId,
          itemType: item.itemType, // Usar itemType do item (que vem do productType)
          width: item.width ? Number(item.width) : undefined,
          height: item.height ? Number(item.height) : undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice), // Campo obrigatório que estava faltando
          notes: item.notes,
          pricingRuleId: item.pricingRuleId,
          attributes: item.attributes || {},

          // Legacy fields for backward compatibility
          area: item.area,
          paperSize: item.paperSize,
          paperType: item.paperType,
          printColors: item.printColors,
          finishing: item.finishing,
          machineTime: item.machineTime,
          setupTime: item.setupTime,
          complexity: item.complexity,

          // Tamanho personalizado
          customSizeName: item.customSizeName,
          isCustomSize: item.isCustomSize,

          // Status de processo do item
          processStatusId: item.processStatusId || undefined
        })),
        deliveryDate: deliveryDate || undefined,
        notes: notes || undefined,
        payments: payments.map(p => ({
          methodId: p.methodId,
          methodName: p.methodName,
          amount: p.amount,
          fee: p.fee,
          netAmount: p.netAmount,
          installments: p.installments,
          // Verifica se p.date é objeto Date ou string
          date: (typeof p.date === 'string' ? p.date : p.date.toISOString()),
          justification: p.justification || undefined
        }))
      };
      
      if (isEditing && editId) {
        // Atualizar pedido existente
        await api.put(`/api/sales/orders/${editId}`, pedidoData);
        toast.success('Pedido atualizado com sucesso!');
      } else {
        // Criar novo pedido
        await api.post('/api/sales/orders', pedidoData);
        toast.success('Pedido criado com sucesso!');
      }

      navigate('/pedidos');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao salvar pedido';
      const errorCode = error.response?.data?.code;

      if (errorCode === 'NO_PRODUCTS_AVAILABLE') {
        toast.error(errorMessage, {
          duration: 5000,
          action: {
            label: 'Cadastrar Produtos',
            onClick: () => navigate('/produtos')
          }
        });
      } else if (errorCode === 'INVALID_PRODUCTS') {
        toast.error(errorMessage);
      } else if (errorCode === 'NO_MATERIALS_AVAILABLE') {
        // Removido conforme solicitação
        /*
        toast.error('Não é possível criar pedidos sem materiais cadastrados.', {
          duration: 5000,
          action: {
            label: 'Cadastrar Materiais',
            onClick: () => navigate('/materiais')
          }
        });
        */
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/pedidos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <span>
                {isEditing ? 'Editar Pedido' : fromBudgetId ? 'Gerar Pedido de Orçamento' : 'Criar Novo Pedido'}
              </span>
              {isEditing && (
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  Editando
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              {isEditing
                ? 'Modifique as informações do pedido existente'
                : 'Preencha as informações para criar um novo pedido ou orçamento'
              }
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" disabled={loading}>
            <FileText className="w-4 h-4 mr-2" />
            Salvar Pedido
          </Button>
          <Button onClick={salvarPedido} disabled={loading || !clienteSelecionado || itens.length === 0}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Salvando...' : isEditing ? 'Atualizar Pedido' : 'Criar Pedido'}
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
            onItemStatusChange={handleItemStatusChange}
            processStatuses={processStatuses}
          />

          {/* Observações e Envio */}
          <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
            <h3 className="text-lg font-medium">Informações Adicionais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Entrega Prevista
                </label>
                <input
                  type="date"
                  className="w-full border rounded-md px-3 py-2"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações Gerais
                </label>
                <textarea
                  className="w-full border rounded-md px-3 py-2"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações importantes sobre o pedido..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Resumo Lateral */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm sticky top-6">
            <h3 className="text-lg font-medium mb-4">Resumo do Pedido</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Itens ({itens.length})</span>
                <span>{itens.reduce((sum, item) => sum + item.quantity, 0)} un</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(itens.reduce((total, item) => total + item.totalPrice, 0))}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(itens.reduce((total, item) => total + item.totalPrice, 0))}</span>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={salvarPedido}
              disabled={loading || !clienteSelecionado || itens.length === 0}
            >
              {loading ? 'Processando...' : (isEditing ? 'Atualizar Pedido' : 'Finalizar Pedido')}
            </Button>
          </div>

          {/* Situação Financeira (Novo) */}
          {itens.length > 0 && (
            <OrderFinancialStatus
              totalOrder={itens.reduce((total, item) => total + item.totalPrice, 0)}
              paidAmount={payments.reduce((total, p) => total + p.amount, 0)}
              payments={payments}
              clientBalance={50.00}
              balanceSourceOrder="PED-0042" // Mock de origem do saldo
              onViewOrigin={(orderId) => {
                setSelectedOriginOrder(orderId);
                setShowHistoryModal(true);
              }}
              onAddPayment={() => {
                setEditingPayment(null);
                setEditingPaymentIndex(-1);
                setShowPaymentModal(true);
              }}
              onRemovePayment={handleRemovePayment}
              onEditPayment={handleEditPayment}
            />
          )}
        </div>
      </div>

      {/* Modais de Fluxo de Itens */}
      <PaymentSelection
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setEditingPayment(null);
          setEditingPaymentIndex(-1);
        }}
        remainingAmount={itens.reduce((total, item) => total + item.totalPrice, 0) - payments.reduce((total, p) => total + p.amount, 0) + (editingPayment?.amount || 0)}
        initialPayment={editingPayment}
        onAddPayment={(newPayment) => setPayments([...payments, newPayment])}
        onUpdatePayment={handleUpdatePayment}
      />

      <OrderHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        orderId={selectedOriginOrder}
      />
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
          onAddItem={() => { }} // Não usado em edição, mas obrigatório na interface se não for opcional (verificar interface, parece que onAddItem é obrigatório)
          onUpdateItem={handleUpdateItem}
          produtos={produtos}
          editingItem={editingItem}
        />
      )}
      {/* Modal de Confirmação de Remoção */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRemoveConfirm(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-red-600 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Cancelar Pagamento
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Para auditoria e segurança, é obrigatório informar o motivo do cancelamento deste pagamento.
            </p>

            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium text-slate-700">Motivo do Cancelamento</label>
              <textarea
                className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
                rows={3}
                placeholder="Ex: Lançamento duplicado, erro de digitação, estorno..."
                value={removalJustification}
                onChange={(e) => setRemovalJustification(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowRemoveConfirm(false)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmRemovePayment}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!removalJustification.trim()}
              >
                Confirmar Exclusão
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CriarPedido;
