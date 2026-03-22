import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Settings,
  Building,
  Users,
  DollarSign,
  Package,
  Shield,
  Bell,
  Palette,
  Database,
  Download,
  Upload,
  Workflow
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import api from '@/lib/api';
import UserManagement from '@/components/admin/UserManagement';
import RolePermissions from '@/components/admin/RolePermissions';
import PaymentMethodSettings from '@/components/admin/PaymentMethodSettings';
import ProcessStatusSettings from '@/components/admin/ProcessStatusSettings';
import PricingRuleSettings from '@/components/admin/PricingRuleSettings';

interface OrganizationSettings {
  id: string;
  enableWMS: boolean;
  enableProduction: boolean;
  enableFinance: boolean;
  enableFinanceReports: boolean;
  enableAutomation: boolean;
  defaultMarkup: number;
  taxRate: number;
  validadeOrcamento: number;
  allowDuplicatePhones: boolean;
}

const Configuracoes: React.FC = () => {
  const { refreshSettings } = useAuth();
  const [activeTab, setActiveTab] = useState('empresa');
  const [loading, setLoading] = useState(false);

  const [organizationData, setOrganizationData] = useState({
    name: '',
    cnpj: '',
    plan: 'basic'
  });

  const [settings, setSettings] = useState<OrganizationSettings>({
    id: '',
    enableWMS: false,
    enableProduction: false,
    enableFinance: true,
    enableFinanceReports: true,
    enableAutomation: true,
    defaultMarkup: 2.0,
    taxRate: 0.0,
    validadeOrcamento: 7,
    allowDuplicatePhones: true
  });

  const [userSettings, setUserSettings] = useState({
    notifications: true,
    emailAlerts: true,
    theme: 'light',
    language: 'pt-BR'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Carregar configurações da organização
      const [orgResponse, settingsResponse] = await Promise.all([
        api.get('/api/organization'),
        api.get('/api/organization/settings')
      ]);

      setOrganizationData({
        name: orgResponse.data.data.name || '',
        cnpj: orgResponse.data.data.cnpj || '',
        plan: orgResponse.data.data.plan || 'basic'
      });

      setSettings(settingsResponse.data.data);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações');
    }
  };

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.put('/api/organization', organizationData);
      toast.success('Configurações da empresa salvas com sucesso!');
      loadSettings(); // Recarregar dados
    } catch (error: any) {
      console.error('Erro ao salvar organização:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar configurações da empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.put('/api/organization/settings', settings);
      toast.success('Configurações do sistema salvas com sucesso!');

      // Recarregar configurações no contexto para atualizar a navegação
      await refreshSettings();

      loadSettings(); // Recarregar dados locais
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar configurações do sistema');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // await api.put('/api/user/settings', userSettings);
      toast.success('Preferências do usuário salvas com sucesso!');
      // Por enquanto, apenas simular o salvamento das preferências do usuário
    } catch (error: any) {
      console.error('Erro ao salvar preferências:', error);
      toast.error('Erro ao salvar preferências do usuário');
    } finally {
      setLoading(false);
    }
  };

  const allTabs = [
    { id: 'empresa', label: 'Empresa', icon: Building },
    { id: 'sistema', label: 'Sistema', icon: Settings },
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign, setting: 'enableFinance' },
    { id: 'processos', label: 'Processos e Catálogo', icon: Workflow },
    { id: 'producao', label: 'Produção', icon: Package, setting: 'enableProduction' },
    { id: 'seguranca', label: 'Segurança', icon: Shield },
    { id: 'notificacoes', label: 'Notificações', icon: Bell },
    { id: 'aparencia', label: 'Aparência', icon: Palette },
    { id: 'backup', label: 'Backup', icon: Database }
  ];

  // Filtrar abas baseadas nas configurações ativas
  const tabs = allTabs.filter(tab => {
    if (tab.setting && settings) {
      return settings[tab.setting as keyof OrganizationSettings] === true;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema e da sua organização
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {/* Empresa */}
          {activeTab === 'empresa' && (
            <Card>
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
                <CardDescription>
                  Configure os dados básicos da sua organização
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveOrganization} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nome da Empresa</label>
                      <Input
                        value={organizationData.name}
                        onChange={(e) => setOrganizationData(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">CNPJ</label>
                      <Input
                        value={organizationData.cnpj}
                        onChange={(e) => setOrganizationData(prev => ({ ...prev, cnpj: e.target.value }))}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Plano Atual</label>
                      <select
                        value={organizationData.plan}
                        onChange={(e) => setOrganizationData(prev => ({ ...prev, plan: e.target.value }))}
                        className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                      >
                        <option value="basic">Básico</option>
                        <option value="pro">Profissional</option>
                        <option value="enterprise">Enterprise</option>
                        <option value="PREMIUM">Premium</option>
                      </select>
                    </div>
                  </div>

                  <Button type="submit" disabled={loading}>
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Sistema */}
          {activeTab === 'sistema' && (
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Sistema</CardTitle>
                <CardDescription>
                  Ative ou desative módulos do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <Settings className="w-5 h-5 text-blue-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Controle de Módulos</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Ative ou desative módulos do sistema. Os links de navegação serão atualizados automaticamente
                            e usuários não poderão acessar módulos desabilitados.
                          </p>
                        </div>
                      </div>
                    </div>

                    <h4 className="font-medium">Módulos Disponíveis</h4>

                    <div className="space-y-3">

                      <div className={`flex items-center justify-between p-3 border rounded-lg ${settings.enableWMS ? 'border-green-200 bg-green-50' : 'border-border'
                        }`}>
                        <div>
                          <h5 className="font-medium flex items-center space-x-2">
                            <span>Controle de Estoque (WMS)</span>
                            {settings.enableWMS && (
                              <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">
                                ATIVO
                              </span>
                            )}
                          </h5>
                          <p className="text-sm text-muted-foreground">
                            Gestão avançada de rolos, chapas e retalhos
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableWMS}
                          onChange={(e) => setSettings(prev => ({ ...prev, enableWMS: e.target.checked }))}
                          className="rounded border-input"
                        />
                      </div>

                      <div className={`flex items-center justify-between p-3 border rounded-lg ${settings.enableProduction ? 'border-green-200 bg-green-50' : 'border-border'
                        }`}>
                        <div>
                          <h5 className="font-medium flex items-center space-x-2">
                            <span>Módulo de Produção</span>
                            {settings.enableProduction && (
                              <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">
                                ATIVO
                              </span>
                            )}
                          </h5>
                          <p className="text-sm text-muted-foreground">
                            Controle de chão de fábrica e filas de impressão
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableProduction}
                          onChange={(e) => setSettings(prev => ({ ...prev, enableProduction: e.target.checked }))}
                          className="rounded border-input"
                        />
                      </div>

                      <div className={`flex items-center justify-between p-3 border rounded-lg ${settings.enableFinance ? 'border-green-200 bg-green-50' : 'border-border'
                        }`}>
                        <div>
                          <h5 className="font-medium flex items-center space-x-2">
                            <span>Módulo Financeiro</span>
                            {settings.enableFinance && (
                              <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">
                                ATIVO
                              </span>
                            )}
                          </h5>
                          <p className="text-sm text-muted-foreground">
                            Contas a pagar, receber e fluxo de caixa
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableFinance}
                          onChange={(e) => setSettings(prev => ({ ...prev, enableFinance: e.target.checked }))}
                          className="rounded border-input"
                        />
                      </div>

                      <div className={`flex items-center justify-between p-3 border rounded-lg ${settings.enableFinanceReports ? 'border-green-200 bg-green-50' : 'border-border'
                        }`}>
                        <div>
                          <h5 className="font-medium flex items-center space-x-2">
                            <span>Relatórios Financeiros</span>
                            {settings.enableFinanceReports && (
                              <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">
                                ATIVO
                              </span>
                            )}
                          </h5>
                          <p className="text-sm text-muted-foreground">
                            Estatísticas de vendas, ticket médio e fluxo de caixa
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableFinanceReports}
                          onChange={(e) => setSettings(prev => ({ ...prev, enableFinanceReports: e.target.checked }))}
                          className="rounded border-input"
                        />
                      </div>

                      <div className={`flex items-center justify-between p-3 border rounded-lg ${settings.enableAutomation ? 'border-green-200 bg-green-50' : 'border-border'
                        }`}>
                        <div>
                          <h5 className="font-medium flex items-center space-x-2">
                            <span>Automações</span>
                            {settings.enableAutomation && (
                              <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">
                                ATIVO
                              </span>
                            )}
                          </h5>
                          <p className="text-sm text-muted-foreground">
                            WhatsApp automático e notificações de status
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableAutomation}
                          onChange={(e) => setSettings(prev => ({ ...prev, enableAutomation: e.target.checked }))}
                          className="rounded border-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Configurações Padrão</h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Margem Padrão (multiplicador)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={settings.defaultMarkup || 2.0}
                          onChange={(e) => setSettings(prev => ({ ...prev, defaultMarkup: parseFloat(e.target.value) || 2.0 }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Ex: 2.0 = 100% de margem sobre o custo
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Taxa de Imposto (%)</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={settings.taxRate || 0.0}
                          onChange={(e) => setSettings(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0.0 }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Validade do Orçamento (dias)</label>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          value={settings.validadeOrcamento || 7}
                          onChange={(e) => setSettings(prev => ({ ...prev, validadeOrcamento: parseInt(e.target.value) || 7 }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Quantos dias o orçamento permanece válido
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="font-medium text-sm">Cadastro de Clientes</h4>
                      <div className="flex items-center justify-between p-3 border rounded-lg border-border">
                        <div>
                          <h5 className="font-medium text-sm">Permitir Telefones Duplicados</h5>
                          <p className="text-sm text-muted-foreground">
                            Permite cadastrar mais de um cliente com o mesmo número de telefone
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.allowDuplicatePhones}
                          onChange={(e) => setSettings(prev => ({ ...prev, allowDuplicatePhones: e.target.checked }))}
                          className="rounded border-input h-4 w-4"
                        />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={loading}>
                    {loading ? 'Salvando...' : 'Salvar Configurações'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Usuários */}
          {activeTab === 'usuarios' && (
            <div className="space-y-6">
              {/* Gerenciamento de Usuários */}
              <Card>
                <CardHeader>
                  <CardTitle>Gerenciamento de Usuários</CardTitle>
                  <CardDescription>
                    Gerencie usuários e suas permissões no sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UserManagement />
                </CardContent>
              </Card>

              {/* Perfis e Permissões */}
              <Card>
                <CardHeader>
                  <CardTitle>Perfis de Acesso</CardTitle>
                  <CardDescription>
                    Configure os níveis de acesso e permissões por perfil
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RolePermissions />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Aparência */}
          {activeTab === 'aparencia' && (
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Aparência</CardTitle>
                <CardDescription>
                  Personalize a interface do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveUser} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tema</label>
                    <select
                      value={userSettings.theme}
                      onChange={(e) => setUserSettings(prev => ({ ...prev, theme: e.target.value }))}
                      className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    >
                      <option value="light">Claro</option>
                      <option value="dark">Escuro</option>
                      <option value="system">Sistema</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Idioma</label>
                    <select
                      value={userSettings.language}
                      onChange={(e) => setUserSettings(prev => ({ ...prev, language: e.target.value }))}
                      className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en-US">English (US)</option>
                      <option value="es-ES">Español</option>
                    </select>
                  </div>

                  <Button type="submit" disabled={loading}>
                    {loading ? 'Salvando...' : 'Salvar Preferências'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Backup */}
          {activeTab === 'backup' && (
            <Card>
              <CardHeader>
                <CardTitle>Backup e Restauração</CardTitle>
                <CardDescription>
                  Gerencie backups dos seus dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Backup Manual</h4>
                    <div className="flex space-x-2">
                      <Button>
                        <Download className="w-4 h-4 mr-2" />
                        Fazer Backup
                      </Button>
                      <Button variant="outline">
                        <Upload className="w-4 h-4 mr-2" />
                        Restaurar Backup
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Backup Automático</h4>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="autoBackup"
                        className="rounded border-input"
                      />
                      <label htmlFor="autoBackup" className="text-sm">
                        Ativar backup automático diário
                      </label>
                    </div>
                  </div>

                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Funcionalidade em desenvolvimento</p>
                    <p className="text-sm">Sistema de backup automático em breve</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financeiro */}
          {activeTab === 'financeiro' && (
            <div className="space-y-6">
              <PaymentMethodSettings />
            </div>
          )}

          {/* Processos e Catálogo */}
          {activeTab === 'processos' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Regras de Precificação (Motor Dinâmico)</CardTitle>
                  <CardDescription>
                    Configure fórmulas com variáveis dinâmicas de engenharia para produtos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PricingRuleSettings />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Fluxo de Status</CardTitle>
                  <CardDescription>
                    Configure os status do processo de pedidos e produção
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProcessStatusSettings />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Placeholder para outras abas */}
          {!['empresa', 'sistema', 'usuarios', 'aparencia', 'backup', 'financeiro'].includes(activeTab) && (
            <Card>
              <CardHeader>
                <CardTitle>Em Desenvolvimento</CardTitle>
                <CardDescription>
                  Esta funcionalidade está sendo desenvolvida
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Funcionalidade em desenvolvimento</p>
                  <p className="text-sm">Esta seção estará disponível em breve</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;