import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Edit, 
  Trash2, 
  Mail, 
  CheckCircle, 
  Search,
  UserPlus,
  Eye,
  EyeOff,
  Users
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'USER';
  active: boolean;
  createdAt: string;
  organizationId: string;
}

const roleLabels = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  USER: 'Usuário'
};

const roleColors = {
  OWNER: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  USER: 'bg-gray-100 text-gray-800'
};

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Estados do formulário de convite
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'USER' as User['role']
  });

  // Estados do formulário de edição
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'USER' as User['role'],
    active: true
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await api.post('/api/admin/users/invite', inviteForm);
      toast.success('Convite enviado com sucesso!');
      setShowInviteModal(false);
      setInviteForm({ name: '', email: '', role: 'USER' });
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao enviar convite');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser) return;

    try {
      await api.put(`/api/admin/users/${editingUser.id}`, editForm);
      toast.success('Usuário atualizado com sucesso!');
      setShowEditModal(false);
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao atualizar usuário');
    }
  };

  const handleToggleUserStatus = async (userId: string, active: boolean) => {
    try {
      await api.patch(`/api/admin/users/${userId}/status`, { active });
      toast.success(`Usuário ${active ? 'ativado' : 'desativado'} com sucesso!`);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao alterar status do usuário');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await api.delete(`/api/admin/users/${userId}`);
      toast.success('Usuário excluído com sucesso!');
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao excluir usuário');
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active
    });
    setShowEditModal(true);
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    roleLabels[user.role].toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManageUser = (targetUser: User) => {
    if (!currentUser) return false;
    
    // OWNER pode gerenciar todos
    if (currentUser.role === 'OWNER') return true;
    
    // ADMIN pode gerenciar MANAGER e USER
    if (currentUser.role === 'ADMIN') {
      return ['MANAGER', 'USER'].includes(targetUser.role);
    }
    
    // MANAGER pode gerenciar apenas USER
    if (currentUser.role === 'MANAGER') {
      return targetUser.role === 'USER';
    }
    
    return false;
  };

  const canInviteRole = (role: User['role']) => {
    if (!currentUser) return false;
    
    // OWNER pode convidar todos os roles
    if (currentUser.role === 'OWNER') return true;
    
    // ADMIN pode convidar MANAGER e USER
    if (currentUser.role === 'ADMIN') {
      return ['MANAGER', 'USER'].includes(role);
    }
    
    // MANAGER pode convidar apenas USER
    if (currentUser.role === 'MANAGER') {
      return role === 'USER';
    }
    
    return false;
  };

  if (loading) {
    return <div className="text-center py-8">Carregando usuários...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header com busca e botão de convite */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {(currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && (
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Convidar Usuário
          </Button>
        )}
      </div>

      {/* Lista de usuários */}
      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div key={user.id} className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h5 className="font-medium">{user.name}</h5>
                    {user.id === currentUser?.id && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full">
                        Você
                      </span>
                    )}
                    {!user.active && (
                      <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${roleColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Desde {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center space-x-2">
                {user.id !== currentUser?.id && canManageUser(user) && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleUserStatus(user.id, !user.active)}
                      title={user.active ? 'Desativar usuário' : 'Ativar usuário'}
                    >
                      {user.active ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(user)}
                      title="Editar usuário"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>

                    {user.role !== 'OWNER' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleDeleteUser(user.id)}
                        title="Excluir usuário"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum usuário encontrado</p>
          </div>
        )}
      </div>

      {/* Modal de Convite */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Convidar Usuário</CardTitle>
              <CardDescription>
                Envie um convite para um novo usuário se juntar à organização
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInviteUser} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Perfil de Acesso</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value as User['role'] }))}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                  >
                    {Object.entries(roleLabels).map(([role, label]) => (
                      canInviteRole(role as User['role']) && (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      )
                    ))}
                  </select>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button type="submit" className="flex-1">
                    <Mail className="w-4 h-4 mr-2" />
                    Enviar Convite
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowInviteModal(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Edição */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Editar Usuário</CardTitle>
              <CardDescription>
                Altere as informações e permissões do usuário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEditUser} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Perfil de Acesso</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value as User['role'] }))}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    disabled={editingUser.role === 'OWNER'}
                  >
                    {Object.entries(roleLabels).map(([role, label]) => (
                      (canInviteRole(role as User['role']) || editingUser.role === role) && (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      )
                    ))}
                  </select>
                  {editingUser.role === 'OWNER' && (
                    <p className="text-xs text-muted-foreground">
                      O perfil de proprietário não pode ser alterado
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={editForm.active}
                    onChange={(e) => setEditForm(prev => ({ ...prev, active: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <label htmlFor="active" className="text-sm font-medium">
                    Usuário ativo
                  </label>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button type="submit" className="flex-1">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default UserManagement;