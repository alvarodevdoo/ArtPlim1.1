import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { MessageSquare, Send } from 'lucide-react';

export interface PedidoCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface Pedido {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  customer: PedidoCustomer;
  // Outros campos podem existir em Pedido, mas estes s\u00e3o necess\u00e1rios aqui
}

interface WhatsAppModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: (phone: string, name: string, message: string) => void;
}

const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ 
  pedido, 
  isOpen, 
  onClose, 
  onSend 
}) => {
  const [message, setMessage] = useState('');

  if (!isOpen || !pedido) return null;

  const handleSend = () => {
    if (pedido.customer?.phone && message.trim()) {
      onSend(pedido.customer.phone, pedido.customer.name, message);
      setMessage('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>Enviar WhatsApp</span>
              </CardTitle>
              <CardDescription>Para: {pedido.customer?.name}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Mensagem:</label>
            <textarea 
              value={message} 
              onChange={(e) => setMessage(e.target.value)} 
              placeholder="Digite sua mensagem personalizada..." 
              className="w-full h-32 p-3 border border-input rounded-md resize-none mt-1 bg-transparent" 
            />
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={handleSend} 
              disabled={!message.trim()} 
              className="flex-1"
            >
              <Send className="w-4 h-4 mr-2" /> Enviar
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default React.memo(WhatsAppModal);
