import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { buildPixBrCode } from '@/lib/pixBrCode';
import { Loader2, CheckCircle2, Clock, Package, AlertCircle, Copy, Check, QrCode as QrCodeIcon } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface PublicOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number | string;
  createdAt: string;
  validUntil?: string | null;
  deliveryDate?: string | null;
  customer?: { name: string };
  processStatus?: { name: string; color?: string | null } | null;
  items?: Array<{
    id: string;
    quantity: number;
    width?: number | string | null;
    height?: number | string | null;
    totalPrice: number | string;
    notes?: string | null;
    product?: { name: string };
  }>;
  transactions?: Array<{
    id: string;
    amount: number | string;
    paidAt?: string | null;
    paymentDate?: string | null;
    createdAt: string;
    paymentMethod?: { name: string; type?: string | null } | null;
  }>;
  organization?: {
    name: string;
    logoFull?: string | null;
    logoIcon?: string | null;
    phone?: string | null;
    settings?: { pixKey?: string | null; pixKeyType?: string | null; pixBeneficiary?: string | null } | null;
  };
}

interface HistoryEvent {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  createdAt: string;
  notes?: string | null;
  fromProcessStatus?: { name: string; color?: string | null } | null;
  toProcessStatus?: { name: string; color?: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Orçamento',
  PENDING: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  IN_PRODUCTION: 'Em produção',
  FINISHED: 'Disponível para retirada',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

// Traduz nomes de processStatus internos para linguagem amigável ao cliente
const CUSTOMER_FRIENDLY: Record<string, string> = {
  'finalizado': 'Disponível para retirada',
  'finalizada': 'Disponível para retirada',
  'pronto': 'Disponível para retirada',
  'concluído': 'Disponível para retirada',
  'concluido': 'Disponível para retirada',
};

const friendlyLabel = (raw?: string | null): string => {
  if (!raw) return '';
  return CUSTOMER_FRIENDLY[raw.trim().toLowerCase()] || raw;
};

const PublicOrderView: React.FC = () => {
  const { token: tokenParam } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const token = tokenParam || search.get('t') || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [pixPayload, setPixPayload] = useState<string>('');
  const [pixQr, setPixQr] = useState<string>('');
  const [pixCopied, setPixCopied] = useState<'key' | 'payload' | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Token ausente.');
      return;
    }
    api
      .get(`/api/public/order?t=${encodeURIComponent(token)}`)
      .then(resp => {
        if (resp.data.success) {
          setOrder(resp.data.data.order);
          setHistory(resp.data.data.history || []);
        } else {
          setError(resp.data.message || 'Erro ao carregar pedido');
        }
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Link inválido ou expirado.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Gera PIX BR Code + QR Code quando há chave configurada e saldo pendente
  useEffect(() => {
    if (!order) return;
    const key = order.organization?.settings?.pixKey;
    if (!key) {
      setPixPayload('');
      setPixQr('');
      return;
    }
    const totalNum = Number(order.total || 0);
    const paid = (order.transactions || []).reduce((s, t) => s + Number(t.amount || 0), 0);
    const pendingAmount = Math.max(totalNum - paid, 0);
    if (pendingAmount <= 0.01) return;

    const payload = buildPixBrCode({
      key,
      beneficiary: order.organization?.settings?.pixBeneficiary || order.organization?.name || '',
      amount: pendingAmount,
      txid: order.orderNumber?.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***',
    });
    setPixPayload(payload);
    QRCode.toDataURL(payload, { margin: 1, width: 240 }).then(setPixQr).catch(() => setPixQr(''));
  }, [order]);

  // Atualiza favicon e título da aba com a marca da organização
  useEffect(() => {
    if (!order) return;
    const orgName = order.organization?.name || 'Acompanhamento';
    document.title = `${order.orderNumber} — ${orgName}`;
    const iconUrl = order.organization?.logoIcon || order.organization?.logoFull;
    if (iconUrl) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = iconUrl;
    }
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-md p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-2">Não foi possível abrir o pedido</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const currentLabel = friendlyLabel(order.processStatus?.name) || STATUS_LABEL[order.status] || order.status;
  const currentColor = order.processStatus?.color || '#3b82f6';
  const total = Number(order.total || 0);
  const totalPaid = (order.transactions || []).reduce((s, t) => s + Number(t.amount || 0), 0);
  const pending = Math.max(total - totalPaid, 0);
  const isFullyPaid = pending <= 0.01;
  const pixKey = order.organization?.settings?.pixKey || '';
  const pixBeneficiary = order.organization?.settings?.pixBeneficiary || order.organization?.name || '';
  const showPix = !!pixKey && !isFullyPaid;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          {order.organization?.logoFull ? (
            <img
              src={order.organization.logoFull}
              alt={order.organization.name}
              className="h-14 max-w-[220px] object-contain"
            />
          ) : order.organization?.logoIcon ? (
            <img src={order.organization.logoIcon} alt={order.organization.name} className="h-12 w-12 object-contain" />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
          )}
          {!order.organization?.logoFull && (
            <div>
              <p className="font-bold text-base leading-tight">{order.organization?.name || 'Acompanhamento'}</p>
              {order.organization?.phone && (
                <p className="text-xs text-muted-foreground">{order.organization.phone}</p>
              )}
            </div>
          )}
          {order.organization?.logoFull && order.organization?.phone && (
            <span className="ml-auto text-base sm:text-lg font-semibold text-foreground">{order.organization.phone}</span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Pedido</p>
              <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
              <p className="text-sm text-muted-foreground mt-1">Cliente: <strong>{order.customer?.name}</strong></p>
              <p className="text-xs text-muted-foreground">Criado em {formatDateTime(order.createdAt)}</p>
            </div>
            <div className="text-right">
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border"
                style={{
                  backgroundColor: `${currentColor}15`,
                  color: currentColor,
                  borderColor: `${currentColor}55`,
                }}
              >
                {currentLabel}
              </span>
              <p className="text-2xl font-bold mt-2">{formatCurrency(total)}</p>
            </div>
          </div>
        </div>

        {/* Itens */}
        {order.items && order.items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">Itens</h2>
            <div className="space-y-2">
              {order.items.map(item => {
                const w = Number(item.width || 0);
                const h = Number(item.height || 0);
                const hasDimensions = w > 0 && h > 0;
                return (
                  <div key={item.id} className="flex items-start justify-between gap-3 border-b last:border-0 pb-2 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{item.product?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {hasDimensions
                          ? `${w} × ${h}mm • ${item.quantity}un`
                          : `${item.quantity}un`}
                      </p>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground italic mt-0.5">Obs: {item.notes}</p>
                      )}
                    </div>
                    <p className="font-semibold text-sm whitespace-nowrap">{formatCurrency(Number(item.totalPrice || 0))}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Resumo Financeiro */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">Financeiro</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total do pedido</span>
              <span className="font-semibold">{formatCurrency(total)}</span>
            </div>
            {(order.transactions || []).map(t => {
              const typeLabel: Record<string, string> = {
                PIX: 'PIX',
                CARD: 'Cartão',
                CASH: 'Dinheiro',
                TRANSFER: 'Transferência',
                BOLETO: 'Boleto',
                OTHER: 'Pagamento',
              };
              const label = typeLabel[t.paymentMethod?.type || ''] || 'Pagamento';
              return (
                <div key={t.id} className="flex justify-between text-green-700">
                  <span>
                    {label}
                    <span className="text-xs text-muted-foreground ml-1">
                      em {formatDateTime(t.paidAt || t.paymentDate || t.createdAt).split(',')[0]}
                    </span>
                  </span>
                  <span>- {formatCurrency(Number(t.amount || 0))}</span>
                </div>
              );
            })}
            <div className="border-t pt-2 flex justify-between">
              <span className={isFullyPaid ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                {isFullyPaid ? 'Pago integralmente' : 'Saldo pendente'}
              </span>
              <span className={`text-lg font-bold ${isFullyPaid ? 'text-green-700' : 'text-red-600'}`}>
                {isFullyPaid ? formatCurrency(total) : formatCurrency(pending)}
              </span>
            </div>

            {/* Bloco PIX */}
            {showPix && (
              <div className="mt-3 rounded-xl border-2 border-emerald-300 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <QrCodeIcon className="w-5 h-5 text-emerald-700" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Pague via PIX</p>
                      {pixBeneficiary && (
                        <p className="text-xs text-muted-foreground">Para: {pixBeneficiary}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Identificador</p>
                    <p className="font-mono font-semibold text-sm text-emerald-800">{order.orderNumber}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {/* QR Code à esquerda */}
                  {pixQr && (
                    <div className="shrink-0 mx-auto sm:mx-0">
                      <img src={pixQr} alt="QR Code PIX" className="rounded-lg bg-white p-2 border w-44 h-44 object-contain" />
                    </div>
                  )}

                  {/* Chave + Copia e Cola à direita */}
                  <div className="flex-1 min-w-0 w-full space-y-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">Chave PIX</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          readOnly
                          value={pixKey}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="flex-1 min-w-0 px-2 py-1.5 border rounded text-xs font-mono bg-white"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(pixKey);
                              setPixCopied('key');
                              toast.success('Chave PIX copiada!');
                              setTimeout(() => setPixCopied(null), 1500);
                            } catch { toast.error('Não foi possível copiar'); }
                          }}
                          className="px-3 py-1.5 border rounded bg-white hover:bg-slate-50 text-xs flex items-center gap-1 shrink-0"
                        >
                          {pixCopied === 'key' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                          Copiar
                        </button>
                      </div>
                    </div>

                    {pixPayload && (
                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">PIX Copia e Cola</label>
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text"
                            readOnly
                            value={pixPayload}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="flex-1 min-w-0 px-2 py-1.5 border rounded text-[10px] font-mono bg-white truncate"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(pixPayload);
                                setPixCopied('payload');
                                toast.success('Código PIX copiado!');
                                setTimeout(() => setPixCopied(null), 1500);
                              } catch { toast.error('Não foi possível copiar'); }
                            }}
                            className="px-3 py-1.5 border rounded bg-white hover:bg-slate-50 text-xs flex items-center gap-1 shrink-0"
                          >
                            {pixCopied === 'payload' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                            Copiar
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Abra o app do seu banco → PIX → Copia e Cola → cole este código.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {order.deliveryDate && (
              <div className="mt-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-primary">Prazo de entrega</span>
                <span className="font-bold text-primary">{formatDateTime(order.deliveryDate).split(',')[0]}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Status atual</span>
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border"
                style={{
                  backgroundColor: `${currentColor}15`,
                  color: currentColor,
                  borderColor: `${currentColor}55`,
                }}
              >
                {currentLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4">Acompanhamento</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sem movimentações registradas ainda.
            </p>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
              {history.map((ev, idx) => {
                const label = friendlyLabel(ev.toProcessStatus?.name) || STATUS_LABEL[ev.toStatus] || ev.toStatus;
                const color = ev.toProcessStatus?.color || '#3b82f6';
                const isLast = idx === history.length - 1;
                return (
                  <div key={ev.id} className="relative">
                    <div
                      className="absolute -left-[31px] top-0.5 w-6 h-6 rounded-full bg-white border-2 flex items-center justify-center shadow-sm z-10"
                      style={{ borderColor: isLast ? color : '#cbd5e1' }}
                    >
                      {isLast ? <CheckCircle2 className="w-3 h-3" style={{ color }} /> : <Clock className="w-3 h-3 text-slate-400" />}
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{formatDateTime(ev.createdAt)}</p>
                    <p className="font-semibold text-sm" style={{ color: isLast ? color : undefined }}>{label}</p>
                    {ev.notes && (
                      <p className="text-xs text-muted-foreground italic mt-1">{ev.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground py-4">
          Em caso de dúvidas, entre em contato com {order.organization?.name || 'a loja'}
          {order.organization?.phone ? ` pelo telefone ${order.organization.phone}` : ''}.
        </p>
      </main>
    </div>
  );
};

export default PublicOrderView;
