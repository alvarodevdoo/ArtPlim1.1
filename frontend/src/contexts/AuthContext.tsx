import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
}

interface OrganizationSettings {
  id: string;
  enableEngineering: boolean;
  enableWMS: boolean;
  enableProduction: boolean;
  enableFinance: boolean;
  enableAutomation: boolean;
  defaultMarkup: number;
  taxRate: number;
  validadeOrcamento: number;
}

interface AuthContextType {
  user: User | null;
  settings: OrganizationSettings | null;
  login: (email: string, password: string, organizationSlug: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  loading: boolean;
  refreshSettings: () => Promise<void>;
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
        enableEngineering: false,
        enableWMS: false,
        enableProduction: false,
        enableFinance: true,
        enableAutomation: true,
        defaultMarkup: 2.0,
        taxRate: 0.0,
        validadeOrcamento: 7
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
              enableEngineering: false,
              enableWMS: false,
              enableProduction: false,
              enableFinance: true,
              enableAutomation: true,
              defaultMarkup: 2.0,
              taxRate: 0.0,
              validadeOrcamento: 7
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
          enableEngineering: false,
          enableWMS: false,
          enableProduction: false,
          enableFinance: true,
          enableAutomation: true,
          defaultMarkup: 2.0,
          taxRate: 0.0,
          validadeOrcamento: 7
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

  return (
    <AuthContext.Provider value={{ user, settings, login, register, logout, loading, refreshSettings }}>
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