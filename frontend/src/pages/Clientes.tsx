import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Search, Edit, Trash2, Phone, Mail, Users } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Cliente {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  type: 'INDIVIDUAL' | 'COMPANY';
  isCustomer: boolean;
  _count?: {
    orders: number;
  };
}

const Clientes: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    document: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    type: 'INDIVIDUAL' as const,
    isCustomer: true,
    isSupplier: false,
    isEmployee: false
  });

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      const response = await api.get('/api/profiles?isCustomer=true');
      setClientes(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCliente) {
        await api.put(`/api/profiles/${editingCliente.id}`, formData);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await api.post('/api/profiles', formData);
        toast.success('Cliente criado com sucesso!');
      }
      
      setShowForm(false);
      setEditingCliente(null);
      resetForm();
      loadClientes();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar cliente');
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      name: cliente.name,
      document: cliente.document || '',
      email: cliente.email || '',
      phone: cliente.phone || '',
      address: '',
      city: cliente.city || '',
      state: cliente.state || '',
      zipCode: '',
      type: cliente.type,
      isCustomer: cliente.isCustomer,
      isSupplier: false,
      isEmployee: false
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este cliente?')) return;
    
    try {
      await api.delete(`/api/profiles/${id}`);
      toast.success('Cliente removido com sucesso!');
      loadClientes();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao remover cliente');
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
      isCustomer: true,
      isSupplier: false,
      isEmployee: false
    });
  };

  const filteredClientes = clientes.filter(cliente =>
    cliente.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.document?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.email?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie seus clientes e prospects
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar clientes..."
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
                {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
              </CardTitle>
              <CardDescription>
                Preencha os dados do cliente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    >
                      <option value="INDIVIDUAL">Pessoa Física</option>
                      <option value="COMPANY">Pessoa Jurídica</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {formData.type === 'INDIVIDUAL' ? 'CPF' : 'CNPJ'}
                    </label>
                    <Input
                      value={formData.document}
                      onChange={(e) => setFormData(prev => ({ ...prev, document: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Telefone</label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
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

                  <div className="space-y-2">
                    <label className="text-sm font-medium">CEP</label>
                    <Input
                      value={formData.zipCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
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

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowForm(false);
                      setEditingCliente(null);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingCliente ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Clientes List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClientes.map((cliente) => (
          <Card key={cliente.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{cliente.name}</CardTitle>
                  <CardDescription>
                    {cliente.type === 'INDIVIDUAL' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                  </CardDescription>
                </div>
                <div className="flex space-x-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(cliente)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(cliente.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cliente.document && (
                  <p className="text-sm text-muted-foreground">
                    {cliente.type === 'INDIVIDUAL' ? 'CPF' : 'CNPJ'}: {cliente.document}
                  </p>
                )}
                
                {cliente.email && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{cliente.email}</span>
                  </div>
                )}
                
                {cliente.phone && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{cliente.phone}</span>
                  </div>
                )}
                
                {(cliente.city || cliente.state) && (
                  <p className="text-sm text-muted-foreground">
                    {cliente.city}{cliente.city && cliente.state && ', '}{cliente.state}
                  </p>
                )}
                
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium">
                    {cliente._count?.orders || 0} pedido(s)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClientes.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum cliente encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Tente ajustar sua busca' : 'Comece criando seu primeiro cliente'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Cliente
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Clientes;