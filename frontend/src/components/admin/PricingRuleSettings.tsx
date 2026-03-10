import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Edit2, Trash2, Plus, Check } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface PricingRule {
    id: string;
    name: string;
    type: 'UNIT' | 'SQUARE_METER' | 'TIME_AREA';
    formula: {
        material: boolean;
        machineTime: boolean;
        labor: boolean;
        fixedCost: boolean;
        profit: boolean;
    };
    config?: any;
    active: boolean;
}

const PricingRuleSettings: React.FC = () => {
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<PricingRule>>({
        name: '',
        type: 'UNIT',
        formula: {
            material: false,
            machineTime: false,
            labor: false,
            fixedCost: false,
            profit: true
        },
        active: true
    });
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/catalog/pricing-rules');
            setRules(response.data.data);
        } catch (error) {
            toast.error('Erro ao carregar regras de precificação');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setFormData({
            name: '',
            type: 'UNIT',
            formula: {
                material: false,
                machineTime: false,
                labor: false,
                fixedCost: false,
                profit: true
            },
            active: true
        });
        setIsCreating(true);
        setEditingId(null);
    };

    const handleEdit = (rule: PricingRule) => {
        setEditingId(rule.id);
        setFormData(rule);
        setIsCreating(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta regra?')) return;
        try {
            await api.delete(`/api/catalog/pricing-rules/${id}`);
            toast.success('Regra removida');
            loadRules();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao remover regra');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/api/catalog/pricing-rules/${editingId}`, formData);
                toast.success('Regra atualizada');
            } else {
                await api.post('/api/catalog/pricing-rules', formData);
                toast.success('Regra criada');
            }
            setEditingId(null);
            setIsCreating(false);
            loadRules();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao salvar regra');
        }
    };

    const toggleFormulaComponent = (component: keyof PricingRule['formula']) => {
        setFormData(prev => ({
            ...prev,
            formula: {
                ...prev.formula!,
                [component]: !prev.formula![component]
            }
        }));
    };

    const renderForm = () => (
        <div className="bg-slate-50 p-4 rounded-lg border mb-4">
            <h4 className="font-medium mb-4">{editingId ? 'Editar Regra' : 'Nova Regra de Precificação'}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium">Nome</label>
                        <Input
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ex: Corte Laser, Adesivo em Metro"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Tipo Base</label>
                        <select
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                            className="w-full h-10 px-3 border rounded-md"
                        >
                            <option value="UNIT">Por Unidade (Simples)</option>
                            <option value="SQUARE_METER">Por Metro Quadrado (Área)</option>
                            <option value="TIME_AREA">Por Tempo + Área (Máquina)</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">Define as variáveis base (Largura/Altura vs. Qtd)</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded border">
                    <label className="text-sm font-medium mb-2 block">Componentes da Fórmula (O que compõe o preço?)</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                            { key: 'material', label: 'Custo de Material' },
                            { key: 'machineTime', label: 'Tempo de Máquina' },
                            { key: 'labor', label: 'Mão de Obra' },
                            { key: 'fixedCost', label: 'Custo Fixo / Setup' },
                            { key: 'profit', label: 'Lucro / Markup' },
                        ].map(({ key, label }) => (
                            <div
                                key={key}
                                onClick={() => toggleFormulaComponent(key as any)}
                                className={`
                                    cursor-pointer px-3 py-2 rounded-md border text-sm flex items-center gap-2 transition-colors
                                    ${formData.formula?.[key as keyof PricingRule['formula']]
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}
                                `}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${formData.formula?.[key as keyof typeof formData.formula] ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>
                                    {formData.formula?.[key as keyof typeof formData.formula] && <Check className="w-3 h-3 text-white" />}
                                </div>
                                {label}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => { setIsCreating(false); setEditingId(null); }}>Cancelar</Button>
                    <Button type="submit">Salvar</Button>
                </div>
            </form>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Regras de Precificação</h3>
                    <p className="text-sm text-gray-500">Defina como seus produtos e serviços são cobrados.</p>
                </div>
                {!isCreating && !editingId && (
                    <Button onClick={handleCreate}>
                        <Plus className="w-4 h-4 mr-2" /> Nova Regra
                    </Button>
                )}
            </div>

            {(isCreating || editingId) && renderForm()}

            <div className="space-y-2">
                {loading ? (
                    <div>Carregando...</div>
                ) : (
                    rules.map(rule => (
                        <div key={rule.id} className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow">
                            <div>
                                <div className="font-medium flex items-center gap-2">
                                    {rule.name}
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600 border">{rule.type}</span>
                                </div>
                                <div className="text-xs text-gray-500 flex gap-1 mt-1">
                                    {Object.entries(rule.formula || {})
                                        .filter(([_, active]) => active)
                                        .map(([key]) => (
                                            <span key={key} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                                {key === 'machineTime' ? 'Máquina' : key === 'fixedCost' ? 'Fixos' : key}
                                            </span>
                                        ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" onClick={() => handleEdit(rule)}><Edit2 className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(rule.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default PricingRuleSettings;
