import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRoles } from '@/features/roles/useRoles';
import { RoleList } from '../roles/RoleList';
import { RoleFormModal } from '../roles/RoleFormModal';
import { PermissionMatrix, PERMISSIONS } from '../roles/PermissionMatrix';

const RolePermissions: React.FC = () => {
  const { user } = useAuth();
  const { roles: fetchedRoles, loading, createRole, updatePermissions } = useRoles();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Ordenação prioritária: Administrador -> Outros (Proprietário oculto)
  const roles = useMemo(() => {
    return fetchedRoles
      .filter(r => r.name !== 'Proprietário') // Ocultar proprietário pois é imutável
      .sort((a, b) => {
        const weights: Record<string, number> = {
          'Administrador': 1,
        };
        const weightA = weights[a.name] || 99;
        const weightB = weights[b.name] || 99;
        if (weightA !== weightB) return weightA - weightB;
        return a.name.localeCompare(b.name);
      });
  }, [fetchedRoles]);

  // Auto-selecionar o primeiro perfil quando carregar
  React.useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const selectedRole = useMemo(() => {
    return roles.find(r => r.id === selectedRoleId) || null;
  }, [roles, selectedRoleId]);

  // Regra de Negócio: OWNER edita tudo (exceto OWNER). ADMIN edita apenas customizados (não-system).
  const canEditSelectedRole = useMemo(() => {
    if (!user || !selectedRole) return false;
    if (selectedRole.name === 'Proprietário') return false; // Ninguém edita o dono
    if (user.role === 'OWNER') return true;
    if (user.role === 'ADMIN' && !selectedRole.isSystem) return true;
    return false;
  }, [user, selectedRole]);

  const handleTogglePermission = async (permissionId: string) => {
    if (!selectedRole || !canEditSelectedRole) return;

    const currentPerms = selectedRole.permissions.map((p: any) => p.permissionKey);
    const hasPermission = currentPerms.includes(permissionId);
    
    const newPermissions = hasPermission 
      ? currentPerms.filter((p: string) => p !== permissionId)
      : [...currentPerms, permissionId];

    await updatePermissions(selectedRole.id, newPermissions);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Departamentos e Perfis</h2>
          <p className="text-muted-foreground">Gerencie o nível de acesso e crie novos departamentos.</p>
        </div>
        
        {/* Apenas administradores e owners podem criar departamentos */}
        {(user?.role === 'OWNER' || user?.role === 'ADMIN') && (
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Novo Departamento
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <RoleList 
            roles={roles} 
            selectedRoleId={selectedRoleId} 
            onSelect={(role) => setSelectedRoleId(role.id)} 
          />

          {selectedRole && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span>Permissões: {selectedRole.name}</span>
                  {!canEditSelectedRole && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-600 text-xs rounded-full font-medium">
                      Somente Leitura
                    </span>
                  )}
                  {selectedRole.isSystem && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium border">
                      Padrão do Sistema
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  {selectedRole.description || 'Nenhuma descrição fornecida.'}
                </CardDescription>

                {/* Relatório de Porcentagem de Acesso */}
                <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      Cobertura Total do Sistema
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {Math.round((selectedRole.permissions.length / PERMISSIONS.length) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${(selectedRole.permissions.length / PERMISSIONS.length) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Este departamento possui <strong>{selectedRole.permissions.length}</strong> de <strong>{PERMISSIONS.length}</strong> permissões totais mapeadas no ArtPlimERP.
                  </p>
                </div>
              </CardHeader>
              
              <CardContent>
                <PermissionMatrix 
                  currentPermissions={selectedRole.permissions.map((p: any) => p.permissionKey)}
                  canEdit={canEditSelectedRole}
                  onToggle={handleTogglePermission}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <RoleFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onCreate={createRole} 
      />
    </div>
  );
};

export default RolePermissions;