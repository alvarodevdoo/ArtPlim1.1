import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Users,
  DollarSign,
  Package,
  Shield,
  Palette,
  Workflow,
  Database
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import api from '@/lib/api';

// Features (Modular Pattern)
import { BackupManager } from '@/features/organization/backup/BackupManager';
import { SecurityManager } from '@/features/organization/security/SecurityManager';
import { GeneralSettings } from '@/features/organization/settings/GeneralSettings';
import { SystemSettings } from '@/features/organization/settings/SystemSettings';
import { FinanceIntegrationSettings } from '@/features/organization/settings/FinanceIntegrationSettings';

// Shared Components
import UserManagement from '@/components/admin/UserManagement';
import RolePermissions from '@/components/admin/RolePermissions';
import PaymentMethodSettings from '@/components/admin/PaymentMethodSettings';
import ProcessStatusSettings from '@/components/admin/ProcessStatusSettings';
import PricingRuleSettings from '@/components/admin/PricingRuleSettings';
import { SpedMappingManager } from '@/features/financeiro/SpedMappingManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
  defaultReceivableCategoryId?: string;
  defaultRevenueCategoryId?: string;
  defaultBackupPassword?: string;
  inventoryValuationMethod: string;
  freightExpenseAccountId?: string;
  taxExpenseAccountId?: string;
}

const Configuracoes: React.FC = () => {
  const { user, refreshSettings } = useAuth();
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
    allowDuplicatePhones: true,
    requireDocumentKeyForEntry: false,
    inventoryValuationMethod: 'AVERAGE'
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
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar organização');
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
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar sistema');
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
              onClick={() => setActiveTab(tab.id)}
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

          {activeTab === 'financeiro' && (
            <div className="space-y-6">
              <FinanceIntegrationSettings
                settings={settings}
                setSettings={setSettings}
                handleSaveSettings={handleSaveSettings}
                loading={loading}
              />
              <PaymentMethodSettings />
              <SpedMappingManager />
            </div>
          )}

          {activeTab === 'processos' && (
            <div className="space-y-6">
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
    </div>
  );
};

export default Configuracoes;