import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Edit2, Trash2, Plus, Download, Upload, Clock } from 'lucide-react';
import { toast } from 'sonner';
import PricingRuleEditorModal, { PricingFormulaRule } from './pricing/PricingRuleEditorModal';
import PricingRuleHistoryModal from './pricing/PricingRuleHistoryModal';

import api from '@/lib/api';

const PricingRuleSettings: React.FC = () => {
    const [rules, setRules] = useState<PricingFormulaRule[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<PricingFormulaRule | null>(null);
    const [historyRuleId, setHistoryRuleId] = useState<string | null>(null);

    const loadRules = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/catalog/pricing-rules');
            const data = response.data.data;
            
            // Adaptar campos do backend (name -> internalName) e parse da formula se necessário
            const adaptedRules = data.map((r: any) => {
                let formulaData = r.formula;
                if (typeof formulaData === 'string') {
                    try {
                        formulaData = JSON.parse(formulaData);
                    } catch (e) {
                        formulaData = { formulaString: r.formula, variables: [] };
                    }
                }
                
                return {
                    id: r.id,
                    internalName: r.name,
                    formulaString: formulaData?.formulaString || '',
                    costFormulaString: formulaData?.costFormulaString || '',
                    variables: (formulaData?.variables || r.variables || []).map((v: any) => ({
                        ...v,
                        defaultUnit: v.defaultUnit || v.baseUnit || '',
                        allowedUnits: v.allowedUnits || [],
                        role: v.role || 'NONE'
                    })),
                    active: r.active,
                    usageCount: r._count?.orderItems || 0
                };
            });
            
            setRules(adaptedRules);
        } catch (error) {
            toast.error('Erro ao carregar regras de precificação');
        } finally {
            setLoading(false);
        }
    };

    // --- AÇÕES DO CRUD ---
    const handleCreateNew = () => {
        setEditingRule(null);
        setIsEditorOpen(true);
    };

    const handleEdit = (rule: PricingFormulaRule) => {
        setEditingRule(rule);
        setIsEditorOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta regra de cálculo?')) return;
        setLoading(true);
        try {
            await api.delete(`/api/catalog/pricing-rules/${id}`);
            toast.success('Regra removida com sucesso!');
            loadRules();
        } catch (error) {
            toast.error('Erro ao excluir regra');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRule = async (ruleData: PricingFormulaRule) => {
        setLoading(true);
        try {
            // Preparar payload para o backend
            const payload = {
                name: ruleData.internalName,
                type: 'UNIT', // Fallback ou derivar do conteúdo
                formula: {
                    formulaString: ruleData.formulaString,
                    costFormulaString: ruleData.costFormulaString,
                    variables: ruleData.variables
                },
                active: ruleData.active
            };

            if (ruleData.id) {
                await api.put(`/api/catalog/pricing-rules/${ruleData.id}`, payload);
                toast.success('Regra atualizada com sucesso!');
            } else {
                await api.post('/api/catalog/pricing-rules', payload);
                toast.success('Regra criada com sucesso!');
            }
            
            setIsEditorOpen(false);
            setEditingRule(null);
            loadRules(); // Recarregar lista
        } catch (error) {
            toast.error('Erro ao salvar regra');
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        loadRules();
    }, []);

    // --- IMPORT / EXPORT (JSON) ---
    const handleExportJSON = () => {
        const dataStr = JSON.stringify(rules, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `formulas_artplim_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        toast.success('Exportação do arquivo JSON inicializada!');
    };

    const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedRules = JSON.parse(event.target?.result as string);
                if (Array.isArray(importedRules)) {
                    // Simples validação estrutural
                    const isValid = importedRules.every(r => r.internalName && r.formulaString && Array.isArray(r.variables));

                    if (isValid) {
                        toast.info('A importação em lote será implementada em breve.');
                        // TODO: Implementar upload em massa para API
                    } else {
                        toast.error('O arquivo JSON não segue a estrutura válida do ArtPlim.');
                    }
                } else {
                    toast.error('Formato inválido. Esperado um array de Regras.');
                }
            } catch (err) {
                toast.error('Falha ao processar arquivo JSON.');
            }
            // Reset input
            if (e.target) e.target.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-lg font-medium">Gestão de Precificação (Fórmulas)</h3>
                    <p className="text-sm text-gray-500">Crie regras e expressões matemáticas para o cálculo dos produtos.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative overflow-hidden inline-block">
                        <Button variant="outline" size="sm" className="bg-white" onClick={() => document.getElementById('import-json')?.click()}>
                            <Upload className="w-4 h-4 mr-2" /> Importar JSON
                        </Button>
                        <input
                            type="file"
                            id="import-json"
                            accept=".json"
                            className="hidden"
                            onChange={handleImportJSON}
                        />
                    </div>
                    <Button variant="outline" size="sm" className="bg-white" onClick={handleExportJSON}>
                        <Download className="w-4 h-4 mr-2" /> Exportar Tudo
                    </Button>
                    <Button onClick={handleCreateNew} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" /> Nova Fórmula
                    </Button>
                </div>
            </div>

            <div className="space-y-3">
                {loading ? (
                    <div className="text-center py-10 text-slate-500">Carregando fórmulas...</div>
                ) : rules.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-300 text-slate-500">
                        Nenhuma fórmula cadastrada. Crie uma nova para começar.
                    </div>
                ) : (
                    rules.map(rule => (
                        <div key={rule.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow gap-4">
                            <div className="flex-1">
                                <div className="font-semibold text-slate-800 flex items-center gap-2 text-lg">
                                    {rule.internalName}
                                </div>
                                <div className="mt-2 text-sm text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100 inline-block">
                                    <span className="text-slate-400 select-none">𝑓(x) = </span> {rule.formulaString}
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {rule.variables.map(v => (
                                        <div key={v.id} className={`text-xs px-2 py-1 rounded flex items-center gap-1 border ${v.type === 'INPUT' ? 'bg-sky-50 border-sky-100 text-sky-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                                            <span className="font-semibold">{v.name}</span>
                                            <span className="opacity-60">({v.defaultUnit || 'un'})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-center">
                                <Button size="sm" variant="outline" className="text-indigo-600 hover:bg-indigo-50 border-indigo-100" onClick={() => setHistoryRuleId(rule.id!)} title="Ver Histórico de Versões">
                                    <Clock className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" className="text-slate-600" onClick={() => handleEdit(rule)}>
                                    <Edit2 className="w-4 h-4 mr-2" /> Editar
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(rule.id!)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Principal do Editor */}
            {isEditorOpen && (
                <PricingRuleEditorModal
                    rule={editingRule}
                    onSave={handleSaveRule}
                    onClose={() => setIsEditorOpen(false)}
                />
            )}

            {/* Modal de Histórico */}
            {historyRuleId && (
                <PricingRuleHistoryModal
                    ruleId={historyRuleId}
                    onClose={() => setHistoryRuleId(null)}
                />
            )}
        </div>
    );
};

export default PricingRuleSettings;
