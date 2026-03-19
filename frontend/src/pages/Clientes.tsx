import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Search, Edit, Trash2, Phone, Mail, Users, MapPin, Building2, Hash } from 'lucide-react';
import axios from 'axios';
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
  address?: string;
  addressNumber?: string;
  zipCode?: string;
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
    addressNumber: '',
    city: '',
    state: '',
    zipCode: '',
    type: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY',
    isCustomer: true,
    isSupplier: false,
    isEmployee: false
  });

  useEffect(() => {
    loadClientes();
  }, []);

  const handleCepSearch = async () => {
    const cep = formData.zipCode.replace(/\D/g, '');
    if (cep.length !== 8) {
      toast.error('CEP inválido (precisa de 8 dígitos)');
      return;
    }

    try {
      const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
      const data = response.data;

      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      setFormData(prev => ({
        ...prev,
        address: toTitleCase(data.logradouro),
        city: toTitleCase(data.localidade),
        state: (data.uf || '').toUpperCase()
      }));
      toast.success('Endereço preenchido!');
    } catch (error) {
      toast.error('Erro ao buscar CEP');
    }
  };

  const toTitleCase = (text: string) => {
    if (!text) return '';
    const prepositions = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com'];
    return text
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 0)
      .map((word, index) => {
        if (index > 0 && prepositions.includes(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  const handleCnpjSearch = async () => {
    const cnpj = formData.document.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      toast.error('CNPJ inválido (precisa de 14 dígitos)');
      return;
    }

    try {
      const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      const data = response.data;

      setFormData(prev => ({
        ...prev,
        name: toTitleCase(data.razao_social || data.nome_fantasia || prev.name),
        email: (data.email || prev.email || '').toLowerCase(),
        phone: data.ddd_telefone_1 || prev.phone,
        address: toTitleCase(data.logradouro || prev.address),
        addressNumber: data.numero || prev.addressNumber,
        city: toTitleCase(data.municipio || prev.city),
        state: (data.uf || prev.state || '').toUpperCase(),
        zipCode: data.cep || prev.zipCode,
        type: 'COMPANY'
      }));
      toast.success('Dados da empresa carregados!');
    } catch (error) {
      toast.error('Erro ao buscar CNPJ');
    }
  };

  const handleDocumentChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    let newType = formData.type;

    if (cleanValue.length === 14) {
      newType = 'COMPANY';
    } else if (cleanValue.length === 11) {
      newType = 'INDIVIDUAL';
    }

    setFormData(prev => ({
      ...prev,
      document: value,
      type: newType
    }));
  };

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

  const checkPhoneDuplicate = async (phone: string) => {
    if (!phone || phone.length < 8) return null;
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const response = await api.get(`/api/profiles?isCustomer=true&search=${cleanPhone}`);
      const existing = response.data.data.find((c: Cliente) =>
        c.phone?.replace(/\D/g, '') === cleanPhone && c.id !== editingCliente?.id
      );
      return existing;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar duplicidade de telefone antes de salvar (apenas se for novo ou mudou)
    if (!editingCliente) {
      const duplicate = await checkPhoneDuplicate(formData.phone);
      if (duplicate) {
        if (confirm(`O telefone ${formData.phone} já pertence ao cliente "${duplicate.name}". Deseja abrir o cadastro dele para atualizar em vez de criar um novo?`)) {
          handleEdit(duplicate);
          return;
        }
      }
    }

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
      const errorMessage = error.response?.data?.message || error.response?.data?.error?.message || 'Erro ao salvar cliente';
      toast.error(errorMessage);
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      name: cliente.name,
      document: cliente.document || '',
      email: cliente.email || '',
      phone: cliente.phone || '',
      address: cliente.address || '',
      addressNumber: cliente.addressNumber || '',
      city: cliente.city || '',
      state: cliente.state || '',
      zipCode: cliente.zipCode || '',
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
      addressNumber: '',
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
                    <div className="flex space-x-2">
                      <Input
                        value={formData.document}
                        onChange={(e) => handleDocumentChange(e.target.value)}
                        placeholder={formData.type === 'INDIVIDUAL' ? "000.000.000-00" : "00.000.000/0000-00"}
                      />
                      {formData.document.replace(/\D/g, '').length === 14 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleCnpjSearch}
                          title="Buscar CNPJ"
                          className="flex-shrink-0"
                        >
                          <Building2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Telefone</label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">CEP</label>
                    <div className="flex space-x-2">
                      <Input
                        value={formData.zipCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                        placeholder="00000-000"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCepSearch}
                        title="Buscar endereço por CEP"
                        className="flex-shrink-0"
                      >
                        <MapPin className="w-4 h-4" />
                      </Button>
                    </div>
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
                      placeholder="UF"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 space-y-2">
                    <label className="text-sm font-medium">Endereço</label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Rua, Avenida, etc."
                    />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <label className="text-sm font-medium">Número</label>
                    <Input
                      value={formData.addressNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, addressNumber: e.target.value }))}
                      placeholder="Nº"
                    />
                  </div>
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

                {(cliente.address || cliente.city || cliente.state) && (
                  <p className="text-sm text-muted-foreground">
                    {cliente.address}{cliente.addressNumber && `, ${cliente.addressNumber}`}<br />
                    {cliente.city}{cliente.city && cliente.state && ', '}{cliente.state}
                    {cliente.zipCode && ` - ${cliente.zipCode}`}
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