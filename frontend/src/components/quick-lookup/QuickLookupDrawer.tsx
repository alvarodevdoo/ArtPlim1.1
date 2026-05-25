import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Filter, FileText, ChevronRight, Loader2 } from 'lucide-react';
import { useQuickLookup } from '@/contexts/QuickLookupContext';
import api from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

/**
 * QuickLookupDrawer
 * -----------------
 * Drawer lateral direito, **não-bloqueante** (sem backdrop), para consultar
 * pedidos antigos sem sair da tela atual.
 *
 * Layout:
 *  - Largura fixa 380px ancorada à direita.
 *  - Tela atrás permanece interativa (sem overlay escurecendo).
 *  - z-index intermediário (50). O popup viewer ficará acima (60).
 *
 * Comportamento:
 *  - Input com debounce 300ms.
 *  - Se "Filtrar por cliente atual" estiver ligado e houver contexto registrado,
 *    pré-filtra. O nome do cliente é injetado no `search` quando o usuário
 *    não digitou nada (heurística simples; backend já bate por search).
 *  - Filtragem fina por `customerId` é feita client-side com os dados retornados.
 *  - Clicar num resultado abre o popup viewer (não fecha o drawer).
 *  - ESC fecha o drawer (se popup não estiver aberto).
 */

interface OrderListItem {
  id: string;
  orderNumber?: string | number;
  number?: string | number;
  createdAt?: string;
  totalAmount?: number;
  total?: number;
  status?: string;
  customer?: { id: string; name: string };
}

const DEBOUNCE_MS = 300;

export const QuickLookupDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    closeDrawer,
    openOrder,
    viewingOrderId,
    query,
    setQuery,
    filterByCurrentCliente,
    setFilterByCurrentCliente,
    suggestedContext,
  } = useQuickLookup();

  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [results, setResults] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus no input ao abrir o drawer.
  useEffect(() => {
    if (isDrawerOpen) {
      // pequeno delay para garantir que o input está no DOM e visível.
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isDrawerOpen]);

  // ESC fecha o drawer (mas não se o popup estiver aberto — popup trata ESC primeiro).
  useEffect(() => {
    if (!isDrawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !viewingOrderId) {
        closeDrawer();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDrawerOpen, viewingOrderId, closeDrawer]);

  // Debounce da busca.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Monta o termo de busca efetivo. Se o usuário não digitou nada mas há
  // cliente atual e o toggle está ligado, usa o nome do cliente como search.
  const effectiveSearch = useMemo(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed) return trimmed;
    if (filterByCurrentCliente && suggestedContext.clienteNome) {
      return suggestedContext.clienteNome;
    }
    return '';
  }, [debouncedQuery, filterByCurrentCliente, suggestedContext.clienteNome]);

  // Carrega resultados sempre que o drawer está aberto e o termo muda.
  useEffect(() => {
    if (!isDrawerOpen) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, any> = { limit: 20 };
        if (effectiveSearch) params.search = effectiveSearch;
        const resp = await api.get('/api/sales/orders', { params });
        if (cancelled) return;
        const data: OrderListItem[] = resp.data?.data || resp.data?.orders || resp.data || [];
        let filtered = Array.isArray(data) ? data : [];
        // Filtragem fina client-side pelo id do cliente atual (caso o
        // backend tenha retornado outros nomes parecidos no search por nome).
        if (filterByCurrentCliente && suggestedContext.clienteId) {
          filtered = filtered.filter(o => o.customer?.id === suggestedContext.clienteId);
        }
        setResults(filtered);
      } catch (err: any) {
        if (cancelled) return;
        setError('Falha ao buscar pedidos.');
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isDrawerOpen, effectiveSearch, filterByCurrentCliente, suggestedContext.clienteId]);

  if (!isDrawerOpen) return null;

  return createPortal(
    <div
      className="fixed top-0 right-0 z-50 h-full w-[380px] bg-card border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      role="complementary"
      aria-label="Consulta rápida de pedidos"
    >
      {/* Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Consulta Rápida</h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                Pedidos
              </p>
            </div>
          </div>
          <button
            onClick={closeDrawer}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input de busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Número, cliente, produto..."
            className="w-full pl-10 pr-3 h-10 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Filtro contextual */}
        {suggestedContext.clienteNome && (
          <label className="flex items-center gap-2 mt-3 px-1 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-primary"
              checked={filterByCurrentCliente}
              onChange={(e) => setFilterByCurrentCliente(e.target.checked)}
            />
            <Filter className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              Filtrar por cliente atual:{' '}
              <span className="font-semibold text-foreground">
                {suggestedContext.clienteNome}
              </span>
            </span>
          </label>
        )}
      </div>

      {/* Resultados */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm">Buscando...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-600">{error}</div>
        ) : results.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {effectiveSearch
              ? 'Nenhum pedido encontrado.'
              : 'Digite para buscar pedidos.'}
          </div>
        ) : (
          <ul className="divide-y">
            {results.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => openOrder(order.id)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                    'hover:bg-accent/40',
                    viewingOrderId === order.id && 'bg-primary/5'
                  )}
                >
                  <div className="mt-0.5 rounded-md bg-blue-50 text-blue-700 p-1.5">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        #{order.orderNumber ?? order.number ?? order.id.slice(0, 6)}
                      </span>
                      {order.status && (
                        <span className="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {order.status}
                        </span>
                      )}
                    </div>
                    {order.customer?.name && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {order.customer.name}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString('pt-BR')
                          : ''}
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        {formatCurrency(Number(order.totalAmount ?? order.total ?? 0))}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground mt-2" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Rodapé com dica de atalho */}
      <div className="px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-background border text-[9px] font-mono">Esc</kbd> fechar
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-background border text-[9px] font-mono">Ctrl</kbd>+
          <kbd className="px-1.5 py-0.5 rounded bg-background border text-[9px] font-mono">K</kbd> abrir
        </span>
      </div>
    </div>,
    document.body
  );
};

export default QuickLookupDrawer;
