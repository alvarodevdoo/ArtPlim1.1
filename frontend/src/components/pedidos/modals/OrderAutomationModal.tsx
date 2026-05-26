import React, { useEffect, useState } from 'react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { Button } from '@/components/ui/Button';
import { X, Zap, Loader2, Bell, MessageSquare, Mail, RefreshCcw } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import { WhatsAppService } from '@/lib/whatsapp';
import type { Pedido } from '@/types/pedidos';

type ActionType = 'whatsapp' | 'email' | 'notification' | 'status_update';

interface AutomationRule {
  id: string;
  name: string;
  description?: string | null;
  trigger: string;
  action: ActionType;
  conditions: Record<string, any>;
  enabled: boolean;
  lastRun?: string | null;
  runCount: number;
}

interface Props {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
}

const renderTemplate = (tpl: string, pedido: Pedido, extras: Record<string, string> = {}): string => {
  const total = Number(pedido.total ?? 0) || 0;
  const totalPaid = (pedido.transactions || []).reduce((sum: number, t: any) => {
    if ((t?.type === 'INCOME' || t?.type === 'CREDIT') && t?.status === 'PAID') {
      return sum + Number(t?.amount || 0);
    }
    return sum;
  }, 0);
  const pending = Math.max(total - totalPaid, 0);
  const itemCount = (pedido.items || []).reduce((s: number, i: any) => s + Number(i?.quantity || 0), 0);
  const firstItemName = pedido.items?.[0]?.product?.name || '';
  const customer: any = pedido.customer || {};

  const vars: Record<string, string> = {
    // Pedido
    orderNumber: pedido.orderNumber || '',
    orderTotal: formatCurrency(total),
    orderTotalPaid: formatCurrency(totalPaid),
    orderTotalPending: formatCurrency(pending),
    orderStatus: (pedido as any).processStatus?.name || pedido.status || '',
    orderItemsCount: String(pedido.items?.length || 0),
    orderItemsQuantity: String(itemCount),
    orderFirstItem: firstItemName,
    orderCreatedAt: pedido.createdAt ? formatDateTime(pedido.createdAt) : '',
    validUntil: pedido.validUntil ? formatDateTime(pedido.validUntil) : '',

    // Cliente
    customerName: customer.name || '',
    customerPhone: customer.phone || '',
    customerEmail: customer.email || '',
    customerDocument: customer.document || customer.cpf || customer.cnpj || '',
    customerCity: customer.city || customer.address?.city || '',

    // Extras (link público etc.)
    ...extras,
  };
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
};

const isWithinBusinessHours = (cond: any): boolean => {
  if (!cond?.respectBusinessHours || !cond.businessHours) return true;
  const { start = '08:00', end = '18:00', weekdays = [1, 2, 3, 4, 5] } = cond.businessHours;
  const now = new Date();
  if (!weekdays.includes(now.getDay())) return false;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= sh * 60 + sm && cur <= eh * 60 + em;
};

const nextBusinessStart = (cond: any): Date => {
  const { start = '08:00', weekdays = [1, 2, 3, 4, 5] } = cond.businessHours || {};
  const [sh, sm] = start.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (!weekdays.includes(d.getDay())) d.setDate(d.getDate() + 1);
  d.setHours(sh, sm, 0, 0);
  return d;
};

const ACTION_ICONS: Record<ActionType, React.ReactNode> = {
  whatsapp: <MessageSquare className="w-4 h-4 text-green-600" />,
  email: <Mail className="w-4 h-4 text-blue-600" />,
  notification: <Bell className="w-4 h-4 text-amber-600" />,
  status_update: <RefreshCcw className="w-4 h-4 text-purple-600" />,
};

export const OrderAutomationModal: React.FC<Props> = ({ pedido, isOpen, onClose }) => {
  const orderId = pedido?.id || '';
  const orderNumber = pedido?.orderNumber;
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadRules();
  }, [isOpen]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/api/sales/automation/rules');
      if (resp.data.success) setRules(resp.data.data.filter((r: AutomationRule) => r.enabled));
    } catch {
      toast.error('Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  };

  const execute = async (rule: AutomationRule) => {
    if (!pedido) return;
    try {
      setExecutingId(rule.id);

      // Verifica horário de expediente — como é execução manual, pergunta o que fazer
      const cond = rule.conditions || {};
      const inHours = isWithinBusinessHours(cond);
      if (!inHours && cond.respectBusinessHours) {
        const when = nextBusinessStart(cond);
        const choice = window.confirm(
          `Você está fora do horário de expediente.\n\n` +
          `OK = Enviar agora mesmo\n` +
          `Cancelar = Agendar para ${formatDateTime(when.toISOString())}`
        );
        if (!choice) {
          // Usuário escolheu agendar
          toast.info(`Envio agendado para ${formatDateTime(when.toISOString())}.`);
          await api.post(`/api/sales/automation/rules/${rule.id}/execute`, {
            orderIds: [orderId],
            scheduledFor: when.toISOString(),
          });
          setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, lastRun: new Date().toISOString(), runCount: r.runCount + 1 } : r)));
          return;
        }
        // Usuário escolheu enviar agora — segue o fluxo normal abaixo.
      }

      // Ação WhatsApp: abre o wa.me com a mensagem renderizada
      if (rule.action === 'whatsapp') {
        const phone = pedido.customer?.phone;
        if (!phone) {
          toast.error('Cliente sem telefone cadastrado.');
          return;
        }
        // Gera link público se o template referenciar {{publicLink}}
        let publicLink = '';
        const template = (cond.messageTemplate as string) || `Olá {{customerName}}! Sobre o pedido {{orderNumber}}.`;
        if (template.includes('{{publicLink}}')) {
          try {
            const linkRes = await api.post(`/api/sales/orders/${pedido.id}/share-link`);
            if (linkRes.data.success) publicLink = linkRes.data.data.url;
          } catch {
            // segue sem link
          }
        }
        const message = renderTemplate(template, pedido, { publicLink });
        WhatsAppService.sendMessage({ phone, message });
      } else if (rule.action === 'email') {
        const email = (pedido.customer as any)?.email;
        if (!email) {
          toast.error('Cliente sem e-mail cadastrado.');
          return;
        }
        let publicLink = '';
        const template = (cond.messageTemplate as string) || `Olá {{customerName}}!`;
        if (template.includes('{{publicLink}}')) {
          try {
            const linkRes = await api.post(`/api/sales/orders/${pedido.id}/share-link`);
            if (linkRes.data.success) publicLink = linkRes.data.data.url;
          } catch {/* segue sem link */}
        }
        const body = renderTemplate(template, pedido, { publicLink });
        window.open(`mailto:${email}?subject=${encodeURIComponent('Pedido ' + (pedido.orderNumber || ''))}&body=${encodeURIComponent(body)}`);
      }

      const resp = await api.post(`/api/sales/automation/rules/${rule.id}/execute`, { orderIds: [orderId] });
      if (resp.data.success) {
        toast.success(`"${rule.name}" executada para o pedido ${orderNumber || ''}`);
        setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, lastRun: new Date().toISOString(), runCount: r.runCount + 1 } : r)));
      }
    } catch (err: any) {
      console.error('Erro ao executar regra:', err);
      const msg = err?.response?.data?.message || err?.message || 'Erro ao executar regra';
      toast.error(msg);
    } finally {
      setExecutingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-auto">
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-lg font-bold">Automações do Pedido</h3>
                {orderNumber && <p className="text-xs text-muted-foreground">{orderNumber}</p>}
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhuma regra ativa. Configure em <strong>Configurações → Automações</strong>.
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map(rule => (
                  <div key={rule.id} className="border rounded-lg p-3 flex items-start justify-between gap-3 hover:bg-slate-50/50">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <div className="mt-0.5">{ACTION_ICONS[rule.action]}</div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{rule.name}</p>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{rule.description}</p>
                        )}
                        {rule.lastRun && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Última: {formatDateTime(rule.lastRun)} • {rule.runCount}x
                          </p>
                        )}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => execute(rule)} disabled={executingId === rule.id}>
                      {executingId === rule.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Zap className="w-3.5 h-3.5 mr-1" />Executar</>}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
