import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Save, UserCheck, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface FieldConfig {
    key: string;
    label: string;
    description: string;
    alwaysRequired?: boolean;
    group: string;
}

const CUSTOMER_FIELDS: FieldConfig[] = [
    // Identificação
    { key: 'name',                 label: 'Nome / Razão Social',     description: 'Nome completo ou razão social da empresa',          alwaysRequired: true, group: 'Identificação' },
    { key: 'document',             label: 'CPF / CNPJ',              description: 'Documento fiscal do cliente',                       group: 'Identificação' },
    { key: 'tradeName',            label: 'Nome Fantasia',            description: 'Nome fantasia (para empresas)',                     group: 'Identificação' },
    { key: 'stateRegistration',    label: 'Inscrição Estadual (IE)',  description: 'Inscrição Estadual para emissão de NF-e',           group: 'Identificação' },
    { key: 'municipalRegistration',label: 'Inscrição Municipal (IM)', description: 'Inscrição Municipal para emissão de NFS-e',         group: 'Identificação' },
    // Contato
    { key: 'phone',                label: 'Telefone',                 description: 'Telefone principal de contato',                    group: 'Contato' },
    { key: 'email',                label: 'E-mail',                   description: 'Endereço de e-mail',                               group: 'Contato' },
    // Endereço
    { key: 'address',              label: 'Logradouro',               description: 'Rua, avenida, etc.',                               group: 'Endereço' },
    { key: 'addressNumber',        label: 'Número',                   description: 'Número do endereço',                               group: 'Endereço' },
    { key: 'addressComplement',    label: 'Complemento',              description: 'Apto, sala, bloco, etc.',                          group: 'Endereço' },
    { key: 'neighborhood',         label: 'Bairro',                   description: 'Bairro do endereço',                               group: 'Endereço' },
    { key: 'city',                 label: 'Cidade',                   description: 'Município',                                        group: 'Endereço' },
    { key: 'state',                label: 'Estado (UF)',              description: 'Unidade Federativa',                               group: 'Endereço' },
    { key: 'zipCode',              label: 'CEP',                      description: 'Código de Endereçamento Postal',                   group: 'Endereço' },
];

const GROUPS = ['Identificação', 'Contato', 'Endereço'];

export const CustomerFieldSettings: React.FC = () => {
    const [required, setRequired] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        api.get('/api/organization/settings')
            .then(res => {
                const fields = res.data.data?.requiredCustomerFields;
                setRequired(Array.isArray(fields) ? fields : []);
            })
            .catch(() => toast.error('Erro ao carregar configurações'))
            .finally(() => setLoading(false));
    }, []);

    const toggle = (key: string) => {
        setRequired(prev => {
            const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
            setDirty(true);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/api/organization/settings', { requiredCustomerFields: required });
            toast.success('Campos obrigatórios salvos');
            setDirty(false);
        } catch {
            toast.error('Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6 text-center text-gray-400">Carregando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-blue-600" />
                        Campos Obrigatórios no Cadastro de Clientes
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Clique nos campos para definir quais são obrigatórios ao cadastrar ou editar um cliente.
                    </p>
                </div>
                <Button onClick={handleSave} disabled={saving || !dirty} size="sm">
                    <Save className="w-4 h-4 mr-1.5" />
                    {saving ? 'Salvando...' : 'Salvar'}
                </Button>
            </div>

            {required.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider w-full mb-1">
                        {required.length} campo(s) obrigatório(s):
                    </span>
                    {required.map(k => {
                        const f = CUSTOMER_FIELDS.find(x => x.key === k);
                        return f ? (
                            <span key={k} className="bg-blue-100 text-blue-800 border border-blue-300 text-xs px-2 py-0.5 rounded-full font-medium">
                                {f.label}
                            </span>
                        ) : null;
                    })}
                </div>
            )}

            <div className="space-y-4">
                {GROUPS.map(group => (
                    <Card key={group}>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                                {group}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {CUSTOMER_FIELDS.filter(f => f.group === group).map(field => {
                                    const isRequired = field.alwaysRequired || required.includes(field.key);
                                    const isFixed = !!field.alwaysRequired;
                                    return (
                                        <button
                                            key={field.key}
                                            onClick={() => !isFixed && toggle(field.key)}
                                            disabled={isFixed}
                                            className={`
                                                flex items-start gap-3 p-3 rounded-lg border text-left transition-all
                                                ${isRequired
                                                    ? 'border-blue-400 bg-blue-50'
                                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}
                                                ${isFixed ? 'cursor-default opacity-80' : 'cursor-pointer'}
                                            `}
                                        >
                                            <div className={`
                                                mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors
                                                ${isRequired ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}
                                            `}>
                                                {isRequired && (
                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-medium ${isRequired ? 'text-blue-900' : 'text-gray-700'}`}>
                                                    {field.label}
                                                    {isFixed && (
                                                        <span className="ml-1.5 text-[10px] text-blue-500 font-bold uppercase tracking-wide">sempre obrigatório</span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                    Campos marcados como obrigatórios serão validados ao salvar um cliente.
                    O campo "Nome" é sempre obrigatório e não pode ser desmarcado.
                </p>
            </div>
        </div>
    );
};
