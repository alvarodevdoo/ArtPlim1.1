import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Wand2, Calculator, Info, Lock, Unlock, X, Plus } from 'lucide-react';
import {
    extractVariables,
    renameVariableInFormula,
    validateFormulaSyntax,
    evaluateFormula,
    removeVariableFromFormula
} from '@/lib/pricing/formulaUtils';
import { toast } from 'sonner';

export type FormulaVariableType = 'INPUT' | 'FIXED';
export type FormulaVariableUnit = 'mm' | 'cm' | 'm' | 'mm2' | 'cm2' | 'm2' | 'un' | 'hora' | 'moeda' | 'g' | 'kg' | '%' | 'X';

export interface FormulaVariable {
    id: string; // ex: largura_placa
    name: string; // ex: Largura da Placa
    type: FormulaVariableType;
    unit: FormulaVariableUnit;
    lockedUnit: boolean;
    fixedValue?: number; // Usado apenas quando type === 'FIXED'
}

// Helper para tratar inputs numéricos que podem vir com vírgula do usuário (Brasil)
const parseSafeFloat = (val: string | number): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const normalized = val.toString().replace(',', '.');
    return parseFloat(normalized) || 0;
};

export interface PricingFormulaRule {
    id?: string;
    internalName: string;
    productCategory?: string; // Opcional para não quebrar regras antigas caso ainda exista em storage
    formulaString: string;
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
        variables: [],
        active: true
    });

    const formulaTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Erros de sintaxe da fórmula live
    const [formulaError, setFormulaError] = useState<string | null>(null);

    // Estado para o Simulador
    const [simulationValues, setSimulationValues] = useState<Record<string, number>>({});

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
            setFormData(rule);

            // Inicializar simulador com 0 para os inputs
            const initialSim: Record<string, number> = {};
            rule.variables.forEach(v => {
                if (v.type === 'INPUT') initialSim[v.id] = 0;
            });
            setSimulationValues(initialSim);
        }
    }, [rule]);

    // Validação em tempo real da fórmula
    useEffect(() => {
        const validation = validateFormulaSyntax(formData.formulaString);
        if (validation === true) {
            setFormulaError(null);
        } else {
            setFormulaError(validation);
        }
    }, [formData.formulaString]);

    // Calculo do resultado do simulador live
    const simulationResult = useMemo(() => {
        if (formulaError) return 'Err';
        if (!formData.formulaString.trim()) return 0;

        const scope: Record<string, number> = {};
        formData.variables.forEach(v => {
            if (v.type === 'FIXED') {
                scope[v.id] = v.fixedValue || 0;
            } else {
                scope[v.id] = simulationValues[v.id] || 0;
            }
        });

        return evaluateFormula(formData.formulaString, scope, formData.variables);
    }, [formData.formulaString, formData.variables, simulationValues, formulaError]);


    // Handlers
    const handleExtractVariables = () => {
        const extracted = extractVariables(formData.formulaString);
        const currentVars = [...formData.variables];

        let newAdded = 0;
        extracted.forEach(varId => {
            // Se já não houver uma variável na lista com esse ID tecnico, adiciona
            if (!currentVars.some(v => v.id === varId)) {
                currentVars.push({
                    id: varId,
                    name: varId.charAt(0).toUpperCase() + varId.slice(1).replace(/_/g, ' '),
                    type: 'INPUT',
                    unit: 'X',
                    lockedUnit: false
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

        // Atualiza a variável e a fórmula num só ciclo
        const updatedVars = [...formData.variables];
        updatedVars[index] = { ...updatedVars[index], id: newId };

        setFormData(prev => ({
            ...prev,
            formulaString: newFormulaStr,
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

        setFormData(prev => ({
            ...prev,
            variables: updatedVars,
            formulaString: newFormula
        }));
    };

    const addManualVariable = () => {
        const uniqueId = `var_${Math.floor(Math.random() * 1000)}`;
        setFormData(prev => ({
            ...prev,
            variables: [
                ...prev.variables,
                { id: uniqueId, name: 'Nova Variável', type: 'INPUT', unit: 'X', lockedUnit: false }
            ]
        }));
    };

    const appendToFormula = (str: string) => {
        const textarea = formulaTextareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = formData.formulaString;
            const before = text.substring(0, start);
            const after = text.substring(end);

            const newText = before + str + after;

            setFormData(prev => ({
                ...prev,
                formulaString: newText
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
                formulaString: prev.formulaString + str
            }));
        }
    };

    const handleSaveConfirm = () => {
        if (!formData.internalName.trim()) {
            toast.error("O nome da regra é obrigatório.");
            return;
        }
        if (formulaError) {
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
                                        {formData.variables.map((varItem, idx) => (
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
                                                            value={varItem.name}
                                                            onChange={e => handleVariableChange(idx, 'name', e.target.value)}
                                                            className="h-8 text-xs"
                                                            placeholder="Nome Público"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <div className="w-1/3">
                                                        <select
                                                            value={varItem.type}
                                                            onChange={e => handleVariableChange(idx, 'type', e.target.value)}
                                                            className="w-full h-8 px-2 border border-slate-300 rounded text-xs bg-slate-50"
                                                        >
                                                            <option value="INPUT">Entrada</option>
                                                            <option value="FIXED">Fixo</option>
                                                        </select>
                                                    </div>

                                                    {varItem.type === 'FIXED' ? (
                                                        <div className="flex-1">
                                                            <Input
                                                                type="text"
                                                                value={varItem.fixedValue ?? ''}
                                                                onChange={e => handleVariableChange(idx, 'fixedValue', parseSafeFloat(e.target.value))}
                                                                placeholder="Valor constante"
                                                                className="h-8 text-xs text-right"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 flex gap-1">
                                                            <select
                                                                value={varItem.unit}
                                                                onChange={e => handleVariableChange(idx, 'unit', e.target.value)}
                                                                className="flex-1 h-8 px-2 border border-slate-300 rounded text-xs bg-white text-slate-700"
                                                            >
                                                                <optgroup label="Comprimento/Dimensão">
                                                                    <option value="mm">mm</option>
                                                                    <option value="cm">cm</option>
                                                                    <option value="m">metros</option>
                                                                </optgroup>
                                                                <optgroup label="Superfície">
                                                                    <option value="mm2">mm²</option>
                                                                    <option value="cm2">cm²</option>
                                                                    <option value="m2">m²</option>
                                                                </optgroup>
                                                                <optgroup label="Volume/Massa">
                                                                    <option value="g">gramas</option>
                                                                    <option value="kg">quilos</option>
                                                                </optgroup>
                                                                <optgroup label="Geral/Financeiro">
                                                                    <option value="un">und</option>
                                                                    <option value="hora">horas</option>
                                                                    <option value="moeda">Valor (R$)</option>
                                                                    <option value="%">%</option>
                                                                    <option value="X">Nenhum / N/A</option>
                                                                </optgroup>
                                                            </select>
                                                            <button
                                                                onClick={() => handleVariableChange(idx, 'lockedUnit', !varItem.lockedUnit)}
                                                                className={`w - 8 h - 8 flex items - center justify - center rounded border transition - colors ${varItem.lockedUnit ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-slate-100 border-slate-200 text-slate-400'} `}
                                                                title="Travar Unidade pro Vendedor"
                                                            >
                                                                {varItem.lockedUnit ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                    {/* COLUNA DIREITA: Editor de Fórmulas */}
                    <div className="w-full md:w-7/12 flex flex-col bg-white">
                        <div className="p-6 flex-1 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                    Editor Lógico
                                </h3>
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
                                                    onClick={() => appendToFormula(` ${v.id} `)}
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
                                    value={formData.formulaString}
                                    onChange={e => setFormData(p => ({ ...p, formulaString: e.target.value }))}
                                    className={`flex-1 w-full p-4 font-mono text-lg rounded-lg border-2 ring-0 transition-colors bg-slate-50 focus:bg-white resize-none ${formulaError ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-indigo-400'}`}
                                    placeholder="Digite sua matemática aqui... ex: (largura * altura) * preco_m2"
                                />
                                {formulaError && (
                                    <div className="absolute -bottom-10 left-0 right-0 p-2 bg-red-100 text-red-700 text-sm rounded-md shadow flex items-center gap-2 z-10 transition-all opacity-100">
                                        <Info className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{formulaError}</span>
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
                                    {formData.variables.filter(v => v.type === 'INPUT').map(v => (
                                        <div key={v.id} className="w-40 flex flex-col">
                                            <label className="text-xs text-indigo-300 font-mono mb-1 truncate" title={v.name}>{v.name}</label>
                                            <div className="flex bg-slate-800 rounded border border-slate-700 focus-within:border-indigo-500 overflow-hidden">
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent h-9 px-2 text-white outline-none text-right font-mono min-w-[60px]"
                                                    placeholder="0.00"
                                                    value={simulationValues[v.id] ?? ''}
                                                    onChange={e => setSimulationValues(p => ({ ...p, [v.id]: parseSafeFloat(e.target.value) }))}
                                                />
                                                {v.lockedUnit ? (
                                                    <div className="h-9 px-2 flex items-center justify-center bg-slate-900 text-slate-500 text-xs font-mono border-l border-slate-700 uppercase">
                                                        {v.unit}
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={v.unit}
                                                        onChange={(e) => {
                                                            const newVars = [...formData.variables];
                                                            const idx = newVars.findIndex(item => item.id === v.id);
                                                            if (idx !== -1) {
                                                                newVars[idx].unit = e.target.value as any;
                                                                setFormData(p => ({ ...p, variables: newVars }));
                                                            }
                                                        }}
                                                        className="h-9 px-1 bg-slate-800 text-slate-400 text-xs font-mono border-l border-slate-700 outline-none cursor-pointer hover:bg-slate-700 uppercase"
                                                    >
                                                        <option value="mm">mm</option>
                                                        <option value="cm">cm</option>
                                                        <option value="m">m</option>
                                                        <option value="mm2">mm²</option>
                                                        <option value="cm2">cm²</option>
                                                        <option value="m2">m²</option>
                                                        <option value="g">g</option>
                                                        <option value="kg">kg</option>
                                                        <option value="un">un</option>
                                                        <option value="hora">hrs</option>
                                                        <option value="moeda">R$</option>
                                                        <option value="%">%</option>
                                                        <option value="X">-</option>
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Variáveis Fixas (Reference) */}
                                    {formData.variables.filter(v => v.type === 'FIXED').length > 0 && (
                                        <div className="flex gap-4 border-l border-slate-700 pl-4 py-1 ml-2">
                                            {formData.variables.filter(v => v.type === 'FIXED').map(v => (
                                                <div key={v.id} className="w-28 opacity-60 flex flex-col">
                                                    <label className="text-[10px] uppercase text-emerald-400 font-bold mb-1 truncate tracking-wider" title={v.name}>
                                                        FIXO: {v.name}
                                                    </label>
                                                    <div className="flex bg-slate-800 rounded border border-slate-700 focus-within:border-emerald-500 overflow-hidden">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-slate-900/50 h-8 px-2 text-emerald-300 outline-none text-right font-mono text-sm"
                                                            value={simulationValues[v.id] ?? v.fixedValue ?? ''}
                                                            onChange={e => setSimulationValues(p => ({ ...p, [v.id]: parseSafeFloat(e.target.value) }))}
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
                        <div className="bg-indigo-600 rounded-xl p-4 min-w-[200px] border border-indigo-500 shadow-2xl flex flex-col justify-center items-center">
                            <span className="text-indigo-200 text-xs font-bold uppercase mb-1">Resultado Preview</span>
                            <div className={`text - 3xl font - bold font - mono ${formulaError ? 'text-red-300 text-xl' : 'text-white'} `}>
                                {formulaError ? 'Err' : (typeof simulationResult === 'number' ? `R$ ${simulationResult.toFixed(2)} ` : simulationResult)}
                            </div>
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
