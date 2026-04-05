import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DatasOrcamento } from '@/components/ui/DatasOrcamento';
import { 
  Printer, FileText, User, MessageSquare, Send, Calendar, 
  Package, Activity, XCircle, Calculator, ChevronRight
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { sendOrderWhatsApp } from '@/lib/whatsapp';
import { useAuth } from '@/contexts/AuthContext';
import { Pedido, ProcessStatus, statusConfig } from '@/types/pedidos';
import { OrderFinancialStatus } from '../../sales/OrderFinancialStatus';
import { PaymentSelection } from '../../sales/PaymentSelection';
import PartialCancelModal from './PartialCancelModal';
import PartialDeliveryModal from './PartialDeliveryModal';
import api from '@/lib/api';
import { toast } from 'sonner';

interface OrderDetailsModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: string, processStatusId?: string) => void;
  onCancelRequest: () => void;
  onWhatsAppRequest: () => void;
  onMaterialRequest?: (item: any) => void;
  processStatuses?: ProcessStatus[];
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  pedido,
  isOpen,
  onClose,
  onStatusChange,
  onCancelRequest,
  onWhatsAppRequest,
  onMaterialRequest,
  processStatuses = []
}) => {
  const { hasPermission } = useAuth();
  const [receivable, setReceivable] = React.useState<any>(null);
  const [loadingFinancial, setLoadingFinancial] = React.useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false);
  
  // Parciais (Cancelamento e Entregas)
  const [selectedItemIds, setSelectedItemIds] = React.useState<string[]>([]);
  const [showPartialCancelModal, setShowPartialCancelModal] = React.useState(false);
  const [showPartialDeliveryModal, setShowPartialDeliveryModal] = React.useState(false);

  // Limpar seleção ao fechar
  React.useEffect(() => {
    if (!isOpen) setSelectedItemIds([]);
  }, [isOpen]);

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const getSelectedItemsFull = () => {
    if (!pedido?.items) return [];
    return pedido.items.filter((i: any) => selectedItemIds.includes(i.id));
  };

  const fetchFinancialData = React.useCallback(async () => {
    if (!pedido?.id || !hasPermission('finance.view')) return;
    
    try {
      setLoadingFinancial(true);
      const response = await api.get(`/api/finance/receivables/order/${pedido.id}`);
      setReceivable(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
    } finally {
      setLoadingFinancial(false);
    }
  }, [pedido?.id, hasPermission]);

  React.useEffect(() => {
    if (isOpen) {
      fetchFinancialData();
    } else {
      setReceivable(null);
    }
  }, [isOpen, fetchFinancialData]);

  if (!isOpen || !pedido) return null;

  const hasFinancialAccess = () => hasPermission('finance.view');

  const getStatusDisplay = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;
  };

  const statusDisplay = getStatusDisplay(pedido.status);
  const finalStatusLabel = (pedido as any).processStatus?.name || statusDisplay.label || pedido.status;
  const finalStatusColor = (pedido as any).processStatus?.color || statusDisplay.color;

  const shouldShowDimensions = (item: any) => {
    const width = Number(item.width || 0);
    const height = Number(item.height || 0);
    if (width <= 0 || height <= 0) return false;
    if (item.itemType === 'SERVICE' || item.product?.productType === 'SERVICE') return false;
    if (item.product?.pricingMode === 'DYNAMIC_ENGINEER') return true;
    return true;
  };

  return (
    <div className="modal-overlay">
      <Card className="modal-content-card max-w-6xl">

        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <span>{pedido.orderNumber}</span>
                <span className={`px-2 py-1 rounded text-sm ${finalStatusColor}`}>
                  {finalStatusLabel}
                </span>
              </CardTitle>
              <CardDescription>Cliente: {pedido.customer?.name}</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Printer className="w-4 h-4 mr-2" /> Imprimir
              </Button>
              <Button variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Informações do Cliente */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Informações do Cliente</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p><span className="font-medium">Nome:</span> {pedido.customer?.name}</p>
                      {pedido.customer?.email && (
                        <p><span className="font-medium">Email:</span> {pedido.customer.email}</p>
                      )}
                      {pedido.customer?.phone && (
                        <p><span className="font-medium">Telefone:</span> {pedido.customer.phone}</p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {pedido.customer?.phone && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => sendOrderWhatsApp({ 
                              customerName: pedido.customer.name, 
                              customerPhone: pedido.customer.phone!, 
                              orderNumber: pedido.orderNumber, 
                              total: pedido.total, 
                              status: pedido.status, 
                              validUntil: pedido.validUntil 
                            })}
                          >
                            <MessageSquare className="w-4 h-4 mr-2" /> Status WhatsApp
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={onWhatsAppRequest}
                          >
                            <Send className="w-4 h-4 mr-2" /> Mensagem
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Validade do Orçamento */}
              {pedido.status === 'DRAFT' && pedido.validUntil && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Calendar className="w-5 h-5" />
                      <span>Validade do Orçamento</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DatasOrcamento criadoEm={pedido.createdAt} validadeEm={pedido.validUntil} />
                  </CardContent>
                </Card>
              )}

              {/* Itens do Pedido */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Package className="w-5 h-5" />
                    <span>Itens do Pedido</span>
                  </CardTitle>
                  {selectedItemIds.length > 0 && (
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="h-8 text-xs font-bold"
                        onClick={() => setShowPartialCancelModal(true)}
                      >
                        <XCircle className="w-3 h-3 mr-1" /> Cancelar ({selectedItemIds.length})
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow"
                        onClick={() => setShowPartialDeliveryModal(true)}
                      >
                        <Package className="w-3 h-3 mr-1" /> Entregar ({selectedItemIds.length})
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(pedido.items || []).map((item, index) => {
                      const w = Number(item.width || 0);
                      const h = Number(item.height || 0);
                      const area = (w * h) / 1000000;
                      const isSelected = selectedItemIds.includes(item.id);
                      const isCancelledOrDelivered = item.status === 'CANCELLED' || item.status === 'DELIVERED';

                      return (
                        <div key={item.id} className={`border rounded-lg p-4 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border'} ${isCancelledOrDelivered ? 'opacity-60 saturate-50' : ''}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1 flex gap-3">
                              <div className="pt-1">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded text-primary focus:ring-primary disabled:opacity-50 cursor-pointer"
                                  checked={isSelected}
                                  onChange={() => toggleItemSelection(item.id)}
                                  disabled={isCancelledOrDelivered}
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-sm font-semibold">#{index + 1}</span>
                                  <h5 className="font-bold text-slate-800">{item.product?.name}</h5>
                                  {isCancelledOrDelivered && (
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${item.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                      {item.status === 'CANCELLED' ? 'CANCELADO' : 'ENTREGUE'}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                                  {shouldShowDimensions(item) && (
                                    <div>
                                      <p><span className="font-medium text-foreground">Dimensões:</span> {w} × {h} mm</p>
                                      <p><span className="font-medium text-foreground">Área unitária:</span> {area.toFixed(2)} m²</p>
                                    </div>
                                  )}
                                  <div>
                                    <p><span className="font-medium text-foreground">Quantidade:</span> {item.quantity} unidade(s)</p>
                                    {item.isCustomSize && <p><span className="font-medium text-foreground">Tamanho Personalizado:</span> Sim</p>}
                                    {item.paperType && <p><span className="font-medium text-foreground">Papel:</span> {item.paperType}</p>}
                                    {item.printColors && <p><span className="font-medium text-foreground">Cores:</span> {item.printColors}</p>}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <p className="font-medium">{formatCurrency(item.unitPrice || 0)}{item.product?.pricingMode === 'SIMPLE_AREA' ? '/m\u00b2' : '/un'}</p>
                              <p className="text-lg font-bold">{formatCurrency(item.totalPrice || 0)}</p>
                              
                              {/* ── Info do Motor de Composição (Snapshot) ── */}
                              {hasFinancialAccess() && item.unitCostAtSale !== undefined && item.unitCostAtSale !== null && (
                                <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-[10px] text-right font-mono">
                                  <div className="text-slate-500 uppercase font-bold tracking-tighter">Lucro de Venda</div>
                                  <div className={`text-sm font-black ${item.profitAtSale > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatCurrency(item.profitAtSale)}/un
                                  </div>
                                  {item.unitCostAtSale > 0 && (
                                    <div className="text-slate-400">
                                      Markup: {((item.unitPriceAtSale / item.unitCostAtSale)).toFixed(2)}x
                                    </div>
                                  )}
                                </div>
                              )}

                              {hasFinancialAccess() && onMaterialRequest && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="mt-2 w-full" 
                                  onClick={() => onMaterialRequest(item)}
                                >
                                  <Calculator className="w-3 h-3 mr-1" /> Material
                                </Button>
                              )}
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Timeline de Produção Estilizada */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Activity className="w-5 h-5" />
                    <span>Progresso do Pedido</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {pedido.statusHistory && pedido.statusHistory.length > 0 ? (
                      pedido.statusHistory.map((step, idx) => (
                        <div key={idx} className="relative pl-6 pb-6 last:pb-0">
                          {idx !== pedido.statusHistory!.length - 1 && (
                            <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-100"></div>
                          )}
                          <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center border border-blue-200">
                            <Activity className="w-3 h-3 text-blue-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-900">
                              {step.toProcessStatus?.name || (statusConfig[step.toStatus as keyof typeof statusConfig]?.label || step.toStatus)}
                            </p>
                            <div className="flex items-center mt-1 text-xs text-gray-500 space-x-2">
                              <span className="flex items-center">
                                <User className="w-3 h-3 mr-1" /> {step.user?.name || 'Sistema'}
                              </span>
                              <span>•</span>
                              <span>{new Date(step.createdAt).toLocaleString('pt-BR')}</span>
                            </div>
                            {step.notes && (
                              <p className="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-100 italic">
                                "{step.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-400 italic text-sm">
                        Nenhum registro de produção disponível.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Análise Financeira Real */}
              {hasFinancialAccess() && (
                <div className="space-y-4">
                  {loadingFinancial ? (
                    <div className="p-8 text-center animate-pulse bg-slate-50 rounded-lg">
                      Carregando dados financeiros...
                    </div>
                  ) : receivable ? (
                    <OrderFinancialStatus 
                      totalOrder={Number(receivable.amount)}
                      paidAmount={receivable.transactions?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0}
                      payments={receivable.transactions?.map((t: any) => ({
                        methodName: t.paymentMethod?.name || 'Não informado',
                        amount: Number(t.amount),
                        date: t.paidAt,
                        installments: 1 // TODO: Support installments in transaction
                      }))}
                      onAddPayment={() => setIsPaymentModalOpen(true)}
                      onRemovePayment={() => {}} // TODO: Implement delete transaction
                    />
                  ) : pedido.status === 'APPROVED' || pedido.status === 'IN_PRODUCTION' || pedido.status === 'FINISHED' || pedido.status === 'DELIVERED' ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm italic">
                      Este pedido foi aprovado mas não possui apropriação financeira vinculada.
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm italic">
                      Aguardando aprovação do pedido para gerar apropriação no plano de contas.
                    </div>
                  )}
                </div>
              )}

              {/* Modal de Pagamento/Liquidação */}
              {receivable && (
                <PaymentSelection 
                  isOpen={isPaymentModalOpen}
                  onClose={() => setIsPaymentModalOpen(false)}
                  onAddPayment={() => {}} // Não usado no fluxo de liquidação direta
                  remainingAmount={Number(receivable.amount) - (receivable.transactions?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0)}
                  receivableId={receivable.id}
                  receivableAccountId={receivable.receivableAccountId}
                  onSuccess={() => {
                    fetchFinancialData();
                    setIsPaymentModalOpen(false);
                  }}
                />
              )}
            </div>

            {/* Ações Rápidas */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Mover para etapa:</p>
                    {processStatuses.length > 0 ? (
                      processStatuses
                        .filter(ps => ps.id !== pedido.processStatusId)
                        .map(ps => (
                        <Button 
                          key={ps.id}
                          className="w-full justify-start text-left" 
                          variant="outline"
                          onClick={() => onStatusChange(pedido.id, ps.mappedBehavior, ps.id)}
                        >
                          <ChevronRight className="w-4 h-4 mr-2 text-blue-500" />
                          {ps.name}
                        </Button>
                      ))
                    ) : (
                      <p className="text-xs italic text-gray-400">Nenhuma etapa disponível no fluxo.</p>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t mt-4">
                    {!['DELIVERED', 'CANCELLED'].includes(pedido.status) && (
                      <Button 
                        variant="ghost" 
                        className="w-full text-red-600 hover:bg-red-50 hover:text-red-700" 
                        onClick={onCancelRequest}
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Cancelar Pedido
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modais Aninhados (Partial Actions) */}
      <PartialCancelModal
        pedido={pedido}
        itemsToCancel={getSelectedItemsFull()}
        isOpen={showPartialCancelModal}
        onClose={() => setShowPartialCancelModal(false)}
        onSuccess={() => {
          // Após sucesso, os items mudam. Talvez um refresh aqui seja via prop.
          // Como onStatusChange é restrito a um pedido geral na UI de Pedidos.tsx
          // O ideal é a pagina de Pedidos escutar atualizações profundas.
          setSelectedItemIds([]);
          // Hack para atualizar financeiro dentro do modal se já estivermos vendo
          fetchFinancialData();
          // Force fechar modal inteiro para reabrir, ou chamar refresh global:
          toast.success('Itens atualizados! Recarregue a janela ou o pedido será atualizado no grid.');
        }}
      />

      <PartialDeliveryModal
        pedido={pedido}
        itemsToDeliver={getSelectedItemsFull()}
        isOpen={showPartialDeliveryModal}
        onClose={() => setShowPartialDeliveryModal(false)}
        onSuccess={() => {
          setSelectedItemIds([]);
          toast.success('Entrega gerada! Reabra o pedido para atualizar a visualização interna.');
        }}
      />
    </div>
  );
};

export default React.memo(OrderDetailsModal);
