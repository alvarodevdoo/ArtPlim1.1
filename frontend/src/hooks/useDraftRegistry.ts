import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_DRAFT_TTL_MS,
  DRAFT_EXPIRATION_ALERT_MS,
  deleteDraft,
  extendDraft,
  listDrafts,
  subscribeDraftChanges,
  type DraftSummary,
} from '@/lib/draftStorage';

interface UseDraftRegistryOptions {
  /** Janela (ms) considerada "perto de expirar". Default: 15 min. */
  alertThresholdMs?: number;
  /** Intervalo (ms) de re-verificação periódica do tempo restante. Default: 30s. */
  pollIntervalMs?: number;
}

interface UseDraftRegistryReturn {
  /** Todos os rascunhos válidos no momento. */
  drafts: DraftSummary[];
  /** Subset de `drafts` cuja expiração está dentro do `alertThresholdMs`. */
  expiringDrafts: DraftSummary[];
  /** Total perto de expirar (atalho usado pelo badge). */
  expiringCount: number;
  /** Estende um rascunho específico (renovando o TTL). */
  extend: (key: string, ttlMs?: number) => void;
  /** Descarta um rascunho específico. */
  discard: (key: string) => void;
}

/**
 * Observa o conjunto de rascunhos no localStorage e expõe aqueles próximos
 * da expiração para alimentar o badge no sino de notificações.
 *
 * Estratégia de atualização:
 *  - Re-lê o storage quando qualquer mutação dispara (subscribeDraftChanges).
 *  - Re-lê também a cada `pollIntervalMs` para refletir o avanço do tempo
 *    (um rascunho com 14:55 restantes vira "perto de expirar" em 5s sem
 *    que ninguém mexa em nada).
 */
export function useDraftRegistry({
  alertThresholdMs = DRAFT_EXPIRATION_ALERT_MS,
  pollIntervalMs = 30_000,
}: UseDraftRegistryOptions = {}): UseDraftRegistryReturn {
  const [drafts, setDrafts] = useState<DraftSummary[]>(() => listDrafts());

  const refresh = useCallback(() => {
    setDrafts(listDrafts());
  }, []);

  useEffect(() => {
    const unsub = subscribeDraftChanges(refresh);
    const interval = setInterval(refresh, pollIntervalMs);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [refresh, pollIntervalMs]);

  const extend = useCallback((key: string, ttlMs: number = DEFAULT_DRAFT_TTL_MS) => {
    extendDraft(key, ttlMs);
    refresh();
  }, [refresh]);

  const discard = useCallback((key: string) => {
    deleteDraft(key);
    refresh();
  }, [refresh]);

  const expiringDrafts = drafts.filter(d => d.msUntilExpiration <= alertThresholdMs);

  return {
    drafts,
    expiringDrafts,
    expiringCount: expiringDrafts.length,
    extend,
    discard,
  };
}
