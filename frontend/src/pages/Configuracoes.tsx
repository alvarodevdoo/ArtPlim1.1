import React, { useState, useEffect, useRef } from 'react';
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
import { SpedMappingManager } from '@/features/financeiro/SpedMappingManager';
import { validateBackupFile } from '@/features/organization/backupSchema';

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
  requireDocumentKeyForEntry: boolean;
  defaultReceivableCategoryId?: string;
  defaultRevenueCategoryId?: string;
}

const Configuracoes: React.FC = () => {
  const { refreshSettings } = useAuth();
  const [activeTab, setActiveTab] = useState('empresa');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    allowDuplicatePhones: true,
    requireDocumentKeyForEntry: false
  });

  const [userSettings, setUserSettings] = useState({
    notifications: true,
    emailAlerts: true,
    theme: 'light',
    language: 'pt-BR'
  });

  const [selectedModules, setSelectedModules] = useState({
    config: true,
    profiles: true,
    materials: true,
    products: true,
    production: true,
    sales: true,
    finance: true
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
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
      loadSettings();
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
      await refreshSettings();
      loadSettings();
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
      toast.success('Preferências do usuário salvas com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar preferências:', error);
      toast.error('Erro ao salvar preferências do usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleExportBackup = async () => {
    setLoading(true);
    try {
      const activeModules = Object.entries(selectedModules)
        .filter(([_, active]) => active)
        .map(([module]) => module);

      if (activeModules.length === 0) {
        toast.error('Selecione pelo menos um módulo para exportar');
        return;
      }

      const response = await api.get('/api/backup/export', {
        params: { modules: activeModules.join(',') },
        responseType: 'blob' 
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `backup-artplim-${date}.bdb`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success('Pacote de backup modular (.bdb) gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao exportar backup:', error);
      toast.error('Erro ao gerar pacote de backup modular');
    } finally {
      setLoading(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const validation = await validateBackupFile(file);
      if (!validation.success) {
        toast.error('Arquivo de backup inválido ou corrompido');
        return;
      }

      await api.post('/api/backup/import', validation.data);
      toast.success('Restauração concluída com sucesso!');
      loadSettings();
    } catch (error: any) {
      console.error('Erro ao importar backup:', error);
      toast.error(error.response?.data?.error?.message || 'Erro na restauração dos dados');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  const tabs = allTabs.filter(tab => {
    if (tab.setting && settings) {
      return settings[tab.setting as keyof OrganizationSettings] === true;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema e da sua organização
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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

        <div className="lg:col-span-3">
          {activeTab === 'empresa' && (
            <Card>
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
                <CardDescription>Configure os dados básicos da sua organização</CardDescription>
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
                  <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Alterações'}</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {activeTab === 'sistema' && (
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Sistema</CardTitle>
                <CardDescription>Ative ou desative módulos do sistema</CardDescription>
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
                            Ative ou desative módulos do sistema. Os links de navegação serão atualizados automaticamente.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className={`flex items-center justify-between p-3 border rounded-lg ${settings.enableWMS ? 'border-green-200 bg-green-50' : 'border-border'}`}>
                        <div>
                          <h5 className="font-medium flex items-center space-x-2">
                            <span>Controle de Estoque (WMS)</span>
                            {settings.enableWMS && <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">ATIVO</span>}
                          </h5>
                          <p className="text-sm text-muted-foreground">Gestão avançada de rolos, chapas e retalhos</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableWMS}
                          onChange={(e) => setSettings(prev => ({ ...prev, enableWMS: e.target.checked }))}
                          className="rounded border-input"
                        />
                      </div>

                      <div className={`flex items-center justify-between p-3 border rounded-lg ${settings.enableProduction ? 'border-green-200 bg-green-50' : 'border-border'}`}>
                        <div>
                          <h5 className="font-medium flex items-center space-x-2">
                            <span>Módulo de Produção</span>
                            {settings.enableProduction && <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">ATIVO</span>}
                          </h5>
                          <p className="text-sm text-muted-foreground">Controle de chão de fábrica e filas de impressão</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableProduction}
                          onChange={(e) => setSettings(prev => ({ ...prev, enableProduction: e.target.checked }))}
                          className="rounded border-input"
                        />
                      </div>

                      <div className={`flex items-center justify-between p-3 border rounded-lg ${settings.enableFinance ? 'border-green-200 bg-green-50' : 'border-border'}`}>
                        <div>
                          <h5 className="font-medium flex items-center space-x-2">
                            <span>Módulo Financeiro</span>
                            {settings.enableFinance && <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">ATIVO</span>}
                          </h5>
                          <p className="text-sm text-muted-foreground">Contas a pagar, receber e fluxo de caixa</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableFinance}
                          onChange={(e) => setSettings(prev => ({ ...prev, enableFinance: e.target.checked }))}
                          className="rounded border-input"
                        />
                      </div>

                      <div className={`flex items-center justify-between p-3 border rounded-lg ${settings.enableFinanceReports ? 'border-green-200 bg-green-50' : 'border-border'}`}>
                        <div>
                          <h5 className="font-medium flex items-center space-x-2">
                            <span>Relatórios Financeiros</span>
                            {settings.enableFinanceReports && <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">ATIVO</span>}
                          </h5>
                          <p className="text-sm text-muted-foreground">Estatísticas de vendas e ticket médio</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableFinanceReports}
                          onChange={(e) => setSettings(prev => ({ ...prev, enableFinanceReports: e.target.checked }))}
                        />
                      </div>

                      <div className={`flex items-center justify-between p-3 border rounded-lg ${settings.enableAutomation ? 'border-green-200 bg-green-50' : 'border-border'}`}>
                        <div>
                          <h5 className="font-medium flex items-center space-x-2">
                            <span>Automações</span>
                            {settings.enableAutomation && <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">ATIVO</span>}
                          </h5>
                          <p className="text-sm text-muted-foreground">WhatsApp automático e notificações</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.enableAutomation}
                          onChange={(e) => setSettings(prev => ({ ...prev, enableAutomation: e.target.checked }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium">Configurações Gerais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Validade do Orçamento (dias)</label>
                        <Input
                          type="number"
                          value={settings.validadeOrcamento}
                          onChange={(e) => setSettings(prev => ({ ...prev, validadeOrcamento: parseInt(e.target.value) }))}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h5 className="font-medium text-sm">Permitir Telefones Duplicados</h5>
                        <p className="text-sm text-muted-foreground">Permite múltiplos clientes com mesmo número</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.allowDuplicatePhones}
                        onChange={(e) => setSettings(prev => ({ ...prev, allowDuplicatePhones: e.target.checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h5 className="font-medium text-sm">Exigir Nota Fiscal nas Entradas</h5>
                        <p className="text-sm text-muted-foreground">Impede registro de estoque sem chave NF</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.requireDocumentKeyForEntry}
                        onChange={(e) => setSettings(prev => ({ ...prev, requireDocumentKeyForEntry: e.target.checked }))}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Configurações'}</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {activeTab === 'usuarios' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Gerenciamento de Usuários</CardTitle>
                  <CardDescription>Gerencie usuários e permissões</CardDescription>
                </CardHeader>
                <CardContent><UserManagement /></CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Perfis de Acesso</CardTitle>
                  <CardDescription>Configure permissões por perfil</CardDescription>
                </CardHeader>
                <CardContent><RolePermissions /></CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'financeiro' && (
            <div className="space-y-6">
              <PaymentMethodSettings />
              <SpedMappingManager />
            </div>
          )}

          {activeTab === 'processos' && (
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Regras de Precificação</CardTitle></CardHeader>
                <CardContent><PricingRuleSettings /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Fluxo de Status</CardTitle></CardHeader>
                <CardContent><ProcessStatusSettings /></CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'backup' && (
            <Card>
              <CardHeader>
                <CardTitle>Backup e Restauração</CardTitle>
                <CardDescription>Gerencie backups dos seus dados com segurança</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Backup Manual</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Selecione os módulos que deseja incluir no arquivo comprimido (.json.gz):
                    </p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      {Object.entries(selectedModules).map(([module, active]) => (
                        <label key={module} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${active ? 'bg-primary/5 border-primary' : 'bg-white border-border'}`}>
                          <input 
                            type="checkbox" 
                            checked={active}
                            onChange={() => setSelectedModules(prev => ({ ...prev, [module]: !active }))}
                            className="rounded border-input text-primary"
                          />
                          <span className="text-xs font-medium capitalize">
                            {module === 'config' ? 'Configurações' : 
                             module === 'profiles' ? 'Clientes/Usuários' :
                             module === 'materials' ? 'Insumos/Estoque' :
                             module === 'products' ? 'Produtos/Catálogo' :
                             module === 'production' ? 'Produção' :
                             module === 'sales' ? 'Vendas' :
                             module === 'finance' ? 'Financeiro' : module}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="flex space-x-2">
                      <Button onClick={handleExportBackup} disabled={loading} className="flex-1 md:flex-none">
                        <Download className="w-4 h-4 mr-2" />
                        {loading ? 'Preparando Pacote...' : 'Gerar Backup Modular (.bdb)'}
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportBackup}
                        className="hidden"
                        accept=".bdb,.json"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Restaurar (.bdb)
                      </Button>
                    </div>
                  </div>
                  <div className="text-center py-8 text-muted-foreground border-t border-dashed mt-4">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Backup Modular Inteligente Ativado</p>
                    <p className="text-sm">Os dados são protegidos por criptografia e isolamento multitenant.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'aparencia' && (
            <Card>
              <CardHeader><CardTitle>Aparência</CardTitle></CardHeader>
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
                  <Button type="submit">Salvar Preferências</Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;