/**
 * useComposition Hook
 *
 * Responsabilidade única: manter o estado do cálculo de composição e
 * disparar recálculos debounced a cada mudança de seleção ou quantidade.
 *
 * Dispara chamada a /simulate-composition e retorna:
 *   - composition: resultado completo (custo, preço sugerido, breakdown)
 *   - loading: flag de carregamento
 *   - error: última mensagem de erro
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { simulateComposition } from '../services/compositionApi';
import type { CompositionResult } from '../types/composition.types';

interface UseCompositionParams {
  productId: string | null;
  selectedOptionIds: string[];
  quantity: number;
  /** Debounce em ms. Padrão: 400ms para UX responsiva sem sobrecarga. */
  debounceMs?: number;
}

interface UseCompositionReturn {
  composition: CompositionResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useComposition({
  productId,
  selectedOptionIds,
  quantity,
  debounceMs = 400
}: UseCompositionParams): UseCompositionReturn {
  const [composition, setComposition] = useState<CompositionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref para cancelar requisições obsoletas (evitar race conditions)
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch = useCallback(() => {
    if (!productId) return;

    // Cancelar timer anterior
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      // Cancelar request anterior se ainda estiver em voo
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const result = await simulateComposition({
          productId,
          selectedOptionIds,
          quantity: Math.max(1, quantity)
        });
        setComposition(result);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError(err.message || 'Erro ao calcular composição');
        }
      } finally {
        setLoading(false);
      }
    }, debounceMs);
  }, [productId, selectedOptionIds.join(','), quantity, debounceMs]);

  useEffect(() => {
    fetch();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetch]);

  return { composition, loading, error, refetch: fetch };
}
