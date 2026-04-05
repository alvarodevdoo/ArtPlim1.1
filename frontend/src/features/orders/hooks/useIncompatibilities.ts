/**
 * useIncompatibilities Hook
 *
 * Responsabilidade única: manter atualizado em tempo real quais opções
 * estão bloqueadas pela seleção atual do usuário.
 *
 * Consulta /orders/incompatibilities debounced a cada mudança de seleção.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchIncompatibilities } from '../services/compositionApi';

interface UseIncompatibilitiesReturn {
  blockedIds: string[];
  reasons: Record<string, string>;
  isBlocked: (optionId: string) => boolean;
  getBlockReason: (optionId: string) => string | null;
}

export function useIncompatibilities(
  selectedOptionIds: string[],
  debounceMs = 300
): UseIncompatibilitiesReturn {
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const result = await fetchIncompatibilities(selectedOptionIds);
        setBlockedIds(result.blockedIds);
        setReasons(result.reasons);
      } catch {
        // Silencioso: incompatibilidades são complementares, não críticas
      }
    }, debounceMs);
  }, [selectedOptionIds.join(','), debounceMs]);

  useEffect(() => {
    fetch();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [fetch]);

  return {
    blockedIds,
    reasons,
    isBlocked: (id: string) => blockedIds.includes(id),
    getBlockReason: (id: string) => reasons[id] || null
  };
}
