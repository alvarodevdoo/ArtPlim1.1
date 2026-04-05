/**
 * Hook: useInsumos
 *
 * Gerencia o estado global de insumos no contexto de uma sessão.
 * Faz o fetch da API, expõe estado de loading/erro e funções CRUD.
 *
 * Uso:
 *   const { insumos, loading, criar, atualizar, toggleStatus } = useInsumos();
 */

import { useState, useEffect, useCallback } from 'react';
import { Insumo, InsumoFormData } from './types';

// ─── Configuração da API ──────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/** Recupera o token JWT do localStorage (mesmo padrão usado no restante do app) */
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options?.headers || {}) },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || json.error?.message || 'Erro na requisição');
  }
  return (json.data ?? json) as T;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInsumos() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Buscar lista ────────────────────────────────────────────────────────────
  const fetchInsumos = useCallback(async (filtros?: { categoria?: string; ativo?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtros?.ativo !== undefined) params.set('active', String(filtros.ativo));
      const queryStr = params.toString();
      const data = await apiFetch<any[]>(`/api/catalog/materials${queryStr ? `?${queryStr}` : ''}`);
      const mappedInsumos: Insumo[] = (Array.isArray(data) ? data : []).map(mat => ({
        id: mat.id,
        organizationId: mat.organizationId,
        nome: mat.name || mat.nome,
        categoria: mat.category?.name || mat.categoria || 'Geral',
        unidadeBase: mat.unit || mat.unidadeBase,
        custoUnitario: Number(mat.costPerUnit || mat.custoUnitario || 0),
        ativo: mat.active !== undefined ? mat.active : mat.ativo,
        createdAt: mat.createdAt,
        updatedAt: mat.updatedAt
      }));
      setInsumos(mappedInsumos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar insumos');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Buscar categorias ───────────────────────────────────────────────────────
  const fetchCategorias = useCallback(async () => {
    try {
      const data = await apiFetch<any[]>('/api/finance/categories?type=EXPENSE');
      setCategorias((Array.isArray(data) ? data : []).map((c: any) => c.name || c));
    } catch {
      // Silencia erro—categorias são secundárias
    }
  }, []);

  // Carrega na montagem do componente
  useEffect(() => {
    fetchInsumos();
    fetchCategorias();
  }, [fetchInsumos, fetchCategorias]);

  // ── Criar ────────────────────────────────────────────────────────────────────
  const criar = useCallback(async (data: InsumoFormData): Promise<Insumo> => {
    const novo = await apiFetch<Insumo>('/api/catalog/materials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setInsumos((prev) => [...prev, novo]);
    return novo;
  }, []);

  // ── Atualizar ─────────────────────────────────────────────────────────────
  const atualizar = useCallback(async (id: string, data: Partial<InsumoFormData>): Promise<Insumo> => {
    const atualizado = await apiFetch<Insumo>(`/api/catalog/materials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setInsumos((prev) => prev.map((i) => (i.id === id ? atualizado : i)));
    return atualizado;
  }, []);

  // ── Toggle Status ─────────────────────────────────────────────────────────
  const toggleStatus = useCallback(async (id: string): Promise<Insumo> => {
    const atualizado = await apiFetch<Insumo>(`/api/catalog/materials/${id}/status`, { method: 'PATCH' });
    setInsumos((prev) => prev.map((i) => (i.id === id ? atualizado : i)));
    return atualizado;
  }, []);

  // ── Remover ───────────────────────────────────────────────────────────────
  const remover = useCallback(async (id: string): Promise<void> => {
    await apiFetch<void>(`/api/catalog/materials/${id}`, { method: 'DELETE' });
    setInsumos((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return {
    insumos,
    categorias,
    loading,
    error,
    fetchInsumos,
    fetchCategorias,
    criar,
    atualizar,
    toggleStatus,
    remover,
  };
}
