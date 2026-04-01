// Hook de dados: responsabilidade única de comunicação com a API de Roles
// Princípio SRP: isola chamadas HTTP e estado de carregamento dos componentes visuais

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

export interface RolePermissionData {
  id: string;
  roleId: string;
  permissionKey: string;
}

export interface RoleData {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  active: boolean;
  createdAt: string;
  permissions: RolePermissionData[];
}

export function useRoles() {
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/roles');
      setRoles(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao carregar perfis de acesso.');
    } finally {
      setLoading(false);
    }
  }, []);

  const createRole = useCallback(async (name: string, description?: string) => {
    await api.post('/api/roles', { name, description });
    await fetchRoles();
  }, [fetchRoles]);

  const updatePermissions = useCallback(async (roleId: string, permissions: string[]) => {
    await api.put(`/api/roles/${roleId}/permissions`, { permissions });
    await fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return { roles, loading, error, createRole, updatePermissions, refetch: fetchRoles };
}
