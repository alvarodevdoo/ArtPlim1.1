/**
 * draftStorage
 * ------------
 * Camada utilitária para rascunhos de formulários persistidos no localStorage.
 *
 * Convenções:
 *  - Toda chave de rascunho começa com o prefixo `draft:` (ex: `draft:material:new`).
 *  - O TTL padrão é de 2 horas. Rascunhos expirados são descartados na leitura
 *    (cleanup preguiçoso — sem necessidade de job em background).
 *  - O valor armazenado segue o formato { version, savedAt, label, values }.
 *  - `version` permite invalidar drafts antigos caso o schema do form mude.
 *
 * Esta camada é "burra" de propósito: ela não conhece react-hook-form.
 * Quem orquestra (hook ou componente) decide quando ler, escrever e descartar.
 */

export const DRAFT_PREFIX = 'draft:';
export const DEFAULT_DRAFT_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas
export const DRAFT_EXPIRATION_ALERT_MS = 15 * 60 * 1000; // 15 minutos
export const DRAFT_SCHEMA_VERSION = 1;

export interface DraftEnvelope<T = unknown> {
  /** Versão do schema do envelope; permite migração/invalidação futura. */
  version: number;
  /** Timestamp (ms epoch) do último salvamento. */
  savedAt: number;
  /** TTL aplicado a este rascunho (ms). Persistido para suportar extensões. */
  ttlMs: number;
  /** Rótulo amigável exibido ao usuário (ex: "Novo Insumo"). */
  label: string;
  /** Conteúdo serializável do formulário. */
  values: T;
}

export interface DraftSummary {
  key: string;
  label: string;
  savedAt: number;
  ttlMs: number;
  expiresAt: number;
  msUntilExpiration: number;
}

/**
 * Normaliza a chave garantindo o prefixo `draft:` exatamente uma vez.
 * Permite que callers passem `material:new` ou `draft:material:new`.
 */
export function buildDraftKey(key: string): string {
  if (!key) throw new Error('draftStorage: key vazia');
  return key.startsWith(DRAFT_PREFIX) ? key : `${DRAFT_PREFIX}${key}`;
}

/** Storage seguro: retorna null em SSR ou se localStorage estiver indisponível. */
function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Lê um rascunho. Retorna `null` se ausente, corrompido ou expirado.
 * Quando expirado, remove a entrada (cleanup preguiçoso).
 */
export function readDraft<T = unknown>(key: string): DraftEnvelope<T> | null {
  const storage = safeStorage();
  if (!storage) return null;
  const fullKey = buildDraftKey(key);
  const raw = storage.getItem(fullKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.savedAt !== 'number' ||
      typeof parsed.ttlMs !== 'number'
    ) {
      storage.removeItem(fullKey);
      return null;
    }
    if (parsed.version !== DRAFT_SCHEMA_VERSION) {
      // Schema novo invalida drafts antigos para evitar dados quebrados.
      storage.removeItem(fullKey);
      return null;
    }
    const expiresAt = parsed.savedAt + parsed.ttlMs;
    if (Date.now() > expiresAt) {
      storage.removeItem(fullKey);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(fullKey);
    return null;
  }
}

/** Grava (ou sobrescreve) um rascunho. Falha silenciosa se storage indisponível. */
export function writeDraft<T>(
  key: string,
  values: T,
  options: { label: string; ttlMs?: number } = { label: '' }
): DraftEnvelope<T> | null {
  const storage = safeStorage();
  if (!storage) return null;

  const envelope: DraftEnvelope<T> = {
    version: DRAFT_SCHEMA_VERSION,
    savedAt: Date.now(),
    ttlMs: options.ttlMs ?? DEFAULT_DRAFT_TTL_MS,
    label: options.label || key,
    values,
  };

  try {
    storage.setItem(buildDraftKey(key), JSON.stringify(envelope));
    notifyChange();
    return envelope;
  } catch {
    // Quota excedida ou modo privado: ignora silenciosamente.
    return null;
  }
}

/** Remove explicitamente um rascunho (uso: cancelar/descartar/submit ok). */
export function deleteDraft(key: string): void {
  const storage = safeStorage();
  if (!storage) return;
  storage.removeItem(buildDraftKey(key));
  notifyChange();
}

/**
 * Estende a vida útil de um rascunho redefinindo `savedAt` para agora,
 * mantendo o conteúdo. Usado pelo botão "Manter mais 2h" do sino.
 */
export function extendDraft(key: string, ttlMs: number = DEFAULT_DRAFT_TTL_MS): DraftEnvelope | null {
  const current = readDraft(key);
  if (!current) return null;
  return writeDraft(key, current.values, { label: current.label, ttlMs });
}

/** Lista todos os rascunhos ainda válidos (limpa expirados como efeito colateral). */
export function listDrafts(): DraftSummary[] {
  const storage = safeStorage();
  if (!storage) return [];
  const summaries: DraftSummary[] = [];
  // Snapshot das chaves para não iterar enquanto mutamos.
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(DRAFT_PREFIX)) keys.push(k);
  }
  for (const fullKey of keys) {
    const env = readDraft(fullKey);
    if (!env) continue; // expirado ou corrompido — readDraft já limpou
    const expiresAt = env.savedAt + env.ttlMs;
    summaries.push({
      key: fullKey,
      label: env.label,
      savedAt: env.savedAt,
      ttlMs: env.ttlMs,
      expiresAt,
      msUntilExpiration: expiresAt - Date.now(),
    });
  }
  // Mais próximo de expirar primeiro.
  summaries.sort((a, b) => a.msUntilExpiration - b.msUntilExpiration);
  return summaries;
}

/**
 * Filtra apenas rascunhos perto de expirar (≤ `thresholdMs`, default 15min).
 */
export function listExpiringDrafts(thresholdMs: number = DRAFT_EXPIRATION_ALERT_MS): DraftSummary[] {
  return listDrafts().filter(d => d.msUntilExpiration <= thresholdMs);
}

// ---------------------------------------------------------------------------
// Canal de notificação de mudanças
// ---------------------------------------------------------------------------
// localStorage emite o evento `storage` apenas entre abas diferentes; mudanças
// na mesma aba não disparam nada. Mantemos um pub/sub interno para o sino
// reagir imediatamente a writes/deletes na mesma aba.

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyChange() {
  for (const l of listeners) {
    try { l(); } catch { /* ignora listeners quebrados */ }
  }
}

/** Registra um listener para qualquer mutação de rascunho. Retorna unsubscribe. */
export function subscribeDraftChanges(listener: Listener): () => void {
  listeners.add(listener);
  // Também escuta mudanças vindas de outras abas.
  const storageHandler = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(DRAFT_PREFIX)) listener();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', storageHandler);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
  };
}

/**
 * Heurística simples: considera "vazio" um objeto cujos valores são todos
 * falsy/primitivos default. Usado pelo hook para não persistir form intocado.
 */
export function isLikelyEmpty(values: unknown): boolean {
  if (values == null) return true;
  if (typeof values !== 'object') return !values;
  const entries = Object.entries(values as Record<string, unknown>);
  return entries.every(([, v]) => {
    if (v == null) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (typeof v === 'number') return v === 0;
    if (typeof v === 'boolean') return true; // booleans default não indicam intenção
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v as object).length === 0;
    return false;
  });
}
