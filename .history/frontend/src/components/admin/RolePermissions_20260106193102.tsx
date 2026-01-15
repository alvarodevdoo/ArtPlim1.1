import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Shield, 
  Users, 
  Settings, 
  DollarSign, 
  Package, 
  Database,
  Eye,
  Edit,
  Trash2,
  Plus,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Permission {
  id: string;
  name: string;
  description: string;
  module: string;
  icon: React.ComponentType<any>;
}

interface RolePermission {
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'USER';
  permissions: string[];
}

const permissions: Permission[] = [
  // Módulo de Vendas
  { id: 'sales.view', name: 'Visualizar Pedidos', description: 'Ver lista de pedidos e orçamentos', module: 'Vendas', icon: Eye },
  { id: 'sales.create', name: 'Criar Pedidos', description: 'Criar novos pedidos e orçamentos', module: 'Vendas', icon: Plus },
  { id: 'sales.edit', name: 'Editar Pedidos', description: 'Modificar pedidos existentes', module: 'Vendas', icon: Edit },
  { id: 'sales.delete', name: 'Excluir Pedidos', description: 'Remover pedidos do sistema', module: 'Vendas', icon: Trash2 },
  { id: 'sales.approve', name: 'Aprovar Orçamentos', description: 'Aprovar orçamentos para produção', module: 'Vendas', icon: CheckCircle },
  
  // Módulo Financeiro
  { id: 'finance.view', name: 'Visualizar Financeiro', description: 'Ver informações financeiras e custos', module: 'Financeiro', icon: DollarSign },
  { id: 'finance.costs', name: 'Ver Custos', description: 'Visualizar custos de materiais e produção', module: 'Financeiro', icon: DollarSign },
  { id: 'finance.margins', name: 'Ver Margens', description: 'Visualizar margens de lucro', module: 'Financeiro', icon: DollarSign },
  { id: 'finance.reports', name: 'Relatórios Financeiros', description: 'Gerar relatórios financeiros', module: 'Financeiro', icon: DollarSign },
  
  // Módulo de Produção
  { id: 'production.view', name: 'Visualizar Produção', description: 'Ver fila de produção', module: 'Produção', icon: Package },
  { id: 'production.manage', name: 'Gerenciar Produção', description: 'Controlar fila e status de produção', module: 'Produção', icon: Package },
  
  // Módulo de Estoque (WMS)
  { id: 'inventory.view', name: 'Visualizar Estoque', description: 'Ver níveis de estoque', module: 'Estoque', icon: Database },
  { id: 'inventory.manage', name: 'Gerenciar Estoque', description: 'Controlar movimentações de estoque', module: 'Estoque', icon: Database },
  
  // Administração
  { id: 'admin.users', name: 'Gerenciar Usuários', description: 'Criar, editar e remover usuários', module: 'Administração', icon: Users },
  { id: 'admin.settings', name: 'Configurações', description: 'Alterar configurações do sistema', module: 'Administração', icon: Settings },
  { id: 'admin.organization', name: 'Dados da Empresa', description: 'Alterar dados da organização', module: 'Administração', icon: Settings },
];

const defaultRolePermissions: RolePermission[] = [
  {
    role: 'OWNER',
    permissions: permissions.map(p => p.id) // Todas as permissões
  },
  {
    role: 'ADMIN',
    permissions: [
      'sales.view', 'sales.create', 'sales.edit', 'sales.delete', 'sales.approve',
      'finance.view', 'finance.costs', 'finance.margins', 'finance.reports',
      'production.view', 'production.manage',
      'inventory.view', 'inventory.manage',
      'admin.users', 'admin.settings'
    ]
  },
  {
    role: 'MANAGER',
    permissions: [
      'sales.view', 'sales.create', 'sales.edit', 'sales.approve',
      'finance.view', 'finance.costs', 'finance.margins',
      'production.view', 'production.manage',
      'inventory.view', 'inventory.manage'
    ]
  },
  {
    role: 'USER',
    permissions: [
      'sales.view', 'sales.create', 'sales.edit'
    ]
  }
];

const roleLabels = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  USER: 'Usuário'
};

const roleColors = {
  OWNER: 'bg-purple-100 text-purple-800 border-purple-200',
  ADMIN: 'bg-red-100 text-red-800 border-red-200',
  MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
  USER: 'bg-gray-100 text-gray-800 border-gray-200'
};

const moduleColors = {
  'Vendas': 'bg-green-50 border-green-200',
  'Financeiro': 'bg-yellow-50 border-yellow-200',
  'Produção': 'bg-blue-50 border-blue-200',
  'Estoque': 'bg-purple-50 border-purple-200',
  'Administração': 'bg-red-50 border-red-200'
};

const RolePermissions: React.FC = () => {
  const { user } = useAuth();
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>(defaultRolePermissions);
  const [selectedRole, setSelectedRole] = useState<'OWNER' | 'ADMIN' | 'MANAGER' | 'USER'>('USER');

  const canEditRole = (role: string) => {
    if (!user) return false;
    
    // OWNER pode editar todos os roles
    if (user.role === 'OWNER') return true;
    
    // ADMIN pode editar MANAGER e USER
    if (user.role === 'ADMIN') {
      return ['MANAGER', 'USER'].includes(role);
    }
    
    // MANAGER pode editar apenas USER
    if (user.role === 'MANAGER') {
      return role === 'USER';
    }
    
    return false;
  };

  const getCurrentRolePermissions = (role: string): string[] => {
    const roleData = rolePermissions.find(rp => rp.role === role);
    return roleData?.permissions || [];
  };

  const togglePermission = (role: string, permissionId: string) => {
    if (!canEditRole(role)) return;

    setRolePermissions(prev => 
      prev.map(rp => {
        if (rp.role === role) {
          const hasPermission = rp.permissions.includes(permissionId);
          return {
            ...rp,
            permissions: hasPermission 
              ? rp.permissions.filter(p => p !== permissionId)
              : [...rp.permissions, permissionId]
          };
        }
        return rp;
      })
    );
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = [];
    }
    acc[permission.module].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const currentPermissions = getCurrentRolePermissions(selectedRole);

  return (
    <div className="space-y-6">
      {/* Seletor de Role */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(roleLabels).map(([role, label]) => (
          <button
            key={role}
            onClick={() => setSelectedRole(role as any)}
            disabled={!canEditRole(role)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              selectedRole === role
                ? roleColors[role as keyof typeof roleColors]
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            } ${!canEditRole(role) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {label}
            {!canEditRole(role) && (
              <Shield className="w-3 h-3 ml-1 inline" />
            )}
          </button>
        ))}
      </div>

      {/* Informações do Role Selecionado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>Permissões do {roleLabels[selectedRole]}</span>
            {!canEditRole(selectedRole) && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-600 text-xs rounded-full">
                Somente Leitura
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {canEditRole(selectedRole) 
              ? 'Clique nas permissões para ativar ou desativar'
              : 'Você não tem permissão para editar este perfil'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
              <div key={module} className={`border rounded-lg p-4 ${moduleColors[module as keyof typeof moduleColors] || 'bg-gray-50 border-gray-200'}`}>
                <h4 className="font-medium mb-3 flex items-center space-x-2">
                  <span>{module}</span>
                  <span className="text-xs text-muted-foreground">
                    ({modulePermissions.filter(p => currentPermissions.includes(p.id)).length}/{modulePermissions.length})
                  </span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modulePermissions.map((permission) => {
                    const Icon = permission.icon;
                    const hasPermission = currentPermissions.includes(permission.id);
                    
                    return (
                      <div
                        key={permission.id}
                        onClick={() => canEditRole(selectedRole) && togglePermission(selectedRole, permission.id)}
                        className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          hasPermission
                            ? 'bg-green-50 border-green-200 shadow-sm'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        } ${!canEditRole(selectedRole) ? 'cursor-not-allowed opacity-75' : ''}`}
                      >
                        <div className={`p-1.5 rounded ${hasPermission ? 'bg-green-100' : 'bg-gray-100'}`}>
                          <Icon className={`w-3 h-3 ${hasPermission ? 'text-green-600' : 'text-gray-500'}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h5 className="text-sm font-medium">{permission.name}</h5>
                            {hasPermission ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {permission.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {canEditRole(selectedRole) && (
            <div className="mt-6 pt-4 border-t">
              <div className="flex space-x-2">
                <Button size="sm" variant="outline">
                  Salvar Alterações
                </Button>
                <Button size="sm" variant="outline">
                  Restaurar Padrão
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo de Permissões */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Acesso por Perfil</CardTitle>
          <CardDescription>
            Visão geral das permissões de cada perfil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(roleLabels).map(([role, label]) => {
              const rolePerms = getCurrentRolePermissions(role);
              const totalPerms = permissions.length;
              const percentage = Math.round((rolePerms.length / totalPerms) * 100);
              
              return (
                <div key={role} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded text-sm font-medium ${roleColors[role as keyof typeof roleColors]}`}>
                      {label}
                    </span>
                    <div className="text-sm text-muted-foreground">
                      {rolePerms.length} de {totalPerms} permissões ({percentage}%)
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8">
                      {percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RolePermissions;