import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
    User, Search, CheckCircle, UserX, Receipt, X, Building2, FileText,
    MapPin, Phone, Mail, Edit2, Save, Users, Star, Trash2, ChevronDown, Plus, Loader2
} from 'lucide-react';
import { Cliente } from '@/types/sales';
import { CustomerBalancePopover } from './CustomerBalancePopover';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
    maskDocument as formatDocument,
    maskPhone as formatPhone,
} from '@/services/lookup';
import { useCnpjLookup } from '@/hooks/useCnpjLookup';
import { useCepLookup } from '@/hooks/useCepLookup';

interface BillingData {
    label?: string;
    name: string;
    tradeName: string;
    document: string;
    stateRegistration: string;
    municipalRegistration: string;
    email: string;
    phone: string;
    address: string;
    addressNumber: string;
    addressComplement: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    savedAt?: string;
}

const emptyBilling = (): BillingData => ({
    label: '', name: '', tradeName: '', document: '', stateRegistration: '',
    municipalRegistration: '', email: '', phone: '',
    address: '', addressNumber: '', addressComplement: '',
    neighborhood: '', city: '', state: '', zipCode: ''
});

interface CustomerSelectionProps {
    selectedCustomer: Cliente | null;
    onSelect: (customer: Cliente) => void;
    onClear: () => void;
    customers: Cliente[];
    loading: boolean;
    profileDetails?: any;
    onProfileUpdated?: () => void;
    billingOverride?: BillingData | null;
    onSaveBillingOverride?: (data: BillingData | null) => void;
}

export const CustomerSelection: React.FC<CustomerSelectionProps> = ({
    selectedCustomer,
    onSelect,
    onClear,
    customers,
    loading,
    profileDetails,
    onProfileUpdated,
    billingOverride,
    onSaveBillingOverride
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [showQuickRegister, setShowQuickRegister] = useState(false);
    const [quickForm, setQuickForm] = useState({ name: '', phone: '', document: '', email: '' });
    const [quickSaving, setQuickSaving] = useState(false);
    const [requiredFields, setRequiredFields] = useState<string[]>([]);
    const [billingMode, setBillingMode] = useState<'customer' | 'third_party'>('customer');
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveForFuture, setSaveForFuture] = useState(false);
    const [formData, setFormData] = useState<BillingData>(emptyBilling());
    const [savedContacts, setSavedContacts] = useState<BillingData[]>([]);
    const [showSavedDropdown, setShowSavedDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const profileToForm = (): BillingData => ({
        label: '',
        name: profileDetails?.name || selectedCustomer?.name || '',
        tradeName: profileDetails?.tradeName || '',
        document: profileDetails?.document || selectedCustomer?.document || '',
        stateRegistration: profileDetails?.stateRegistration || '',
        municipalRegistration: profileDetails?.municipalRegistration || '',
        email: profileDetails?.email || selectedCustomer?.email || '',
        phone: profileDetails?.phone || selectedCustomer?.phone || '',
        address: profileDetails?.address || '',
        addressNumber: profileDetails?.addressNumber || '',
        addressComplement: profileDetails?.addressComplement || '',
        neighborhood: profileDetails?.neighborhood || '',
        city: profileDetails?.city || '',
        state: profileDetails?.state || '',
        zipCode: profileDetails?.zipCode || '',
    });

    // Inicializa quando o modal abre
    useEffect(() => {
        if (!showBillingModal) return;
        const contacts = (profileDetails?.savedBillingContacts as BillingData[]) || [];
        setSavedContacts(contacts);

        const hasOverride = !!(billingOverride?.name || billingOverride?.document);
        if (hasOverride) {
            setBillingMode('third_party');
            setFormData({ ...emptyBilling(), ...billingOverride });
        } else {
            setBillingMode('customer');
            setFormData(profileToForm());
        }
        setIsEditing(false);
        setSaveForFuture(false);
    }, [showBillingModal]);

    // Atualiza form ao trocar modo
    useEffect(() => {
        if (!showBillingModal) return;
        if (billingMode === 'customer') {
            setFormData(profileToForm());
        } else {
            setFormData(billingOverride ? { ...emptyBilling(), ...billingOverride } : emptyBilling());
        }
        setIsEditing(false);
        setSaveForFuture(false);
    }, [billingMode]);

    // Carrega campos obrigatórios uma vez
    useEffect(() => {
        api.get('/api/organization/settings').then(res => {
            const fields = res.data.data?.requiredCustomerFields;
            setRequiredFields(Array.isArray(fields) ? fields : []);
        }).catch(() => {});
    }, []);

    const searchDigits = searchTerm.replace(/\D/g, '');
    const filteredCustomers = customers.filter(customer => {
        const term = searchTerm.toLowerCase();
        if (customer.name.toLowerCase().includes(term)) return true;
        if (customer.document && customer.document.replace(/\D/g, '').includes(searchDigits || term)) return true;
        if (customer.phone && customer.phone.replace(/\D/g, '').includes(searchDigits || term)) return true;
        if (customer.email && customer.email.toLowerCase().includes(term)) return true;
        return false;
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowDropdown(false);
        };
        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showDropdown]);

    const field = (key: keyof BillingData) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setFormData(prev => ({ ...prev, [key]: e.target.value }));

    const { loading: cnpjLoading, fetchDebounced: lookupCnpjDebounced } = useCnpjLookup({
        onSuccess: (data) => {
            setFormData(prev => ({
                ...prev,
                name: data.razaoSocial || prev.name,
                tradeName: data.nomeFantasia || prev.tradeName,
                document: data.cnpjFormatted,
                address: data.address || prev.address,
                addressNumber: data.addressNumber || prev.addressNumber,
                addressComplement: data.complement || prev.addressComplement,
                neighborhood: data.neighborhood || prev.neighborhood,
                city: data.city || prev.city,
                state: data.state || prev.state,
                zipCode: data.zipCode || prev.zipCode,
                phone: data.phone || prev.phone,
                email: data.email || prev.email,
            }));
        },
    });

    const { fetchDebounced: lookupCepDebounced } = useCepLookup({
        onSuccess: (data) => {
            setFormData(prev => ({
                ...prev,
                zipCode: data.cepFormatted || prev.zipCode,
                address: data.address || prev.address,
                addressComplement: data.complement || prev.addressComplement,
                neighborhood: data.neighborhood || prev.neighborhood,
                city: data.city || prev.city,
                state: data.state || prev.state,
            }));
        },
    });

    const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        const formatted = formatDocument(e.target.value);
        setFormData(prev => ({ ...prev, document: formatted }));

        // Auto-busca quando CNPJ completo (14 dígitos)
        if (raw.length === 14) {
            lookupCnpjDebounced(raw);
        }
    };

    const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
        const formatted = raw.replace(/(\d{5})(\d{1,3})/, '$1-$2');
        setFormData(prev => ({ ...prev, zipCode: formatted }));

        if (raw.length === 8) {
            lookupCepDebounced(raw);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (billingMode === 'customer') {
                await api.patch(`/api/profiles/${selectedCustomer!.id}`, formData);
                toast.success('Dados de faturamento salvos no cadastro do cliente');
                onProfileUpdated?.();
                setIsEditing(false);
                setShowBillingModal(false);
            } else {
                if (!formData.name && !formData.document) {
                    toast.error('Preencha ao menos o nome ou CPF/CNPJ do terceiro');
                    return;
                }
                // Salvar no pedido
                onSaveBillingOverride?.(formData);

                // Se marcou para salvar para uso futuro
                if (saveForFuture) {
                    const contactToSave: BillingData = {
                        ...formData,
                        label: formData.label?.trim() || formData.name || formData.document
                    };
                    await api.post(`/api/profiles/${selectedCustomer!.id}/billing-contacts`, contactToSave);
                    const updated = [...savedContacts, contactToSave];
                    setSavedContacts(updated);
                    toast.success('Contato salvo para uso futuro');
                } else {
                    toast.success('Dados de faturamento alternativos aplicados a este pedido');
                }
                setIsEditing(false);
                setSaveForFuture(false);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.response?.data?.error?.message || 'Erro ao salvar dados de faturamento');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSaved = async (index: number) => {
        try {
            await api.delete(`/api/profiles/${selectedCustomer!.id}/billing-contacts/${index}`);
            const updated = savedContacts.filter((_, i) => i !== index);
            setSavedContacts(updated);
            toast.success('Contato removido');
        } catch {
            toast.error('Erro ao remover contato');
        }
    };

    const applyContact = (contact: BillingData) => {
        setFormData({ ...emptyBilling(), ...contact });
        setShowSavedDropdown(false);
        setIsEditing(true);
        toast.info(`Contato "${contact.label || contact.name}" carregado. Salve para aplicar.`);
    };

    const handleClearOverride = () => {
        onSaveBillingOverride?.(null);
        setBillingMode('customer');
        setFormData(profileToForm());
        toast.success('Faturamento voltou para os dados do cliente');
    };

    const hasOverride = !!(billingOverride?.name || billingOverride?.document);

    const FIELD_LABELS: Record<string, string> = {
        document: 'CPF/CNPJ', phone: 'Telefone', email: 'E-mail',
        address: 'Logradouro', addressNumber: 'Número', city: 'Cidade',
        state: 'Estado', zipCode: 'CEP',
    };

    const handleQuickRegister = async () => {
        if (!quickForm.name.trim()) { toast.error('Nome é obrigatório'); return; }

        // Validar campos obrigatórios que estão no formulário rápido
        const quickFields = ['document', 'phone', 'email'];
        const missingInForm = requiredFields.filter(f => quickFields.includes(f) && !(quickForm as any)[f]?.trim());
        if (missingInForm.length > 0) {
            toast.error(`Campos obrigatórios: ${missingInForm.map(f => FIELD_LABELS[f] || f).join(', ')}`);
            return;
        }
        // Campos obrigatórios fora do formulário rápido (endereço etc.)
        const extraRequired = requiredFields.filter(f => !quickFields.includes(f) && f !== 'name');
        if (extraRequired.length > 0) {
            toast.error(`Complete no cadastro completo: ${extraRequired.map(f => FIELD_LABELS[f] || f).join(', ')}`);
        }

        setQuickSaving(true);
        try {
            const res = await api.post('/api/profiles', {
                type: quickForm.document.replace(/\D/g, '').length === 14 ? 'COMPANY' : 'INDIVIDUAL',
                name: quickForm.name.trim(),
                phone: quickForm.phone.trim() || undefined,
                document: quickForm.document.replace(/\D/g, '') || undefined,
                email: quickForm.email.trim() || undefined,
                isCustomer: true,
                isSupplier: false,
                isEmployee: false,
            });
            const newCustomer = res.data.data;
            toast.success(`Cliente "${newCustomer.name}" cadastrado!`);
            onSelect(newCustomer);
            setShowQuickRegister(false);
            setShowDropdown(false);
            setSearchTerm(newCustomer.name);
            setQuickForm({ name: '', phone: '', document: '', email: '' });
        } catch (err: any) {
            toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Erro ao cadastrar cliente');
        } finally {
            setQuickSaving(false);
        }
    };

    const renderField = (label: string, key: keyof BillingData, className = '', mono = false) => {
        const isDocumentField = key === 'document';
        const isCepField = key === 'zipCode';
        const isAutoField = isDocumentField || isCepField;
        const lookupHint = isDocumentField ? 'Consultando Receita Federal...' : 'Consultando ViaCEP...';

        return (
            <div className={className}>
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    {label}
                    {isAutoField && cnpjLoading && (
                        <span className="inline-flex items-center gap-1 text-blue-500 text-[10px]">
                            <Loader2 className="w-3 h-3 animate-spin" /> {lookupHint}
                        </span>
                    )}
                </label>
                {isEditing ? (
                    <input
                        className={`w-full border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${mono ? 'font-mono' : ''} ${isAutoField && cnpjLoading ? 'border-blue-300 bg-blue-50' : ''}`}
                        value={(formData[key] as string) || ''}
                        onChange={isDocumentField ? handleDocumentChange : isCepField ? handleCepChange : field(key)}
                        placeholder={isDocumentField ? '00.000.000/0000-00 ou 000.000.000-00' : isCepField ? '00000-000' : undefined}
                    />
                ) : (
                    <p className={`text-sm font-medium text-gray-800 min-h-[20px] ${mono ? 'font-mono' : ''}`}>
                        {(formData[key] as string) || <span className="text-gray-300">—</span>}
                    </p>
                )}
            </div>
        );
    };

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Cliente</span>
                </CardTitle>
                <CardDescription>
                    {selectedCustomer ? 'Cliente selecionado para este pedido' : 'Selecione o cliente para este pedido'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {!selectedCustomer && (
                        <div className="relative" ref={dropdownRef}>
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                                placeholder={loading ? 'Carregando clientes...' : 'Buscar cliente por nome ou documento...'}
                                value={searchTerm}
                                disabled={loading}
                                onChange={(e) => { setSearchTerm(e.target.value); if (!showDropdown) setShowDropdown(true); }}
                                onFocus={() => setShowDropdown(true)}
                                className="pl-10"
                            />
                            {showDropdown && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {filteredCustomers.length > 0 ? filteredCustomers.map(customer => (
                                        <div
                                            key={customer.id}
                                            className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={(e) => { e.stopPropagation(); onSelect(customer); setSearchTerm(customer.name); setShowDropdown(false); }}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="font-medium">{customer.name}</div>
                                                {Number(customer.balance) > 0 && (
                                                    <CustomerBalancePopover customerId={customer.id} customerName={customer.name} balance={Number(customer.balance)} />
                                                )}
                                            </div>
                                            {customer.document && <div className="text-sm text-gray-500">{customer.document}</div>}
                                            {customer.phone && <div className="text-sm text-gray-500">{customer.phone}</div>}
                                        </div>
                                    )) : (
                                        <div className="p-3 text-gray-500 text-center">
                                            {loading ? (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                                                    <span>Carregando clientes...</span>
                                                </div>
                                            ) : customers.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}
                                        </div>
                                    )}
                                    {/* Botão cadastro rápido */}
                                    {!loading && (
                                        <div className="border-t border-gray-200">
                                            <button
                                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => { setQuickForm({ name: searchTerm, phone: '', document: '', email: '' }); setShowQuickRegister(true); setShowDropdown(false); }}
                                            >
                                                <Plus className="w-4 h-4" />
                                                {searchTerm ? `Cadastrar "${searchTerm}" como novo cliente` : 'Cadastrar novo cliente'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedCustomer && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <div>
                                        <div className="flex items-center flex-wrap gap-1">
                                            <p className="font-medium text-green-800">{selectedCustomer.name}</p>
                                            {Number(selectedCustomer.balance) > 0 && (
                                                <CustomerBalancePopover customerId={selectedCustomer.id} customerName={selectedCustomer.name} balance={Number(selectedCustomer.balance)} />
                                            )}
                                            {selectedCustomer.exemptFromDeposit && (
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full border border-blue-200">ISENTO DE SINAL</span>
                                            )}
                                            {hasOverride && (
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full border border-purple-200 flex items-center gap-1">
                                                    <Users className="w-2.5 h-2.5" /> Fat. Terceiro
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-green-600">
                                            {selectedCustomer.email ? `${selectedCustomer.email} • ` : ''}{selectedCustomer.phone}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => { onClear(); setSearchTerm(''); onSaveBillingOverride?.(null); }}
                                        className="bg-white hover:bg-green-100 border-green-300 text-green-700 hover:text-green-800" title="Trocar Cliente">
                                        <UserX className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="sm"
                                        className="bg-white hover:bg-green-100 border-green-300 text-green-700 hover:text-green-800"
                                        title="Dados para Faturamento" onClick={() => setShowBillingModal(true)}>
                                        <Receipt className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>

        {showBillingModal && selectedCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-green-600" />
                            <h2 className="text-lg font-semibold">Dados para Faturamento</h2>
                        </div>
                        <button onClick={() => setShowBillingModal(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Seletor de modo */}
                    <div className="px-6 pt-4 flex-shrink-0 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                <button onClick={() => setBillingMode('customer')}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${billingMode === 'customer' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <User className="w-3.5 h-3.5 inline mr-1.5" />Cadastro do Cliente
                                </button>
                                <button onClick={() => setBillingMode('third_party')}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${billingMode === 'third_party' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <Users className="w-3.5 h-3.5 inline mr-1.5" />Terceiro / Empresa
                                </button>
                            </div>

                            {/* Contatos salvos */}
                            {billingMode === 'third_party' && savedContacts.length > 0 && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowSavedDropdown(v => !v)}
                                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 transition-colors"
                                    >
                                        <Star className="w-3.5 h-3.5" />
                                        Contatos salvos ({savedContacts.length})
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                    {showSavedDropdown && (
                                        <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-10 overflow-hidden">
                                            <div className="p-2 border-b">
                                                <p className="text-xs text-gray-500 font-medium px-1">Selecione para carregar</p>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {savedContacts.map((c, i) => (
                                                    <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 group">
                                                        <button className="flex-1 text-left" onClick={() => applyContact(c)}>
                                                            <p className="text-sm font-medium text-gray-800">{c.label || c.name}</p>
                                                            {c.document && <p className="text-xs text-gray-400 font-mono">{c.document}</p>}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSaved(i)}
                                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1 transition-opacity"
                                                            title="Remover contato salvo"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-400">
                            {billingMode === 'customer'
                                ? 'Editar aqui atualiza permanentemente o cadastro do cliente.'
                                : 'Os dados abaixo serão usados apenas neste pedido, a menos que você salve para uso futuro.'}
                        </p>
                    </div>

                    {/* Formulário */}
                    <div className="px-6 py-4 overflow-y-auto flex-1 space-y-5">

                        {billingMode === 'third_party' && isEditing && (
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Identificador / Apelido (opcional)</label>
                                <input
                                    className="w-full border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    placeholder="Ex: Empresa Principal, Filial SP..."
                                    value={formData.label || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, label: e.target.value }))}
                                />
                            </div>
                        )}

                        {/* Identificação */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" /> Identificação
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {renderField('Nome / Razão Social', 'name', 'col-span-2')}
                                {renderField('Nome Fantasia', 'tradeName', 'col-span-2')}
                                {renderField('CPF / CNPJ', 'document', '', true)}
                                {renderField('Inscrição Estadual (IE)', 'stateRegistration', '', true)}
                                {renderField('Inscrição Municipal (IM)', 'municipalRegistration', '', true)}
                            </div>
                        </div>

                        {/* Contato */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5" /> Contato
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {renderField('Telefone', 'phone')}
                                {renderField('E-mail', 'email', 'col-span-2')}
                            </div>
                        </div>

                        {/* Endereço */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" /> Endereço de Cobrança
                            </p>
                            <div className="grid grid-cols-4 gap-3">
                                {renderField('Logradouro', 'address', 'col-span-3')}
                                {renderField('Número', 'addressNumber')}
                                {renderField('Complemento', 'addressComplement', 'col-span-2')}
                                {renderField('Bairro', 'neighborhood', 'col-span-2')}
                                {renderField('Cidade', 'city', 'col-span-2')}
                                {renderField('Estado (UF)', 'state')}
                                {renderField('CEP', 'zipCode')}
                            </div>
                        </div>

                        {/* Salvar para uso futuro (só no modo terceiro, editando) */}
                        {billingMode === 'third_party' && isEditing && (
                            <label className="flex items-center gap-2 text-sm text-blue-700 cursor-pointer p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <input
                                    type="checkbox"
                                    checked={saveForFuture}
                                    onChange={e => setSaveForFuture(e.target.checked)}
                                    className="rounded"
                                />
                                <Star className="w-3.5 h-3.5 flex-shrink-0" />
                                Salvar para reutilizar em pedidos futuros deste cliente
                                {saveForFuture && !formData.label?.trim() && (
                                    <span className="text-xs text-amber-600 ml-1">(preencha o Apelido acima)</span>
                                )}
                            </label>
                        )}

                        {/* Aviso terceiro ativo */}
                        {billingMode === 'customer' && hasOverride && (
                            <div className="flex items-start justify-between gap-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                                <div className="flex items-start gap-2 text-sm text-purple-700">
                                    <Users className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <p>Este pedido está configurado para faturar para um <strong>terceiro</strong>. Para usar os dados do cliente, remova o terceiro.</p>
                                </div>
                                <button onClick={handleClearOverride} className="text-xs text-purple-600 underline whitespace-nowrap hover:text-purple-800">
                                    Remover terceiro
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between flex-shrink-0">
                        <div>
                            {!isEditing ? (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />Editar
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="text-gray-500">
                                    Cancelar edição
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowBillingModal(false)}>Fechar</Button>
                            {isEditing && (
                                <Button size="sm" onClick={handleSave} disabled={saving}>
                                    <Save className="w-3.5 h-3.5 mr-1.5" />
                                    {saving ? 'Salvando...' : billingMode === 'customer' ? 'Salvar no Cadastro' : 'Usar neste Pedido'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
        {/* Modal de Cadastro Rápido */}
        {showQuickRegister && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b">
                        <div className="flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-semibold">Cadastro Rápido de Cliente</h2>
                        </div>
                        <button onClick={() => setShowQuickRegister(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="px-6 py-5 space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Nome <span className="text-red-500">*</span>
                            </label>
                            <input
                                autoFocus
                                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="Nome completo ou razão social"
                                value={quickForm.name}
                                onChange={e => setQuickForm(p => ({ ...p, name: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleQuickRegister()}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Telefone{requiredFields.includes('phone') && <span className="text-red-500 ml-0.5">*</span>}
                                </label>
                                <input
                                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    placeholder="(00) 00000-0000"
                                    value={quickForm.phone}
                                    onChange={e => setQuickForm(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    CPF / CNPJ{requiredFields.includes('document') && <span className="text-red-500 ml-0.5">*</span>}
                                </label>
                                <input
                                    className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    placeholder="000.000.000-00"
                                    value={quickForm.document}
                                    onChange={e => setQuickForm(p => ({ ...p, document: formatDocument(e.target.value) }))}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                E-mail{requiredFields.includes('email') && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                            <input
                                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="email@exemplo.com"
                                type="email"
                                value={quickForm.email}
                                onChange={e => setQuickForm(p => ({ ...p, email: e.target.value }))}
                            />
                        </div>
                        {requiredFields.filter(f => !['name','document','phone','email'].includes(f)).length > 0 && (
                            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                                Campos obrigatórios adicionais devem ser preenchidos no cadastro completo:{' '}
                                {requiredFields.filter(f => !['name','document','phone','email'].includes(f)).map(f => FIELD_LABELS[f] || f).join(', ')}.
                            </p>
                        )}
                        <p className="text-xs text-gray-400">Complete os demais dados no cadastro completo do cliente.</p>
                    </div>

                    <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowQuickRegister(false)}>
                            Cancelar
                        </Button>
                        <Button size="sm" onClick={handleQuickRegister} disabled={quickSaving || !quickForm.name.trim() || ['phone','document','email'].filter(f => requiredFields.includes(f)).some(f => !(quickForm as any)[f]?.trim())}>
                            {quickSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Salvando...</> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Cadastrar e Selecionar</>}
                        </Button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
