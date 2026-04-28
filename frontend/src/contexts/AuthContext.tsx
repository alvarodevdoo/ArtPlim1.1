import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';
import { PermissionType, MODULE_SETTINGS_MAP } from '@/lib/permissions';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
  permissions: string[];
}

interface OrganizationSettings {
  id: string;
  enableWMS: boolean;
  enableProduction: boolean;
  enableFinance: boolean;
  enableFinanceReports: boolean;
  enableAutomation: boolean;
  enableCategoryAppropriation: boolean;
  defaultMarkup: number;
  taxRate: number;
  validadeOrcamento: number;
  requireOrderDeposit: boolean;
  minDepositPercent: number;
}

interface AuthContextType {
  user: User | null;
  settings: OrganizationSettings | null;
  login: (email: string, password: string, organizationSlug: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  hasPermission: (permission: PermissionType) => boolean;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  organizationSlug: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Função para carregar configurações da organização
  const loadOrganizationSettings = async () => {
    try {
      const response = await api.get('/api/organization/settings');
      setSettings(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar configurações da organização:', error);
      // Se falhar, usar configurações padrão
      setSettings({
        id: '',
        enableWMS: false,
        enableProduction: false,
        enableFinance: true,
        enableFinanceReports: true,
        enableAutomation: true,
        enableCategoryAppropriation: true,
        defaultMarkup: 2.0,
        taxRate: 0.0,
        validadeOrcamento: 7,
        requireOrderDeposit: false,
        minDepositPercent: 0
      });
    }
  };

  // Função pública para recarregar configurações
  const refreshSettings = async () => {
    if (user) {
      await loadOrganizationSettings();
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');

      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);

          // Tentar carregar configurações da organização após definir o usuário
          try {
            await loadOrganizationSettings();
          } catch (settingsError) {
            console.warn('Erro ao carregar configurações na inicialização, usando padrões:', settingsError);
            // Usar configurações padrão se falhar
          setSettings({
            id: '',
            enableWMS: false,
            enableProduction: false,
            enableFinance: true,
            enableFinanceReports: true,
            enableAutomation: true,
            enableCategoryAppropriation: true,
            defaultMarkup: 2.0,
            taxRate: 0.0,
            validadeOrcamento: 7,
            requireOrderDeposit: false,
            minDepositPercent: 0
          });
          }
        } catch (error) {
          console.error('Erro ao inicializar autenticação:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }

      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string, organizationSlug: string) => {
    try {
      const response = await api.post('/api/auth/login', {
        email,
        password,
        organizationSlug
      });

      const { token, user: userData } = response.data.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      // Carregar configurações da organização após login bem-sucedido
      try {
        await loadOrganizationSettings();
      } catch (settingsError) {
        console.warn('Erro ao carregar configurações, usando padrões:', settingsError);
        // Usar configurações padrão se falhar
        setSettings({
          id: '',
          enableWMS: false,
          enableProduction: false,
          enableFinance: true,
          enableFinanceReports: true,
          enableAutomation: true,
          enableCategoryAppropriation: true,
          defaultMarkup: 2.0,
          taxRate: 0.0,
          validadeOrcamento: 7,
          requireOrderDeposit: false,
          minDepositPercent: 0
        });
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Erro ao fazer login');
    }
  };

  const register = async (data: RegisterData) => {
    try {
      await api.post('/api/auth/register', data);
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Erro ao registrar');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setSettings(null);
  };

  const hasPermission = (permission: PermissionType): boolean => {
    if (!user) return false;

    // 1. O Proprietário (OWNER) sempre tem permissão total por padrão no RBAC
    if (user.role !== 'OWNER') {
      // Verificar se o usuário possui a permissão no RBAC dinâmico
      const hasRolePermission = user.permissions.includes(permission);
      if (!hasRolePermission) return false;
    }

    // 2. Verificar se o módulo está habilitado nas configurações globais da organização
    const requiredSetting = MODULE_SETTINGS_MAP[permission];
    if (requiredSetting && settings) {
      return settings[requiredSetting as keyof typeof settings] === true;
    }

    return true;
  };

  return (
    <AuthContext.Provider value={{ user, settings, login, register, logout, loading, refreshSettings, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}