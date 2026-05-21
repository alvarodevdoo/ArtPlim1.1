import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { XCircle, Package, Check, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { ModalPortal } from '@/components/ui/ModalPortal';

export interface PedidoCustomer {
  id: string;
  name: string;
}

export interface Pedido {
  id: string;
  orderNumber: string;
  total: number;
  status?: string;
  customer: PedidoCustomer;
  transactions?: Array<{
    amount: number | string;
    status: string;
    type: string;
  }>;
}

interface MaterialInfo {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface CancelOrderModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string, reason: string, paymentAction: string, refundAmount: number, materiaisConsumidos?: string[]) => void;
}

const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  pedido,
  isOpen,
  onClose,
  onConfirm
}) => {
  const [cancelReason, setCancelReason] = useState('');
  const [paymentAction, setPaymentAction] = useState('NONE');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [materiais, setMateriais] = useState<MaterialInfo[]>([]);
  const [materiaisConsumidos, setMateriaisConsumidos] = useState<Set<string>>(new Set());
  const [loadingMateriais, setLoadingMateriais] = useState(false);

  const totalPaid = pedido?.transactions
    ? pedido.transactions
        .filter(t => t.status === 'PAID' && (t.type === 'INCOME' || t.type === 'DEBIT'))
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
    : 0;

  // Status que indicam que a produção pode ter sido iniciada
  const statusPosProducao = ['IN_PRODUCTION', 'FINISHED', 'DELIVERED'];
  const jaProduziu = pedido?.status ? statusPosProducao.includes(pedido.status) : false;

  useEffect(() => {
    if (isOpen && pedido) {
      setCancelReason('');
      setPaymentAction('NONE');
      setRefundAmount(totalPaid);
      setMateriaisConsumidos(new Set());
      setMateriais([]);

      // Buscar materiais do pedido
      setLoadingMateriais(true);
      api.get(`/api/sales/orders/${pedido.id}/materials`)
        .then(res => {
          const mats = res.data?.data || [];
          setMateriais(mats);
          // Se já produziu, marcar todos como consumidos por padrão
          if (jaProduziu) {
            setMateriaisConsumidos(new Set(mats.map((m: MaterialInfo) => m.id)));
          }
        })
        .catch(() => setMateriais([]))
        .finally(() => setLoadingMateriais(false));
    }
  }, [isOpen, pedido?.id]);

  if (!isOpen || !pedido) return null;

  const toggleMaterial = (id: string) => {
    setMateriaisConsumidos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (materiaisConsumidos.size === materiais.length) {
      setMateriaisConsumidos(new Set());
    } else {
      setMateriaisConsumidos(new Set(materiais.map(m => m.id)));
    }
  };

  const handleConfirm = () => {
    onConfirm(
      pedido.id,
      cancelReason,
      paymentAction,
      refundAmount,
      Array.from(materiaisConsumidos)
    );
  };

  return (
    <ModalPortal>
      <Card className="modal-content-card max-w-lg">

        <CardHeader>
          <CardTitle className="text-red-600 flex items-center">
            <XCircle className="w-5 h-5 mr-2" />
            Confirmar Cancelamento
          </CardTitle>
          <CardDescription>
            Pedido #{pedido.orderNumber} - {pedido.customer?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo do Cancelamento:</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Explique o motivo do cancelamento..."
              className="w-full h-20 p-2 border border-input rounded-md resize-none bg-transparent text-sm"
            />
          </div>

          {/* Seção de Materiais */}
          {loadingMateriais ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando materiais...
            </div>
          ) : materiais.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Package className="w-4 h-4" /> Materiais já consumidos:
                </label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-primary hover:underline"
                >
                  {materiaisConsumidos.size === materiais.length ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Marque os materiais que já foram consumidos na produção. Eles <strong>não</strong> serão devolvidos ao estoque.
              </p>
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {materiais.map(mat => {
                  const checked = materiaisConsumidos.has(mat.id);
                  return (
                    <label
                      key={mat.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors text-sm ${
                        checked ? 'bg-red-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        checked ? 'bg-red-500 border-red-500' : 'border-muted-foreground/40'
                      }`}>
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMaterial(mat.id)}
                        className="sr-only"
                      />
                      <span className={`flex-1 ${checked ? 'text-red-700' : ''}`}>{mat.name}</span>
                      <span className={`text-xs tabular-nums ${checked ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {mat.quantity.toFixed(2)} {mat.unit}
                      </span>
                    </label>
                  );
                })}
              </div>
              {materiaisConsumidos.size > 0 && (
                <p className="text-[10px] text-amber-600 font-medium">
                  {materiaisConsumidos.size} material(is) marcado(s) como consumido(s) — não serão devolvidos ao estoque.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Ação Financeira:</label>
            <Select value={paymentAction} onValueChange={setPaymentAction}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a ação" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="NONE">Nenhuma (Apenas cancelar)</SelectItem>
                <SelectItem value="REFUND" disabled={totalPaid <= 0}>Solicitar Estorno/Devolução</SelectItem>
                <SelectItem value="CREDIT" disabled={totalPaid <= 0}>Converter em Crédito para o Cliente</SelectItem>
              </SelectContent>
            </Select>
            {totalPaid <= 0 && paymentAction !== 'NONE' && (
              <p className="text-sm text-yellow-600 font-medium">Não há histórico de pagamentos para estornar ou creditar.</p>
            )}
          </div>
          {paymentAction !== 'NONE' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor a Estornar/Creditar (R$):</label>
              <Input
                type="number"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(Math.min(Number(e.target.value), totalPaid))}
                max={totalPaid}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Valor pago: R$ {totalPaid.toFixed(2)}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex space-x-2">
          <Button
            variant="destructive"
            className="flex-1"
            disabled={!cancelReason.trim() || (paymentAction !== 'NONE' && refundAmount > totalPaid)}
            onClick={handleConfirm}
          >
            Confirmar Cancelamento
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Voltar
          </Button>
        </CardFooter>
      </Card>
    </ModalPortal>
  );
};

export default React.memo(CancelOrderModal);
