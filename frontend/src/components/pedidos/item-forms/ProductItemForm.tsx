import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { Save, Plus, Lock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useInsumos } from '@/features/insumos/useInsumos';
import { SeletorInsumos } from '@/features/insumos/SeletorInsumos';
import { InsumoMaterialSelecionado } from '@/features/insumos/types';
import { calculatePricingResult } from '@/lib/pricing/formulaUtils';

interface Produto {
    id: string;
    name: string;
    description?: string;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    pricingRule?: {
        id: string;
        name: string;
        formula: any;
    };
    formulaData?: any;
}

interface ProductItemFormProps {
    produto: Produto;
    onSubmit: (itemData: any) => void;
    editingData?: any;
    isEditing?: boolean;
}

const ProductItemForm: React.FC<ProductItemFormProps> = ({
    produto,
    onSubmit,
    editingData,
    isEditing = false
}) => {
    const [quantity, setQuantity] = useState<number>(1);
    const [unitPrice, setUnitPrice] = useState<number>(0);
    const [notes, setNotes] = useState('');
    const [simulatingPrice, setSimulatingPrice] = useState(false);
    const [materiaisSelecionados, setMateriaisSelecionados] = useState<InsumoMaterialSelecionado[]>([]);
    const [dynamicVariables, setDynamicVariables] = useState<Record<string, { value: any; unit: string | null }>>({});
    const [calculationLogs, setCalculationLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const { insumos } = useInsumos();

    const [configuracoes, setConfiguracoes] = useState<any[]>([]);
    const [opcoesSelecionadas, setOpcoesSelecionadas] = useState<Record<string, string>>({});

    // 1. OTIMIZAÇÃO: Parsing e Memoização da Fórmula (Evita JSON.parse a cada render)
    const parsedFormulaData = useMemo(() => {
        const rule = produto?.pricingRule;
        if (!rule?.formula) return null;
        if (typeof rule.formula === 'string') {
            try { return JSON.parse(rule.formula); } catch { return null; }
        }
        return rule.formula;
    }, [produto?.pricingRule]);

    // OTIMIZAÇÃO: Filtra variáveis de entrada apenas quando a regra muda
    const inputVars = useMemo(() => {
        return parsedFormulaData?.variables?.filter((v: any) => v.visible !== false && (v.type === 'INPUT' || !v.type)) || [];
    }, [parsedFormulaData]);

    // 2. Carregar dados iniciais
    useEffect(() => {
        let isMounted = true;

        const carregarDadosIniciais = async () => {
            if (editingData) {
                setQuantity(editingData.quantity || 1);
                setUnitPrice(editingData.unitPrice || 0);
                setNotes(editingData.notes || '');

                if (editingData.attributes?.insumos) setMateriaisSelecionados(editingData.attributes.insumos);
                if (editingData.attributes?.selectedOptions) setOpcoesSelecionadas(editingData.attributes.selectedOptions);

                if (editingData.attributes?.dynamicVariables) {
                    const saved = editingData.attributes.dynamicVariables;
                    const normalized: Record<string, { value: any; unit: string | null }> = {};
                    Object.entries(saved).forEach(([key, val]: [string, any]) => {
                        normalized[key] = (val && typeof val === 'object' && 'value' in val)
                            ? val
                            : { value: val, unit: null };
                    });
                    setDynamicVariables(normalized);
                }
            } else if (produto?.id) {
                try {
                    const response = await api.get(`/api/catalog/products/${produto.id}/ficha-tecnica`);
                    if (isMounted && response.data.success && response.data.data) {
                        const fichaBase = response.data.data.map((item: any) => ({
                            insumoId: item.insumoId,
                            nome: item.insumo.nome,
                            precoBase: Number(item.insumo.custoUnitario),
                            quantidadeUtilizada: item.quantidade,
                            unidadeBase: item.insumo.unidadeBase
                        }));
                        setMateriaisSelecionados(fichaBase);
                    }

                    if (isMounted && parsedFormulaData?.variables) {
                        const initialVars: any = {};
                        parsedFormulaData.variables.forEach((v: any) => {
                            initialVars[v.id] = {
                                value: v.fixedValue ?? 0,
                                unit: v.unit || v.baseUnit || null
                            };
                        });
                        setDynamicVariables(initialVars);
                    }
                } catch (error) {
                    console.error("Erro ao carregar inicialização do item:", error);
                }
            }

            if (!editingData?.attributes?.dynamicVariables && parsedFormulaData?.variables) {
                const initialVars: Record<string, { value: any; unit: string | null }> = {};
                parsedFormulaData.variables.forEach((v: any) => {
                    let val: any = 0;
                    if (produto?.formulaData?.[v.id] !== undefined) val = produto.formulaData[v.id];
                    else if (v.type === 'FIXED') val = v.fixedValue ?? 0;

                    initialVars[v.id] = {
                        value: val,
                        unit: v.defaultUnit || v.unit || null
                    };
                });
                if (isMounted) setDynamicVariables(initialVars);
            }

            if (produto?.id) {
                try {
                    const response = await api.get(`/api/catalog/products/${produto.id}/configurations`);
                    if (isMounted && response.data.success) {
                        setConfiguracoes(response.data.data || []);
                    }
                } catch (error) {
                    console.error("Erro ao carregar configurações:", error);
                }
            }
        };

        carregarDadosIniciais();
        return () => { isMounted = false; };
    }, [editingData, produto?.id, parsedFormulaData]);

    // 3. Simulação Reativa com cálculo local otimizado
    useEffect(() => {
        const handler = setTimeout(() => {
            if (quantity <= 0) {
                setUnitPrice(0);
                return;
            }

            if (!parsedFormulaData) {
                setUnitPrice(produto?.salePrice || 0);
                return;
            }

            const inputs: Record<string, any> = {};
            Object.entries(dynamicVariables).forEach(([id, data]) => {
                inputs[id] = data.value;
                inputs[`${id}_unit`] = data.unit;
            });

            inputs['CUSTO_MATERIAIS'] = materiaisSelecionados.reduce((acc, m) => acc + (m.quantidadeUtilizada * m.precoBase), 0);
            inputs['QUANTIDADE'] = quantity;

            const result = calculatePricingResult(parsedFormulaData.formulaString, parsedFormulaData.variables, inputs);

            setUnitPrice(result.value);
            setSimulatingPrice(false);
        }, 300); // Reduzido para 300ms. Como o mathjs tá cacheado, pode ser mais rápido.

        return () => clearTimeout(handler);
    }, [quantity, materiaisSelecionados, dynamicVariables, opcoesSelecionadas, parsedFormulaData, produto?.salePrice]);

    // 4. Handlers de UI otimizados com useCallback
    const handleDynamicVarChange = useCallback((id: string, field: 'value' | 'unit', val: any) => {
        setDynamicVariables(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: val }
        }));
    }, []);

    const handleOptionChange = useCallback(async (configId: string, optionId: string) => {
        if (opcoesSelecionadas[configId] === optionId) return;
        setOpcoesSelecionadas(prev => ({ ...prev, [configId]: optionId }));

        if (!optionId) return;

        try {
            const response = await api.get(`/api/catalog/options/${optionId}/ficha-tecnica`);
            if (response.data.success && response.data.data) {
                const novosInsumos = response.data.data.map((item: any) => ({
                    insumoId: item.insumoId,
                    nome: item.insumo.nome,
                    precoBase: Number(item.insumo.custoUnitario),
                    quantidadeUtilizada: item.quantidade,
                    unidadeBase: item.insumo.unidadeBase
                }));

                setMateriaisSelecionados(prev => {
                    const baseMap = new Map();
                    prev.forEach(m => baseMap.set(m.insumoId, m));
                    novosInsumos.forEach((m: any) => {
                        if (!baseMap.has(m.insumoId)) baseMap.set(m.insumoId, m);
                    });
                    return Array.from(baseMap.values());
                });
            }
        } catch (error) {
            console.error("Erro ao carregar ficha da opção:", error);
        }
    }, [opcoesSelecionadas]);

    const handleSubmit = useCallback(() => {
        if (quantity <= 0 || unitPrice <= 0) {
            toast.error('Preencha os campos e aguarde o cálculo');
            return;
        }

        const itemData = {
            productId: produto.id,
            product: produto,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
            totalPrice: Number(unitPrice * quantity),
            notes,
            attributes: {
                dynamicVariables,
                insumos: materiaisSelecionados,
                selectedOptions: opcoesSelecionadas,
                CUSTO_MATERIAIS: materiaisSelecionados.reduce((acc, m) => acc + (m.quantidadeUtilizada * m.precoBase), 0)
            }
        };
        onSubmit(itemData);
    }, [produto, quantity, unitPrice, notes, dynamicVariables, materiaisSelecionados, opcoesSelecionadas, onSubmit]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-200">
                {configuracoes.map(config => (
                    <div key={config.id} className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">{config.name} {config.required && '*'}</label>
                        <select
                            value={opcoesSelecionadas[config.id] || ''}
                            onChange={(e) => handleOptionChange(config.id, e.target.value)}
                            className="w-full h-10 px-3 py-2 border border-slate-200 rounded-md bg-white text-sm focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="">Selecione...</option>
                            {config.options?.map((opt: any) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                ))}

                {inputVars.map((v: any) => {
                    const isLocked = produto.formulaData?.[`${v.id}_locked`] === true;
                    const hasUnits = v.allowedUnits && v.allowedUnits.length > 0;

                    return (
                        <div key={v.id} className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                                {v.name}
                                {isLocked && <Lock className="w-3 h-3 text-slate-400" />}
                            </label>
                            <div className="flex gap-1">
                                {v.defaultUnit === 'moeda' || v.role === 'MONETARY' ? (
                                    <CurrencyInput
                                        value={dynamicVariables[v.id]?.value || 0}
                                        onValueChange={(val) => handleDynamicVarChange(v.id, 'value', val || 0)}
                                        disabled={isLocked}
                                        className="flex-1"
                                    />
                                ) : (
                                    <Input
                                        type="text"
                                        value={dynamicVariables[v.id]?.value ?? ''}
                                        onChange={(e) => handleDynamicVarChange(v.id, 'value', e.target.value)}
                                        className="h-10 border-slate-200 bg-white flex-1 font-mono text-center"
                                        disabled={isLocked}
                                    />
                                )}
                                {hasUnits && (
                                    <select
                                        value={dynamicVariables[v.id]?.unit || v.defaultUnit || v.unit || ''}
                                        onChange={(e) => handleDynamicVarChange(v.id, 'unit', e.target.value)}
                                        disabled={isLocked}
                                        className="w-20 h-10 px-1 border border-slate-200 rounded-md bg-white text-xs"
                                    >
                                        {(v.allowedUnits || []).map((u: string) => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    );
                })}

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Quantidade</label>
                    <Input
                        type="number"
                        value={quantity || ''}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        placeholder="1"
                        min="1"
                        className="h-10 border-slate-200 bg-white"
                    />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm">
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Preço Unitário</span>
                    {simulatingPrice ? (
                        <div className="flex items-center gap-2 text-primary font-bold animate-pulse">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span>Calculando...</span>
                        </div>
                    ) : (
                        <span className="text-2xl font-black text-emerald-700">{formatCurrency(unitPrice)}</span>
                    )}
                </div>
                <div className="text-right">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Total do Item</span>
                    <div className="text-3xl font-black text-emerald-600">{formatCurrency(unitPrice * quantity)}</div>
                </div>
            </div>

            {calculationLogs.length > 0 && (
                <div className="px-1">
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline uppercase tracking-tight"
                    >
                        {showLogs ? 'Ocultar Detalhes do Cálculo' : 'Ver Detalhes do Cálculo'}
                    </button>
                    {showLogs && (
                        <div className="mt-2 p-3 bg-slate-100 rounded-lg border border-slate-200 font-mono text-[10px] text-slate-600 space-y-1">
                            {calculationLogs.map((log, i) => (
                                <div key={i}>{log}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="pt-2">
                <SeletorInsumos
                    insumos={insumos}
                    materiaisIniciais={materiaisSelecionados}
                    onMaterialsChange={setMateriaisSelecionados}
                />
            </div>

            <div>
                <label className="text-sm font-medium">Observações</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações do item..."
                    className="w-full h-20 p-3 border border-input rounded-md resize-none mt-1"
                />
            </div>

            <Button onClick={handleSubmit} disabled={quantity <= 0 || unitPrice <= 0 || simulatingPrice} className="w-full">
                {isEditing ? <><Save className="w-4 h-4 mr-2" /> Salvar</> : <><Plus className="w-4 h-4 mr-2" /> Adicionar</>}
            </Button>
        </div>
    );
};

export default ProductItemForm;