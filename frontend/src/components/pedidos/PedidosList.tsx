import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Eye, Edit, Package, Phone, Plus, Printer, RotateCcw, Clock, CheckCircle2, AlertCircle, User as UserIcon, X, ChevronDown, ChevronUp, RefreshCcw, Wrench, Copy } from 'lucide-react';
import { DatasOrcamento } from '@/components/ui/DatasOrcamento';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Pedido, ProcessStatus, statusConfig, shouldShowDimensions } from '@/types/pedidos';
import api from '@/lib/api';
import { toast } from 'sonner';

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
  debouncedSearch: string;
  statusFilter: string;
  onOrderUpdated?: (updatedOrder: Pedido) => void;
}

const PedidosList: React.FC<PedidosListProps> = React.memo(({
  filteredPedidos, selectedPedidos, processStatuses,
  handleSelectAll, handleSelectPedido, getStatusDisplay,
  handleStatusChange, setSelectedPedido, setShowCancelModal,
  debouncedSearch, statusFilter, onOrderUpdated
}) => {
  const navigate = useNavigate();
  const [historyPedidoId, setHistoryPedidoId] = React.useState<string | null>(null);
  const [historyData, setHistoryData] = React.useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [expandedPedidos, setExpandedPedidos] = React.useState<Record<string, boolean>>({});
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);

  // Reabre o pedido para o status anterior (sem impacto financeiro)
  const handleReopen = async (pedido: Pedido) => {
    const reason = window.prompt(
      `Reabrir pedido ${pedido.orderNumber}?\nInforme o motivo (ex: "Clique acidental"):`
    );
    if (!reason) return;
    setLoadingAction(pedido.id + '_reopen');
    try {
      const res = await api.post(`/api/sales/orders/${pedido.id}/reopen`, { reason });
      if (res.data.success) {
        toast.success('Pedido reaberto com sucesso!');
        onOrderUpdated?.(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao reabrir pedido.');
    } finally {
      setLoadingAction(null);
    }
  };

  // Regenera a produção para itens com defeito (baixa estoque novamente)
  const handleRegenerate = async (pedido: Pedido) => {
    const reason = window.prompt(
      `Regerar produção do pedido ${pedido.orderNumber}?\nDescreva o problema (obrigatório):`
    );
    if (!reason || reason.trim().length < 3) {
      toast.error('É necessário informar o motivo com ao menos 3 caracteres.');
      return;
    }
    if (!window.confirm(
      `Confirma a regeneração de produção?\n\n` +
      `• As OPs atuais serão canceladas.\n` +
      `• O estoque será baixado novamente (custo de retrabalho).\n` +
      `• O pedido voltará para APROVADO.\n\nContinuar?`
    )) return;

    setLoadingAction(pedido.id + '_regenerate');
    try {
      const res = await api.post(`/api/sales/orders/${pedido.id}/regenerate`, { reason });
      if (res.data.success) {
        toast.success('Produção regenerada! Novas OPs geradas com sucesso.');
        onOrderUpdated?.(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao regenerar produção.');
    } finally {
      setLoadingAction(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedPedidos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchHistory = async (pedidoId: string) => {
    setLoadingHistory(true);
    setHistoryPedidoId(pedidoId);
    try {
      const response = await api.get(`/api/sales/orders/${pedidoId}/history`);
      if (response.data.success) {
        setHistoryData(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

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
        const config = statusConfig[pedido?.status as keyof typeof statusConfig];
        const statusColor = pedido?.status === 'CANCELLED' ? '#EF4444' : (pedido?.processStatus?.color || (config as any)?.hex || '#cbd5e1');
        const isOverdue = pedido?.status === 'DRAFT' && pedido?.validUntil && new Date(pedido.validUntil) < new Date();

        return (
          <Card
            key={pedido.id}
            className={`transition-all duration-300 shadow-sm hover:shadow-lg border-l-[6px] relative group overflow-hidden ${isOverdue ? 'bg-red-50/50 border-red-200' : 'bg-card'}`}
            style={{
              borderLeftColor: statusColor,
              '--status-color': statusColor
            } as any}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300 pointer-events-none"
              style={{ backgroundColor: statusColor }}
            />
            <CardContent className="p-6 relative z-10">
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
                      // Pedidos cancelados não mostram status de pagamento
                      if (pedido?.status === 'CANCELLED') return null;

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
                          Pendente: {pendingAmount > 0 ? formatCurrency(pendingAmount) : 'R$ 0,00'}
                        </span>
                      );
                    })()}
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0 text-muted-foreground hover:text-primary flex items-center justify-end w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(pedido.id);
                      }}
                    >
                      {(pedido?.items || []).length} item(s)
                      {expandedPedidos[pedido.id] ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                    </Button>
                  </div>

                  <div className="flex items-center space-x-2">
                    {(() => {
                      const statusDisplay = getStatusDisplay(pedido);
                      const isDynamic = !!pedido?.processStatus;
                      const isInteractive = pedido?.status !== 'DELIVERED' && pedido?.status !== 'CANCELLED';

                      if (!isInteractive) {
                        const isCancelled = pedido?.status === 'CANCELLED';
                        if (isCancelled) {
                          return <span className="px-3 py-1 rounded-full text-xs font-medium border bg-red-100 text-red-700 border-red-300">{statusDisplay.label}</span>;
                        }
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

                  <div className="flex items-center space-x-1">
                    {/* Botão de Histórico / Rastreio */}
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      title="Histórico de Movimentações"
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchHistory(pedido.id);
                      }}
                    >
                      <Clock className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                    </Button>

                    <Button size="icon" variant="ghost" onClick={() => setSelectedPedido(pedido)} title="Visualizar"><Eye className="w-4 h-4" /></Button>
                    {(() => {
                      const isCancelled = pedido?.status === 'CANCELLED';
                      if (isCancelled) return null;

                      const canEdit = pedido?.processStatus
                        ? pedido.processStatus.allowEdition
                        : pedido?.status === 'DRAFT';

                      if (canEdit) {
                        return (
                          <Button size="icon" variant="ghost" onClick={() => navigate(`/pedidos/criar?edit=${pedido.id}`)} title="Editar">
                            <Edit className="w-4 h-4" />
                          </Button>
                        );
                      }

                      // Pedidos FINISHED/DELIVERED são tratados pelos botões Reabrir/Regerar abaixo.
                      // Pedidos em produção (APPROVED, IN_PRODUCTION) não têm botão de reabrir aqui.
                      return null;
                    })()}
                    <Button size="icon" variant="ghost" title="Imprimir"><Printer className="w-4 h-4" /></Button>

                    {/* Botão Clonar — para copiar pedidos (especialmente útil para cancelados) */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                      title="Copiar / Duplicar Pedido"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/pedidos/criar?clone=${pedido.id}`);
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>

                    {/* Botão Reabrir — para pedidos FINISHED ou DELIVERED */}
                    {(pedido?.status === 'FINISHED' || pedido?.status === 'DELIVERED') && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Reabrir pedido (corrigir clique acidental)"
                        disabled={loadingAction === pedido.id + '_reopen'}
                        onClick={(e) => { e.stopPropagation(); handleReopen(pedido); }}
                      >
                        <RefreshCcw className={`w-4 h-4 ${loadingAction === pedido.id + '_reopen' ? 'animate-spin' : ''}`} />
                      </Button>
                    )}

                    {/* Botão Regerar Produção — para pedidos que precisam ser refeitos */}
                    {(pedido?.status === 'FINISHED' || pedido?.status === 'DELIVERED') && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        title="Regerar produção (produto com defeito)"
                        disabled={loadingAction === pedido.id + '_regenerate'}
                        onClick={(e) => { e.stopPropagation(); handleRegenerate(pedido); }}
                      >
                        <Wrench className={`w-4 h-4 ${loadingAction === pedido.id + '_regenerate' ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {expandedPedidos[pedido.id] && (
                <div className="mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-300">
                  {pedido?.status === 'DRAFT' && pedido?.validUntil && (
                    <div className="mb-4"><DatasOrcamento criadoEm={pedido.createdAt} validadeEm={pedido.validUntil} className="p-3 bg-muted rounded-lg" /></div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(pedido?.items || []).map((item) => (
                      <div key={item.id} className="text-sm bg-muted p-3 rounded-xl border border-slate-200/50 hover:bg-slate-100 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-slate-800">{item?.product?.name}</p>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {shouldShowDimensions(item as any)
                            ? `${item?.width} × ${item?.height}mm • ${item?.quantity}un`
                            : `${item?.quantity}un`}
                        </p>
                        <p className="font-bold text-primary mt-1">{formatCurrency(item?.totalPrice || 0)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

      {/* Drawer de Histórico Customizado */}
      {historyPedidoId && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setHistoryPedidoId(null)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Rastreamento do Pedido
                </h3>
                <p className="text-xs text-muted-foreground">Histórico de movimentações e justificativas</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setHistoryPedidoId(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-3">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Carregando histórico...</p>
                </div>
              ) : historyData.length > 0 ? (
                <div className="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                  {historyData.map((event, idx) => {
                    const toStatusInfo = statusConfig[event.toStatus as keyof typeof statusConfig];
                    return (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[31px] top-1 w-6 h-6 rounded-full bg-white border-2 border-primary flex items-center justify-center z-10 shadow-sm">
                          {idx === 0 ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <Clock className="w-3 h-3 text-slate-400" />}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{formatDateTime(event.createdAt)}</p>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              <UserIcon className="w-3 h-3" />
                              {event.user?.name || 'Sistema'}
                            </div>
                          </div>
                          
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm transition-hover hover:bg-white hover:shadow-md">
                            <div className="flex items-center gap-2 mb-1">
                               {event.fromStatus && (
                                 <>
                                   <span className="text-[11px] text-muted-foreground line-through">
                                      {statusConfig[event.fromStatus as keyof typeof statusConfig]?.label || event.fromStatus}
                                   </span>
                                   <span className="text-muted-foreground">→</span>
                                 </>
                               )}
                               <h4 className="font-bold text-sm text-slate-800">
                                  {toStatusInfo?.label || event.toStatus}
                               </h4>
                            </div>
                            {event.notes && (
                              <div className="mt-2 flex gap-2 text-sm p-3 bg-white rounded-lg border border-slate-200">
                                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-slate-700 italic text-xs leading-relaxed">{event.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20 text-muted-foreground">
                   <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                   <p>Nenhuma movimentação registrada.</p>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-slate-50 border-t text-center">
              <Button className="w-full" variant="outline" onClick={() => setHistoryPedidoId(null)}>
                Fechar Histórico
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PedidosList.displayName = 'PedidosList';
export default PedidosList;
