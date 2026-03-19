import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { XCircle } from 'lucide-react';

export interface PedidoCustomer {
  id: string;
  name: string;
}

export interface Pedido {
  id: string;
  orderNumber: string;
  total: number;
  customer: PedidoCustomer;
}

interface CancelOrderModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string, reason: string, paymentAction: string, refundAmount: number) => void;
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

  useEffect(() => {
    if (isOpen && pedido) {
      setCancelReason('');
      setPaymentAction('NONE');
      setRefundAmount(Number(pedido.total) || 0);
    }
  }, [isOpen, pedido]);

  if (!isOpen || !pedido) return null;

  const handleConfirm = () => {
    onConfirm(pedido.id, cancelReason, paymentAction, refundAmount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <Card className="w-full max-w-md">
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
              className="w-full h-24 p-2 border border-input rounded-md resize-none bg-transparent" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ação Financeira:</label>
            <Select value={paymentAction} onValueChange={setPaymentAction}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Nenhuma (Apenas cancelar)</SelectItem>
                <SelectItem value="REFUND">Solicitar Estorno/Devolução</SelectItem>
                <SelectItem value="CREDIT">Converter em Crédito para o Cliente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentAction !== 'NONE' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor a Estornar/Creditar (R$):</label>
              <Input 
                type="number" 
                step="0.01" 
                value={refundAmount} 
                onChange={(e) => setRefundAmount(Math.min(Number(e.target.value), Number(pedido.total)))} 
                max={Number(pedido.total)} 
                className="w-full" 
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex space-x-2">
          <Button 
            variant="destructive" 
            className="flex-1" 
            disabled={!cancelReason.trim()} 
            onClick={handleConfirm}
          >
            Confirmar Cancelamento
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Voltar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default React.memo(CancelOrderModal);
