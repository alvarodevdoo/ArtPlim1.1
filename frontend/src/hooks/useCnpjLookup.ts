import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  lookupCnpj,
  CnpjInvalidError,
  CnpjLookupResult,
  isValidCnpjLength,
  onlyDigits,
} from '@/services/lookup';

interface UseCnpjLookupOptions {
  onSuccess?: (result: CnpjLookupResult) => void;
  onError?: (error: Error) => void;
  /** Exibe toasts padronizados (default: true). */
  showToasts?: boolean;
  /** Debounce em ms para a versão auto (default: 300). */
  debounceMs?: number;
}

interface UseCnpjLookupReturn {
  loading: boolean;
  /** Dispara o lookup imediatamente (uso em botão "Buscar"). */
  fetch: (cnpj: string) => Promise<CnpjLookupResult | null>;
  /** Agenda o lookup com debounce (uso em auto-busca no onChange). */
  fetchDebounced: (cnpj: string) => void;
  /** Cancela um debounce pendente (ex: no cleanup do componente). */
  cancel: () => void;
}

/**
 * Hook centralizado de consulta de CNPJ.
 * Usa a cadeia cnpj.ws → BrasilAPI definida em services/lookup/cnpjService.
 */
export function useCnpjLookup(options: UseCnpjLookupOptions = {}): UseCnpjLookupReturn {
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
    async (cnpj: string): Promise<CnpjLookupResult | null> => {
      const digits = onlyDigits(cnpj);
      if (!isValidCnpjLength(digits)) {
        if (showToasts) toast.error('CNPJ inválido (precisa de 14 dígitos)');
        return null;
      }

      setLoading(true);
      try {
        const result = await lookupCnpj(digits);
        if (showToasts) {
          const empresa = result.razaoSocial || result.nomeFantasia || 'Empresa';
          toast.success(`Dados recuperados: ${empresa}`);
          if (result.situacao && !/ativa/i.test(result.situacao)) {
            toast.warning(`Situação cadastral: ${result.situacao}`);
          }
        }
        onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Falha ao consultar CNPJ');
        if (showToasts) {
          if (error instanceof CnpjInvalidError) {
            toast.error(error.message || 'CNPJ inválido');
          } else {
            toast.error('Não foi possível recuperar dados deste CNPJ');
          }
        }
        onError?.(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onError, onSuccess, showToasts]
  );

  const fetchDebounced = useCallback(
    (cnpj: string) => {
      cancel();
      const digits = onlyDigits(cnpj);
      if (!isValidCnpjLength(digits)) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runFetch(digits);
      }, debounceMs);
    },
    [cancel, debounceMs, runFetch]
  );

  return { loading, fetch: runFetch, fetchDebounced, cancel };
}
