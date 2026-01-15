import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  key: string;
}

interface CacheOptions {
  ttl?: number; // Time to live em milissegundos
  maxSize?: number; // Máximo de entradas no cache
  staleWhileRevalidate?: boolean; // Retorna dados stale enquanto revalida
  onError?: (error: Error) => void;
  onSuccess?: (data: any) => void;
}

class SmartCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 100, defaultTTL = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    // Remove entrada mais antiga se exceder o tamanho máximo
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
      key
    });
  }

  get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const isExpired = now > entry.expiresAt;
    const isStale = now > (entry.timestamp + (this.defaultTTL * 0.8)); // 80% do TTL

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return {
      data: entry.data as T,
      isStale
    };
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Instância global do cache
const globalCache = new SmartCache();

// Hook principal para cache inteligente
export const useSmartCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
) => {
  const {
    ttl = 5 * 60 * 1000, // 5 minutos
    staleWhileRevalidate = true,
    onError,
    onSuccess
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const fetcherRef = useRef(fetcher);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Atualizar referência do fetcher
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Verificar cache primeiro
    if (!forceRefresh) {
      const cached = globalCache.get<T>(key);
      if (cached) {
        setData(cached.data);
        setIsStale(cached.isStale);
        setError(null);

        // Se não está stale, não precisa revalidar
        if (!cached.isStale || !staleWhileRevalidate) {
          return cached.data;
        }
      }
    }

    setLoading(true);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await fetcherRef.current();
      
      // Verificar se a requisição foi cancelada
      if (abortController.signal.aborted) {
        return;
      }

      setData(result);
      setIsStale(false);
      globalCache.set(key, result, ttl);
      
      onSuccess?.(result);
      return result;
    } catch (err) {
      if (abortController.signal.aborted) {
        return;
      }

      const error = err instanceof Error ? err : new Error('Erro desconhecido');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
      abortControllerRef.current = null;
    }
  }, [key, ttl, staleWhileRevalidate, onError, onSuccess]);

  // Carregar dados na inicialização
  useEffect(() => {
    fetchData();

    // Cleanup na desmontagem
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  const invalidate = useCallback(() => {
    globalCache.invalidate(key);
    setData(null);
    setIsStale(false);
  }, [key]);

  return {
    data,
    loading,
    error,
    isStale,
    refresh,
    invalidate,
    fetchData
  };
};

// Hook para cache de lista com paginação
export const useSmartListCache = <T>(
  baseKey: string,
  fetcher: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
  options: CacheOptions & { pageSize?: number } = {}
) => {
  const { pageSize = 20, ...cacheOptions } = options;
  const [currentPage, setCurrentPage] = useState(1);
  const [allData, setAllData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);

  const pageKey = `${baseKey}:page:${currentPage}:${pageSize}`;

  const { data: pageData, loading, error, refresh } = useSmartCache(
    pageKey,
    () => fetcher(currentPage, pageSize),
    cacheOptions
  );

  useEffect(() => {
    if (pageData) {
      setAllData(prev => {
        const newData = [...prev];
        const startIndex = (currentPage - 1) * pageSize;
        
        // Substituir dados da página atual
        for (let i = 0; i < pageData.data.length; i++) {
          newData[startIndex + i] = pageData.data[i];
        }
        
        return newData;
      });
      setTotal(pageData.total);
    }
  }, [pageData, currentPage, pageSize]);

  const loadMore = useCallback(() => {
    if (currentPage * pageSize < total) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, pageSize, total]);

  const reset = useCallback(() => {
    setCurrentPage(1);
    setAllData([]);
    setTotal(0);
    globalCache.invalidatePattern(`${baseKey}:page:*`);
  }, [baseKey]);

  return {
    data: allData,
    currentPage,
    total,
    loading,
    error,
    hasMore: currentPage * pageSize < total,
    loadMore,
    reset,
    refresh
  };
};

// Hook para cache de busca com debounce
export const useSmartSearchCache = <T>(
  baseKey: string,
  searchFn: (query: string) => Promise<T[]>,
  debounceMs = 300,
  options: CacheOptions = {}
) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Debounce da query
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, debounceMs]);

  const searchKey = `${baseKey}:search:${debouncedQuery}`;

  const { data, loading, error, refresh } = useSmartCache(
    searchKey,
    () => debouncedQuery ? searchFn(debouncedQuery) : Promise.resolve([]),
    {
      ...options,
      ttl: options.ttl || 2 * 60 * 1000 // 2 minutos para buscas
    }
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    query,
    setQuery,
    results: data || [],
    loading: loading && debouncedQuery.length > 0,
    error,
    refresh,
    clearSearch
  };
};

// Hook para invalidação automática baseada em eventos
export const useCacheInvalidation = (patterns: string[]) => {
  const invalidatePatterns = useCallback(() => {
    patterns.forEach(pattern => {
      globalCache.invalidatePattern(pattern);
    });
  }, [patterns]);

  useEffect(() => {
    // Escutar eventos customizados para invalidação
    const handleInvalidation = (event: CustomEvent) => {
      const { pattern } = event.detail;
      if (patterns.some(p => p === pattern || pattern.includes(p))) {
        invalidatePatterns();
      }
    };

    window.addEventListener('cache:invalidate', handleInvalidation as EventListener);

    return () => {
      window.removeEventListener('cache:invalidate', handleInvalidation as EventListener);
    };
  }, [patterns, invalidatePatterns]);

  return { invalidatePatterns };
};

// Função utilitária para disparar invalidação de cache
export const invalidateCache = (pattern: string) => {
  globalCache.invalidatePattern(pattern);
  
  // Disparar evento para outros componentes
  window.dispatchEvent(new CustomEvent('cache:invalidate', {
    detail: { pattern }
  }));
};

// Hook para estatísticas do cache
export const useCacheStats = () => {
  const [stats, setStats] = useState(globalCache.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(globalCache.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return stats;
};

export { globalCache };