import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * QuickLookupContext
 * ------------------
 * Estado global do "lateral bar de consulta rápida".
 *
 * Conceito:
 *  - O usuário pode estar editando qualquer coisa (pedido, produto, etc.)
 *    e precisa consultar um pedido antigo SEM perder o que está fazendo.
 *  - Uma única instância de drawer + popup, controlada por este contexto,
 *    fica disponível em qualquer rota.
 *  - Telas podem opcionalmente "registrar contexto" (ex: cliente selecionado
 *    no momento) para que a busca pré-filtre relevância.
 *
 * Responsabilidades deste contexto:
 *  - Abrir/fechar drawer.
 *  - Abrir/fechar popup com pedido específico.
 *  - Manter consulta digitada e tipo de entidade ativa entre aberturas.
 *  - Expor contexto sugerido (clienteId atual) — usado como pré-filtro.
 *
 * NÃO é responsabilidade daqui:
 *  - Buscar dados (cada componente faz sua própria chamada à API).
 *  - Renderizar UI (drawer e popup são componentes separados).
 */

export type LookupEntity = 'orders';

export interface SuggestedContext {
  /** Cliente selecionado na tela atual (pré-filtra resultados). */
  clienteId?: string | null;
  /** Nome do cliente para exibição em label de filtro. */
  clienteNome?: string | null;
}

interface QuickLookupContextValue {
  // ── Drawer ───────────────────────────────────────────────────────────────
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  // ── Popup viewer ─────────────────────────────────────────────────────────
  viewingOrderId: string | null;
  openOrder: (orderId: string) => void;
  closeOrder: () => void;

  // ── Busca persistente ────────────────────────────────────────────────────
  /** Texto da busca, preservado entre aberturas do drawer. */
  query: string;
  setQuery: (q: string) => void;
  /** Tipo de entidade ativa (Fase 1: só 'orders'). */
  entity: LookupEntity;
  setEntity: (e: LookupEntity) => void;
  /** Filtro "Cliente atual" ligado? Persistente entre aberturas. */
  filterByCurrentCliente: boolean;
  setFilterByCurrentCliente: (v: boolean) => void;

  // ── Contexto sugerido pela tela atual ────────────────────────────────────
  suggestedContext: SuggestedContext;
  /**
   * Registra (ou substitui) o contexto sugerido. Retorna função de cleanup
   * que restaura o contexto anterior — uso típico em useEffect.
   *
   * Implementado como pilha: se telas aninhadas registrarem, o cleanup
   * volta ao contexto anterior corretamente.
   */
  registerContext: (ctx: SuggestedContext) => () => void;
}

const QuickLookupContext = createContext<QuickLookupContextValue | null>(null);

export const useQuickLookup = (): QuickLookupContextValue => {
  const ctx = useContext(QuickLookupContext);
  if (!ctx) {
    throw new Error('useQuickLookup deve ser usado dentro de <QuickLookupProvider />');
  }
  return ctx;
};

interface ProviderProps {
  children: React.ReactNode;
}

export const QuickLookupProvider: React.FC<ProviderProps> = ({ children }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [entity, setEntity] = useState<LookupEntity>('orders');
  const [filterByCurrentCliente, setFilterByCurrentCliente] = useState(true);
  const [suggestedContext, setSuggestedContext] = useState<SuggestedContext>({});

  // Pilha de contextos para suportar telas aninhadas registrando o seu.
  // Quando a tela A registra { clienteId: X } e depois um modal interno
  // registra { clienteId: Y }, ao fechar o modal o contexto volta para X.
  const stackRef = useRef<SuggestedContext[]>([]);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setIsDrawerOpen(v => !v), []);

  const openOrder = useCallback((orderId: string) => setViewingOrderId(orderId), []);
  const closeOrder = useCallback(() => setViewingOrderId(null), []);

  const registerContext = useCallback((ctx: SuggestedContext): (() => void) => {
    stackRef.current.push(ctx);
    setSuggestedContext(ctx);
    return () => {
      // Remove a primeira ocorrência desta entrada (não usa pop bruto para
      // suportar cleanups fora de ordem, embora raros).
      const idx = stackRef.current.lastIndexOf(ctx);
      if (idx >= 0) stackRef.current.splice(idx, 1);
      const top = stackRef.current[stackRef.current.length - 1];
      setSuggestedContext(top || {});
    };
  }, []);

  const value: QuickLookupContextValue = useMemo(() => ({
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    viewingOrderId,
    openOrder,
    closeOrder,
    query,
    setQuery,
    entity,
    setEntity,
    filterByCurrentCliente,
    setFilterByCurrentCliente,
    suggestedContext,
    registerContext,
  }), [
    isDrawerOpen, openDrawer, closeDrawer, toggleDrawer,
    viewingOrderId, openOrder, closeOrder,
    query, entity, filterByCurrentCliente,
    suggestedContext, registerContext,
  ]);

  return (
    <QuickLookupContext.Provider value={value}>
      {children}
    </QuickLookupContext.Provider>
  );
};

/**
 * Hook utilitário: registra contexto sugerido pelo tempo de vida do componente.
 * Aceita undefined para "não tenho contexto agora" sem precisar registrar.
 */
export const useRegisterLookupContext = (ctx: SuggestedContext | undefined) => {
  const { registerContext } = useQuickLookup();
  // Serialização estável para evitar re-registro em cada render quando a
  // referência muda mas os valores não.
  const key = JSON.stringify(ctx ?? {});
  React.useEffect(() => {
    if (!ctx || (!ctx.clienteId && !ctx.clienteNome)) return;
    const cleanup = registerContext(ctx);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, registerContext]);
};
