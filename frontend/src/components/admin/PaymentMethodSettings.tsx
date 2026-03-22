import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Edit, Trash, CreditCard, Banknote, DollarSign, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface PaymentMethod {
    id: string;
    name: string;
    type: 'PIX' | 'CARD' | 'CASH' | 'TRANSFER' | 'BOLETO' | 'OTHER';
    feePercentage: number;
    installmentRules?: {
        maxInstallments: number;
        interestFreeInstallments: number;
    };
    accountId?: string | null;
    account?: { id: string; name: string };
    active: boolean;
}

interface Account {
    id: string;
    name: string;
    type: string;
    balance: string | number;
}

const PaymentMethodSettings: React.FC = () => {
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [type, setType] = useState('PIX');
    const [accountId, setAccountId] = useState('');
    const [feePercentage, setFeePercentage] = useState('0');
    const [maxInstallments, setMaxInstallments] = useState('1');
    const [interestFreeInstallments, setInterestFreeInstallments] = useState('1');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [methodsRes, accountsRes] = await Promise.all([
                api.get('/api/payment-methods'),
                api.get('/api/finance/accounts')
            ]);
            setMethods(methodsRes.data.data);
            setAccounts(accountsRes.data.data);
        } catch (error) {
            toast.error('Erro ao carregar dados');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (method?: PaymentMethod) => {
        if (method) {
            setEditingMethod(method);
            setName(method.name);
            setType(method.type);
            setAccountId(method.accountId || '');
            setFeePercentage(String(method.feePercentage));
            setMaxInstallments(String(method.installmentRules?.maxInstallments || 1));
            setInterestFreeInstallments(String(method.installmentRules?.interestFreeInstallments || 1));
        } else {
            setEditingMethod(null);
            setName('');
            setType('PIX');
            setAccountId('');
            setFeePercentage('0');
            setMaxInstallments('1');
            setInterestFreeInstallments('1');
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name,
                type,
                accountId: accountId || null,
                feePercentage: Number(feePercentage),
                installmentRules: type === 'CARD' ? {
                    maxInstallments: Number(maxInstallments),
                    interestFreeInstallments: Number(interestFreeInstallments)
                } : undefined
            };

            if (editingMethod) {
                await api.put(`/api/payment-methods/${editingMethod.id}`, payload);
                toast.success('Método atualizado com sucesso');
            } else {
                await api.post('/api/payment-methods', payload);
                toast.success('Método criado com sucesso');
            }

            setIsModalOpen(false);
            loadData();
        } catch (error) {
            toast.error('Erro ao salvar método de pagamento');
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este método?')) return;
        try {
            await api.delete(`/api/payment-methods/${id}`);
            toast.success('Método removido com sucesso');
            loadData();
        } catch (error) {
            toast.error('Erro ao remover método. Tente desativá-lo.');
        }
    };

    const handleToggleStatus = async (id: string) => {
        try {
            await api.patch(`/api/payment-methods/${id}/toggle-status`);
            toast.success('Status atualizado');
            loadData();
        } catch (error) {
            toast.error('Erro ao atualizar status');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'PIX': return <DollarSign className="w-5 h-5 text-green-600" />;
            case 'CARD': return <CreditCard className="w-5 h-5 text-blue-600" />;
            case 'CASH': return <Banknote className="w-5 h-5 text-green-800" />;
            default: return <Wallet className="w-5 h-5 text-gray-600" />;
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Métodos de Pagamento</CardTitle>
                    <CardDescription>Configure as formas de pagamento aceitas e suas taxas</CardDescription>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Método
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="py-8 text-center text-muted-foreground">Carregando...</div>
                ) : methods.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed rounded-lg bg-slate-50">
                        <h3 className="text-lg font-medium text-slate-900">Nenhum método cadastrado</h3>
                        <p className="text-slate-500 mb-4">Comece adicionando uma forma de pagamento</p>
                        <Button onClick={() => handleOpenModal()} variant="outline">Adicionar Agora</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {methods.map((method) => (
                            <div key={method.id} className={`flex items-center justify-between p-4 border rounded-lg ${!method.active ? 'opacity-60 bg-slate-50' : 'bg-white'}`}>
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-slate-100 rounded-full">
                                        {getIcon(method.type)}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                            {method.name}
                                            {!method.active && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Inativo</span>}
                                        </h4>
                                        <p className="text-sm text-slate-500">
                                            Taxa: {Number(method.feePercentage).toFixed(2)}% •
                                            {method.type === 'CARD'
                                                ? ` Até ${method.installmentRules?.maxInstallments}x`
                                                : ' À vista'}
                                            {method.account && ` • Conta: ${method.account.name}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(method.id)}>
                                        {method.active ? 'Desativar' : 'Ativar'}
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(method)}>
                                        <Edit className="w-4 h-4 text-slate-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(method.id)}>
                                        <Trash className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal Simplificado (Inline por enquanto) */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in slide-in-from-bottom-5">
                            <h3 className="text-lg font-bold mb-4">{editingMethod ? 'Editar Método' : 'Novo Método de Pagamento'}</h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium">Nome</label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pix, Cartão Visa..." required />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium">Tipo</label>
                                        <select
                                            value={type}
                                            onChange={e => setType(e.target.value)}
                                            className="w-full h-10 px-3 border rounded-md"
                                        >
                                            <option value="PIX">Pix</option>
                                            <option value="CARD">Cartão de Crédito/Débito</option>
                                            <option value="BOLETO">Boleto</option>
                                            <option value="CASH">Dinheiro</option>
                                            <option value="TRANSFER">Transferência</option>
                                            <option value="OTHER">Outro</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Conta de Destino</label>
                                        <select
                                            value={accountId}
                                            onChange={e => setAccountId(e.target.value)}
                                            className="w-full h-10 px-3 border rounded-md"
                                        >
                                            <option value="">Padrão (Primeira Conta Ativa)</option>
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Taxa (%)</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={feePercentage}
                                            onChange={e => setFeePercentage(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {type === 'CARD' && (
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border">
                                        <div>
                                            <label className="text-xs font-medium uppercase text-slate-500">Max. Parcelas</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="24"
                                                value={maxInstallments}
                                                onChange={e => setMaxInstallments(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium uppercase text-slate-500">Sem Juros Até</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max={maxInstallments}
                                                value={interestFreeInstallments}
                                                onChange={e => setInterestFreeInstallments(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 mt-6">
                                    <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                                    <Button type="submit">Salvar</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default PaymentMethodSettings;
