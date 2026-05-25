import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_DRAFT_TTL_MS,
  deleteDraft,
  readDraft,
  writeDraft,
  type DraftEnvelope,
} from '@/lib/draftStorage';

/**
 * useStateDraft
 * -------------
 * Variante de `useFormDraft` para formulários que não usam react-hook-form.
 *
 * O consumidor fornece:
 *  - `snapshot`: função que recolhe o estado atual em um objeto serializável.
 *  - `apply`:    função que aplica um snapshot de volta aos `setState` internos.
 *  - `isEmpty`:  predicado opcional que decide se ainda não vale a pena salvar
 *                (evita persistir o "esqueleto" inicial intocado).
 *
 * Comportamento idêntico ao `useFormDraft`:
 *  - Auto-save com debounce; TTL 2h por padrão.
 *  - Detecção na ativação; restauração manual (não automática).
 *  - Auto-save pausa enquanto `hasDraft` for true (usuário ainda não decidiu).
 *  - `clear` para usar em submit OK.
 */
export interface UseStateDraftOptions<T> {
  /** Chave única (ex: 'order:new'). */
  key: string;
  /** Rótulo amigável (ex: 'Novo Pedido'). */
  label: string;
  /** Liga/desliga o auto-save. */
  enabled: boolean;
  /** Snapshot do estado atual; deve ser puro e serializável. */
  snapshot: () => T;
  /** Aplica um snapshot de volta. Tipicamente um conjunto de setState. */
  apply: (data: T) => void;
  /** Predicado para "ainda não vale persistir". Default: nunca empty. */
  isEmpty?: (data: T) => boolean;
  /** TTL ms. Default: 2h. */
  ttlMs?: number;
  /** Debounce ms. Default: 500ms. */
  debounceMs?: number;
  /**
   * Lista de valores a observar. Funciona como o array de deps do useEffect:
   * sempre que algum item mudar, o auto-save é reagendado.
   * Tipicamente: passe os pedaços individuais de estado que compõem `snapshot`.
   */
  deps: React.DependencyList;
}

export interface UseStateDraftReturn<T> {
  hasDraft: boolean;
  savedAt: number | null;
  draft: DraftEnvelope<T> | null;
  restore: () => boolean;
  discard: () => void;
  clear: () => void;
}

export function useStateDraft<T>({
  key,
  label,
  enabled,
  snapshot,
  apply,
  isEmpty,
  ttlMs = DEFAULT_DRAFT_TTL_MS,
  debounceMs = 500,
  deps,
}: UseStateDraftOptions<T>): UseStateDraftReturn<T> {
  const [draft, setDraft] = useState<DraftEnvelope<T> | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Refs para fugir do problema de closures velhas em effects.
  const snapshotRef = useRef(snapshot);
  const applyRef = useRef(apply);
  const isEmptyRef = useRef(isEmpty);
  snapshotRef.current = snapshot;
  applyRef.current = apply;
  isEmptyRef.current = isEmpty;

  // --- Detecção inicial -----------------------------------------------------
  useEffect(() => {
    if (!enabled) {
      setDraft(null);
      setHasDraft(false);
      setSavedAt(null);
      return;
    }
    const env = readDraft<T>(key);
    if (env) {
      setDraft(env);
      setHasDraft(true);
      setSavedAt(env.savedAt);
    } else {
      setDraft(null);
      setHasDraft(false);
      setSavedAt(null);
    }
  }, [enabled, key]);

  // --- Auto-save debounced --------------------------------------------------
  // Suspende enquanto `hasDraft` é true: garante que aplicações de defaults
  // dos useEffects iniciais do componente não sobrescrevam o rascunho antes
  // do usuário decidir.
  useEffect(() => {
    if (!enabled) return;
    if (hasDraft) return;

    const timer = setTimeout(() => {
      const data = snapshotRef.current();
      if (isEmptyRef.current?.(data)) return;
      const env = writeDraft(key, data, { label, ttlMs });
      if (env) setSavedAt(env.savedAt);
    }, debounceMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hasDraft, key, label, ttlMs, debounceMs, ...deps]);

  // --- API ------------------------------------------------------------------
  const restore = useCallback((): boolean => {
    const env = draft ?? readDraft<T>(key);
    if (!env) {
      setHasDraft(false);
      setDraft(null);
      return false;
    }
    applyRef.current(env.values);
    setHasDraft(false);
    return true;
  }, [draft, key]);

  const discard = useCallback(() => {
    deleteDraft(key);
    setDraft(null);
    setHasDraft(false);
    setSavedAt(null);
  }, [key]);

  return { hasDraft, savedAt, draft, restore, discard, clear: discard };
}
