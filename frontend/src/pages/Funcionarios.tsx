import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Search, Edit, Trash2, Phone, Mail, Users, UserCheck, UserX, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Funcionario {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  type: 'INDIVIDUAL' | 'COMPANY';
  isEmployee: boolean;
  active: boolean;
  _count: {
    orders: number;
  };
}

const Funcionarios: React.FC = () => {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingFuncionario, setEditingFuncionario] = useState<Funcionario | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    document: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    type: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY',
    isCustomer: false,
    isSupplier: false,
    isEmployee: true,
    position: '',
    department: '',
    salary: '',
    hireDate: '',
    active: true,
    password: '',
    role: 'USER' as 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'USER'
  });

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadFuncionarios();
  }, []);

  const loadFuncionarios = async () => {
    try {
      const response = await api.get('/api/profiles?isEmployee=true');
      setFuncionarios(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingFuncionario) {
        await api.put(`/api/profiles/${editingFuncionario.id}`, formData);
        toast.success('Funcionário atualizado com sucesso!');
      } else {
        await api.post('/api/profiles', formData);
        toast.success('Funcionário criado com sucesso!');
      }

      setShowForm(false);
      setEditingFuncionario(null);
      resetForm();
      loadFuncionarios();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar funcionário');
    }
  };

  const handleEdit = (funcionario: Funcionario) => {
    setEditingFuncionario(funcionario);
    setFormData({
      name: funcionario.name,
      document: funcionario.document || '',
      email: funcionario.email || '',
      phone: funcionario.phone || '',
      address: '',
      city: funcionario.city || '',
      state: funcionario.state || '',
      zipCode: '',
      type: funcionario.type,
      isCustomer: false,
      isSupplier: false,
      isEmployee: funcionario.isEmployee,
      position: '',
      department: '',
      salary: '',
      hireDate: '',
      active: funcionario.active,
      password: '',
      role: (funcionario as any).user?.role || 'USER'
    });
    setShowForm(true);
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await api.put(`/api/profiles/${id}`, { active: !currentStatus });
      toast.success(`Funcionário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
      loadFuncionarios();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao alterar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este funcionário?')) return;

    try {
      await api.delete(`/api/profiles/${id}`);
      toast.success('Funcionário removido com sucesso!');
      loadFuncionarios();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao remover funcionário');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      document: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      type: 'INDIVIDUAL',
      isCustomer: false,
      isSupplier: false,
      isEmployee: true,
      position: '',
      department: '',
      salary: '',
      hireDate: '',
      active: true,
      password: '',
      role: 'USER'
    });
  };

  const filteredFuncionarios = funcionarios.filter(funcionario =>
    funcionario.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    funcionario.document?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    funcionario.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Funcionários</h1>
          <p className="text-muted-foreground">
            Gerencie sua equipe e colaboradores
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Funcionário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{funcionarios.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{funcionarios.filter(f => f.active).length}</p>
                <p className="text-sm text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserX className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{funcionarios.filter(f => !f.active).length}</p>
                <p className="text-sm text-muted-foreground">Inativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar funcionários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingFuncionario ? 'Editar Funcionário' : 'Novo Funcionário'}
              </CardTitle>
              <CardDescription>
                Preencha os dados do funcionário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome Completo *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">CPF</label>
                    <Input
                      value={formData.document}
                      onChange={(e) => setFormData(prev => ({ ...prev, document: e.target.value }))}
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email *</label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Telefone</label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cargo</label>
                    <Input
                      value={formData.position}
                      onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                      placeholder="Ex: Operador de Impressão"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Departamento</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    >
                      <option value="">Selecione...</option>
                      <option value="producao">Produção</option>
                      <option value="vendas">Vendas</option>
                      <option value="administrativo">Administrativo</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="logistica">Logística</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data de Admissão</label>
                    <Input
                      type="date"
                      value={formData.hireDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, hireDate: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Salário (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.salary}
                      onChange={(e) => setFormData(prev => ({ ...prev, salary: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cidade</label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estado</label>
                    <Input
                      value={formData.state}
                      onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Endereço</label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Senha de Acesso {editingFuncionario ? '(deixe em branco para manter a atual)' : '*'}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={editingFuncionario ? 'Digite para alterar' : 'Mínimo 6 caracteres'}
                      required={!editingFuncionario}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Esta senha será usada para login no sistema
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Cargo de Acesso (Permissões)</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                  >
                    <option value="USER">Usuário (Padrão)</option>
                    <option value="OPERATOR">Operador (Produção)</option>
                    <option value="MANAGER">Gerente</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Define o nível de permissão e quais módulos o funcionário poderá acessar
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <label htmlFor="active" className="text-sm font-medium">
                    Funcionário ativo
                  </label>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingFuncionario(null);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingFuncionario ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Funcionários List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFuncionarios.map((funcionario) => (
          <Card key={funcionario.id} className={!funcionario.active ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <span>{funcionario.name}</span>
                    {funcionario.active ? (
                      <UserCheck className="w-4 h-4 text-green-500" />
                    ) : (
                      <UserX className="w-4 h-4 text-red-500" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    {funcionario.active ? 'Ativo' : 'Inativo'}
                  </CardDescription>
                </div>
                <div className="flex space-x-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(funcionario)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleToggleStatus(funcionario.id, funcionario.active)}
                  >
                    {funcionario.active ? (
                      <UserX className="w-4 h-4" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(funcionario.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {funcionario.document && (
                  <p className="text-sm text-muted-foreground">
                    CPF: {funcionario.document}
                  </p>
                )}

                {funcionario.email && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{funcionario.email}</span>
                  </div>
                )}

                {funcionario.phone && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{funcionario.phone}</span>
                  </div>
                )}

                {(funcionario.city || funcionario.state) && (
                  <p className="text-sm text-muted-foreground">
                    {funcionario.city}{funcionario.city && funcionario.state && ', '}{funcionario.state}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFuncionarios.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum funcionário encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Tente ajustar sua busca' : 'Comece cadastrando seu primeiro funcionário'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Primeiro Funcionário
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Funcionarios;