import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings,
  Building,
  Users,
  DollarSign,
  Package,
  Shield,
  Palette,
  Workflow,
  Database,
  UserCheck
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ShoppingCart, GitBranch } from 'lucide-react';

// Features (Modular Pattern)
import { BackupManager } from '@/features/organization/backup/BackupManager';
import { SecurityManager } from '@/features/organization/security/SecurityManager';
import { GeneralSettings } from '@/features/organization/settings/GeneralSettings';
import { SystemSettings } from '@/features/organization/settings/SystemSettings';
import { FinanceIntegrationSettings } from '@/features/organization/settings/FinanceIntegrationSettings';
import { CommissionRulesSettings } from '@/features/organization/settings/CommissionRulesSettings';
import { OrderSettings } from '@/features/organization/settings/OrderSettings';
import { CustomerFieldSettings } from '@/features/organization/settings/CustomerFieldSettings';

// Shared Components
import UserManagement from '@/components/admin/UserManagement';
import RolePermissions from '@/components/admin/RolePermissions';
import PaymentMethodSettings from '@/components/admin/PaymentMethodSettings';
import ProcessStatusSettings from '@/components/admin/ProcessStatusSettings';
import PricingRuleSettings from '@/components/admin/PricingRuleSettings';
import { SpedMappingManager } from '@/features/financeiro/SpedMappingManager';
import { ChartOfAccountsManager } from '@/features/financeiro/ChartOfAccountsManager';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { BookOpen, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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
  enableCategoryAppropriation: boolean;
  defaultReceivableCategoryId?: string;
  defaultRevenueCategoryId?: string;
  defaultBackupPassword?: string;
  inventoryValuationMethod: string;
  freightExpenseAccountId?: string;
  taxExpenseAccountId?: string;
  nfeCertificate?: string | null;
  nfeCertificatePassword?: string | null;
  nfeCertificateExpiry?: string | null;
  nfeCertificateSubject?: string | null;
  nfeCertificateFileName?: string | null;
  requireOrderDeposit: boolean;
  minDepositPercent: number;
  allowDeliveryWithBalance: boolean;
  defaultDueDateDays: number;
}

const Configuracoes: React.FC = () => {
  const { user, refreshSettings } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'empresa');
  const [loading, setLoading] = useState(false);
  const [showChartOfAccounts, setShowChartOfAccounts] = useState(false);

  // Sincroniza aba com URL: troca de aba escreve ?tab=..., e o estado segue a URL (back/forward funcionam)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    } else if (!tab) {
      setSearchParams({ tab: 'empresa' }, { replace: true });
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const [organizationData, setOrganizationData] = useState<any>({
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
    requireDocumentKeyForEntry: false,
    enableCategoryAppropriation: true,
    inventoryValuationMethod: 'AVERAGE',
    nfeCertificate: null,
    nfeCertificatePassword: null,
    nfeCertificateExpiry: null,
    nfeCertificateSubject: null,
    nfeCertificateFileName: null,
    requireOrderDeposit: false,
    minDepositPercent: 0.0,
    allowDeliveryWithBalance: true,
    defaultDueDateDays: 0
  });

  const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({
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

      setOrganizationData(orgResponse.data.data);

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
      // Limpar campos que não devem ser enviados para o update (ID, Slug, etc)
      const { id, slug, active, createdAt, updatedAt, ...cleanData } = organizationData;
      
      await api.put('/api/organization', cleanData);
      toast.success('Dados da empresa atualizados!');
      loadSettings();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error?.message || 'Erro ao salvar organização';
      toast.error(msg);
      console.error('Erro Organization PUT:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      await api.put('/api/organization/settings', settings);
      toast.success('Configurações salvas com sucesso!');
      await refreshSettings();
      loadSettings();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error?.message || 'Erro ao salvar configurações';
      toast.error(msg);
      console.error('Erro Settings PUT:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const allTabs = [
    { id: 'empresa', label: 'Empresa', icon: Building },
    { id: 'sistema', label: 'Sistema', icon: Settings },
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'pedidos', label: 'Pedidos', icon: ShoppingCart },
    { id: 'clientes', label: 'Clientes', icon: UserCheck },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign, setting: 'enableFinance' },
    { id: 'processos', label: 'Processos e Catálogo', icon: Workflow },
    { id: 'producao', label: 'Produção', icon: Package, setting: 'enableProduction' },
    { id: 'seguranca', label: 'Segurança', icon: Shield },
    { id: 'backup', label: 'Backup', icon: Database },
    { id: 'aparencia', label: 'Aparência', icon: Palette },
  ];

  const visibleTabs = allTabs.filter(tab => !tab.setting || (settings as any)[tab.setting]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 space-y-1">
          <div className="mb-6 px-4">
             <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
             <p className="text-muted-foreground text-xs">Gerencie sua organização</p>
          </div>
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'animate-pulse' : ''}`} />
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {activeTab === 'empresa' && (
            <GeneralSettings 
              organizationData={organizationData}
              setOrganizationData={setOrganizationData}
              handleSaveOrganization={handleSaveOrganization}
              loading={loading}
            />
          )}

          {activeTab === 'sistema' && (
            <SystemSettings 
              settings={settings}
              setSettings={setSettings}
              handleSaveSettings={handleSaveSettings}
              loading={loading}
            />
          )}

          {activeTab === 'usuarios' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Gerenciamento de Usuários</CardTitle>
                </CardHeader>
                <CardContent><UserManagement /></CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Perfis de Acesso</CardTitle>
                </CardHeader>
                <CardContent><RolePermissions /></CardContent>
              </Card>
            </div>
          )}

           {activeTab === 'pedidos' && (
            <OrderSettings 
              settings={settings}
              setSettings={setSettings}
              handleSaveSettings={handleSaveSettings}
              loading={loading}
            />
          )}

          {activeTab === 'clientes' && (
            <CustomerFieldSettings />
          )}

          {activeTab === 'financeiro' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle>Plano de Contas</CardTitle>
                        <CardDescription>
                          Estrutura hierárquica oficial de contas contábeis para DRE, balanço e relatórios. Configure uma vez por ano.
                        </CardDescription>
                      </div>
                    </div>
                    <Button onClick={() => setShowChartOfAccounts(true)}>
                      Abrir Plano de Contas
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              <FinanceIntegrationSettings
                settings={settings}
                setSettings={setSettings}
                handleSaveSettings={handleSaveSettings}
                loading={loading}
              />
              <CommissionRulesSettings />
              <PaymentMethodSettings
                scope="SALES"
                title="Métodos de Pagamento — Vendas"
                description="Instrumentos usados para receber de clientes (Pix, Cartão, Dinheiro...)"
              />
              <PaymentMethodSettings
                scope="PURCHASES"
                title="Métodos de Pagamento — Compras"
                description="Instrumentos usados para pagar fornecedores (cartões de compras, contas, Pix...)"
              />
              {settings.enableCategoryAppropriation ? (
                <SpedMappingManager />
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center bg-slate-50/50">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-1">Módulo Desativado</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    A Apropriação Contábil por Categoria está desabilitada. Para ativar, acesse <strong>Sistema → Módulos Ativos</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'processos' && (
            <div className="space-y-6">
              {/* Modo do Fluxo de Trabalho */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><GitBranch className="w-5 h-5" /> Fluxo de Trabalho</CardTitle>
                  <CardDescription>Define como os pedidos podem transitar entre os status configurados abaixo.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {([
                      { value: 'STRICT', label: 'Sequencial', desc: 'O pedido deve passar por todos os status na ordem. Ex: Rascunho → Aprovado → Produção → Finalizado → Entregue.' },
                      { value: 'SKIP', label: 'Pular Etapas', desc: 'Permite avançar para qualquer status futuro, pulando etapas. Não permite retroceder.' },
                      { value: 'FREE', label: 'Livre', desc: 'Qualquer transição é permitida, inclusive retroceder. Máxima flexibilidade.' },
                    ] as const).map((mode) => {
                      const isSelected = ((settings as any).workflowMode || 'FREE') === mode.value;
                      return (
                        <label
                          key={mode.value}
                          className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all group ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
                              : 'border-muted hover:border-muted-foreground/30 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="workflowMode"
                            value={mode.value}
                            checked={isSelected}
                            onChange={() => {
                              setSettings((prev: any) => ({ ...prev, workflowMode: mode.value }));
                              // Salvar imediatamente ao trocar
                              api.put('/api/organization/settings', { workflowMode: mode.value })
                                .then(() => toast.success('Modo de fluxo atualizado!'))
                                .catch(() => toast.error('Erro ao salvar modo de fluxo'));
                            }}
                            className="sr-only"
                          />
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-primary' : 'border-muted-foreground/40'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            </div>
                            <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{mode.label}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight pl-5">{mode.desc}</p>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card><CardContent className="pt-6"><PricingRuleSettings /></CardContent></Card>
              <Card><CardContent className="pt-6"><ProcessStatusSettings /></CardContent></Card>
            </div>
          )}

          {activeTab === 'producao' && (
             <Card>
                <CardHeader><CardTitle>Configurações de Produção</CardTitle></CardHeader>
                <CardContent>Recursos de PCP e controle de chão de fábrica ativos.</CardContent>
             </Card>
          )}

          {activeTab === 'seguranca' && (
             <SecurityManager 
               settings={settings}
               setSettings={setSettings}
               handleSaveSettings={handleSaveSettings}
               loading={loading}
             />
          )}

          {activeTab === 'backup' && (
            <BackupManager 
              selectedModules={selectedModules}
              setSelectedModules={setSelectedModules}
              loadSettings={loadSettings}
              userRole={user?.role}
            />
          )}

          {activeTab === 'aparencia' && (
            <Card>
              <CardHeader><CardTitle>Aparência</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                   <p className="text-sm text-muted-foreground italic">Em breve: Personalização total de cores e logotipos.</p>
                   <Button variant="outline">Restaurar Padrões</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showChartOfAccounts && (
        <ModalPortal>
          <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-7xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-slate-50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-none mb-1">Plano de Contas</h2>
                  <p className="text-xs text-slate-500">Estrutura contábil oficial da organização</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowChartOfAccounts(false)} className="rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ChartOfAccountsManager embedded />
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default Configuracoes;