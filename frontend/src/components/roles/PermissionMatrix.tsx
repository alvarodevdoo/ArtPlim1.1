// Componente: Matriz de Permissões — painel de checkboxes por módulo
// Princípio SRP: apenas exibe e coleta seleção de permissões. Não conhece API ou estado global.
// Princípio OCP: novos módulos/permissões adicionados ao array PERMISSIONS sem alterar este componente.

import React from 'react';
import {
  Eye, Plus, Edit, Trash2, CheckCircle, XCircle,
  DollarSign, Package, Database, Users, Settings
} from 'lucide-react';

interface PermissionDef {
  id: string;
  name: string;
  description: string;
  module: string;
  icon: React.ComponentType<any>;
}

const PERMISSIONS: PermissionDef[] = [
  // Vendas
  { id: 'sales.view', name: 'Visualizar Pedidos', description: 'Ver lista de pedidos e orçamentos', module: 'Vendas', icon: Eye },
  { id: 'sales.create', name: 'Criar Pedidos', description: 'Criar novos pedidos e orçamentos', module: 'Vendas', icon: Plus },
  { id: 'sales.edit', name: 'Editar Pedidos', description: 'Modificar pedidos existentes', module: 'Vendas', icon: Edit },
  { id: 'sales.delete', name: 'Excluir Pedidos', description: 'Remover pedidos do sistema', module: 'Vendas', icon: Trash2 },
  { id: 'sales.approve', name: 'Aprovar Orçamentos', description: 'Aprovar orçamentos para produção', module: 'Vendas', icon: CheckCircle },
  // Financeiro
  { id: 'finance.view', name: 'Visualizar Financeiro', description: 'Ver informações financeiras', module: 'Financeiro', icon: DollarSign },
  { id: 'finance.costs', name: 'Ver Custos', description: 'Visualizar custos de produção', module: 'Financeiro', icon: DollarSign },
  { id: 'finance.margins', name: 'Ver Margens', description: 'Visualizar margens de lucro', module: 'Financeiro', icon: DollarSign },
  { id: 'finance.reports', name: 'Relatórios Financeiros', description: 'Gerar relatórios financeiros', module: 'Financeiro', icon: DollarSign },
  // Produção
  { id: 'production.view', name: 'Visualizar Produção', description: 'Ver fila de produção', module: 'Produção', icon: Package },
  { id: 'production.manage', name: 'Gerenciar Produção', description: 'Controlar fila de produção', module: 'Produção', icon: Package },
  // Estoque
  { id: 'inventory.view', name: 'Visualizar Estoque', description: 'Ver níveis de estoque', module: 'Estoque', icon: Database },
  { id: 'inventory.manage', name: 'Gerenciar Estoque', description: 'Controlar movimentações', module: 'Estoque', icon: Database },
  // Administração
  { id: 'admin.users', name: 'Gerenciar Usuários', description: 'Criar, editar e remover usuários', module: 'Administração', icon: Users },
  { id: 'admin.settings', name: 'Configurações', description: 'Alterar configurações do sistema', module: 'Administração', icon: Settings },
  { id: 'admin.organization', name: 'Dados da Empresa', description: 'Alterar dados da organização', module: 'Administração', icon: Settings },
  
  // Segurança e Backup
  { id: 'backup.export', name: 'Gerar Backups', description: 'Permite exportar um pacote com os dados da empresa', module: 'Administração', icon: Database },
  { id: 'backup.import', name: 'Restaurar Dados', description: 'Permissão crítica: Permite sobrescrever os dados com um backup', module: 'Administração', icon: Database },
];

const MODULE_COLORS: Record<string, string> = {
  'Vendas': 'bg-green-50 border-green-200',
  'Financeiro': 'bg-yellow-50 border-yellow-200',
  'Produção': 'bg-blue-50 border-blue-200',
  'Estoque': 'bg-purple-50 border-purple-200',
  'Administração': 'bg-red-50 border-red-200',
};

interface PermissionMatrixProps {
  currentPermissions: string[];
  canEdit: boolean;
  onToggle: (permissionId: string) => void;
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  currentPermissions,
  canEdit,
  onToggle,
}) => {
  // Agrupar permissões por módulo
  const grouped = PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, PermissionDef[]>);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([module, perms]) => (
        <div
          key={module}
          className={`border rounded-lg p-4 ${MODULE_COLORS[module] ?? 'bg-gray-50 border-gray-200'}`}
        >
          <h4 className="font-medium mb-3 flex items-center justify-between">
            <span>{module}</span>
            <span className="text-xs text-muted-foreground">
              {perms.filter(p => currentPermissions.includes(p.id)).length}/{perms.length}
            </span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {perms.map((perm) => {
              const Icon = perm.icon;
              const hasPermission = currentPermissions.includes(perm.id);

              return (
                <div
                  key={perm.id}
                  onClick={() => canEdit && onToggle(perm.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                    hasPermission
                      ? 'bg-green-50 border-green-200 shadow-sm'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  } ${!canEdit ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                >
                  <div className={`p-1.5 rounded flex-shrink-0 ${hasPermission ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Icon className={`w-3 h-3 ${hasPermission ? 'text-green-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{perm.name}</span>
                      {hasPermission
                        ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      }
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// Exportar a lista de permissões disponíveis para uso externo (ex: seeds, validações)
export { PERMISSIONS };
