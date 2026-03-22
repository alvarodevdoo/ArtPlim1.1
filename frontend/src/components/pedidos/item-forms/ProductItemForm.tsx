import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

// 🔥 CACHE GLOBAL (Backup de Memória Rápida)
const formBackupCache = new Map<string, {
    vars: Record<string, any>;
    materiais: InsumoMaterialSelecionado[];
    notes: string;
    options: Record<string, string>;
}>();

interface Produto {
    id: string;
    name: string;
    description?: string;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    pricingRuleId?: string;
    pricingRule?: { id: string; name: string; formula: any; };
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
    const [isInitializing, setIsInitializing] = useState(true);
    const { insumos } = useInsumos();

    const [configuracoes, setConfiguracoes] = useState<any[]>([]);
    const [opcoesSelecionadas, setOpcoesSelecionadas] = useState<Record<string, string>>({});

    const [resolvedPricingRule, setResolvedPricingRule] = useState<any>(null);
    const loadedSignatureRef = useRef<string | null>(null);

    useEffect(() => {
        const pricingRuleId = (editingData as any)?.pricingRuleId || (produto as any)?.pricingRuleId || (produto as any)?.pricingRule?.id;
        if (!pricingRuleId) return setResolvedPricingRule(null);

        api.get(`/api/catalog/pricing-rules/${pricingRuleId}`)
            .then(res => { if (res.data?.success && res.data?.data) setResolvedPricingRule(res.data.data); })
            .catch(() => { /* silencioso */ });
    }, [(produto as any)?.pricingRuleId, (produto as any)?.pricingRule?.id, (editingData as any)?.pricingRuleId]);

    // 2. Memoização da Fórmula
    const parsedFormulaData = useMemo(() => {
        let attributes = editingData?.attributes || {};
        if (typeof attributes === 'string') { try { attributes = JSON.parse(attributes); } catch { attributes = {}; } }
        if (attributes.formula_snapshot && editingData?.productId === produto?.id) return attributes.formula_snapshot;

        const ruleFromProp = (produto as any)?.pricingRule;
        if (ruleFromProp?.formula) return typeof ruleFromProp.formula === 'string' ? JSON.parse(ruleFromProp.formula) : ruleFromProp.formula;
        if (resolvedPricingRule?.formula) return typeof resolvedPricingRule.formula === 'string' ? JSON.parse(resolvedPricingRule.formula) : resolvedPricingRule.formula;
        return null;
    }, [(produto as any)?.pricingRule, resolvedPricingRule, editingData?.attributes, editingData?.productId]);

    const inputVars = useMemo(() => parsedFormulaData?.variables?.filter((v: any) => v.visible !== false && (v.type === 'INPUT' || !v.type)) || [], [parsedFormulaData]);

    // Gatilho seguro para detectar atualizações na API após o F5
    const attributesStr = useMemo(() => {
        if (!editingData?.attributes) return "{}";
        if (typeof editingData.attributes === 'string') return editingData.attributes;
        try { return JSON.stringify(editingData.attributes); } catch { return "{}"; }
    }, [editingData?.attributes]);

    // 3. CARREGAMENTO ESTRITO (Sobrevive a F5 e Auto-Save)
    useEffect(() => {
        let isMounted = true;
        const currentProdId = produto?.id || 'NO_PROD';
        const currentItemId = editingData?.id || 'NEW_ITEM';

        if (!parsedFormulaData?.variables && (produto as any)?.pricingRuleId) return;

        // Se o escudo já travou com sucesso PARA ESTE ITEM, ignoramos updates da prop (evita wipe enquanto digita)
        if (loadedSignatureRef.current === currentItemId) return;

        let attributes = editingData?.attributes || {};
        if (typeof attributes === 'string') { try { attributes = JSON.parse(attributes); } catch { attributes = {}; } }

        const savedVars = attributes.dynamicVariables || {};
        const hasSavedVars = Object.keys(savedVars).length > 0;
        const hasRootDimensions = editingData?.width !== undefined || editingData?.height !== undefined;

        // O segredo do F5: Só consideramos "Hidratado" se os dados já vieram da API ou se for explicitamente um item novo.
        const isHydrated = hasSavedVars || hasRootDimensions || currentItemId === 'NEW_ITEM';

        const carregarDadosIniciais = async () => {
            let productDefaults: Record<string, any> = {};
            let initialProductDefaults = (produto as any)?.formulaData || {};
            if (typeof initialProductDefaults === 'string') { try { initialProductDefaults = JSON.parse(initialProductDefaults); } catch { initialProductDefaults = {}; } }
            Object.entries(initialProductDefaults).forEach(([k, v]) => productDefaults[k.toLowerCase()] = v);

            const backup = formBackupCache.get(currentProdId);
            const varsToUse = hasSavedVars ? savedVars : (backup?.vars || {});
            const matToUse = attributes.insumos ? attributes.insumos : (backup?.materiais || null);
            const optToUse = Object.keys(attributes.selectedOptions || {}).length > 0 ? attributes.selectedOptions : (backup?.options || {});
            const notesToUse = editingData?.notes || backup?.notes || '';

            const buildInitialVariables = () => {
                const initialVars: Record<string, { value: any; unit: string | null }> = {};
                parsedFormulaData.variables.forEach((v: any) => {
                    const varIdLow = v.id.toLowerCase();

                    // Prioridade de Valor: 1. DB (JSON) | 2. DB (Raiz fallback) | 3. Cache Memória
                    let savedVal = savedVars[v.id] ?? savedVars[varIdLow];

                    if (savedVal === undefined && editingData) {
                        if (varIdLow === 'largura' || varIdLow === 'width') savedVal = editingData.width;
                        if (varIdLow === 'altura' || varIdLow === 'height') savedVal = editingData.height;
                    }

                    if (savedVal === undefined && backup?.vars) {
                        const backupVar = backup.vars[v.id] ?? backup.vars[varIdLow];
                        if (backupVar !== undefined) savedVal = typeof backupVar === 'object' && 'value' in backupVar ? backupVar.value : backupVar;
                    }

                    // Prioridade de Unidade: 1. DB | 2. Defaults do Produto | 3. Formula
                    const unitFromProductDefaults = productDefaults[`${varIdLow}_unit`];
                    const fallbackUnit = unitFromProductDefaults || v.defaultUnit || v.unit || v.baseUnit || (v.allowedUnits?.length ? v.allowedUnits[0] : null);

                    let finalValue = savedVal;
                    let finalUnit = fallbackUnit;

                    if (savedVal !== undefined && savedVal !== null) {
                        if (typeof savedVal === 'object' && 'value' in savedVal) {
                            finalValue = savedVal.value;
                            finalUnit = savedVal.unit || fallbackUnit;
                        }
                    } else {
                        finalValue = productDefaults[varIdLow] !== undefined ? productDefaults[varIdLow] : (v.type === 'FIXED' ? v.fixedValue : (v.defaultValue ?? ''));
                    }

                    initialVars[v.id] = { value: finalValue, unit: finalUnit };
                });
                return initialVars;
            };

            if (editingData && editingData.productId === produto?.id) {
                setQuantity(editingData.quantity || 1);
                setUnitPrice(editingData.unitPrice || 0);
                setNotes(notesToUse);
                if (matToUse) setMateriaisSelecionados(matToUse);
                if (optToUse) setOpcoesSelecionadas(optToUse);

                if (parsedFormulaData?.variables) {
                    setDynamicVariables(buildInitialVariables());
                } else if (Object.keys(varsToUse).length > 0) {
                    const normalized: Record<string, { value: any; unit: string | null }> = {};
                    Object.entries(varsToUse).forEach(([key, val]: [string, any]) => {
                        normalized[key] = (val && typeof val === 'object' && 'value' in val) ? val : { value: val, unit: null };
                    });
                    setDynamicVariables(normalized);
                }
            } else if (produto?.id) {
                setQuantity(1);
                setNotes(backup?.notes || '');
                setOpcoesSelecionadas(optToUse);

                if (!matToUse) {
                    const resFicha = await api.get(`/api/catalog/products/${produto.id}/ficha-tecnica`);
                    if (isMounted && resFicha.data.success && resFicha.data.data) {
                        const fichaBase = resFicha.data.data.map((item: any) => ({
                            insumoId: item.insumoId, nome: item.insumo.nome, precoBase: Number(item.insumo.custoUnitario), quantidadeUtilizada: item.quantidade, unidadeBase: item.insumo.unidadeBase
                        }));
                        setMateriaisSelecionados(fichaBase);
                    }
                } else {
                    setMateriaisSelecionados(matToUse);
                }

                if (isMounted && parsedFormulaData?.variables) {
                    setDynamicVariables(buildInitialVariables());
                }
            }

            if (produto?.id) {
                try {
                    const response = await api.get(`/api/catalog/products/${produto.id}/configurations`);
                    if (isMounted && response.data.success) setConfiguracoes(response.data.data || []);
                } catch (error) { console.error("Erro ao carregar configurações:", error); }
            }

            if (isMounted) {
                // SÓ trava o recarregamento se tivermos certeza que recebemos os dados reais da API.
                // Se o componente montou vazio antes da API terminar, o isHydrated será false e deixará
                // esse useEffect rodar de novo assim que o attributesStr atualizar com a resposta.
                if (isHydrated) {
                    loadedSignatureRef.current = currentItemId;
                }
                setIsInitializing(false);
            }
        };

        carregarDadosIniciais();
        return () => { isMounted = false; };

        // Dependências ajustadas para reagir magicamente quando o F5 terminar de baixar os dados
    }, [produto?.id, editingData?.id, editingData?.width, editingData?.height, attributesStr, parsedFormulaData]);

    // 4. Motor de Precificação (Execução)
    useEffect(() => {
        if (!parsedFormulaData?.formulaString || isInitializing) return;

        const timer = setTimeout(() => {
            const inputs: Record<string, any> = {};
            
            // Variáveis dinâmicas (Inputs do usuário)
            Object.entries(dynamicVariables).forEach(([id, data]) => {
                const idLow = id.toLowerCase();
                inputs[idLow] = data.value;
                inputs[`${idLow}_unit`] = data.unit;
                inputs[id] = data.value;
                inputs[`${id}_unit`] = data.unit;
            });

            // Materiais/Insumos
            inputs['custo_materiais'] = materiaisSelecionados.reduce((acc, m) => acc + (m.quantidadeUtilizada * m.precoBase), 0);
            inputs['quantidade'] = quantity;

            setSimulatingPrice(true);
            try {
                const result = calculatePricingResult(parsedFormulaData.formulaString, parsedFormulaData.variables, inputs);
                if (result.value !== undefined) setUnitPrice(Number(result.value));
            } catch (err) {
                console.error("Erro no cálculo:", err);
            } finally {
                setSimulatingPrice(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [parsedFormulaData, dynamicVariables, materiaisSelecionados, quantity, isInitializing]);

    // 5. Handlers
    const handleDynamicVarChange = useCallback((id: string, field: 'value' | 'unit', val: any) => {
        setDynamicVariables(prev => {
            const next = { ...prev, [id]: { ...prev[id], [field]: val } };
            if (produto?.id) {
                const currentCache = formBackupCache.get(produto.id) || { vars: {}, materiais: [], notes: '', options: {} };
                formBackupCache.set(produto.id, { ...currentCache, vars: next });
            }
            return next;
        });
    }, [produto?.id]);

    const handleMateriaisChange = useCallback((novosMateriais: InsumoMaterialSelecionado[]) => {
        setMateriaisSelecionados(novosMateriais);
        if (produto?.id) {
            const currentCache = formBackupCache.get(produto.id) || { vars: {}, materiais: [], notes: '', options: {} };
            formBackupCache.set(produto.id, { ...currentCache, materiais: novosMateriais });
        }
    }, [produto?.id]);

    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNotes(e.target.value);
        if (produto?.id) {
            const currentCache = formBackupCache.get(produto.id) || { vars: {}, materiais: [], notes: '', options: {} };
            formBackupCache.set(produto.id, { ...currentCache, notes: e.target.value });
        }
    };

    const handleOptionChange = useCallback(async (configId: string, optionId: string) => {
        const novaSelecao = { ...opcoesSelecionadas, [configId]: optionId };
        setOpcoesSelecionadas(novaSelecao);

        if (produto?.id) {
            const currentCache = formBackupCache.get(produto.id) || { vars: {}, materiais: [], notes: '', options: {} };
            formBackupCache.set(produto.id, { ...currentCache, options: novaSelecao });
        }

        if (!optionId) return;

        try {
            const response = await api.get(`/api/catalog/options/${optionId}/ficha-tecnica`);
            if (response.data.success && response.data.data) {
                const novosInsumos = response.data.data.map((item: any) => ({
                    insumoId: item.insumoId, nome: item.insumo.nome, precoBase: Number(item.insumo.custoUnitario), quantidadeUtilizada: item.quantidade, unidadeBase: item.insumo.unidadeBase
                }));

                setMateriaisSelecionados(prev => {
                    const baseMap = new Map();
                    prev.forEach(m => baseMap.set(m.insumoId, m));
                    novosInsumos.forEach((m: any) => { if (!baseMap.has(m.insumoId)) baseMap.set(m.insumoId, m); });
                    const novoArray = Array.from(baseMap.values());

                    if (produto?.id) {
                        const currentCache = formBackupCache.get(produto.id) || { vars: {}, materiais: [], notes: '', options: {} };
                        formBackupCache.set(produto.id, { ...currentCache, materiais: novoArray as any });
                    }
                    return novoArray as any;
                });
            }
        } catch (error) { console.error("Erro ao carregar ficha da opção:", error); }
    }, [opcoesSelecionadas, produto?.id]);

    const handleSubmit = useCallback(() => {
        if (quantity <= 0 || unitPrice <= 0) return toast.error('Preencha os campos e aguarde o cálculo');

        const vars = {} as any;
        Object.entries(dynamicVariables).forEach(([k, v]) => vars[k.toLowerCase()] = (v as any).value);

        const itemData = {
            id: editingData?.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
            productId: produto.id,
            product: produto,
            width: vars.largura ?? vars.width ?? editingData?.width,
            height: vars.altura ?? vars.height ?? editingData?.height,
            pricingRuleId: resolvedPricingRule?.id || (produto as any)?.pricingRuleId || (produto as any)?.pricingRule?.id || editingData?.pricingRuleId,
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
    }, [produto, editingData, quantity, unitPrice, notes, dynamicVariables, materiaisSelecionados, opcoesSelecionadas, onSubmit, resolvedPricingRule]);

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
                            {config.options?.map((opt: any) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
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
                                    <CurrencyInput value={dynamicVariables[v.id]?.value || 0} onValueChange={(val) => handleDynamicVarChange(v.id, 'value', val || 0)} disabled={isLocked} className="flex-1" />
                                ) : (
                                    <Input type="text" value={dynamicVariables[v.id]?.value ?? ''} onChange={(e) => handleDynamicVarChange(v.id, 'value', e.target.value)} className="h-10 border-slate-200 bg-white flex-1 font-mono text-center" disabled={isLocked} />
                                )}
                                {hasUnits && (
                                    <select value={dynamicVariables[v.id]?.unit || v.defaultUnit || v.unit || ''} onChange={(e) => handleDynamicVarChange(v.id, 'unit', e.target.value)} disabled={isLocked} className="w-20 h-10 px-1 border border-slate-200 rounded-md bg-white text-xs">
                                        {(v.allowedUnits || []).map((u: string) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>
                    );
                })}

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Quantidade</label>
                    <Input type="number" value={quantity || ''} onChange={(e) => setQuantity(Number(e.target.value))} placeholder="1" min="1" className="h-10 border-slate-200 bg-white" />
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

            <div className="pt-2">
                <SeletorInsumos insumos={insumos} materiaisIniciais={materiaisSelecionados} onMaterialsChange={handleMateriaisChange} />
            </div>

            <div>
                <label className="text-sm font-medium">Observações</label>
                <textarea value={notes} onChange={handleNotesChange} placeholder="Observações do item..." className="w-full h-20 p-3 border border-input rounded-md resize-none mt-1" />
            </div>

            <Button onClick={handleSubmit} disabled={quantity <= 0 || unitPrice <= 0 || simulatingPrice} className="w-full">
                {isEditing ? <><Save className="w-4 h-4 mr-2" /> Salvar</> : <><Plus className="w-4 h-4 mr-2" /> Adicionar</>}
            </Button>
        </div>
    );
};

export default ProductItemForm;