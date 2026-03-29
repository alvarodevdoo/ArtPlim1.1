import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Edit, Trash, CreditCard, Banknote, DollarSign, Wallet, ArrowDown } from 'lucide-react';
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
        installmentFees?: { installment: number; fee: number }[];
        brands?: {
            name: string;
            installmentFees?: { installment: number; fee: number }[];
        }[];
    };
    accountId?: string | null;
    account?: { id: string; name: string };
    feeCategoryId?: string | null;
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
    const [categories, setCategories] = useState<{ id: string, name: string, type: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [type, setType] = useState('PIX');
    const [accountId, setAccountId] = useState('');
    const [feePercentage, setFeePercentage] = useState('0');
    const [feeCategoryId, setFeeCategoryId] = useState('');
    const [maxInstallments, setMaxInstallments] = useState('1');
    const [interestFreeInstallments, setInterestFreeInstallments] = useState('1');
    const [installmentFees, setInstallmentFees] = useState<{ installment: number; fee: number }[]>([]);
    const [brands, setBrands] = useState<{ name: string; installmentFees?: { installment: number; fee: number }[] }[]>([]);
    const [activeBrandIndex, setActiveBrandIndex] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [methodsRes, accountsRes, categoriesRes] = await Promise.all([
                api.get('/api/payment-methods'),
                api.get('/api/finance/accounts'),
                api.get('/api/finance/categories')
            ]);
            setMethods(methodsRes.data.data);
            setAccounts(accountsRes.data.data);
            setCategories(categoriesRes.data.data.filter((c: any) => c.active));
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
            setFeeCategoryId(method.feeCategoryId || '');
            setMaxInstallments(String(method.installmentRules?.maxInstallments || 1));
            setInterestFreeInstallments(String(method.installmentRules?.interestFreeInstallments || 1));
            setInstallmentFees(method.installmentRules?.installmentFees || []);
            setBrands(method.installmentRules?.brands || []);
            setActiveBrandIndex(null);
        } else {
            setEditingMethod(null);
            setName('');
            setType('PIX');
            setAccountId('');
            setFeePercentage('0');
            setFeeCategoryId('');
            setMaxInstallments('1');
            setInterestFreeInstallments('1');
            setInstallmentFees([]);
            setBrands([]);
            setActiveBrandIndex(null);
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
                feeCategoryId: feeCategoryId || null,
                installmentRules: type === 'CARD' ? {
                    maxInstallments: Number(maxInstallments),
                    interestFreeInstallments: Number(interestFreeInstallments),
                    installmentFees: installmentFees.length > 0 ? installmentFees : undefined,
                    brands: brands.length > 0 ? brands : undefined
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
                        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 animate-in slide-in-from-bottom-5 overflow-y-auto max-h-[90vh]">
                            <h3 className="text-lg font-bold mb-4">{editingMethod ? 'Editar Método' : 'Novo Método de Pagamento'}</h3>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-medium">Nome</label>
                                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pix, Cartão Visa..." required />
                                    </div>

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
                                    <div>
                                        <label className="text-sm font-medium">Categoria p/ Taxas</label>
                                        <select
                                            value={feeCategoryId}
                                            onChange={e => setFeeCategoryId(e.target.value)}
                                            className="w-full h-10 px-3 border rounded-md"
                                        >
                                            <option value="">Nenhuma (Padrão)</option>
                                            {categories.filter(c => c.type === 'EXPENSE').map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {type === 'CARD' && (
                                    <div className="space-y-6">
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

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border h-fit">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm font-bold text-slate-700">Bandeiras Aceitas</label>
                                                    <Button 
                                                        type="button" 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-7 text-xs"
                                                        onClick={() => {
                                                            const name = prompt('Nome da Bandeira (ex: Visa, Master, Elo):');
                                                            if (name) setBrands([...brands, { name, installmentFees: [] }]);
                                                        }}
                                                    >
                                                        <Plus className="w-3 h-3 mr-1" /> Add
                                                    </Button>
                                                </div>
                                                
                                                <div className="flex flex-wrap gap-2">
                                                    <Button 
                                                        type="button"
                                                        variant={activeBrandIndex === null ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-8 text-xs w-full justify-start"
                                                        onClick={() => setActiveBrandIndex(null)}
                                                    >
                                                        Taxas Gerais
                                                    </Button>
                                                    {brands.map((brand, idx) => (
                                                        <div key={idx} className="flex items-center w-full">
                                                            <Button 
                                                                type="button"
                                                                variant={activeBrandIndex === idx ? "default" : "outline"}
                                                                size="sm"
                                                                className="h-8 text-xs rounded-r-none border-r-0 flex-1 justify-start overflow-hidden"
                                                                onClick={() => setActiveBrandIndex(idx)}
                                                            >
                                                                {brand.name}
                                                            </Button>
                                                            <Button 
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 rounded-l-none text-red-400 hover:text-red-600 border-l-0"
                                                                onClick={() => {
                                                                    if (confirm(`Remover bandeira ${brand.name}?`)) {
                                                                        const newBrands = brands.filter((_, i) => i !== idx);
                                                                        setBrands(newBrands);
                                                                        if (activeBrandIndex === idx) setActiveBrandIndex(null);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-3 p-4 bg-blue-50/50 rounded-lg border border-blue-100 h-fit">
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-sm font-bold text-blue-900 truncate">
                                                        {activeBrandIndex !== null ? brands[activeBrandIndex].name : 'Taxas Gerais'}
                                                    </label>
                                                    <Button 
                                                        type="button" 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-7 text-[10px] px-2"
                                                        onClick={() => {
                                                            const fees = [];
                                                            for (let i = 1; i <= Number(maxInstallments); i++) {
                                                                fees.push({ installment: i, fee: Number(feePercentage) });
                                                            }
                                                            if (activeBrandIndex !== null) {
                                                                const newBrands = [...brands];
                                                                newBrands[activeBrandIndex].installmentFees = fees;
                                                                setBrands(newBrands);
                                                            } else {
                                                                setInstallmentFees(fees);
                                                            }
                                                        }}
                                                    >
                                                        Gerar Base
                                                    </Button>
                                                </div>
                                                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                                                    {Array.from({ length: Number(maxInstallments) }).map((_, idx) => {
                                                        const inst = idx + 1;
                                                        const currentFeesList = activeBrandIndex !== null ? (brands[activeBrandIndex].installmentFees || []) : installmentFees;
                                                        const currentFee = currentFeesList.find(f => f.installment === inst)?.fee ?? feePercentage;
                                                        return (
                                                            <div key={inst} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded border border-blue-100 shadow-sm">
                                                                <span className="text-xs font-bold text-slate-500 w-6">{inst}x</span>
                                                                <div className="flex items-center gap-1.5 flex-1 justify-end">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        className="w-16 h-7 px-1.5 border rounded text-xs text-right font-mono"
                                                                        value={currentFee}
                                                                        onChange={(e) => {
                                                                            const newFee = Number(e.target.value);
                                                                            if (activeBrandIndex !== null) {
                                                                                const newBrands = [...brands];
                                                                                const brandFees = [...(newBrands[activeBrandIndex].installmentFees || [])];
                                                                                const feeIdx = brandFees.findIndex(f => f.installment === inst);
                                                                                if (feeIdx > -1) brandFees[feeIdx].fee = newFee;
                                                                                else brandFees.push({ installment: inst, fee: newFee });
                                                                                newBrands[activeBrandIndex].installmentFees = brandFees;
                                                                                setBrands(newBrands);
                                                                            } else {
                                                                                const newFees = [...installmentFees];
                                                                                const feeIdx = newFees.findIndex(f => f.installment === inst);
                                                                                if (feeIdx > -1) newFees[feeIdx].fee = newFee;
                                                                                else newFees.push({ installment: inst, fee: newFee });
                                                                                setInstallmentFees(newFees);
                                                                            }
                                                                        }}
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0 text-blue-400"
                                                                        onClick={() => {
                                                                            if (activeBrandIndex !== null) {
                                                                                const newBrands = [...brands];
                                                                                const brandFees = [...(newBrands[activeBrandIndex].installmentFees || [])];
                                                                                for (let i = inst + 1; i <= Number(maxInstallments); i++) {
                                                                                    const idxToUpdate = brandFees.findIndex(f => f.installment === i);
                                                                                    if (idxToUpdate > -1) brandFees[idxToUpdate].fee = currentFee as number;
                                                                                    else brandFees.push({ installment: i, fee: currentFee as number });
                                                                                }
                                                                                newBrands[activeBrandIndex].installmentFees = brandFees;
                                                                                setBrands(newBrands);
                                                                            } else {
                                                                                const newFees = [...installmentFees];
                                                                                for (let i = inst + 1; i <= Number(maxInstallments); i++) {
                                                                                    const idxToUpdate = newFees.findIndex(f => f.installment === i);
                                                                                    if (idxToUpdate > -1) newFees[idxToUpdate].fee = currentFee as number;
                                                                                    else newFees.push({ installment: i, fee: currentFee as number });
                                                                                }
                                                                                setInstallmentFees(newFees);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <ArrowDown className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-blue-600 italic leading-relaxed">
                                            O sistema usará a Taxa Base ({feePercentage}%) para parcelas que não estiverem na lista.
                                        </p>
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
