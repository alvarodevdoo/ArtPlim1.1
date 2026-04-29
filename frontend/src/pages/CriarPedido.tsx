import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
import { WasteModal } from '@/components/pedidos/modals/WasteModal';
import { CustomerBalanceAlert } from '@/components/sales/CustomerBalanceAlert';


const CriarPedido: React.FC = () => {
  const navigate = useNavigate();
  const { settings, user, hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const cloneId = searchParams.get('clone');
  const fromBudgetId = searchParams.get('fromBudget');
  const isEditing = !!editId;
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);


  // Dados do pedido
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(false);

  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  // Pagamentos (Mock)
  const [payments, setPayments] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedOriginOrder, setSelectedOriginOrder] = useState<string>('');
  const [processStatuses, setProcessStatuses] = useState<any[]>([]);

  // Edio de item
  const [editingItem, setEditingItem] = useState<ItemPedido | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedWasteItem, setSelectedWasteItem] = useState<ItemPedido | null>(null);
  const [receivable, setReceivable] = useState<any>(null);
  const [orgSettings, setOrgSettings] = useState<any>(null);
  const [maxDiscountThreshold, setMaxDiscountThreshold] = useState<number>(0.15); // Default 15%
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [profileDetails, setProfileDetails] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    loadClientes();
    loadProdutos();
    loadProcessStatuses();
    loadOrgSettings();

    // Se estiver editando, carregar dados do pedido
    if (isEditing && editId) {
      loadPedidoParaEdicao(editId).then(() => {
        // Se houver comando de auto-pagamento na URL
        if (searchParams.get('autoPay') === 'true') {
          console.log('[CriarPedido] Gatilho de autoPay detectado.');
          setShowPaymentModal(true);
        }
      });
    } else if (cloneId) {
      loadPedidoParaClonagem(cloneId);
    } else if (fromBudgetId) {
      loadBudgetData(fromBudgetId);
    }
  }, [isEditing, editId, cloneId, fromBudgetId]);

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

  const loadProfileDetails = async (id: string) => {
    try {
      setLoadingProfile(true);
      const response = await api.get(`/api/profiles/${id}`);
      if (response.data.success) {
        setProfileDetails(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes do perfil:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (clienteSelecionado?.id) {
      loadProfileDetails(clienteSelecionado.id);
    } else {
      setProfileDetails(null);
    }
  }, [clienteSelecionado?.id]);

  const loadOrgSettings = async () => {
    setLoadingSettings(true);
    try {
      const settingsResp = await api.get('/api/organization/settings');
      setOrgSettings(settingsResp.data.data);
      
      const orgResp = await api.get('/api/organization');
      if (orgResp.data?.success && orgResp.data.data?.maxDiscountThreshold !== undefined) {
        setMaxDiscountThreshold(Number(orgResp.data.data.maxDiscountThreshold));
      }
    } catch (error) {
      console.error('Erro ao carregar configuraes locais:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadProdutos = async () => {
    try {
      const response = await api.get('/api/catalog/products?include=standardSizes,pricingRule');
      const produtosData = response.data.data || [];

      // Converter productType string para ItemType enum
      const produtosComTipoCorreto = produtosData.map((produto: any) => ({
        ...produto,
        productType: produto.productType as ItemType // Cast para ItemType
      }));

      setProdutos(produtosComTipoCorreto);

      // Verificar se no h produtos cadastrados
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
      // Verificar se h materiais cadastrados (necessrio para produtos)
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
        toast.error('Pedidos entregues no podem ser editados');
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
        itemType: item.product?.productType || item.itemType || ItemType.PRODUCT, 
        width: item.width,
        height: item.height,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        notes: item.notes,
        attributes: item.attributes || {},
        pricingRuleId: item.pricingRuleId,
        area: item.area,
        paperSize: item.paperSize,
        paperType: item.paperType,
        printColors: item.printColors,
        finishing: item.finishing,
        machineTime: item.machineTime,
        setupTime: item.setupTime,
        complexity: item.complexity,
        customSizeName: item.customSizeName,
        isCustomSize: item.isCustomSize || false,
        processStatusId: item.processStatusId,
        processStatus: item.processStatus,
        status: item.status,
        unitCostAtSale: item.unitCostAtSale ? Number(item.unitCostAtSale) : undefined,
        unitPriceAtSale: item.unitPriceAtSale ? Number(item.unitPriceAtSale) : undefined,
        profitAtSale: item.profitAtSale ? Number(item.profitAtSale) : undefined,
        compositionSnapshot: item.compositionSnapshot,
        discountItem: item.discountItem ? Number(item.discountItem) : 0,
        discountGlobal: item.discountGlobal ? Number(item.discountGlobal) : 0,
      }));

      setItens(itensCarregados);
      setGlobalDiscount(pedido.globalDiscount ? Number(pedido.globalDiscount) : 0);
      setDeliveryDate(pedido.deliveryDate ? new Date(pedido.deliveryDate).toISOString().split('T')[0] : '');
      setNotes(pedido.notes || '');

      // Carregar pagamentos (transaes)
      if (pedido.transactions && pedido.transactions.length > 0) {
        const pagamentosCarregados = pedido.transactions
          .filter((t: any) => t.status !== 'CANCELLED' && t.type === 'INCOME')
          .map((t: any) => ({
            id: t.id,
            methodId: t.paymentMethodId,
            methodName: t.paymentMethod?.name || 'Mtodo Desconhecido',
            amount: Number(t.amount),
            installments: 1,
            date: t.paidAt,
            justification: t.auditNotes || undefined,
            fee: 0,
            netAmount: Number(t.amount)
          }));
        setPayments(pagamentosCarregados);
      }

      // Carregar apropriao financeira para liquidao real
      if (pedido.accountsReceivable && pedido.accountsReceivable.length > 0) {
        setReceivable(pedido.accountsReceivable[0]);
      } else {
        setReceivable(null);
      }

      // toast.success('Pedido carregado para edio!'); // Removido para evitar poluio visual
    } catch (error: any) {
      toast.error('Erro ao carregar pedido para edio');
      navigate('/pedidos');
    } finally {
      setLoading(false);
    }
  };

  const loadPedidoParaClonagem = async (pedidoId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/sales/orders/${pedidoId}`);
      const pedido = response.data.data;
      
      setClienteSelecionado(pedido.customer);

      const itensCarregados = pedido.items.map((item: any) => ({
        id: undefined, // Ignora id para forar recriao
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
        area: item.area,
        paperSize: item.paperSize,
        paperType: item.paperType,
        printColors: item.printColors,
        finishing: item.finishing,
        machineTime: item.machineTime,
        setupTime: item.setupTime,
        complexity: item.complexity,
        customSizeName: item.customSizeName,
        isCustomSize: item.isCustomSize || false,
        processStatusId: undefined, // Reseta o sub status
        status: 'DRAFT', // Reseta o status inicial
        unitCostAtSale: item.unitCostAtSale ? Number(item.unitCostAtSale) : undefined,
        unitPriceAtSale: item.unitPriceAtSale ? Number(item.unitPriceAtSale) : undefined,
        profitAtSale: item.profitAtSale ? Number(item.profitAtSale) : undefined,
        compositionSnapshot: item.compositionSnapshot,
        discountItem: item.discountItem ? Number(item.discountItem) : 0,
        discountGlobal: item.discountGlobal ? Number(item.discountGlobal) : 0,
      }));

      setItens(itensCarregados);
      setDeliveryDate('');
      setNotes('Pedido duplicado - ' + (pedido.notes || ''));
      toast.success('Itens do pedido clonados com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao carregar pedido para clonagem');
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

      // Carregar dados do cliente do oramento
      setClienteSelecionado(budget.customer);

      // Carregar itens do oramento e mapear para itens de pedido
      const itensCarregados = budget.items.map((item: any) => ({
        id: `temp-${Math.random().toString(36).substr(2, 9)}`, // Novo ID temporrio para o pedido
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
      setNotes(budget.notes ? `Gerado a partir do oramento ${budget.budgetNumber}. ${budget.notes}` : `Gerado a partir do oramento ${budget.budgetNumber}.`);

      toast.success(`Dados carregados do oramento ${budget.budgetNumber}`);
    } catch (error: any) {
      console.error('Erro ao carregar oramento:', error);
      toast.error('Erro ao carregar dados do oramento para gerar o pedido');
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
    // Verificar se h produtos cadastrados
    if (produtos.length === 0) {
      toast.error('No  possvel adicionar itens sem produtos cadastrados.', {
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

  // Edio de pagamento
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

  // Remoo de pagamento
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
      toast.error('Justificativa  obrigatria para cancelamento de pagamento');
      return;
    }

    if (paymentToRemoveIndex !== null) {
      setPayments(prev => prev.filter((_, i) => i !== paymentToRemoveIndex));
      toast.success('Pagamento removido e justificado');
      setLoading(false);
      setPaymentToRemoveIndex(null);
    }
  };

  const globalDiscountValidation = useMemo(() => {
    const totalGross = itens.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    if (totalGross <= 0) return { ok: true, percent: 0 };
    const percent = globalDiscount / totalGross;
    return {
      ok: percent <= maxDiscountThreshold,
      percent: percent * 100
    };
  }, [globalDiscount, itens, maxDiscountThreshold]);

  const canEditPriceByRole = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'MANAGER' || hasPermission('sales.edit_price');

  const orderTotalToPay = useMemo(() => {
    const itemsTotal = itens.reduce((total, item) => {
      if ((item as any).discountStatus === 'PENDING') {
        return total + (item.unitPrice * item.quantity);
      }
      return total + (item.unitPrice * item.quantity) - (item.discountItem || 0);
    }, 0);

    const isGlobalPending = globalDiscount > 0 && !globalDiscountValidation.ok && !canEditPriceByRole;
    if (isGlobalPending) {
      return itemsTotal;
    }

    return itemsTotal - globalDiscount;
  }, [itens, globalDiscount, globalDiscountValidation.ok, canEditPriceByRole]);

  const salvarPedido = async (skipNavigate = false, customPayments?: any[]): Promise<boolean> => {
    if (!clienteSelecionado) {
      toast.error('Selecione um cliente');
      return false;
    }

    if (itens.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido');
      return false;
    }

    // Validao de Desconto Global
    if (!globalDiscountValidation.ok && !canEditPriceByRole) {
      toast.error(`Desconto global de ${globalDiscountValidation.percent.toFixed(2)}% excede o limite permitido de ${(maxDiscountThreshold * 100).toFixed(2)}%. Reduza o desconto ou solicite autorizao.`);
      return false;
    }

    const toNumber = (val: any) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      let str = val.toString();
      if (str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
      }
      return parseFloat(str) || 0;
    };

    if (loadingSettings) {
      toast.error('Aguarde o carregamento das configuraes de validao...');
      return false;
    }

    if (produtos.length === 0) {
      toast.error('No  possvel criar pedidos sem produtos cadastrados.', {
        duration: 5000,
        action: {
          label: 'Cadastrar Produtos',
          onClick: () => navigate('/produtos')
        }
      });
      return false;
    }

    setLoading(true);
    let currentSettings = orgSettings || settings;
    
    try {
      toast.info('Validando regras financeiras...', { duration: 1000 });
      const freshRes = await api.get('/api/organization/settings');
      currentSettings = freshRes.data.data;
    } catch (e) {
      console.warn('Falha ao buscar configuraes frescas, usando cache.');
    }

    const totalOrder = itens.reduce((sum, item) => sum + toNumber(item.totalPrice), 0);
    const paidTotal = (customPayments || payments).reduce((sum, p) => sum + toNumber(p.amount), 0);
    const minPercent = toNumber(currentSettings?.minDepositPercent || 0);
    const requireDeposit = !!currentSettings?.requireOrderDeposit;
    const currentPercent = totalOrder > 0 ? (paidTotal / totalOrder) * 100 : 0;

    if (requireDeposit && currentPercent < minPercent && !skipNavigate) {
      const remainingForDeposit = (totalOrder * (minPercent / 100)) - paidTotal;
      
      // Camada 1: Cliente isento -> passa sem perguntar (Check fresco no banco)
      let clienteIsento = !!(clienteSelecionado as any)?.exemptFromDeposit;
      
      try {
        const profileRes = await api.get(`/api/profiles/${clienteSelecionado.id}`);
        if (profileRes.data.success) {
          clienteIsento = !!profileRes.data.data.exemptFromDeposit;
          console.log('[CriarPedido] Status de iseno atualizado do banco:', clienteIsento);
        }
      } catch (err) {
        console.warn('[CriarPedido] Erro ao buscar status fresco do cliente, usando dados locais.');
      }

      if (!clienteIsento) {
        // Camada 2: Usurio com autoridade -> pode fazer override com justificativa
        const canOverride = user?.role === 'OWNER' || user?.role === 'MANAGER' || hasPermission('finance.approve' as any);

        setLoading(false);
        if (canOverride) {
          const justificativa = window.prompt(
            ` AUTORIZAO\n\nEste pedido exige ${minPercent}% de sinal (${formatCurrency(totalOrder * (minPercent / 100))}).\nPago: ${formatCurrency(paidTotal)} (${currentPercent.toFixed(1)}%)\n\nComo gestor, pode prosseguir sem o sinal.\nInforme a JUSTIFICATIVA (obrigatrio):`
          );
          if (!justificativa || !justificativa.trim()) {
            toast.error('Justificativa obrigatria para iseno de sinal');
            return false;
          }
          setNotes(prev => `${prev ? prev + ' | ' : ''}[ISENO AUTORIZADA por ${user?.name}: ${justificativa.trim()}]`);
          setLoading(true);
        } else {
          // Camada 3: Usurio comum -> pede pagamento ou bloqueia
          if (window.confirm(
            `Este pedido exige um sinal mnimo de ${minPercent}% (${formatCurrency(totalOrder * (minPercent / 100))}).\n\nPago: ${formatCurrency(paidTotal)}\nFaltam: ${formatCurrency(remainingForDeposit)}\n\nDeseja registrar o pagamento agora?`
          )) {
            setShowPaymentModal(true);
            return false;
          } else {
            toast.error(`Sinal mnimo de ${minPercent}% no atingido. Solicite autorizao a um gestor.`);
            return false;
          }
        }
      }
    }

    // Validar se todos os itens tm dados obrigatrios
    const itensInvalidos = itens.filter(item => {
      const problems = [];
      const isService = item.itemType === ItemType.SERVICE;

      if (!item.productId || item.productId.trim() === '') problems.push('productId vazio');
      if (!item.quantity || item.quantity <= 0 || isNaN(item.quantity)) problems.push('quantity invlida');
      if (!item.unitPrice && item.unitPrice !== 0 || item.unitPrice < 0 || isNaN(item.unitPrice)) problems.push('unitPrice invlido');
      if (!item.totalPrice && item.totalPrice !== 0 || item.totalPrice < 0 || isNaN(item.totalPrice)) problems.push('totalPrice invlido');

      // Validar se o produto ainda existe na lista de produtos carregados (apenas para produtos, no servios)
      if (!isService) {
        const produtoExiste = produtos.find(p => p.id === item.productId);
        if (!produtoExiste) problems.push('produto no encontrado');
      }

      if (problems.length > 0) {
        return true;
      }
      return false;
    });

    if (itensInvalidos.length > 0) {
      // Items with validation problems found
      toast.error(`Existem ${itensInvalidos.length} item(ns) com dados incompletos ou produtos invlidos. Verifique os produtos, quantidades e preos.`);
      return false;
    }

    // Validar se todos os produtos dos itens ainda existem no backend (apenas produtos, no servios)
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

        toast.error(`Os seguintes produtos no existem mais: ${invalidProductNames.join(', ')}. Remova estes itens e tente novamente.`);
        return false;
      }
    } catch (error) {
      toast.error('Erro ao validar produtos. Tente novamente.');
      return false;
    }

    // Prepare order data for submission
    // setLoading(true); // J definimos no topo da funo para a validao fresca
    try {
      const pedidoData = {
        customerId: clienteSelecionado.id,
        items: itens.map(item => ({
          id: item.id, // Enviar o ID para preservar o status no backend
          productId: item.productId,
          itemType: item.itemType, // Usar itemType do item (que vem do productType)
          width: item.width ? Number(item.width) : undefined,
          height: item.height ? Number(item.height) : undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice), // Campo obrigatrio
          discount: Number(item.discountItem) || 0, // Enviar desconto do item
          notes: item.notes,
          pricingRuleId: item.pricingRuleId,
          attributes: item.attributes || {},
          discountStatus: (item as any).discountStatus || 'NONE',
          authorizationRequestId: (item as any).authorizationRequestId,

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
          status: item.status || undefined,
          processStatusId: item.processStatusId || undefined
        })),
        globalDiscount: globalDiscount > 0 ? Number(globalDiscount) : undefined,
        discountStatus: globalDiscount > 0 ? (globalDiscountValidation.ok || canEditPriceByRole ? 'APPROVED' : 'PENDING') : 'NONE',
        deliveryDate: deliveryDate || undefined,
        notes: notes || undefined,
        payments: (customPayments || payments).map(p => ({
          id: p.id,           //  IMPORTANTE: incluir id para o backend saber quais j existem
          methodId: p.methodId,
          methodName: p.methodName,
          amount: p.amount,
          fee: p.fee,
          netAmount: p.netAmount,
          installments: p.installments,
          // Verifica se p.date  objeto Date ou string
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

      if (!skipNavigate) {
        navigate('/pedidos');
      }
      return true;
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
        // Removido conforme solicitao
        /*
        toast.error('No  possvel criar pedidos sem materiais cadastrados.', {
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
    return false;
  };

  const handleAutoStatusUpdate = async (paymentsToUse: any[]) => {
    const rawTargetStatus = searchParams.get('targetStatus');
    const rawTargetProcessStatusId = searchParams.get('targetProcessStatusId');
    
    const targetStatus = rawTargetStatus === 'undefined' ? null : rawTargetStatus;
    const targetProcessStatusId = rawTargetProcessStatusId === 'undefined' ? null : rawTargetProcessStatusId;

    if (targetStatus && editId) {
      try {
        console.log('[CriarPedido] Salvando pedido antes da transio de status...');
        const success = await salvarPedido(true, paymentsToUse);
        if (!success) {
          toast.error('Falha ao salvar os pagamentos no servidor.');
          return;
        }

        // Delay para garantir sincronia temporal no BD (transaction updates)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('[CriarPedido] Executando atualizao de status automtica:', targetStatus, 'ProcessId:', targetProcessStatusId);
        const payload: any = targetProcessStatusId ? { processStatusId: targetProcessStatusId } : { status: targetStatus };
        
        console.log('[CriarPedido] Payload da atualizacao:', payload);
        if (!payload.status && !payload.processStatusId) {
            console.error('[CriarPedido] Abortando PATCH: payload sem status válido');
            toast.error('Erro interno: status de destino não configurado');
            return;
        }

        await api.patch(`/api/sales/orders/${editId}/status`, payload);
        toast.success('Status atualizado com sucesso aps pagamento!');
        
        navigate('/pedidos', { replace: true });
      } catch (error) {
        console.error('Erro na atualizao automtica:', error);
        toast.error('Pagamento registrado, mas houve um erro ao atualizar o status automaticamente.');
      }
    }
  };

  return (
    <>
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
                  {isEditing ? 'Editar Pedido' : fromBudgetId ? 'Gerar Pedido de Oramento' : 'Criar Novo Pedido'}
                </span>
                {isEditing && (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    Editando
                  </span>
                )}
              </h1>
              <p className="text-muted-foreground">
                {isEditing
                  ? 'Modifique as informaes do pedido existente'
                  : 'Preencha as informaes para criar um novo pedido ou oramento'
                }
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" disabled={loading || loadingSettings}>
              <FileText className="w-4 h-4 mr-2" />
              Salvar Pedido
            </Button>
            <Button onClick={() => salvarPedido()} disabled={loading || loadingSettings || !clienteSelecionado || itens.length === 0}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Salvando...' : loadingSettings ? 'Validando...' : isEditing ? 'Atualizar Pedido' : 'Criar Pedido'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulrio Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Seleo de Cliente */}
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
              onRegisterWaste={(item) => setSelectedWasteItem(item)}
            />

            {/* Observaes e Envio */}
            <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
              <h3 className="text-lg font-medium">Informaes Adicionais</h3>
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
                    Observaes Gerais
                  </label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Informaes importantes sobre o pedido..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Resumo Lateral Fixo */}
          <div className="space-y-6">
            <div className="sticky top-1 space-y-2">
              <div className="bg-white p-6 rounded-lg border shadow-sm">
                <h3 className="text-lg font-medium mb-4">Resumo do Pedido</h3>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Itens ({itens.length})</span>
                    <span>{itens.reduce((sum, item) => sum + item.quantity, 0)} un</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal Bruto</span>
                    <span>{formatCurrency(itens.reduce((total, item) => total + (item.unitPrice * item.quantity), 0))}</span>
                  </div>
                  
                  {/* Descontos nos itens */}
                  {itens.some(item => item.discountItem) && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Descontos (Itens)</span>
                      <span>- {formatCurrency(itens.reduce((total, item) => total + (item.discountItem || 0), 0))}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span>Desconto Global</span>
                      <div className="w-32">
                        <input
                          type="number"
                          className={`w-full border rounded text-right px-2 py-1 ${!globalDiscountValidation.ok ? 'border-red-500 text-red-600' : ''}`}
                          placeholder="0,00"
                          value={globalDiscount || ''}
                          onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    {!globalDiscountValidation.ok && (
                      <div className="text-[10px] text-red-600 font-bold text-right">
                        Excede teto de {(maxDiscountThreshold * 100).toFixed(2)}%
                      </div>
                    )}
                  </div>


                  <div className="border-t pt-3 flex justify-between font-bold text-lg">
                    <span>Total a Pagar</span>
                    <div className="flex flex-col items-end">
                      <span className={itens.some(i => (i as any).discountStatus === 'PENDING') ? 'text-amber-600' : ''}>
                        {formatCurrency(orderTotalToPay)}
                      </span>
                      {itens.some(i => (i as any).discountStatus === 'PENDING') && (
                        <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1 animate-pulse">
                          <AlertCircle className="w-2.5 h-2.5" /> Valor pode mudar aps autorizao
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => salvarPedido()}
                  disabled={
                    loading || 
                    loadingSettings || 
                    !clienteSelecionado || 
                    itens.length === 0 || 
                    (!globalDiscountValidation.ok && !canEditPriceByRole)
                  }
                >
                  {loading ? 'Processando...' : loadingSettings ? 'Validando...' : (isEditing ? 'Atualizar Pedido' : 'Finalizar Pedido')}
                </Button>
              </div>

              {/* Situao Financeira */}
              {itens.length > 0 && (
                <div className="space-y-4">
                  <OrderFinancialStatus
                    totalOrder={itens.reduce((total, item) => total + item.totalPrice, 0)}
                    paidAmount={payments.reduce((total, p) => total + p.amount, 0)}
                    payments={payments}
                    onAddPayment={() => {
                      setEditingPayment(null);
                      setEditingPaymentIndex(-1);
                      setShowPaymentModal(true);
                    }}
                    onRemovePayment={handleRemovePayment}
                    onEditPayment={handleEditPayment}
                    customerBalance={Number(profileDetails?.balance || 0)}
                    lastBalanceMovement={profileDetails?.balanceMovements?.[0] || null}
                    onUseBalance={(amount) => {
                      // Adicionar o saldo como um pagamento do tipo "Saldo do Cliente"
                      const balancePayment = {
                        methodId: 'BALANCE',
                        methodName: 'Saldo do Cliente',
                        amount: amount,
                        fee: 0,
                        netAmount: amount,
                        date: new Date().toISOString(),
                        installments: 1
                      };
                      setPayments(prev => [...prev, balancePayment]);
                    }}
                  />
                </div>
              )}
            </div>
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
          remainingAmount={Math.round((itens.reduce((total, item) => total + item.totalPrice, 0) - payments.reduce((total, p) => total + p.amount, 0) + (editingPayment?.amount || 0)) * 100) / 100}
          initialPayment={editingPayment}
          onAddPayment={(newPayment) => {
            const updatedPayments = [...payments, newPayment];
            setPayments(updatedPayments);
            // Aps sucesso no pagamento local, salva o pedido inteiro antes de transacionar o status
            if (searchParams.get('autoPay') === 'true') {
              handleAutoStatusUpdate(updatedPayments);
            }
          }}
          onSuccess={() => {
            // Callback disparado quando o pagamento e persistido diretamente via Liquidacao
            if (searchParams.get('autoPay') === 'true') {
              handleAutoStatusUpdate(payments); // Passa o array atual apenas para fallback
            }
          }}
          receivableId={receivable?.id}
          receivableAccountId={receivable?.accountId}
          onUpdatePayment={handleUpdatePayment}
          availableBalance={Number(profileDetails?.balance || 0)}
        />

        <OrderHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          orderId={selectedOriginOrder}
        />
        <AddItemModalFlow
          isOpen={showAddModal || showEditModal}
          onClose={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setEditingItem(null);
          }}
          onAddItem={handleAddItem}
          onUpdateItem={handleUpdateItem}
          produtos={produtos}
          editingItem={editingItem}
          maxDiscountThreshold={maxDiscountThreshold}
          isPriceUnlocked={canEditPriceByRole}
        />
        {showRemoveConfirm && (
          <div className="modal-overlay z-[1000]">
            <div className="absolute inset-0 bg-transparent" onClick={() => setShowRemoveConfirm(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">

              <h3 className="text-lg font-bold text-red-600 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Cancelar Pagamento
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Para auditoria e segurana,  obrigatrio informar o motivo do cancelamento deste pagamento.
              </p>

              <div className="space-y-2 mb-6">
                <label className="text-sm font-medium text-slate-700">Motivo do Cancelamento</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
                  rows={3}
                  placeholder="Ex: Lanamento duplicado, erro de digitao, estorno..."
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
                  Confirmar Excluso
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal de Perdas/Retrabalho */}
        <WasteModal
          isOpen={!!selectedWasteItem}
          onClose={() => setSelectedWasteItem(null)}
          orderId={editId || ''}
          item={selectedWasteItem}
          onSuccess={() => {
              if (editId) loadPedidoParaEdicao(editId);
          }}
        />
      </div>
    </>
  );
};

export default CriarPedido;
