import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core';
import { sendOrderWhatsApp, WhatsAppService } from '@/lib/whatsapp';
import { Pedido, PedidoStats, ProcessStatus, statusConfig } from '@/types/pedidos';

export function usePedidos() {
  const { settings, hasPermission } = useAuth();

  // --- Estados Base ---
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [processStatuses, setProcessStatuses] = useState<ProcessStatus[]>([]);
  const [stats, setStats] = useState<PedidoStats | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Estados de Filtro / Busca ---
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // --- Estados Visuais ---
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedPedidos, setSelectedPedidos] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const navigate = useNavigate();

  // --- Estados dos Modais ---
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [showMaterialCalculator, setShowMaterialCalculator] = useState(false);
  const [calculatorItem, setCalculatorItem] = useState<any>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [autoOpenPaymentPedidoId, setAutoOpenPaymentPedidoId] = useState<string | null>(null);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ 
    pedidoId: string, 
    status: string, 
    processStatusId?: string 
  } | null>(null);

  // --- DnD Sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  );

  // --- Helpers ---
  const hasFinancialAccess = useCallback(() => hasPermission('finance.view'), [hasPermission]);

  // --- Debounce da busca ---
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // --- Loaders ---
  const loadProcessStatuses = useCallback(async () => {
    try {
      const response = await api.get('/api/organization/config/process-statuses');
      if (response?.data?.success) setProcessStatuses(response.data.data || []);
    } catch (error) {
      console.error('Failed to load process statuses', error);
    }
  }, []);

  useEffect(() => { loadProcessStatuses(); }, [loadProcessStatuses]);

  const loadPedidos = useCallback(async (searchQuery?: string) => {
    try {
      setLoading(true);
      const params: any = {};
      if (searchQuery) params.search = searchQuery;

      const [pedidosResponse, statsResponse] = await Promise.all([
        api.get('/api/sales/orders', { params }),
        api.get('/api/sales/orders/stats'),
      ]);

      setPedidos(pedidosResponse?.data?.data || []);
      setStats(statsResponse?.data?.data || null);
    } catch {
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPedidos(debouncedSearch); }, [debouncedSearch, loadPedidos]);

  // --- Derivações ---
  const getStatusDisplay = useCallback((pedido: Pedido) => {
    const baseConfig = statusConfig[pedido?.status as keyof typeof statusConfig] || statusConfig.DRAFT;
    // Se o pedido tem um processStatus dinâmico, expor a cor dele como badgeColor
    if (pedido?.processStatus?.color) {
      return {
        ...baseConfig,
        label: pedido.processStatus.name || baseConfig.label,
        badgeColor: pedido.processStatus.color,
      };
    }
    return baseConfig;
  }, []);

  const filteredPedidos = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    return (pedidos || [])
      .filter(pedido => {
        const matchesSearch =
          pedido?.orderNumber?.toLowerCase().includes(term) ||
          pedido?.customer?.name?.toLowerCase().includes(term) ||
          (pedido?.customer?.phone && pedido.customer.phone.toLowerCase().includes(term));
        const matchesStatus = !statusFilter || pedido.status === statusFilter;
        const matchesDate = !dateFilter || (pedido?.createdAt && new Date(pedido.createdAt).toISOString().split('T')[0] === dateFilter);
        return matchesSearch && matchesStatus && matchesDate;
      })
      .sort((a, b) => {
        let aVal: any = 0, bVal: any = 0;
        switch (sortBy) {
          case 'date':
            aVal = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
            bVal = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
            break;
          case 'value':
            aVal = Number(a?.total || 0);
            bVal = Number(b?.total || 0);
            break;
          case 'customer':
            aVal = a?.customer?.name?.toLowerCase() || '';
            bVal = b?.customer?.name?.toLowerCase() || '';
            break;
        }
        if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });
  }, [pedidos, debouncedSearch, statusFilter, dateFilter, sortBy, sortOrder]);

  const kanbanItems = useMemo(() => {
    const items: any[] = [];
    filteredPedidos.forEach(pedido => {
      (pedido?.items || []).forEach(item => {
        const itemStatus = (item as any)?.status || pedido.status;
        items.push({
          ...item,
          parentOrderId: pedido.id,
          orderNumber: pedido.orderNumber,
          customerName: pedido?.customer?.name,
          orderCreatedAt: pedido.createdAt,
          status: itemStatus,
        });
      });
    });
    return items;
  }, [filteredPedidos]);

  const itemsByStatus = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    Object.keys(statusConfig).forEach(status => {
      grouped[status] = kanbanItems.filter(item => item.status === status);
    });
    return grouped;
  }, [kanbanItems]);

  const overduePedidos = useMemo(() =>
    (pedidos || []).filter(pedido =>
      pedido?.status === 'DRAFT' && pedido?.validUntil && new Date(pedido.validUntil) < new Date()
    ), [pedidos]);

  const pendingValue = useMemo(() =>
    (pedidos || [])
      .filter(p => ['DRAFT', 'APPROVED', 'IN_PRODUCTION'].includes(p?.status))
      .reduce((sum, p) => sum + Number(p?.total || 0), 0),
    [pedidos]);

  // --- Ações ---
  const handleItemOrderStatusChange = useCallback(async (itemId: string, newStatus: string, showToast: boolean = true) => {
    try {
      const response = await api.patch(`/api/sales/orders/items/${itemId}/status`, { status: newStatus });
      const updatedPedido = response?.data?.data;
      if (updatedPedido) {
        setPedidos(prev => prev.map(p => p.id === updatedPedido.id ? updatedPedido : p));
        setSelectedPedido(prev => prev?.id === updatedPedido.id ? updatedPedido : prev);
      }
      if (showToast) toast.success('Status do item atualizado');
      loadPedidos(debouncedSearch);
    } catch {
      if (showToast) toast.error('Erro ao atualizar status do item');
    }
  }, [loadPedidos, debouncedSearch]);

  const handleStatusChange = useCallback(async (pedidoId: string, newStatus: string, details?: any) => {
    const targetProcessStatus = processStatuses.find(s => s.id === newStatus);
    const isProcessStatus = !!targetProcessStatus;
    const mappedBehavior = targetProcessStatus?.mappedBehavior || (newStatus as any);

    try {
      const payload: any = { ...details };
      let response;

      // Se o status destino é APROVADO, usamos o Motor de Composição (ConfirmOrderService)
      if (mappedBehavior === 'APPROVED') {
        const confirmPayload: any = {};
        if (isProcessStatus) confirmPayload.processStatusId = newStatus;
        response = await api.post(`/api/sales/orders/${pedidoId}/confirm`, confirmPayload);
      } else {
        // Fluxo padrão para demais transições
        if (isProcessStatus) payload.processStatusId = newStatus;
        else payload.status = newStatus;
        response = await api.patch(`/api/sales/orders/${pedidoId}/status`, payload);
      }

      const updatedPedido = response?.data?.data;

      if (updatedPedido) {
        setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, ...updatedPedido } : p));
        setSelectedPedido(prev => prev?.id === pedidoId ? { ...prev, ...updatedPedido } : prev);

        if (updatedPedido?.customer?.phone && settings?.enableAutomation) {
          sendOrderWhatsApp({
            customerName: updatedPedido.customer.name,
            customerPhone: updatedPedido.customer.phone,
            orderNumber: updatedPedido.orderNumber,
            total: updatedPedido.total,
            status: updatedPedido.status,
            validUntil: updatedPedido.validUntil,
          });
        }
      }
      toast.success(mappedBehavior === 'APPROVED' ? 'Pedido confirmado e estoque atualizado!' : 'Status atualizado com sucesso!');
      loadPedidos(debouncedSearch);
    } catch (error: any) {
      // Diagnóstico para o desenvolvedor
      console.warn('[StatusChange Error Debug]:', {
        status: error.response?.status,
        data: JSON.stringify(error.response?.data),
        message: error.message
      });

      const errorData = error.response?.data;
      const errorMessage = (typeof errorData === 'string' ? errorData : (errorData?.message || errorData?.error?.message)) || error.message || '';
      
      // Busca insensível a caixa por qualquer indício de bloqueio financeiro
      const isPaymentRequired = errorMessage && /PAYMENT_REQUIRED/i.test(errorMessage);

      if (isPaymentRequired) {
        const parts = errorMessage.split('|');
        const friendlyMessage = parts.length > 1 ? parts[1] : (parts[0].includes(':') ? parts[0].split(':')[1] : parts[0]);
        
        toast.error(friendlyMessage || 'Pagamento necessário para prosseguir');
        
        // Tenta encontrar o pedido no estado global
        const pedido = pedidos.find(p => p.id === pedidoId) || (selectedPedido?.id === pedidoId ? selectedPedido : null);
        
        if (pedido) {
          console.log('[StatusChange] Redirecionando para edição com autoPay:', pedidoId);
          
          // Memoriza o status desejado para tentar novamente após o pagamento
          setPendingStatusUpdate({ 
            pedidoId, 
            status: mappedBehavior, 
            processStatusId: isProcessStatus ? newStatus : undefined 
          });

          // Redireciona para a página de EDIÇÃO com TODAS as instruções de destino
          navigate(`/pedidos/criar?edit=${pedidoId}&autoPay=true&targetStatus=${mappedBehavior}&targetProcessStatusId=${isProcessStatus ? newStatus : ''}`);
        } else {
          console.error('[StatusChange] Falha ao localizar pedido para abrir modal:', pedidoId);
          toast.error('Realize o pagamento para prosseguir (não foi possível abrir o modal automaticamente).');
        }
      } else {
        toast.error(errorMessage || 'Erro ao atualizar status');
      }
    }
  }, [processStatuses, settings?.enableAutomation, loadPedidos, debouncedSearch, pedidos, selectedPedido?.id]);

  const handlePaymentSuccess = useCallback(async (pedidoId: string) => {
    // 1. Recarregar a lista para atualizar saldos e transações
    await loadPedidos(debouncedSearch);
    
    // 2. Se temos uma mudança pendente para esse pedido, vamos executá-la
    if (pendingStatusUpdate && pendingStatusUpdate.pedidoId === pedidoId) {
      console.log('[PaymentSuccess] Executando mudança de status pendente:', pendingStatusUpdate.status);
      
      const { status, processStatusId } = pendingStatusUpdate;
      setPendingStatusUpdate(null); // Limpamos antes para evitar loops
      
      // Pequeno delay para garantir que o backend processou a transação e o loadPedidos refletiu no estado
      setTimeout(() => {
        handleStatusChange(pedidoId, processStatusId || status);
      }, 500);
    }
  }, [loadPedidos, debouncedSearch, pendingStatusUpdate, handleStatusChange]);

  const handleBulkStatusChange = useCallback(async (newStatus: string) => {
    if (selectedPedidos.length === 0) return toast.error('Selecione pelo menos um pedido');
    
    const targetProcessStatus = processStatuses.find(s => s.id === newStatus);
    const mappedBehavior = targetProcessStatus?.mappedBehavior || (newStatus as any);
    
    try {
      if (mappedBehavior === 'APPROVED') {
        // Aprovação em lote via Motor de Composição (execução sequencial para evitar erros de estoque parciais)
        toast.info(`Processando confirmação de ${selectedPedidos.length} pedido(s)...`);
        for (const id of selectedPedidos) {
          const payload: any = {};
          if (targetProcessStatus) payload.processStatusId = newStatus;
          await api.post(`/api/sales/orders/${id}/confirm`, payload);
        }
      } else {
        // Atualização em lote padrão
        await Promise.all(selectedPedidos.map(id => {
          const payload: any = {};
          if (targetProcessStatus) payload.processStatusId = newStatus;
          else payload.status = newStatus;
          return api.patch(`/api/sales/orders/${id}/status`, payload);
        }));
      }

      toast.success(`${selectedPedidos.length} pedido(s) atualizado(s) com sucesso!`);
      setSelectedPedidos([]);
      loadPedidos(debouncedSearch);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao atualizar pedidos em lote. Verifique se há estoque suficiente.');
      loadPedidos(debouncedSearch); // Atualiza para mostrar o que deu certo
    }
  }, [selectedPedidos, processStatuses, loadPedidos, debouncedSearch]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;
    const activeItem = kanbanItems.find(i => i.id === activeItemId);
    if (!activeItem) return;

    let targetStatus: string | null = null;
    const validStatuses = Object.keys(statusConfig);

    if (validStatuses.includes(overId)) {
      targetStatus = overId;
    } else {
      const overItem = kanbanItems.find(i => i.id === overId);
      if (overItem) targetStatus = overItem.status;
    }

    if (targetStatus && activeItem.status !== targetStatus) {
      await handleItemOrderStatusChange(activeItemId, targetStatus, false);
    }
  }, [kanbanItems, handleItemOrderStatusChange]);

  const handleSelectAll = useCallback(() => {
    if (selectedPedidos.length === filteredPedidos.length && filteredPedidos.length > 0) {
      setSelectedPedidos([]);
    } else {
      setSelectedPedidos(filteredPedidos.map(p => p.id));
    }
  }, [selectedPedidos.length, filteredPedidos]);

  const handleSelectPedido = useCallback((pedidoId: string) => {
    setSelectedPedidos(prev => prev.includes(pedidoId) ? prev.filter(id => id !== pedidoId) : [...prev, pedidoId]);
  }, []);

  const handleViewOrder = useCallback((id: string) => {
    const p = pedidos.find(p => p.id === id);
    if (p) setSelectedPedido(p);
  }, [pedidos]);

  const sendOverdueReminders = useCallback(async () => {
    let sentCount = 0;
    for (const pedido of overduePedidos) {
      if (pedido?.customer?.phone) {
        WhatsAppService.sendQuoteReminder({
          customerName: pedido.customer.name,
          customerPhone: pedido.customer.phone,
          orderNumber: pedido.orderNumber,
          total: pedido.total,
          status: pedido.status,
          validUntil: pedido.validUntil,
        });
        sentCount++;
      }
    }
    toast.success(`${sentCount} lembrete(s) enviado(s) via WhatsApp!`);
  }, [overduePedidos]);

  const exportPedidos = useCallback(async () => {
    try {
      const response = await api.get('/api/sales/orders/export', {
        responseType: 'blob',
        params: { status: statusFilter, search: debouncedSearch, date: dateFilter },
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pedidos_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Relatório exportado com sucesso!');
    } catch {
      toast.error('Erro ao exportar relatório');
    }
  }, [statusFilter, debouncedSearch, dateFilter]);

  return {
    // Estados
    pedidos, stats, loading, processStatuses,
    searchInput, setSearchInput,
    debouncedSearch,
    statusFilter, setStatusFilter,
    dateFilter, setDateFilter,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    viewMode, setViewMode,
    selectedPedidos, setSelectedPedidos,
    activeId, setActiveId,
    selectedPedido, setSelectedPedido,
    showMaterialCalculator, setShowMaterialCalculator,
    calculatorItem, setCalculatorItem,
    showWhatsAppModal, setShowWhatsAppModal,
    showAutomation, setShowAutomation,
    showCancelModal, setShowCancelModal,
    autoOpenPaymentPedidoId, setAutoOpenPaymentPedidoId,
    // Derivações
    filteredPedidos, kanbanItems, itemsByStatus, overduePedidos, pendingValue,
    // Sensors DnD
    sensors,
    // Callbacks
    hasFinancialAccess,
    getStatusDisplay,
    loadPedidos,
    handleItemOrderStatusChange,
    handleStatusChange,
    handlePaymentSuccess,
    handleBulkStatusChange,
    handleDragEnd,
    handleSelectAll,
    handleSelectPedido,
    handleViewOrder,
    sendOverdueReminders,
    exportPedidos,
    // Settings
    settings,
  };
}
