import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  lookupCep,
  CepLookupResult,
  isValidCepLength,
  onlyDigits,
} from '@/services/lookup';

interface UseCepLookupOptions {
  onSuccess?: (result: CepLookupResult) => void;
  onError?: (error: Error) => void;
  showToasts?: boolean;
  debounceMs?: number;
}

interface UseCepLookupReturn {
  loading: boolean;
  fetch: (cep: string) => Promise<CepLookupResult | null>;
  fetchDebounced: (cep: string) => void;
  cancel: () => void;
}

/**
 * Hook centralizado de consulta de CEP (ViaCEP).
 */
export function useCepLookup(options: UseCepLookupOptions = {}): UseCepLookupReturn {
  const { onSuccess, onError, showToasts = true, debounceMs = 300 } = options;
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const runFetch = useCallback(
    async (cep: string): Promise<CepLookupResult | null> => {
      const digits = onlyDigits(cep);
      if (!isValidCepLength(digits)) {
        if (showToasts) toast.error('CEP inválido (precisa de 8 dígitos)');
        return null;
      }

      setLoading(true);
      try {
        const result = await lookupCep(digits);
        if (showToasts) {
          const localidade = [result.city, result.state].filter(Boolean).join(' - ');
          toast.success(localidade ? `CEP encontrado: ${localidade}` : 'Endereço localizado!');
        }
        onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Falha ao consultar CEP');
        if (showToasts) toast.error('Não foi possível localizar este CEP');
        onError?.(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onError, onSuccess, showToasts]
  );

  const fetchDebounced = useCallback(
    (cep: string) => {
      cancel();
      const digits = onlyDigits(cep);
      if (!isValidCepLength(digits)) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runFetch(digits);
      }, debounceMs);
    },
    [cancel, debounceMs, runFetch]
  );

  return { loading, fetch: runFetch, fetchDebounced, cancel };
}
