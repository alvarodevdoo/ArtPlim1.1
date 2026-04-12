import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Search, Edit, Trash2, Phone, Mail, Truck, MapPin, Building2, Hash } from 'lucide-react';
import axios from 'axios';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Fornecedor {
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
  isSupplier: boolean;
  _count?: {
    orders: number;
  };
}

const Fornecedores: React.FC = () => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);

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
    type: 'COMPANY' as 'INDIVIDUAL' | 'COMPANY',
    isCustomer: false,
    isSupplier: true,
    isEmployee: false
  });

  useEffect(() => {
    loadFornecedores();
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

  const loadFornecedores = async () => {
    try {
      const response = await api.get('/api/profiles?isSupplier=true');
      setFornecedores(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingFornecedor) {
        await api.put(`/api/profiles/${editingFornecedor.id}`, formData);
        toast.success('Fornecedor atualizado com sucesso!');
      } else {
        await api.post('/api/profiles', formData);
        toast.success('Fornecedor criado com sucesso!');
      }

      setShowForm(false);
      setEditingFornecedor(null);
      resetForm();
      loadFornecedores();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error?.message || 'Erro ao salvar fornecedor';
      toast.error(errorMessage);
    }
  };

  const handleEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setFormData({
      name: fornecedor.name,
      document: fornecedor.document || '',
      email: fornecedor.email || '',
      phone: fornecedor.phone || '',
      address: fornecedor.address || '',
      addressNumber: fornecedor.addressNumber || '',
      city: fornecedor.city || '',
      state: fornecedor.state || '',
      zipCode: fornecedor.zipCode || '',
      type: fornecedor.type,
      isCustomer: (fornecedor as any).isCustomer || false,
      isSupplier: fornecedor.isSupplier,
      isEmployee: (fornecedor as any).isEmployee || false
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este fornecedor?')) return;

    try {
      await api.delete(`/api/profiles/${id}`);
      toast.success('Fornecedor removido com sucesso!');
      loadFornecedores();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao remover fornecedor');
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
      type: 'COMPANY',
      isCustomer: false,
      isSupplier: true,
      isEmployee: false
    });
  };

  const filteredFornecedores = fornecedores.filter(fornecedor =>
    fornecedor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fornecedor.document?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fornecedor.email?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground">
            Gerencie seus fornecedores de insumos e serviços
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Fornecedor
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar fornecedores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <Card className="modal-content-card max-w-2xl">
            <CardHeader>
              <CardTitle>
                {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </CardTitle>
              <CardDescription>
                Preencha os dados do fornecedor
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome / Razão Social *</label>
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
                      className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm"
                    >
                      <option value="COMPANY">Pessoa Jurídica</option>
                      <option value="INDIVIDUAL">Pessoa Física</option>
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
                      placeholder="email@fornecedor.com"
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

                  {/* Papéis no Sistema */}
                  <div className="md:col-span-2 space-y-2 border-t pt-2 mt-2">
                    <label className="text-sm font-medium block mb-2">Papéis no Sistema</label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isCustomer}
                          onChange={(e) => setFormData(prev => ({ ...prev, isCustomer: e.target.checked }))}
                          className="rounded border-input h-4 w-4"
                        />
                        <span className="text-sm">Cliente</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isSupplier}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            isSupplier: e.target.checked,
                            isEmployee: e.target.checked ? false : prev.isEmployee
                          }))}
                          className="rounded border-input h-4 w-4"
                        />
                        <span className="text-sm">Fornecedor</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isEmployee}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            isEmployee: e.target.checked,
                            isSupplier: e.target.checked ? false : prev.isSupplier
                          }))}
                          className="rounded border-input h-4 w-4"
                        />
                        <span className="text-sm">Colaborador</span>
                      </label>
                    </div>
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
                      setEditingFornecedor(null);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingFornecedor ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fornecedores List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredFornecedores.map((fornecedor) => (
          <Card key={fornecedor.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Truck className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{fornecedor.name}</CardTitle>
                    <CardDescription>
                      {fornecedor.type === 'INDIVIDUAL' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(fornecedor)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(fornecedor.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {fornecedor.document && (
                  <p className="text-sm text-muted-foreground">
                    {fornecedor.type === 'INDIVIDUAL' ? 'CPF' : 'CNPJ'}: {fornecedor.document}
                  </p>
                )}

                {fornecedor.email && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{fornecedor.email}</span>
                  </div>
                )}

                {fornecedor.phone && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{fornecedor.phone}</span>
                  </div>
                )}

                {(fornecedor.address || fornecedor.city || fornecedor.state) && (
                  <p className="text-sm text-muted-foreground">
                    {fornecedor.address}{fornecedor.addressNumber && `, ${fornecedor.addressNumber}`}<br />
                    {fornecedor.city}{fornecedor.city && fornecedor.state && ', '}{fornecedor.state}
                    {fornecedor.zipCode && ` - ${fornecedor.zipCode}`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFornecedores.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum fornecedor encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Tente ajustar sua busca' : 'Cadastre seu primeiro fornecedor de insumos'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Fornecedor
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Fornecedores;
