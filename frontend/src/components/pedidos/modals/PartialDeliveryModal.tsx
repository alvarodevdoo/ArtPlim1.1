import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/textarea';
import { PackageCheck, Truck } from 'lucide-react';
import { Pedido } from '@/types/pedidos';
import api from '@/lib/api';
import { toast } from 'sonner';

interface PartialDeliveryModalProps {
  pedido: Pedido | null;
  itemsToDeliver: any[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PartialDeliveryModal: React.FC<PartialDeliveryModalProps> = ({ pedido, itemsToDeliver, isOpen, onClose, onSuccess }) => {
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && itemsToDeliver) {
      const initialQtys: { [key: string]: number } = {};
      itemsToDeliver.forEach(item => {
        initialQtys[item.id] = item.quantity;
      });
      setQuantities(initialQtys);
      setNotes('');
    }
  }, [isOpen, itemsToDeliver]);

  if (!isOpen || !pedido || itemsToDeliver.length === 0) return null;

  const handleQtyChange = (itemId: string, val: string, max: number) => {
    let num = parseInt(val, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > max) num = max;
    
    setQuantities(prev => ({ ...prev, [itemId]: num }));
  };

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      
      const payloadItems = Object.entries(quantities)
        .filter(([_, qty]) => qty > 0)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

      if (payloadItems.length === 0) {
        toast.warning('Nenhuma quantidade válida de entrega informada.');
        setIsSubmitting(false);
        return;
      }

      const payload = { items: payloadItems, notes };

      await api.post(`/api/sales/orders/${pedido.id}/deliveries`, payload);
      
      toast.success('Romaneio de entrega gerado com sucesso!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao gerar romaneio:', error);
      toast.error(error.response?.data?.error?.message || 'Falha ao registrar entrega.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="modal-content-card max-w-xl w-full relative">
        <CardHeader>
          <div className="flex items-center space-x-2 text-emerald-600 mb-2">
            <Truck className="w-5 h-5" />
            <CardTitle>Novo Romaneio</CardTitle>
          </div>
          <CardDescription className="text-slate-600">
            Entregando <span className="font-bold">{itemsToDeliver.length}</span> itens. Informe as quantidades repassadas ao cliente.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-3">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Itens e Quantidades</Label>
            {itemsToDeliver.map((item, index) => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex flex-col flex-1">
                  <span className="font-medium text-sm text-slate-800 line-clamp-1">
                    #{index + 1} {item.product?.name || 'Item'}
                  </span>
                  <span className="text-xs text-slate-500">Comprado: {item.quantity} un</span>
                </div>
                <div className="ml-4 flex items-center space-x-2">
                  <Label className="text-xs font-semibold text-slate-600">Qtd a entregar:</Label>
                  <Input 
                    type="number" 
                    className="w-20 text-center font-bold"
                    min="0"
                    max={item.quantity}
                    value={quantities[item.id] !== undefined ? quantities[item.id] : item.quantity}
                    onChange={(e) => handleQtyChange(item.id, e.target.value, item.quantity)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 mt-4">
            <Label htmlFor="notes" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Ex: Entregue via portador..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>
        </CardContent>

        <CardFooter className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white" 
            onClick={handleConfirm} 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Gerando...' : <><PackageCheck className="w-4 h-4 mr-2" /> Gerar Romaneio</>}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PartialDeliveryModal;
