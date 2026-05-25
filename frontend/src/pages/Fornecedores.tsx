import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Search, Edit, Trash2, Phone, Mail, Truck, MapPin, Building2, Hash } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { toTitleCaseBR } from '@/services/lookup';
import { useCnpjLookup } from '@/hooks/useCnpjLookup';
import { useCepLookup } from '@/hooks/useCepLookup';
import { ModalPortal } from '@/components/ui/ModalPortal';

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
    isEmployee: false,
    paymentMode: 'ON_PURCHASE' as 'ON_PURCHASE' | 'DAYS_AFTER' | 'MONTH_DAY' | 'END_OF_MONTH',
    paymentTerms: '' as string | number,
    paymentDayOfMonth: '' as string | number,
    defaultPaymentMethodId: '' as string
  });
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string; type: string }>>([]);

  useEffect(() => {
    loadFornecedores();
    (async () => {
      try {
        const resp = await api.get('/api/payment-methods?scope=PURCHASES');
        const list = resp.data?.data || resp.data || [];
        setPaymentMethods(Array.isArray(list) ? list.map((m: any) => ({ id: m.id, name: m.name, type: m.type })) : []);
      } catch (e) {}
    })();
  }, []);

  const toTitleCase = toTitleCaseBR;

  const { fetch: handleCepSearchFetch } = useCepLookup({
    onSuccess: (data) => {
      setFormData(prev => ({
        ...prev,
        address: toTitleCase(data.address),
        city: toTitleCase(data.city),
        state: (data.state || '').toUpperCase(),
      }));
    },
  });

  const { fetch: handleCnpjSearchFetch } = useCnpjLookup({
    onSuccess: (data) => {
      setFormData(prev => ({
        ...prev,
        name: toTitleCase(data.razaoSocial || data.nomeFantasia || prev.name),
        email: (data.email || prev.email || '').toLowerCase(),
        phone: data.phone || prev.phone,
        address: toTitleCase(data.address || prev.address),
        addressNumber: data.addressNumber || prev.addressNumber,
        city: toTitleCase(data.city || prev.city),
        state: (data.state || prev.state || '').toUpperCase(),
        zipCode: data.zipCode || prev.zipCode,
        type: 'COMPANY',
      }));
    },
  });

  const handleCepSearch = () => handleCepSearchFetch(formData.zipCode);
  const handleCnpjSearch = () => handleCnpjSearchFetch(formData.document);

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
      // Normalizar campos de pagamento (strings vazias → undefined)
      const payload: any = {
        ...formData,
        paymentTerms: formData.paymentMode === 'DAYS_AFTER' && formData.paymentTerms !== ''
          ? Number(formData.paymentTerms)
          : undefined,
        paymentDayOfMonth: formData.paymentMode === 'MONTH_DAY' && formData.paymentDayOfMonth !== ''
          ? Number(formData.paymentDayOfMonth)
          : null,
        defaultPaymentMethodId: formData.defaultPaymentMethodId || null
      };

      if (editingFornecedor) {
        await api.put(`/api/profiles/${editingFornecedor.id}`, payload);
        toast.success('Fornecedor atualizado com sucesso!');
      } else {
        await api.post('/api/profiles', payload);
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
      isEmployee: (fornecedor as any).isEmployee || false,
      paymentMode: (fornecedor as any).paymentMode || 'ON_PURCHASE',
      paymentTerms: (fornecedor as any).paymentTerms ?? '',
      paymentDayOfMonth: (fornecedor as any).paymentDayOfMonth ?? '',
      defaultPaymentMethodId: (fornecedor as any).defaultPaymentMethodId ?? ''
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
      isEmployee: false,
      paymentMode: 'ON_PURCHASE',
      paymentTerms: '',
      paymentDayOfMonth: '',
      defaultPaymentMethodId: ''
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
          <h1 className="text-display">Fornecedores</h1>
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
        <ModalPortal>
          <Card className="modal-content-card max-w-5xl">
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
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-5 space-y-2">
                    <label className="text-sm font-medium">Nome / Razão Social *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="md:col-span-3 space-y-2">
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

                  <div className="md:col-span-4 space-y-2">
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

                  <div className="md:col-span-5 space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@fornecedor.com"
                    />
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <label className="text-sm font-medium">Telefone</label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div className="md:col-span-4 space-y-2">
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

                  <div className="md:col-span-6 space-y-2">
                    <label className="text-sm font-medium">Endereço</label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Rua, Avenida, etc."
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Número</label>
                    <Input
                      value={formData.addressNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, addressNumber: e.target.value }))}
                      placeholder="Nº"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-sm font-medium">Cidade</label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-1 space-y-2">
                    <label className="text-sm font-medium">Estado</label>
                    <Input
                      value={formData.state}
                      onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                      placeholder="UF"
                    />
                  </div>

                  {/* Papéis no Sistema */}
                  <div className={`${formData.isSupplier ? 'md:col-span-5' : 'md:col-span-12'} space-y-2 border-t pt-3 mt-1`}>
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

                  {/* Forma de Pagamento ao Fornecedor */}
                  {formData.isSupplier && (
                    <div className="md:col-span-7 border-t pt-3 mt-1">
                      <div className="space-y-3 p-4 bg-blue-50/40 rounded-xl border border-blue-100">
                        <label className="text-sm font-bold text-blue-700 block">Forma de Pagamento ao Fornecedor</label>
                        <div className="grid grid-cols-2 gap-3">
                          <select
                            value={formData.paymentMode}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              paymentMode: e.target.value as any,
                              paymentTerms: '',
                              paymentDayOfMonth: ''
                            }))}
                            className="h-10 px-3 rounded-lg border border-blue-200 bg-white text-sm font-medium"
                          >
                            <option value="ON_PURCHASE">Na hora da retirada</option>
                            <option value="DAYS_AFTER">A cada X dias após a compra</option>
                            <option value="MONTH_DAY">Dia fixo do mês</option>
                            <option value="END_OF_MONTH">No fim do mês</option>
                          </select>
                          {formData.paymentMode === 'DAYS_AFTER' && (
                            <Input
                              type="number"
                              min="1"
                              placeholder="Ex: 30 dias"
                              value={formData.paymentTerms as any}
                              onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                            />
                          )}
                          {formData.paymentMode === 'MONTH_DAY' && (
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              placeholder="Ex: 10 (dia 10)"
                              value={formData.paymentDayOfMonth as any}
                              onChange={(e) => setFormData(prev => ({ ...prev, paymentDayOfMonth: e.target.value }))}
                            />
                          )}
                          <div className="col-span-2">
                            <label className="text-[11px] font-bold uppercase text-blue-700 block mb-1">Método de Pagamento</label>
                            <select
                              value={formData.defaultPaymentMethodId}
                              onChange={(e) => setFormData(prev => ({ ...prev, defaultPaymentMethodId: e.target.value }))}
                              className="w-full h-10 px-3 rounded-lg border border-blue-200 bg-white text-sm font-medium"
                            >
                              <option value="">— selecione (Dinheiro, Pix, Cartão...) —</option>
                              {paymentMethods.map(pm => (
                                <option key={pm.id} value={pm.id}>{pm.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                          {formData.paymentMode === 'ON_PURCHASE' && '✓ Pagamento imediato — conta a pagar nasce QUITADA.'}
                          {formData.paymentMode === 'DAYS_AFTER' && '✓ Conta a pagar PENDENTE com vencimento em N dias após a compra.'}
                          {formData.paymentMode === 'MONTH_DAY' && '✓ Conta a pagar PENDENTE com vencimento no dia escolhido do mês.'}
                          {formData.paymentMode === 'END_OF_MONTH' && '✓ Conta a pagar PENDENTE com vencimento no último dia do mês corrente.'}
                        </p>
                      </div>
                    </div>
                  )}
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
        </ModalPortal>
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
