import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Wand2, Calculator, Info, X, Plus, Eye, EyeOff, Star, ListChecks } from 'lucide-react';
import {
    evaluateFormula,
    validateFormulaSyntax,
    extractVariables,
    renameVariableInFormula,
    removeVariableFromFormula,
    calculatePricingResult
} from '@/lib/pricing/formulaUtils';
import { toast } from 'sonner';

export type FormulaVariableType = 'INPUT' | 'FIXED';
export type FormulaVariableRole =
    | 'LENGTH' | 'AREA' | 'TIME' | 'WEIGHT'
    | 'ENERGY' | 'POWER' | 'VOLUME'
    | 'PERCENT' | 'COST_RATE' | 'NONE';

export interface FormulaVariable {
    id: string; // ex: largura_placa
    name: string; // ex: Largura da Placa
    type: FormulaVariableType;
    allowedUnits: string[]; // Unidades permitidas no frontend
    role: FormulaVariableRole; // Papel da variável para cálculo de BOM
    visible: boolean; // Se a variável aparece no modal de venda
    fixedValue?: number | string; // Usado apenas quando type === 'FIXED'
    defaultUnit?: string; // Unidade padrão ao abrir OS
}

// Sugestões de unidades por tipo
const UNIT_SUGGESTIONS: Record<string, string[]> = {
    LENGTH: ['mm', 'cm', 'm'],
    AREA: ['mm²', 'cm²', 'm²'],
    TIME: ['s', 'min', 'h'],
    WEIGHT: ['mg', 'g', 'kg'],
    VOLUME: ['ml', 'l'],
    ENERGY: ['mWh', 'Wh', 'kWh'],
    POWER: ['mW', 'W', 'kW'],
    PERCENT: ['%'],
    COST_RATE: ['R$/kWh', 'R$/kg', 'R$/m', 'R$/m²', 'R$/h'],
    NONE: []
};

// Helper para tratar inputs numéricos que podem vir com vírgula do usuário (Brasil)
export interface PricingFormulaRule {
    id?: string;
    internalName: string;
    productCategory?: string; // Opcional para não quebrar regras antigas caso ainda exista em storage
    formulaString: string;
    costFormulaString?: string; // Nova fórmula opcional para cálculo de custo
    variables: FormulaVariable[];
    active: boolean;
}

interface Props {
    rule: PricingFormulaRule | null;
    onSave: (rule: PricingFormulaRule) => void;
    onClose: () => void;
}

const PricingRuleEditorModal: React.FC<Props> = ({ rule, onSave, onClose }) => {
    // Estado principal do form
    const [formData, setFormData] = useState<PricingFormulaRule>({
        internalName: '',
        formulaString: '',
        costFormulaString: '',
        variables: [],
        active: true
    });

    const formulaTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Erros de sintaxe da fórmula live
    const [formulaError, setFormulaError] = useState<string | null>(null);
    const [costFormulaError, setCostFormulaError] = useState<string | null>(null);

    // Aba ativa no editor: 'venda' ou 'custo'
    const [activeTab, setActiveTab] = useState<'venda' | 'custo'>('venda');

    // Estado para o Simulador
    const [simulationValues, setSimulationValues] = useState<Record<string, any>>({});

    // Sincroniza valores fixos com o simulador quando a regra carrega ou variáveis fixas mudam
    useEffect(() => {
        const newValues = { ...simulationValues };
        let hasChanges = false;
        formData.variables.forEach(v => {
            // Se for fixo e ainda não estiver no simulador, ou se o valor fixo mudou e não houve override manual ainda
            // Para simplificar, vamos sempre garantir que fixos tenham um valor inicial no simulador
            if (v.type === 'FIXED' && v.fixedValue !== undefined && simulationValues[v.id] === undefined) {
                newValues[v.id] = v.fixedValue;
                hasChanges = true;
            }
        });
        if (hasChanges) setSimulationValues(newValues);
    }, [formData.variables]);

    // Estado temporário para digitação do ID sem quebrar a regex
    const [tempVarIds, setTempVarIds] = useState<Record<number, string>>({});

    useEffect(() => {
        if (rule) {
            setFormData({
                ...rule,
                costFormulaString: rule.costFormulaString || ''
            });

            // Inicializar simulador com 0 para os inputs
            const initialSim: Record<string, any> = {};
            rule.variables.forEach(v => {
                if (v.type === 'INPUT') {
                    initialSim[v.id] = 0;
                    initialSim[`${v.id}_unit`] = v.defaultUnit || null;
                }
            });
            setSimulationValues(initialSim);
        }
    }, [rule]);

    // Validação em tempo real da fórmula
    useEffect(() => {
        const validation = validateFormulaSyntax(formData.formulaString);
        setFormulaError(validation === true ? null : validation);

        if (formData.costFormulaString) {
            const costValidation = validateFormulaSyntax(formData.costFormulaString);
            setCostFormulaError(costValidation === true ? null : costValidation);
        } else {
            setCostFormulaError(null);
        }
    }, [formData.formulaString, formData.costFormulaString]);

    // Calculo do resultado do simulador live
    const simulation = useMemo(() => {
        const res = { venda: 0 as number | string, custo: 0 as number | string, breakdown: [] as any[] };
        if (formulaError || costFormulaError) return res;

        // USA O MOTOR UNIFICADO PARA TUDO
        const inputs = { ...simulationValues, QUANTIDADE: 1 }; // No simulador, quantidade default é 1
        const calcSale = calculatePricingResult(formData.formulaString, formData.variables, inputs);
        const calcCost = calculatePricingResult(formData.costFormulaString, formData.variables, inputs);

        res.venda = calcSale.value;
        res.custo = calcCost.value;
        res.breakdown = calcCost.breakdown;

        return res;
    }, [formData.formulaString, formData.costFormulaString, formData.variables, simulationValues, formulaError, costFormulaError]);


    // Handlers
    const handleExtractVariables = () => {
        const formulaToExtract = activeTab === 'venda' ? formData.formulaString : (formData.costFormulaString || '');
        const extracted = extractVariables(formulaToExtract);
        const currentVars = [...formData.variables];

        let newAdded = 0;
        extracted.forEach(varId => {
            // Se já não houver uma variável na lista com esse ID tecnico, adiciona
            if (!currentVars.some(v => v.id === varId)) {
                currentVars.push({
                    id: varId,
                    name: varId.charAt(0).toUpperCase() + varId.slice(1).replace(/_/g, ' '),
                    type: 'INPUT',
                    allowedUnits: ['mm', 'cm', 'm'],
                    role: 'NONE',
                    visible: true
                });
                newAdded++;
            }
        });

        if (newAdded > 0) {
            setFormData(prev => ({ ...prev, variables: currentVars }));
            toast.success(`${newAdded} variáveis extraídas da fórmula com sucesso!`);
        } else {
            toast.info('Nenhuma variável nova encontrada na fórmula.');
        }
    };

    const handleVariableChange = (index: number, field: keyof FormulaVariable, value: any) => {
        const updatedVars = [...formData.variables];
        updatedVars[index] = { ...updatedVars[index], [field]: value };

        // Se mudou para FIXO, limpamos o valor do simulador para evitar conflito de visualização
        if (field === 'type' && value === 'FIXED') {
            const varId = updatedVars[index].id;
            setSimulationValues(prev => {
                const next = { ...prev };
                delete next[varId];
                return next;
            });
        }

        setFormData(prev => ({ ...prev, variables: updatedVars }));
    };

    const handleVariableIdRename = (index: number, oldId: string, newId: string) => {
        if (oldId === newId) return; // Nao houve mudança

        // Verifica duplicata
        if (formData.variables.some((v, i) => i !== index && v.id === newId)) {
            toast.error('Já existe uma variável com esse ID!');
            return;
        }

        // Renomear na String da fórmula
        const newFormulaStr = renameVariableInFormula(formData.formulaString, oldId, newId);
        const newCostFormulaStr = formData.costFormulaString ? renameVariableInFormula(formData.costFormulaString, oldId, newId) : '';

        // Atualiza a variável e a fórmula num só ciclo
        const updatedVars = [...formData.variables];
        updatedVars[index] = { ...updatedVars[index], id: newId };

        setFormData(prev => ({
            ...prev,
            formulaString: newFormulaStr,
            costFormulaString: newCostFormulaStr,
            variables: updatedVars
        }));

        toast.success(`Variável renomeada de '${oldId}' para '${newId}' com segurança.`);
    };

    const removeVariable = (index: number) => {
        const updatedVars = [...formData.variables];
        const varToRemove = updatedVars[index];
        updatedVars.splice(index, 1);

        // Remove da lista e da String da matemática ao mesmo tempo (com os operadores)
        const newFormula = removeVariableFromFormula(formData.formulaString, varToRemove.id);
        const newCostFormula = formData.costFormulaString ? removeVariableFromFormula(formData.costFormulaString, varToRemove.id) : '';

        setFormData(prev => ({
            ...prev,
            variables: updatedVars,
            formulaString: newFormula,
            costFormulaString: newCostFormula
        }));
    };

    const addManualVariable = () => {
        const uniqueId = `var_${Math.floor(Math.random() * 1000)}`;
        setFormData(prev => ({
            ...prev,
            variables: [
                ...prev.variables,
                { id: uniqueId, name: 'Nova Variável', type: 'INPUT', allowedUnits: [], role: 'NONE', visible: true }
            ]
        }));
    };

    const appendToFormula = (str: string) => {
        const textarea = formulaTextareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = activeTab === 'venda' ? formData.formulaString : (formData.costFormulaString || '');
            const before = text.substring(0, start);
            const after = text.substring(end);

            const newText = before + str + after;

            setFormData(prev => ({
                ...prev,
                [activeTab === 'venda' ? 'formulaString' : 'costFormulaString']: newText
            }));

            // Re-focar e posicionar o cursor após o render
            setTimeout(() => {
                textarea.focus();
                const newCursorPos = start + str.length;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
            }, 0);
        } else {
            // Fallback caso o ref não esteja disponível
            setFormData(prev => ({
                ...prev,
                [activeTab === 'venda' ? 'formulaString' : 'costFormulaString']: (activeTab === 'venda' ? prev.formulaString : (prev.costFormulaString || '')) + str
            }));
        }
    };

    const handleSaveConfirm = () => {
        if (!formData.internalName.trim()) {
            toast.error("O nome da regra é obrigatório.");
            return;
        }
        if (formulaError || costFormulaError) {
            toast.error("A fórmula possui erros matemáticos. Corrija antes de salvar.");
            return;
        }
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* HEAD */}
                <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                    <div className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-xl font-bold text-slate-800">
                            Editor Dinâmico de Precificação
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* BODY ALTO (Duas colunas) */}
                <div className="flex-1 overflow-y-auto p-0 flex flex-col md:flex-row">

                    {/* COLUNA ESQUERDA: Config e Variáveis */}
                    <div className="w-full md:w-5/12 bg-slate-50 p-6 border-r border-slate-200 overflow-y-auto">
                        <div className="space-y-6">

                            {/* Metadados Base */}
                            <div className="space-y-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-1">Nome da Regra</label>
                                    <Input
                                        value={formData.internalName}
                                        onChange={e => setFormData(p => ({ ...p, internalName: e.target.value }))}
                                        placeholder="Ex: Adesivo Vinil"
                                        className="font-medium"
                                    />
                                </div>
                            </div>

                            {/* Variáveis Management */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                        Variáveis Dinâmicas
                                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                                            {formData.variables.length}
                                        </span>
                                    </h3>
                                    <Button size="sm" variant="outline" onClick={addManualVariable} className="h-8 text-xs">
                                        <Plus className="w-3 h-3 mr-1" /> Var
                                    </Button>
                                </div>

                                {formData.variables.length === 0 ? (
                                    <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                                        Nenhuma variável cadastrada. Digite a fórmula e use a Varinha Mágica!
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {formData.variables.map((varItem, idx) => {
                                            if (!varItem) return null;
                                            return (
                                                <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm shadow-slate-100 space-y-3 relative group">
                                                    <button
                                                        onClick={() => removeVariable(idx)}
                                                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-0.5 block">ID Técnico (Fórmula)</label>
                                                            <Input
                                                                value={tempVarIds[idx] !== undefined ? tempVarIds[idx] : varItem.id}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setTempVarIds(prev => ({ ...prev, [idx]: val }));
                                                                }}
                                                                onBlur={(e) => {
                                                                    const newId = e.target.value.trim();
                                                                    const oldId = varItem.id;

                                                                    setTempVarIds(prev => {
                                                                        const next = { ...prev };
                                                                        delete next[idx];
                                                                        return next;
                                                                    });

                                                                    if (newId !== '' && newId !== oldId) {
                                                                        handleVariableIdRename(idx, oldId, newId);
                                                                    }
                                                                }}
                                                                className="h-8 text-xs font-mono bg-slate-50 text-indigo-700 border-indigo-200"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-0.5 block">Nome Exibição (OS)</label>
                                                            <Input
                                                                value={varItem.name || ''}
                                                                onChange={e => handleVariableChange(idx, 'name', e.target.value)}
                                                                className="h-8 text-xs"
                                                                placeholder="Nome Público"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex gap-2">
                                                            <div className="flex-1">
                                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-0.5 block">Tipo da Variável</label>
                                                                <select
                                                                    value={varItem.role || 'NONE'}
                                                                    onChange={e => {
                                                                        const newRole = e.target.value as FormulaVariableRole;
                                                                        const suggestions = UNIT_SUGGESTIONS[newRole] || [];
                                                                        const updatedVars = [...formData.variables];
                                                                        updatedVars[idx] = {
                                                                            ...updatedVars[idx],
                                                                            role: newRole,
                                                                            allowedUnits: suggestions,
                                                                            defaultUnit: suggestions.length > 0 ? suggestions[0] : ''
                                                                        };
                                                                        setFormData({ ...formData, variables: updatedVars });
                                                                    }}
                                                                    className="w-full h-8 px-2 border border-slate-300 rounded text-xs bg-slate-50 font-medium"
                                                                >
                                                                    <option value="NONE">Valor (Financeiro)</option>
                                                                    <option value="LENGTH">Medida (Comprimento)</option>
                                                                    <option value="AREA">Área (Espaço)</option>
                                                                    <option value="VOLUME">Volume (Capacidade)</option>
                                                                    <option value="TIME">Tempo (Duração)</option>
                                                                    <option value="WEIGHT">Peso (Massa)</option>
                                                                    <option value="ENERGY">Energia (Consumo)</option>
                                                                    <option value="POWER">Potência (Capacidade)</option>
                                                                    <option value="PERCENT">Percentual (%)</option>
                                                                    <option value="COST_RATE">Taxa de Custo (Ex: R$/kWh)</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* Gestão de Unidades como Tags (Apenas para Entradas) */}
                                                        {varItem.role !== 'NONE' && varItem.type !== 'FIXED' && (
                                                            <div className="bg-slate-50 p-2 rounded-md border border-slate-200">
                                                                <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block flex justify-between">
                                                                    Configuração de Unidades
                                                                    <span className="text-[9px] lowercase italic font-normal">Estrela = Padrão PDV</span>
                                                                </label>
                                                                <div className="flex flex-wrap gap-1.5 mb-2">
                                                                    {(varItem.allowedUnits || []).map(unit => (
                                                                        <div
                                                                            key={unit}
                                                                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all ${varItem.defaultUnit === unit ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600'}`}
                                                                        >
                                                                            <button
                                                                                onClick={() => handleVariableChange(idx, 'defaultUnit', unit)}
                                                                                className={`hover:scale-110 transition-transform ${varItem.defaultUnit === unit ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                                                                            >
                                                                                <Star className={`w-3 h-3 ${varItem.defaultUnit === unit ? 'fill-amber-500' : ''}`} />
                                                                            </button>
                                                                            <span>{unit}</span>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newList = (varItem.allowedUnits || []).filter(u => u !== unit);
                                                                                    handleVariableChange(idx, 'allowedUnits', newList);
                                                                                    if (varItem.defaultUnit === unit) {
                                                                                        handleVariableChange(idx, 'defaultUnit', newList[0] || '');
                                                                                    }
                                                                                }}
                                                                                className="hover:text-red-500 text-slate-400"
                                                                            >
                                                                                <X className="w-2.5 h-2.5" />
                                                                            </button>
                                                                        </div>
                                                                    ))}

                                                                    {/* Seletor de adição de unidades sugeridas */}
                                                                    {varItem.role && UNIT_SUGGESTIONS[varItem.role] && (
                                                                        <div className="flex items-center ml-1">
                                                                            <select
                                                                                className="h-6 text-[10px] px-1 border border-dashed border-slate-300 rounded bg-white text-slate-400 hover:text-slate-600 cursor-pointer outline-none"
                                                                                value=""
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value;
                                                                                    if (val === 'CUSTOM') {
                                                                                        const custom = prompt('Digite a sigla da unidade:');
                                                                                        if (custom) {
                                                                                            const newList = [...(varItem.allowedUnits || []), custom.trim()];
                                                                                            handleVariableChange(idx, 'allowedUnits', newList);
                                                                                        }
                                                                                    } else if (val && !(varItem.allowedUnits || []).includes(val)) {
                                                                                        const newList = [...(varItem.allowedUnits || []), val];
                                                                                        handleVariableChange(idx, 'allowedUnits', newList);
                                                                                        if (!varItem.defaultUnit) handleVariableChange(idx, 'defaultUnit', val);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <option value="">+ add</option>
                                                                                {(UNIT_SUGGESTIONS[varItem.role] || [])
                                                                                    .filter(u => !(varItem.allowedUnits || []).includes(u))
                                                                                    .map(u => (
                                                                                        <option key={u} value={u}>{u}</option>
                                                                                    ))
                                                                                }
                                                                                <option value="CUSTOM">Outra...</option>
                                                                            </select>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex gap-2 items-center">
                                                            <div className="w-1/3">
                                                                <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block leading-none">Origem</label>
                                                                <select
                                                                    value={varItem.type || 'INPUT'}
                                                                    onChange={e => handleVariableChange(idx, 'type', e.target.value)}
                                                                    className="w-full h-8 px-2 border border-slate-300 rounded text-xs bg-slate-50 font-bold"
                                                                >
                                                                    <option value="INPUT">Variável</option>
                                                                    <option value="FIXED">Fixo</option>
                                                                </select>
                                                            </div>

                                                            {varItem.type === 'FIXED' ? (
                                                                <>
                                                                    <div className="w-1/4">
                                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block leading-none">Unidade</label>
                                                                        <Input
                                                                            value={varItem.defaultUnit || ''}
                                                                            onChange={e => {
                                                                                handleVariableChange(idx, 'defaultUnit', e.target.value);
                                                                                handleVariableChange(idx, 'allowedUnits', [e.target.value]);
                                                                            }}
                                                                            placeholder="un"
                                                                            className="h-8 text-[10px] font-mono uppercase"
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block text-right font-mono leading-none">Valor Fixo</label>
                                                                        <Input
                                                                            type="text"
                                                                            value={varItem.fixedValue ?? ''}
                                                                            onChange={e => handleVariableChange(idx, 'fixedValue', e.target.value)}
                                                                            placeholder="0.00"
                                                                            className="h-8 text-xs text-right font-mono font-bold"
                                                                        />
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="flex-1 flex gap-2 justify-end">
                                                                    <button
                                                                        onClick={() => handleVariableChange(idx, 'visible', varItem.visible === undefined ? false : !varItem.visible)}
                                                                        className={`px-3 h-8 flex items-center justify-center rounded border transition-colors ${varItem.visible !== false ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-400'}`}
                                                                        title={varItem.visible !== false ? 'Visível na Venda' : 'Oculto na Venda'}
                                                                    >
                                                                        {varItem.visible !== false ? <><Eye className="w-3 h-3 mr-1" /> Visível</> : <><EyeOff className="w-3 h-3 mr-1" /> Oculto</>}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                    {/* COLUNA DIREITA: Editor de Fórmulas */}
                    <div className="w-full md:w-7/12 flex flex-col bg-white">
                        <div className="p-6 flex-1 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                    <button
                                        onClick={() => setActiveTab('venda')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'venda' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Fórmula de Venda
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('custo')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'custo' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Fórmula de Custo
                                    </button>
                                </div>
                                <Button size="sm" onClick={handleExtractVariables} className="bg-purple-600 hover:bg-purple-700">
                                    <Wand2 className="w-4 h-4 mr-2" /> Extrair Variáveis Mágica
                                </Button>
                            </div>

                            <div className="flex flex-col gap-2 mb-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="flex flex-wrap gap-2 items-center">
                                    <div className="flex flex-wrap gap-1 items-center">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Básico:</span>
                                        {['+', '-', '*', '/', '(', ')', '^'].map((sym) => (
                                            <button
                                                key={sym}
                                                onClick={() => appendToFormula(` ${sym} `)}
                                                className="h-8 w-8 flex items-center justify-center bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 rounded shadow-sm text-sm font-mono font-bold transition-colors"
                                            >
                                                {sym}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1"></div>

                                    <div className="flex flex-wrap gap-1 items-center">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Especial:</span>
                                        {[
                                            { id: 'sqrt(', label: 'Raiz' },
                                            { id: 'ceil(', label: 'Teto (↑)' },
                                            { id: 'floor(', label: 'Chão (↓)' }
                                        ].map((func) => (
                                            <button
                                                key={func.id}
                                                onClick={() => appendToFormula(` ${func.id} `)}
                                                className="h-8 px-3 flex items-center justify-center bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded shadow-sm text-xs font-semibold transition-colors"
                                                title={`Aplicar cálculo de ${func.label}`}
                                            >
                                                {func.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {formData.variables.length > 0 && (
                                    <>
                                        <div className="w-full h-px bg-slate-200 my-1"></div>
                                        <div className="flex flex-wrap gap-1 items-center">
                                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Inserir Variável:</span>
                                            {formData.variables.map(v => (
                                                <button
                                                    key={v.id}
                                                    onClick={() => appendToFormula(v.id.includes(' ') ? ` "${v.id}" ` : ` ${v.id} `)}
                                                    className="h-7 px-2 flex items-center justify-center bg-indigo-100 text-indigo-700 hover:bg-indigo-200 hover:text-indigo-800 border border-indigo-200 rounded shadow-sm text-[11px] font-mono font-bold transition-colors"
                                                    title={`Inserir ${v.name} na fórmula`}
                                                >
                                                    {v.id}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Textarea Mágico */}
                            <div className="relative flex-1 min-h-[250px] flex flex-col group mt-1">
                                <textarea
                                    ref={formulaTextareaRef}
                                    value={activeTab === 'venda' ? formData.formulaString : (formData.costFormulaString || '')}
                                    onChange={e => setFormData(p => ({
                                        ...p,
                                        [activeTab === 'venda' ? 'formulaString' : 'costFormulaString']: e.target.value
                                    }))}
                                    className={`flex-1 w-full p-4 font-mono text-lg rounded-lg border-2 ring-0 transition-colors ${activeTab === 'venda'
                                        ? (formulaError ? 'border-red-300 focus:border-red-500 bg-red-50/20' : 'border-slate-200 focus:border-indigo-400 bg-slate-50 focus:bg-white')
                                        : (costFormulaError ? 'border-red-300 focus:border-red-500 bg-red-50/20' : 'border-slate-200 focus:border-orange-400 bg-orange-50/10 focus:bg-white')
                                        } resize-none`}
                                    placeholder={activeTab === 'venda' ? "Digite a lógica de VENDA... ex: custo * 2" : "Digite a lógica de CUSTO... ex: g * preco_g"}
                                />
                                {(activeTab === 'venda' ? formulaError : costFormulaError) && (
                                    <div className="absolute -bottom-10 left-0 right-0 p-2 bg-red-100 text-red-700 text-sm rounded-md shadow flex items-center gap-2 z-10 transition-all opacity-100">
                                        <Info className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{activeTab === 'venda' ? formulaError : costFormulaError}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RODAPÉ: Simulador de Testes */}
                <div className="bg-slate-900 text-slate-100 p-5 mt-auto">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                        Painel de Simulação ao Vivo
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </h4>

                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Area de Inputs do Simulador */}
                        <div className="flex-1 w-full flex flex-wrap gap-4 items-start">
                            {formData.variables.length === 0 ? (
                                <p className="text-slate-500 text-sm italic">Adicione variáveis lógicas no painel para simular.</p>
                            ) : (
                                <>
                                    {/* Variáveis de Entrada (Simuláveis) */}
                                    {formData.variables.filter(v => v && v.type === 'INPUT').map(v => (
                                        <div key={v.id} className="w-40 flex flex-col">
                                            <label className="text-xs text-indigo-300 font-mono mb-1 truncate" title={v.name}>{v.name}</label>
                                            <div className="flex bg-slate-800 rounded border border-slate-700 focus-within:border-indigo-500 overflow-hidden">
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent h-9 px-2 text-white outline-none text-right font-mono min-w-[60px]"
                                                    placeholder="0.00"
                                                    value={simulationValues[v.id] ?? ''}
                                                    onChange={e => setSimulationValues(p => ({ ...p, [v.id]: e.target.value }))}
                                                />
                                                {(!v.allowedUnits || v.allowedUnits.length === 0) ? (
                                                    <div className="h-9 px-2 flex items-center justify-center bg-slate-900 text-slate-500 text-xs font-mono border-l border-slate-700 uppercase">
                                                        {v.defaultUnit || '-'}
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={simulationValues[`${v.id}_unit`] || (v.allowedUnits?.[0] || '')}
                                                        onChange={(e) => {
                                                            setSimulationValues(p => ({ ...p, [`${v.id}_unit`]: e.target.value }));
                                                        }}
                                                        className="h-9 px-1 bg-slate-800 text-slate-400 text-xs font-mono border-l border-slate-700 outline-none cursor-pointer hover:bg-slate-700 uppercase"
                                                    >
                                                        {(v.allowedUnits || [])
                                                            .filter((u, i, arr) => u && arr.indexOf(u) === i)
                                                            .map(u => (
                                                                <option key={u} value={u}>{u}</option>
                                                            ))
                                                        }
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Variáveis Fixas (Reference) */}
                                    {formData.variables.filter(v => v && v.type === 'FIXED').length > 0 && (
                                        <div className="flex gap-4 border-l border-slate-700 pl-4 py-1 ml-2">
                                            {formData.variables.filter(v => v && v.type === 'FIXED').map(v => (
                                                <div key={v.id} className="w-28 opacity-60 flex flex-col">
                                                    <label className="text-[10px] uppercase text-emerald-400 font-bold mb-1 truncate tracking-wider" title={v.name}>
                                                        FIXO: {v.name}
                                                    </label>
                                                    <div className="flex bg-slate-800 rounded border border-slate-700 focus-within:border-emerald-500 overflow-hidden">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-slate-900/50 h-8 px-2 text-emerald-300 outline-none text-right font-mono text-sm"
                                                            value={v.type === 'FIXED' ? (v.fixedValue ?? 0) : (simulationValues[v.id] ?? '')}
                                                            onChange={e => setSimulationValues(p => ({ ...p, [v.id]: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Card Result Preview */}
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-4">
                                <div className="bg-indigo-600 rounded-xl p-3 min-w-[140px] border border-indigo-500 shadow-lg flex flex-col justify-center items-center">
                                    <span className="text-indigo-200 text-[10px] font-bold uppercase mb-1">Venda Preview</span>
                                    <div className={`text-xl font-bold font-mono text-center px-1 ${formulaError || typeof simulation.venda === 'string' ? 'text-red-300 text-sm' : 'text-white'}`}>
                                        {formulaError
                                            ? 'Erro Sintaxe'
                                            : (typeof simulation.venda === 'string'
                                                ? simulation.venda
                                                : `R$ ${simulation.venda.toFixed(2)}`
                                            )
                                        }
                                    </div>
                                </div>

                                <div className="bg-orange-600 rounded-xl p-3 min-w-[140px] border border-orange-500 shadow-lg flex flex-col justify-center items-center relative group/cost">
                                    <span className="text-orange-200 text-[10px] font-bold uppercase mb-1 flex items-center gap-1">
                                        Custo Estimado <Info className="w-2.5 h-2.5" />
                                    </span>
                                    <div className={`text-xl font-bold font-mono text-center px-1 ${costFormulaError || typeof simulation.custo === 'string' ? 'text-red-300 text-sm' : 'text-white'}`}>
                                        {costFormulaError
                                            ? 'Erro Sintaxe'
                                            : (typeof simulation.custo === 'string'
                                                ? simulation.custo
                                                : `R$ ${simulation.custo.toFixed(2)}`
                                            )
                                        }
                                    </div>

                                    {/* Detalhamento Hover */}
                                    {simulation.breakdown.length > 0 && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-3 z-50 pointer-events-none opacity-0 group-hover/cost:opacity-100 transition-opacity">
                                            <h5 className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2 border-b border-slate-700 pb-1">Detalhamento de Custos (Hover)</h5>
                                            <div className="space-y-2">
                                                {simulation.breakdown.map((item, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-300 truncate mr-2">{item.label}</span>
                                                        <span className="text-white font-mono font-bold whitespace-nowrap">
                                                            {typeof item.value === 'number'
                                                                ? `R$ ${item.value.toFixed(2)}`
                                                                : item.value}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-emerald-600 rounded-xl p-3 min-w-[140px] border border-emerald-500 shadow-lg flex flex-col justify-center items-center">
                                    <span className="text-emerald-200 text-[10px] font-bold uppercase mb-1">Lucro Bruto</span>
                                    <div className="text-xl font-bold font-mono text-white">
                                        {(typeof simulation.venda === 'number' && typeof simulation.custo === 'number')
                                            ? `R$ ${(simulation.venda - simulation.custo).toFixed(2)}`
                                            : '—'}
                                    </div>
                                </div>
                            </div>

                            {/* NOVO: Detalhamento Visível (Igual à imagem) */}
                            {simulation.breakdown.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <ListChecks className="w-3 h-3" /> Detalhamento do Orçamento
                                    </h4>
                                    <div className="space-y-2">
                                        {simulation.breakdown.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm">
                                                <span className="text-slate-600 font-medium">{item.label.replace(/_/g, ' ')}:</span>
                                                <span className="text-slate-900 font-bold">
                                                    {typeof item.value === 'number'
                                                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)
                                                        : item.value}
                                                </span>
                                            </div>
                                        ))}
                                        <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-indigo-700">
                                            <span>CUSTO TOTAL ESTIMADO:</span>
                                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(typeof simulation.custo === 'number' ? simulation.custo : 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Botões Finais */}
                        <div className="ml-auto pl-6 border-l border-slate-800 flex flex-col gap-2 min-w-[150px]">
                            <Button variant="outline" className="text-white hover:text-black border-slate-700 bg-transparent h-10 w-full" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white h-10 w-full" onClick={handleSaveConfirm}>
                                Salvar Regra
                            </Button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PricingRuleEditorModal;
