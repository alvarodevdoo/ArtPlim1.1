import axios from 'axios';

// Debug: verificar se está lendo a variável de ambiente
console.log('🔍 DEBUG API CONFIG:');
console.log('VITE_API_URL:', (import.meta as any).env?.VITE_API_URL);
console.log('import.meta.env:', (import.meta as any).env);
console.log('Fallback seria:', 'http://localhost:3001');

const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001',
  timeout: 10000,
});

console.log('🎯 API baseURL final:', api.defaults.baseURL);

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

export default api;