import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// Com proxy do Vite, as chamadas devem ser relativas
const api = axios.create({
  baseURL: '', // Vazio = usa a URL atual (localhost:3000), proxy redireciona
  timeout: 10000,
});

// Interceptor para adicionar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar respostas
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ────────────────────────────────────────────────────────────────────────────
// GET dedup + cache curto
// Componentes diferentes que fazem o mesmo GET ao montar (e StrictMode em dev,
// que dobra cada useEffect) batiam a API várias vezes. Esse wrapper:
//  1) Compartilha a MESMA promise para requests GET idênticos em voo (dedup).
//  2) Cacheia a última resposta por 2s — segundo render do StrictMode reusa.
// O cache é invalidado por qualquer PUT/POST/PATCH/DELETE para a mesma URL base.
// ────────────────────────────────────────────────────────────────────────────
type CacheEntry = { promise: Promise<AxiosResponse<any>>; ts: number };
const inflight = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 2000;

const buildKey = (url: string, config?: AxiosRequestConfig): string => {
  const params = config?.params ? JSON.stringify(config.params) : '';
  return `${url}?${params}`;
};

const invalidate = (url: string) => {
  // Invalida todas as variantes da mesma URL base
  const base = url.split('?')[0];
  for (const key of Array.from(inflight.keys())) {
    if (key.startsWith(base)) inflight.delete(key);
  }
};

const originalGet = api.get.bind(api);
api.get = function <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
  // Se o caller pediu pra bypassar o cache, vai direto
  if ((config as any)?.skipCache) return originalGet<T>(url, config);

  const key = buildKey(url, config);
  const cached = inflight.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.promise as Promise<AxiosResponse<T>>;
  }
  const p = originalGet<T>(url, config).catch((err) => {
    // Em caso de erro, remove o cache imediatamente para a próxima chamada tentar de novo
    inflight.delete(key);
    throw err;
  });
  inflight.set(key, { promise: p as Promise<AxiosResponse<any>>, ts: Date.now() });
  return p;
} as typeof api.get;

// Invalida cache em mutações
const wrapMutation = <M extends 'post' | 'put' | 'patch' | 'delete'>(method: M) => {
  const orig = api[method].bind(api) as any;
  api[method] = function (url: string, ...rest: any[]) {
    invalidate(url);
    return orig(url, ...rest);
  } as any;
};
wrapMutation('post');
wrapMutation('put');
wrapMutation('patch');
wrapMutation('delete');

export default api;
export { api };