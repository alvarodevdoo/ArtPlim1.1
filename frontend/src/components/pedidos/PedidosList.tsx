import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Eye, Edit, Package, Phone, Plus, Printer } from 'lucide-react';
import { DatasOrcamento } from '@/components/ui/DatasOrcamento';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Pedido, ProcessStatus, statusConfig, shouldShowDimensions } from '@/types/pedidos';

interface PedidosListProps {
  filteredPedidos: Pedido[];
  selectedPedidos: string[];
  processStatuses: ProcessStatus[];
  handleSelectAll: () => void;
  handleSelectPedido: (id: string) => void;
  getStatusDisplay: (pedido: Pedido) => any;
  handleStatusChange: (pedidoId: string, newStatus: string, details?: any) => void;
  setSelectedPedido: (p: Pedido) => void;
  setShowCancelModal: (v: boolean) => void;
  settings: any;
  debouncedSearch: string;
  statusFilter: string;
}

const PedidosList: React.FC<PedidosListProps> = React.memo(({
  filteredPedidos, selectedPedidos, processStatuses,
  handleSelectAll, handleSelectPedido, getStatusDisplay,
  handleStatusChange, setSelectedPedido, setShowCancelModal,
  settings, debouncedSearch, statusFilter,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={selectedPedidos.length === filteredPedidos.length && filteredPedidos.length > 0}
            onChange={handleSelectAll}
            className="rounded border-input"
          />
          <span className="text-sm text-muted-foreground">{filteredPedidos.length} pedido(s) encontrado(s)</span>
        </div>
      </div>

      {filteredPedidos.map((pedido) => {
        const statusInfo = statusConfig[pedido?.status as keyof typeof statusConfig];
        const isOverdue = pedido?.status === 'DRAFT' && pedido?.validUntil && new Date(pedido.validUntil) < new Date();

        return (
          <Card
            key={pedido.id}
            className={`transition-all duration-200 shadow-sm hover:shadow-md border-l-[4px] ${(statusInfo as any)?.border || 'border-l-muted'} ${isOverdue ? 'bg-red-50/50 border-red-200' : 'bg-card hover:border-slate-300'}`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedPedidos.includes(pedido.id)}
                    onChange={() => handleSelectPedido(pedido.id)}
                    className="rounded border-input"
                  />
                  <div className="flex flex-col">
                    <h3 className="font-bold text-lg text-foreground leading-tight flex items-center space-x-2">
                      <span>{pedido?.customer?.name || 'Cliente'}</span>
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">{pedido?.orderNumber || ''}</span>
                      {isOverdue && <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-bold uppercase">Vencido</span>}
                    </h3>
                    {pedido?.customer?.phone && (
                      <p className="text-sm font-semibold text-blue-700 flex items-center mt-1">
                        <Phone className="w-3.5 h-3.5 mr-1.5" />{pedido.customer.phone}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{pedido?.createdAt ? formatDateTime(pedido.createdAt) : ''}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-lg">{formatCurrency(pedido?.total || 0)}</p>
                    {(() => {
                      const totalPaid = pedido?.transactions?.reduce((sum, t) => {
                        if (t?.type === 'INCOME' && t?.status === 'PAID') return sum + Number(t?.amount || 0);
                        return sum;
                      }, 0) || 0;
                      const pendingAmount = Number(pedido?.total || 0) - totalPaid;
                      const isPaid = totalPaid >= Number(pedido?.total || 0) - 0.01;
                      const isPartial = totalPaid > 0 && !isPaid;
                      if (isPaid) return <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block mt-1">Pago</span>;
                      return (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${isPartial ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50'}`}>
                          {isPartial ? 'Parcial: ' : 'Pendente: '}{pendingAmount > 0 ? formatCurrency(pendingAmount) : 'R$ 0,00'}
                        </span>
                      );
                    })()}
                    <p className="text-xs text-muted-foreground mt-1">{(pedido?.items || []).length} item(s)</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {(() => {
                      const statusDisplay = getStatusDisplay(pedido);
                      const isDynamic = !!pedido?.processStatus;
                      const isInteractive = pedido?.status !== 'DELIVERED' && pedido?.status !== 'CANCELLED';

                      if (!isInteractive) {
                        return isDynamic ? (
                          <span className="px-3 py-1 rounded-full text-xs font-medium border" style={{ backgroundColor: (statusDisplay as any)?.badgeColor?.startsWith('#') ? `${(statusDisplay as any).badgeColor}20` : '#f3f4f6', color: (statusDisplay as any)?.badgeColor || '#374151', borderColor: (statusDisplay as any)?.badgeColor || '#d1d5db' }}>{statusDisplay.label}</span>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${(statusDisplay as any)?.color}`}>{statusDisplay.label}</span>
                        );
                      }

                      return (
                        <div className="relative">
                          <select
                            value={pedido?.processStatusId || pedido?.status || ''}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              const targetProcessStatus = processStatuses.find(s => s.id === newStatus);
                              const isCancelled = newStatus === 'CANCELLED' || targetProcessStatus?.mappedBehavior === 'CANCELLED';
                              if (isCancelled) {
                                setSelectedPedido(pedido);
                                setShowCancelModal(true);
                              } else {
                                handleStatusChange(pedido.id, newStatus);
                              }
                            }}
                            className={`appearance-none pl-3 pr-8 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${!isDynamic ? (statusDisplay as any)?.color : ''}`}
                            style={{
                              backgroundColor: isDynamic && (statusDisplay as any)?.badgeColor?.startsWith('#') ? `${(statusDisplay as any).badgeColor}20` : isDynamic ? '#f3f4f6' : undefined,
                              color: isDynamic ? (statusDisplay as any)?.badgeColor || '#374151' : undefined,
                              borderColor: isDynamic ? (statusDisplay as any)?.badgeColor || '#d1d5db' : undefined,
                              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'currentColor\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 8px center',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {processStatuses.length > 0 ? (
                              <>
                                {!pedido?.processStatusId && !processStatuses.some(s => s.id === pedido?.processStatusId) && (
                                  <option value={pedido?.status} disabled hidden>{statusConfig[pedido?.status as keyof typeof statusConfig]?.label || pedido?.status}</option>
                                )}
                                {processStatuses.map(status => <option key={status.id} value={status.id}>{status.name}</option>)}
                              </>
                            ) : (
                              Object.entries(statusConfig).map(([status, config]) => <option key={status} value={status}>{config.label}</option>)
                            )}
                          </select>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => setSelectedPedido(pedido)} title="Visualizar"><Eye className="w-4 h-4" /></Button>
                    {pedido?.status === 'DRAFT' && (
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/pedidos/criar?edit=${pedido.id}`)} title="Editar"><Edit className="w-4 h-4" /></Button>
                    )}
                    <Button size="icon" variant="ghost" title="Imprimir"><Printer className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                {pedido?.status === 'DRAFT' && pedido?.validUntil && (
                  <div className="mb-4"><DatasOrcamento criadoEm={pedido.createdAt} validadeEm={pedido.validUntil} className="p-3 bg-muted rounded-lg" /></div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(pedido?.items || []).slice(0, 3).map((item) => (
                    <div key={item.id} className="text-sm bg-muted p-2 rounded">
                      <p className="font-medium">{item?.product?.name}</p>
                      <p className="text-muted-foreground">
                        {shouldShowDimensions(item as any, settings?.enableEngineering)
                          ? `${item?.width} × ${item?.height}mm • ${item?.quantity}un`
                          : `${item?.quantity}un`}
                      </p>
                      <p className="font-medium">{formatCurrency(item?.totalPrice || 0)}</p>
                    </div>
                  ))}
                  {(pedido?.items || []).length > 3 && (
                    <div className="text-sm bg-muted p-2 rounded flex items-center justify-center">
                      <span className="text-muted-foreground">+{pedido.items.length - 3} item(s)</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {filteredPedidos.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground mb-4">{debouncedSearch || statusFilter ? 'Tente ajustar os filtros' : 'Comece criando seu primeiro pedido'}</p>
            {!debouncedSearch && !statusFilter && (
              <Button onClick={() => navigate('/pedidos/criar')}><Plus className="w-4 h-4 mr-2" /> Criar Primeiro Pedido</Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
});

PedidosList.displayName = 'PedidosList';
export default PedidosList;
