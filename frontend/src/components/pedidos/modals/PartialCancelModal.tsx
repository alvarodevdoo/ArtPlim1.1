import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { Pedido } from '@/types/pedidos';
import api from '@/lib/api';
import { toast } from 'sonner';

interface PartialCancelModalProps {
  pedido: Pedido | null;
  itemsToCancel: any[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PartialCancelModal: React.FC<PartialCancelModalProps> = ({ pedido, itemsToCancel, isOpen, onClose, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !pedido || itemsToCancel.length === 0) return null;

  const totalValueToCancel = itemsToCancel.reduce((sum, item) => sum + Number(item.totalPrice), 0);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      
      const payload = {
        itemIds: itemsToCancel.map(i => i.id),
        reason
      };

      await api.patch(`/api/sales/orders/${pedido.id}/cancel-items`, payload);
      
      toast.success('Itens cancelados com sucesso.');
      setReason('');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao cancelar itens:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao cancelar os itens selecionados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="modal-content-card max-w-md w-full relative">
        <CardHeader>
          <div className="flex items-center space-x-2 text-red-600 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <CardTitle>Cancelar Itens ({itemsToCancel.length})</CardTitle>
          </div>
          <CardDescription className="text-slate-600">
            Confirme o cancelamento destes itens. Esta ação ajustará o rateio financeiro automaticamente.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-100 p-4 rounded-lg">
            <div className="flex items-start space-x-3 text-red-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-1">Impacto Financeiro Estimado: R$ {totalValueToCancel.toFixed(2).replace('.', ',')}</p>
                <p className="opacity-90 leading-relaxed">
                  O valor de contas a receber será abatido. Se a fatura já estiver paga pelo cliente, um Estorno será gerado automaticamente.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-semibold text-slate-700">Motivo do Cancelamento (Opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Descreva o motivo..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </CardContent>

        <CardFooter className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Sair</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PartialCancelModal;
