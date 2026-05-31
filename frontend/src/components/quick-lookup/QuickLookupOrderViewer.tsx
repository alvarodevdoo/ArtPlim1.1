import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Copy, ExternalLink, Loader2, User, Calendar, FileText, AlertCircle,
} from 'lucide-react';
import { useQuickLookup } from '@/contexts/QuickLookupContext';
import api from '@/lib/api';
import { formatCurrency, cn, getItemLengthUnit, formatLengthFromMm } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * QuickLookupOrderViewer
 * ----------------------
 * Popup read-only com detalhes de um pedido, exibido por cima do drawer
 * e da tela atual. Não permite edição (intencional — pra editar, abre em
 * nova aba e o usuário decide se quer mesmo).
 *
 * z-index 60 (acima do drawer 50 e da tela 40).
 * Backdrop semi-transparente, mas o drawer continua visível à direita.
 */

interface OrderItem {
  id: string;
  product?: { name?: string };
  productName?: string;
  customSizeName?: string;
  width?: number;
  height?: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  attributes?: any;
}

interface OrderDetail {
  id: string;
  orderNumber?: string | number;
  number?: string | number;
  createdAt?: string;
  status?: string;
  notes?: string;
  globalDiscount?: number;
  totalAmount?: number;
  total?: number;
  customer?: { id: string; name: string };
  items?: OrderItem[];
}

const ENDPOINT = (id: string) => `/api/sales/orders/${id}`;

export const QuickLookupOrderViewer: React.FC = () => {
  const { viewingOrderId, closeOrder, closeDrawer } = useQuickLookup();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega o pedido sempre que muda o id alvo.
  useEffect(() => {
    if (!viewingOrderId) {
      setOrder(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await api.get(ENDPOINT(viewingOrderId));
        if (cancelled) return;
        const data = resp.data?.data || resp.data;
        setOrder(data);
      } catch (err: any) {
        if (cancelled) return;
        setError('Não foi possível carregar este pedido.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [viewingOrderId]);

  // ESC fecha o popup. Para no popup — o drawer só responde a ESC quando
  // o popup está fechado (lógica daquele componente).
  useEffect(() => {
    if (!viewingOrderId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeOrder();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewingOrderId, closeOrder]);

  if (!viewingOrderId) return null;

  /**
   * Copiar um valor é tratado como "consulta concluída":
   * fecha o popup e o drawer numa só ação. Esse é o gesto mais comum
   * de fim de fluxo — o usuário pegou o número e quer voltar à tela
   * de trabalho sem precisar fechar manualmente cada camada.
   */
  const copyValue = async (label: string, value: number) => {
    try {
      await navigator.clipboard.writeText(value.toFixed(2));
      toast.success(`${label} copiado: ${formatCurrency(value)}`);
      closeOrder();
      closeDrawer();
    } catch {
      toast.error('Falha ao copiar.');
    }
  };

  const openInNewTab = () => {
    if (!viewingOrderId) return;
    // Abrir em modo edição em nova aba — preserva a tela atual.
    const url = `/pedidos/criar?edit=${viewingOrderId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    // Usuário escolheu trabalhar com este pedido em outra aba —
    // a consulta cumpriu seu papel, fecha tudo.
    closeOrder();
    closeDrawer();
  };

  const total = Number(order?.totalAmount ?? order?.total ?? 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop semi-transparente. Clique fecha. */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeOrder}
      />

      {/* Card */}
      <div
        className={cn(
          'relative bg-card rounded-2xl shadow-2xl border w-full max-w-2xl max-h-[85vh] flex flex-col',
          'animate-in zoom-in-95 fade-in duration-150'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold truncate">
                {loading
                  ? 'Carregando…'
                  : order
                    ? `Pedido #${order.orderNumber ?? order.number ?? order.id.slice(0, 8)}`
                    : 'Pedido'}
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                Consulta · somente leitura
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={openInNewTab}
              title="Abrir em nova aba (modo edição)"
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-accent transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir
            </button>
            <button
              type="button"
              onClick={closeOrder}
              title="Fechar (Esc)"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Carregando pedido…
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 m-5 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          ) : order ? (
            <div className="p-5 space-y-5">
              {/* Resumo */}
              <div className="grid grid-cols-2 gap-3">
                <InfoRow
                  icon={<User className="w-3.5 h-3.5" />}
                  label="Cliente"
                  value={order.customer?.name || '—'}
                />
                <InfoRow
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Data"
                  value={
                    order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString('pt-BR')
                      : '—'
                  }
                />
                {order.status && (
                  <InfoRow
                    icon={<FileText className="w-3.5 h-3.5" />}
                    label="Status"
                    value={order.status}
                  />
                )}
                {typeof order.globalDiscount === 'number' && order.globalDiscount > 0 && (
                  <InfoRow
                    label="Desconto global"
                    value={`${(order.globalDiscount * 100).toFixed(1)}%`}
                  />
                )}
              </div>

              {/* Itens */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Itens
                </h4>
                {!order.items || order.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Sem itens registrados.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 border-b text-muted-foreground uppercase">
                        <tr>
                          <th className="px-3 py-2 text-[10px] font-black tracking-wider">Item</th>
                          <th className="px-3 py-2 text-center text-[10px] font-black tracking-wider">Qtd</th>
                          <th className="px-3 py-2 text-right text-[10px] font-black tracking-wider">Unitário</th>
                          <th className="px-3 py-2 text-right text-[10px] font-black tracking-wider">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-background">
                        {order.items.map((item) => {
                          const name =
                            item.product?.name || item.productName || item.customSizeName || 'Item';
                          const qty = Number(item.quantity || 0);
                          const unit = Number(item.unitPrice || 0);
                          const net = Number(item.totalPrice || 0);
                          const gross = unit * qty;
                          const disc = gross - net;
                          const hasDisc = disc > 0.009;
                          const dimUnit = getItemLengthUnit(item);
                          const hasDim = !!(item.width && item.height);
                          return (
                            <tr key={item.id}>
                              <td className="px-3 py-3 align-top">
                                <p className="font-bold text-foreground">{name}</p>
                                {hasDim && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {formatLengthFromMm(Number(item.width), dimUnit)} × {formatLengthFromMm(Number(item.height), dimUnit)} {dimUnit}
                                    <span className="mx-1 text-muted-foreground/40">|</span>
                                    {((Number(item.width) * Number(item.height) * qty) / 1000000).toFixed(4)} m²
                                  </p>
                                )}
                                {item.notes && (
                                  <p className="text-[10px] text-muted-foreground italic mt-0.5 line-clamp-2">
                                    {item.notes}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center align-top font-medium">{qty}</td>
                              <td className="px-3 py-3 text-right align-top">
                                <button
                                  type="button"
                                  onClick={() => copyValue('Valor unitário', unit)}
                                  className="group inline-flex items-center gap-1 font-medium text-foreground hover:text-primary transition-colors"
                                  title="Copiar valor unitário"
                                >
                                  {formatCurrency(unit)}
                                  <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              </td>
                              <td className="px-3 py-3 text-right align-top">
                                {hasDisc && (
                                  <>
                                    <span className="block text-[11px] text-muted-foreground/60 line-through">{formatCurrency(gross)}</span>
                                    <span className="block text-[11px] text-red-500">- {formatCurrency(disc)}</span>
                                  </>
                                )}
                                <span className="block font-bold text-foreground">{formatCurrency(net)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Observações */}
              {order.notes && (
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                    Observações
                  </h4>
                  <p className="text-sm text-foreground bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">
                    {order.notes}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
          <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
            Total
          </span>
          <button
            type="button"
            disabled={!order}
            onClick={() => order && copyValue('Total do pedido', total)}
            className="group inline-flex items-center gap-2 text-base font-black text-foreground hover:text-primary transition-colors disabled:opacity-50"
            title="Copiar total"
          >
            {formatCurrency(total)}
            <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const InfoRow: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
      {icon}
      {label}
    </span>
    <span className="text-sm font-medium text-foreground truncate">{value}</span>
  </div>
);

export default QuickLookupOrderViewer;
