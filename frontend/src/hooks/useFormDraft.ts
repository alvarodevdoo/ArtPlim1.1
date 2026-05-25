import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReset, UseFormWatch } from 'react-hook-form';
import {
  DEFAULT_DRAFT_TTL_MS,
  deleteDraft,
  isLikelyEmpty,
  readDraft,
  writeDraft,
  type DraftEnvelope,
} from '@/lib/draftStorage';

/**
 * useFormDraft
 * ------------
 * Plugar em qualquer formulário react-hook-form para ter auto-save com TTL.
 *
 * Modelo mental:
 *  - Enquanto `enabled` for true, observa `watch` e persiste valores em
 *    localStorage com debounce de `debounceMs` (default 500ms).
 *  - Ao montar (ou ao `enabled` virar true), detecta rascunho válido e expõe
 *    `hasDraft` + `restore()` / `discard()`. Não restaura automaticamente —
 *    o consumidor decide quando aplicar via `restore()`.
 *  - Em submit OK, o consumidor chama `clear()` para remover o rascunho.
 *
 * O hook *nunca* chama `reset` sem ordem explícita. Isso evita corromper
 * formulários de edição (onde a fonte da verdade é o backend).
 */
export interface UseFormDraftOptions<T extends FieldValues> {
  /** Chave única e estável do form (ex: 'material:new'). */
  key: string;
  /** Rótulo amigável exibido no sino (ex: 'Novo Insumo'). */
  label: string;
  /** Função `watch` do useForm. */
  watch: UseFormWatch<T>;
  /** Função `reset` do useForm — usada por `restore()`. */
  reset: UseFormReset<T>;
  /** Liga/desliga o auto-save. Tipicamente: `isOpen && !editingId`. */
  enabled: boolean;
  /** TTL em ms. Default: 2h. */
  ttlMs?: number;
  /** Debounce de save. Default: 500ms. */
  debounceMs?: number;
  /**
   * Função opcional para sanitizar/serializar valores antes de gravar.
   * Útil para remover Files, datas não serializáveis, etc.
   */
  serialize?: (values: T) => unknown;
  /**
   * Função opcional para decidir se vale a pena salvar. Por padrão usa a
   * heurística `isLikelyEmpty`. Retorne `false` para inibir a gravação.
   */
  shouldPersist?: (values: T) => boolean;
}

export interface UseFormDraftReturn<T extends FieldValues> {
  /** Existe um rascunho válido aguardando decisão do usuário? */
  hasDraft: boolean;
  /** Timestamp do último save (ms epoch), ou null. */
  savedAt: number | null;
  /** Envelope completo do draft detectado (para inspeção). */
  draft: DraftEnvelope<T> | null;
  /** Aplica o draft ao form via `reset`. Marca `hasDraft=false`. */
  restore: () => boolean;
  /** Remove o draft e zera o estado. */
  discard: () => void;
  /** Alias semântico de `discard` para uso em submit OK. */
  clear: () => void;
}

export function useFormDraft<T extends FieldValues>({
  key,
  label,
  watch,
  reset,
  enabled,
  ttlMs = DEFAULT_DRAFT_TTL_MS,
  debounceMs = 500,
  serialize,
  shouldPersist,
}: UseFormDraftOptions<T>): UseFormDraftReturn<T> {
  const [draft, setDraft] = useState<DraftEnvelope<T> | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Refs para evitar capturar closures velhas na subscription do watch.
  const serializeRef = useRef(serialize);
  const shouldPersistRef = useRef(shouldPersist);
  serializeRef.current = serialize;
  shouldPersistRef.current = shouldPersist;

  // --- Detecção inicial -----------------------------------------------------
  // Quando o form é (re)ativado, verifica se há rascunho válido para oferecer
  // restauração. Não aplica automaticamente — quem decide é a UI.
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
  // Importante: enquanto `hasDraft` for true (banner visível, usuário ainda não
  // decidiu), o auto-save fica suspenso. Sem isso, o `reset(defaultsVazios)`
  // que outros effects do form possam disparar logo após a abertura
  // sobrescreveria o rascunho salvo antes do usuário clicar em "Continuar".
  useEffect(() => {
    if (!enabled) return;
    if (hasDraft) return; // aguarda decisão (restore ou discard)
    let timer: ReturnType<typeof setTimeout> | null = null;

    const subscription = watch((value) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const values = value as T;
        const persistGuard = shouldPersistRef.current;
        const passes = persistGuard
          ? persistGuard(values)
          : !isLikelyEmpty(values);
        if (!passes) return;
        const payload = serializeRef.current ? serializeRef.current(values) : values;
        const env = writeDraft(key, payload, { label, ttlMs });
        if (env) setSavedAt(env.savedAt);
      }, debounceMs);
    });

    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [enabled, hasDraft, key, label, ttlMs, debounceMs, watch]);

  // --- API ------------------------------------------------------------------
  const restore = useCallback((): boolean => {
    // Usa o snapshot capturado no momento da detecção, não re-lê do storage.
    // Motivo: se o auto-save tivesse rodado entre detecção e clique do usuário
    // (cenário possível antes da pausa por `hasDraft`), a versão em storage
    // poderia já estar corrompida por defaults aplicados via `reset`.
    // Fallback para o storage caso o snapshot tenha sido invalidado.
    const env = draft ?? readDraft<T>(key);
    if (!env) {
      setHasDraft(false);
      setDraft(null);
      return false;
    }
    reset(env.values as Parameters<UseFormReset<T>>[0]);
    setHasDraft(false); // usuário decidiu — banner some e auto-save reativa
    return true;
  }, [draft, key, reset]);

  const discard = useCallback(() => {
    deleteDraft(key);
    setDraft(null);
    setHasDraft(false);
    setSavedAt(null);
  }, [key]);

  return {
    hasDraft,
    savedAt,
    draft,
    restore,
    discard,
    clear: discard,
  };
}
