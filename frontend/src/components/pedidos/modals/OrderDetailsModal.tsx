import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DatasOrcamento } from '@/components/ui/DatasOrcamento';
import { 
  Printer, FileText, User, MessageSquare, Send, Calendar, 
  Package, Activity, CheckCircle, Target, XCircle, Calculator
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { sendOrderWhatsApp } from '@/lib/whatsapp';
import { useAuth } from '@/contexts/AuthContext';

export interface ProcessStatus {
  id: string;
  name: string;
  color: string;
  icon?: string;
  mappedBehavior: string;
  scope?: 'ORDER' | 'ITEM' | 'BOTH';
}

export interface ItemProduct {
  id: string;
  name: string;
  productType?: string;
  pricingMode?: string;
}

export interface PedidoItem {
  id: string;
  product?: ItemProduct;
  width?: number;
  height?: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  itemType?: string;
  isCustomSize?: boolean;
  paperType?: string;
  printColors?: string;
}

export interface PedidoCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface Pedido {
  id: string;
  orderNumber: string;
  status: 'DRAFT' | 'APPROVED' | 'IN_PRODUCTION' | 'FINISHED' | 'DELIVERED' | 'CANCELLED';
  processStatusId?: string;
  processStatus?: ProcessStatus;
  total: number;
  createdAt: string;
  validUntil?: string;
  deliveryDate?: string;
  notes?: string;
  updatedAt: string;
  customer: PedidoCustomer;
  items: PedidoItem[];
  transactions?: any[];
  approvedAt?: string;
  inProductionAt?: string;
  finishedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
}

interface OrderDetailsModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: string) => void;
  onCancelRequest: () => void;
  onWhatsAppRequest: () => void;
  onMaterialRequest?: (item: PedidoItem) => void;
}

const statusConfig = {
  DRAFT: { label: 'Pedido Criado', color: 'bg-gray-100 text-gray-800' },
  APPROVED: { label: 'Aguardando Aprovação', color: 'bg-blue-100 text-blue-800' },
  IN_PRODUCTION: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-800' },
  FINISHED: { label: 'Aguardando Retirada', color: 'bg-green-100 text-green-800' },
  DELIVERED: { label: 'Entregue', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800' }
};

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  pedido,
  isOpen,
  onClose,
  onStatusChange,
  onCancelRequest,
  onWhatsAppRequest,
  onMaterialRequest
}) => {
  const { settings, hasPermission } = useAuth();

  if (!isOpen || !pedido) return null;

  const hasFinancialAccess = () => hasPermission('finance.view');

  const getStatusDisplay = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;
  };

  const statusDisplay = getStatusDisplay(pedido.status);

  const shouldShowDimensions = (item: PedidoItem) => {
    const width = Number(item.width || 0);
    const height = Number(item.height || 0);
    if (width <= 0 || height <= 0) return false;
    if (item.itemType === 'SERVICE' || item.product?.productType === 'SERVICE') return false;
    if (item.product?.pricingMode === 'DYNAMIC_ENGINEER' && settings?.enableEngineering === false) return false;
    return true;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-background">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <span>{pedido.orderNumber}</span>
                <span className={`px-2 py-1 rounded text-sm ${statusDisplay.color}`}>
                  {statusDisplay.label}
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
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Package className="w-5 h-5" />
                    <span>Itens do Pedido</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(pedido.items || []).map((item, index) => {
                      const w = Number(item.width || 0);
                      const h = Number(item.height || 0);
                      const area = (w * h) / 1000000;

                      return (
                        <div key={item.id} className="border border-border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-sm">#{index + 1}</span>
                                <h5 className="font-medium">{item.product?.name}</h5>
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
                            <div className="text-right ml-4">
                              <p className="font-medium">{formatCurrency(item.unitPrice || 0)}{item.product?.pricingMode === 'SIMPLE_AREA' ? '/m\u00b2' : '/un'}</p>
                              <p className="text-lg font-bold">{formatCurrency(item.totalPrice || 0)}</p>
                              {hasFinancialAccess() && onMaterialRequest && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="mt-2" 
                                  onClick={() => onMaterialRequest(item)}
                                >
                                  <Calculator className="w-3 h-3 mr-1" /> Material
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Timeline de Produção */}
              {pedido.status !== 'DRAFT' && pedido.status !== 'CANCELLED' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Activity className="w-5 h-5" />
                      <span>Timeline de Produção</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { status: 'APPROVED', label: 'Pedido Aprovado', icon: CheckCircle },
                        { status: 'IN_PRODUCTION', label: 'Em Produção', icon: Package },
                        { status: 'FINISHED', label: 'Produção Finalizada', icon: CheckCircle },
                        { status: 'DELIVERED', label: 'Entregue', icon: CheckCircle }
                      ].map((step) => {
                        const statusKeys = Object.keys(statusConfig);
                        const isCompleted = statusKeys.indexOf(pedido.status) >= statusKeys.indexOf(step.status);
                        const isCurrent = pedido.status === step.status;
                        const StepIcon = step.icon;
                        
                        return (
                          <div key={step.status} className="flex items-center space-x-3">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                              isCompleted ? 'bg-green-100' : isCurrent ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                              <StepIcon className={`w-4 h-4 ${
                                isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'
                              }`} />
                            </div>
                            <div className="flex-1">
                              <p className={`font-medium ${
                                isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'
                              }`}>
                                {step.label}
                              </p>
                              {isCurrent && <p className="text-sm text-muted-foreground mt-0.5 italic">Em andamento...</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Análise Financeira */}
              {hasFinancialAccess() && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>Análise Financeira</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Subtotal:</span>
                          <p className="text-lg font-bold">{formatCurrency(pedido.total || 0)}</p>
                        </div>
                        <div>
                          <span className="font-medium">Custo Estimado:</span>
                          <p className="text-lg font-bold text-red-600">{formatCurrency(Number(pedido.total || 0) * 0.6)}</p>
                        </div>
                        <div>
                          <span className="font-medium">Margem Bruta:</span>
                          <p className="text-lg font-bold text-green-600">{formatCurrency(Number(pedido.total || 0) * 0.4)}</p>
                        </div>
                        <div>
                          <span className="font-medium">Margem %:</span>
                          <p className="text-lg font-bold text-green-600">40%</p>
                        </div>
                      </div>
                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total do Pedido:</span>
                          <span className="text-2xl font-bold">{formatCurrency(pedido.total || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Ações Rápidas */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pedido.status === 'DRAFT' && (
                    <Button className="w-full" onClick={() => onStatusChange(pedido.id, 'APPROVED')}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Aprovar Pedido
                    </Button>
                  )}
                  {pedido.status === 'APPROVED' && (
                    <Button className="w-full" onClick={() => onStatusChange(pedido.id, 'IN_PRODUCTION')}>
                      <Package className="w-4 h-4 mr-2" /> Iniciar Produção
                    </Button>
                  )}
                  {pedido.status === 'IN_PRODUCTION' && (
                    <Button className="w-full" onClick={() => onStatusChange(pedido.id, 'FINISHED')}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Finalizar Produção
                    </Button>
                  )}
                  {pedido.status === 'FINISHED' && (
                    <Button className="w-full" onClick={() => onStatusChange(pedido.id, 'DELIVERED')}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Entregue
                    </Button>
                  )}
                  {!['DELIVERED', 'CANCELLED'].includes(pedido.status) && (
                    <Button 
                      variant="outline" 
                      className="w-full text-red-600 border-red-200 hover:bg-red-50" 
                      onClick={onCancelRequest}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Cancelar Pedido
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default React.memo(OrderDetailsModal);
