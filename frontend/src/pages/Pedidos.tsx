import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { MaterialCalculator } from '@/components/ui/MaterialCalculator';
import { OrderAutomation } from '@/components/ui/OrderAutomation';
import { Bell, Download, List, Kanban, Plus } from 'lucide-react';
import { WhatsAppService } from '@/lib/whatsapp';
import { toast } from 'sonner';

import { usePedidos } from '@/hooks/usePedidos';
import PedidosFilters from '@/components/pedidos/PedidosFilters';
import PedidosStats from '@/components/pedidos/PedidosStats';
import PedidosList from '@/components/pedidos/PedidosList';
import PedidosKanban from '@/components/pedidos/PedidosKanban';
import OrderDetailsModal from '@/components/pedidos/modals/OrderDetailsModal';
import CancelOrderModal from '@/components/pedidos/modals/CancelOrderModal';
import WhatsAppModal from '@/components/pedidos/modals/WhatsAppModal';

const Pedidos: React.FC = () => {
  const navigate = useNavigate();
  const {
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
  } = usePedidos();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pedidos</h1>
          <p className="text-muted-foreground">Gerencie pedidos e ordens de serviço</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={exportPedidos}>
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
          {settings?.enableAutomation && (
            <Button variant="outline" onClick={() => setShowAutomation(!showAutomation)}>
              <Bell className="w-4 h-4 mr-2" /> Automação
            </Button>
          )}
          <div className="flex border rounded-lg">
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
              <List className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')}>
              <Kanban className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={() => navigate('/pedidos/criar')}>
            <Plus className="w-4 h-4 mr-2" /> Novo Pedido
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <PedidosFilters
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        processStatuses={processStatuses}
      />

      {loading && pedidos.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
          <p className="text-muted-foreground">Carregando pedidos...</p>
        </div>
      )}

      {/* Stats (somente quando não há filtros ativos) */}
      {!(debouncedSearch || statusFilter || dateFilter) && (
        <PedidosStats
          stats={stats}
          pendingValue={pendingValue}
          overduePedidos={overduePedidos}
          pedidos={pedidos}
          hasFinancialAccess={hasFinancialAccess}
          sendOverdueReminders={sendOverdueReminders}
        />
      )}

      {/* Automação */}
      {showAutomation && settings?.enableAutomation && (
        <OrderAutomation
          orders={pedidos}
          onComplete={() => loadPedidos(debouncedSearch)}
          onRuleExecute={(_, orderIds) => { toast.success(`Automação executada para ${orderIds?.length || 0} pedido(s)!`); }}
        />
      )}

      {/* Seleção em massa */}
      {selectedPedidos.length > 0 && (
        <Card className="border-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="font-medium">{selectedPedidos.length} pedido(s) selecionado(s)</span>
                <Button variant="outline" size="sm" onClick={() => setSelectedPedidos([])}>Limpar Seleção</Button>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('APPROVED')}>Aprovar Selecionados</Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('IN_PRODUCTION')}>Enviar para Produção</Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('CANCELLED')}>Cancelar Selecionados</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <PedidosKanban
          kanbanItems={kanbanItems}
          itemsByStatus={itemsByStatus}
          activeId={activeId}
          setActiveId={setActiveId}
          handleDragEnd={handleDragEnd}
          handleViewOrder={handleViewOrder}
          handleItemOrderStatusChange={handleItemOrderStatusChange}
        />
      )}

      {/* List View */}
      {viewMode === 'list' && (
      <PedidosList
          filteredPedidos={filteredPedidos}
          selectedPedidos={selectedPedidos}
          processStatuses={processStatuses}
          handleSelectAll={handleSelectAll}
          handleSelectPedido={handleSelectPedido}
          getStatusDisplay={getStatusDisplay}
          handleStatusChange={handleStatusChange}
          setSelectedPedido={setSelectedPedido}
          setShowCancelModal={setShowCancelModal}
          debouncedSearch={debouncedSearch}
          statusFilter={statusFilter}
          onOrderUpdated={(updated) => loadPedidos(debouncedSearch)}
        />
      )}

      {/* Modais */}
      <OrderDetailsModal
        pedido={selectedPedido}
        isOpen={!!selectedPedido && !showCancelModal && !showWhatsAppModal && !showMaterialCalculator}
        onClose={() => {
          setSelectedPedido(null);
          setAutoOpenPaymentPedidoId(null);
        }}
        onStatusChange={handleStatusChange}
        onPaymentSuccess={handlePaymentSuccess}
        autoOpenPayment={!!selectedPedido && selectedPedido.id === autoOpenPaymentPedidoId}
        onCancelRequest={() => setShowCancelModal(true)}
        onWhatsAppRequest={() => setShowWhatsAppModal(true)}
        onMaterialRequest={(item) => {
          setCalculatorItem(item);
          setShowMaterialCalculator(true);
        }}
        processStatuses={processStatuses}
      />

      <CancelOrderModal
        pedido={selectedPedido}
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={(id, reason, paymentAction, refundAmount) => {
          handleStatusChange(id, 'CANCELLED', { reason, paymentAction, refundAmount });
          setShowCancelModal(false);
        }}
      />

      <WhatsAppModal
        pedido={selectedPedido}
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        onSend={(phone, name, message) => {
          WhatsAppService.sendCustomMessage(phone, name, message);
          setShowWhatsAppModal(false);
          toast.success('Mensagem enviada!');
        }}
      />

      {showMaterialCalculator && calculatorItem && (hasFinancialAccess() || hasPermission('sales.edit')) && (
        <div className="modal-overlay">
          <Card className="modal-content-card max-w-4xl">

              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Calculadora de Materiais</CardTitle>
                    <CardDescription>{calculatorItem?.product?.name} - {calculatorItem?.width} × {calculatorItem?.height}mm</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setShowMaterialCalculator(false)}>Fechar</Button>
                </div>
              </CardHeader>
              <CardContent>
                <MaterialCalculator
                  width={calculatorItem?.width || 0}
                  height={calculatorItem?.height || 0}
                  quantity={calculatorItem?.quantity || 0}
                  onCalculationComplete={() => { }}
                />
              </CardContent>
            </Card>
          </div>
      )}

    </div>
  );
};

export default Pedidos;