import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { Building2, MapPin } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { toTitleCaseBR } from '@/services/lookup';
import { useCepLookup } from '@/hooks/useCepLookup';
import { useCnpjLookup } from '@/hooks/useCnpjLookup';
import { NFeData } from '../types';

interface NFeSupplierRegistrationModalProps {
  nfeData: NFeData;
  onCancel: () => void;
  onCreated: () => void;
}

interface SupplierFormState {
  name: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  addressNumber: string;
  city: string;
  state: string;
  zipCode: string;
  type: 'INDIVIDUAL' | 'COMPANY';
  isCustomer: boolean;
  isSupplier: boolean;
  isEmployee: boolean;
  paymentMode: 'ON_PURCHASE' | 'DAYS_AFTER' | 'MONTH_DAY' | 'END_OF_MONTH';
  paymentTerms: string | number;
  paymentDayOfMonth: string | number;
  defaultPaymentMethodId: string;
}

const buildInitialForm = (nfeData: NFeData): SupplierFormState => {
  const endereco = nfeData.emitente.endereco || {};
  const rawDoc = String(nfeData.emitente.cnpj ?? '');
  const cnpj = rawDoc.replace(/\D/g, '');
  return {
    name: toTitleCaseBR(nfeData.emitente.nomeFantasia || nfeData.emitente.razaoSocial || ''),
    document: rawDoc,
    email: '',
    phone: endereco.telefone ? String(endereco.telefone) : '',
    address: toTitleCaseBR(endereco.logradouro || ''),
    addressNumber: endereco.numero ? String(endereco.numero) : '',
    city: toTitleCaseBR(endereco.cidade || ''),
    state: (endereco.uf || '').toUpperCase(),
    zipCode: endereco.cep ? String(endereco.cep) : '',
    type: cnpj.length === 11 ? 'INDIVIDUAL' : 'COMPANY',
    isCustomer: false,
    isSupplier: true,
    isEmployee: false,
    paymentMode: 'ON_PURCHASE',
    paymentTerms: '',
    paymentDayOfMonth: '',
    defaultPaymentMethodId: '',
  };
};

export const NFeSupplierRegistrationModal: React.FC<NFeSupplierRegistrationModalProps> = ({
  nfeData,
  onCancel,
  onCreated,
}) => {
  const [formData, setFormData] = useState<SupplierFormState>(() => buildInitialForm(nfeData));
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const resp = await api.get('/api/payment-methods?scope=PURCHASES');
        const list = resp.data?.data || resp.data || [];
        setPaymentMethods(Array.isArray(list) ? list.map((m: any) => ({ id: m.id, name: m.name, type: m.type })) : []);
      } catch (e) {
        // silencioso – métodos de pagamento são opcionais
      }
    })();
  }, []);

  const { fetch: handleCepSearchFetch } = useCepLookup({
    onSuccess: (data) => {
      setFormData(prev => ({
        ...prev,
        address: toTitleCaseBR(data.address),
        city: toTitleCaseBR(data.city),
        state: (data.state || '').toUpperCase(),
      }));
    },
  });

  const { fetch: handleCnpjSearchFetch } = useCnpjLookup({
    onSuccess: (data) => {
      setFormData(prev => ({
        ...prev,
        name: toTitleCaseBR(data.razaoSocial || data.nomeFantasia || prev.name),
        email: (data.email || prev.email || '').toLowerCase(),
        phone: data.phone || prev.phone,
        address: toTitleCaseBR(data.address || prev.address),
        addressNumber: data.addressNumber || prev.addressNumber,
        city: toTitleCaseBR(data.city || prev.city),
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
    if (cleanValue.length === 14) newType = 'COMPANY';
    else if (cleanValue.length === 11) newType = 'INDIVIDUAL';
    setFormData(prev => ({ ...prev, document: value, type: newType }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: any = {
        ...formData,
        paymentTerms: formData.paymentMode === 'DAYS_AFTER' && formData.paymentTerms !== ''
          ? Number(formData.paymentTerms)
          : undefined,
        paymentDayOfMonth: formData.paymentMode === 'MONTH_DAY' && formData.paymentDayOfMonth !== ''
          ? Number(formData.paymentDayOfMonth)
          : null,
        defaultPaymentMethodId: formData.defaultPaymentMethodId || null,
      };
      await api.post('/api/profiles', payload);
      toast.success('Fornecedor cadastrado com sucesso!');
      onCreated();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error?.message || 'Erro ao salvar fornecedor';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <Card className="modal-content-card max-w-5xl">
        <CardHeader>
          <CardTitle>Cadastrar Fornecedor da NF-e</CardTitle>
          <CardDescription>
            Este fornecedor ainda não está cadastrado. Confirme os dados extraídos da nota antes de prosseguir
            para o mapeamento dos itens.
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
                    placeholder={formData.type === 'INDIVIDUAL' ? '000.000.000-00' : '00.000.000/0000-00'}
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
                        isEmployee: e.target.checked ? false : prev.isEmployee,
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
                        isSupplier: e.target.checked ? false : prev.isSupplier,
                      }))}
                      className="rounded border-input h-4 w-4"
                    />
                    <span className="text-sm">Colaborador</span>
                  </label>
                </div>
              </div>

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
                          paymentDayOfMonth: '',
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
              <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar e Continuar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </ModalPortal>
  );
};
