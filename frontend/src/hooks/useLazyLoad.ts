import { useState, useEffect, useRef, useCallback } from 'react';

// Hook para lazy loading de componentes baseado em intersection observer
export const useLazyLoad = (options: IntersectionObserverInit = {}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true);
          setHasLoaded(true);
          observer.unobserve(element);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [hasLoaded, options]);

  return { elementRef, isVisible, hasLoaded };
};

// Hook para lazy loading de listas com paginação infinita
export const useInfiniteScroll = <T>(
  fetchMore: () => Promise<T[]>,
  hasMore: boolean = true,
  threshold: number = 0.8
) => {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const newItems = await fetchMore();
      setItems(prev => [...prev, ...newItems]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar mais itens');
    } finally {
      setLoading(false);
    }
  }, [fetchMore, hasMore, loading]);

  useEffect(() => {
    const observer = observerRef.current;
    if (!observer) return;

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold }
    );

    intersectionObserver.observe(observer);

    return () => {
      intersectionObserver.unobserve(observer);
    };
  }, [loadMore, hasMore, loading, threshold]);

  const reset = useCallback(() => {
    setItems([]);
    setError(null);
  }, []);

  return {
    items,
    loading,
    error,
    observerRef,
    loadMore,
    reset,
    setItems
  };
};

// Hook para lazy loading de imagens
export const useLazyImage = (src: string, placeholder?: string) => {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const image = new Image();
          
          image.onload = () => {
            setImageSrc(src);
            setIsLoaded(true);
            setIsError(false);
          };
          
          image.onerror = () => {
            setIsError(true);
            setIsLoaded(false);
          };
          
          image.src = src;
          observer.unobserve(img);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(img);

    return () => {
      observer.unobserve(img);
    };
  }, [src]);

  return { imgRef, imageSrc, isLoaded, isError };
};

// Hook para lazy loading de dados com cache
export const useLazyData = <T>(
  key: string,
  fetcher: () => Promise<T>,
  dependencies: any[] = []
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  const loadData = useCallback(async (force: boolean = false) => {
    // Verificar cache primeiro
    const cached = cacheRef.current.get(key);
    const now = Date.now();
    
    if (!force && cached && (now - cached.timestamp) < CACHE_DURATION) {
      setData(cached.data);
      setHasLoaded(true);
      return cached.data;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setData(result);
      setHasLoaded(true);
      
      // Atualizar cache
      cacheRef.current.set(key, { data: result, timestamp: now });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [key, fetcher]);

  // Carregar dados quando as dependências mudarem
  useEffect(() => {
    if (!hasLoaded) {
      loadData();
    }
  }, [loadData, hasLoaded, ...dependencies]);

  const refresh = useCallback(() => {
    return loadData(true);
  }, [loadData]);

  const clearCache = useCallback(() => {
    cacheRef.current.delete(key);
  }, [key]);

  return {
    data,
    loading,
    error,
    hasLoaded,
    refresh,
    clearCache
  };
};

// Hook para debounce de pesquisas
export const useDebouncedSearch = <T>(
  searchFn: (query: string) => Promise<T[]>,
  delay: number = 300
) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchResults = await searchFn(searchQuery);
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na pesquisa');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchFn]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      search(query);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, search, delay]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    clearSearch
  };
};

// Hook para lazy loading de módulos/componentes
export const useLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) => {
  const [Component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComponent = useCallback(async () => {
    if (Component) return Component;

    setLoading(true);
    setError(null);

    try {
      const module = await importFn();
      setComponent(() => module.default);
      return module.default;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar componente');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [importFn, Component]);

  return {
    Component: Component || fallback,
    loading,
    error,
    loadComponent
  };
};