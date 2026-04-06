import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { 
    Plus, 
    Package, 
    Save,
    Coins
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useInsumos } from '@/features/insumos/useInsumos';
import { SeletorInsumos } from '@/features/insumos/SeletorInsumos';
import { InsumoMaterialSelecionado } from '@/features/insumos/types';
import { calculatePricingResult } from '@/lib/pricing/formulaUtils';
import { useComposition } from '@/features/orders/hooks/useComposition';
import { useIncompatibilities } from '@/features/orders/hooks/useIncompatibilities';
import { PriceSummaryPanel } from '@/features/orders/components/ConfiguratorModal/PriceSummaryPanel';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';

interface Produto {
    id: string;
    name: string;
    description?: string;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    pricingRuleId?: string;
    pricingRule?: { id: string; name: string; formula: any; };
    formulaData?: any;
    targetMarkup?: number;
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
    // ── Estados Principais ────────────────────────────────────────────
    const [quantity, setQuantity] = useState<number>(editingData?.quantity || 1);
    const [unitPrice, setUnitPrice] = useState<number>(editingData?.unitPrice || 0);
    const [notes, setNotes] = useState(editingData?.notes || '');
    const [materiaisSelecionados, setMateriaisSelecionados] = useState<InsumoMaterialSelecionado[]>(
        editingData?.attributes?.insumos || []
    );
    const [dynamicVariables, setDynamicVariables] = useState<Record<string, { value: any; unit: string | null }>>(
        editingData?.attributes?.dynamicVariables || {}
    );
    const [opcoesSelecionadas, setOpcoesSelecionadas] = useState<Record<string, string>>(
        editingData?.attributes?.selectedOptions || {}
    );
    const [configuracoes, setConfiguracoes] = useState<any[]>([]);
    const [simulatingPrice, setSimulatingPrice] = useState(false);
    const { insumos } = useInsumos();

    // ── Motor de Composição ───────────────────────────────────────────
    const { composition, loading: compLoading } = useComposition({
        productId: produto.id,
        selectedOptionIds: Object.values(opcoesSelecionadas).filter(Boolean),
        quantity
    });

    const { blockedIds } = useIncompatibilities(Object.values(opcoesSelecionadas).filter(Boolean));

    // ── Carregamento de Dados ─────────────────────────────────────────
    useEffect(() => {
        if (!produto?.id) return;
        
        api.get(`/api/catalog/products/${produto.id}/configurations/complete`)
            .then(res => {
                if (res.data?.success && res.data.data?.configurations) {
                    setConfiguracoes(res.data.data.configurations);
                    if (!isEditing && Object.keys(opcoesSelecionadas).length === 0) {
                        const defaults: Record<string, string> = {};
                        res.data.data.configurations.forEach((c: any) => {
                            if (c.required && c.options.length > 0) {
                                defaults[c.id] = c.options[0].value;
                            }
                        });
                        setOpcoesSelecionadas(defaults);
                    }
                }
            })
            .catch(err => console.error("Erro ao carregar variações:", err));
            
        if (!isEditing && materiaisSelecionados.length === 0) {
            api.get(`/api/catalog/products/${produto.id}/ficha-tecnica`)
                .then(res => {
                    if (res.data?.success && res.data.data) {
                        const fichaBase = res.data.data.map((item: any) => {
                            const m = item.material || {};
                            return {
                                insumoId: item.materialId,
                                nome: m.name || 'Insumo sem nome',
                                precoBase: Number(m.costPrice || m.averageCost || 0),
                                quantidadeUtilizada: item.quantidade || 0,
                                unidadeBase: m.unit || 'un'
                            };
                        });
                        setMateriaisSelecionados(fichaBase);
                    }
                })
                .catch(err => console.error("Erro ao carregar ficha técnica:", err));
        }
    }, [produto.id]);

    const pricingRule = useMemo(() => {
        const ruleFromProp = (produto as any)?.pricingRule;
        if (ruleFromProp?.formula) return typeof ruleFromProp.formula === 'string' ? JSON.parse(ruleFromProp.formula) : ruleFromProp.formula;
        return null;
    }, [produto]);

    const inputVars = useMemo(() => pricingRule?.variables?.filter((v: any) => {
        const isHidden = v.visible === false;
        const isPriceField = v.role === 'SALE_PRICE' || v.role === 'MONETARY' || 
                             (v.name || '').toUpperCase().includes('PREÇO') || 
                             (v.name || '').toUpperCase().includes('PRECO') ||
                             (v.name || '').toUpperCase().includes('PRICE');
        const isInput = v.type === 'INPUT' || !v.type;
        return !isHidden && !isPriceField && isInput;
    }) || [], [pricingRule]);

    // Mantém o resultado da fórmula em estado para compor
    const [formulaResultValue, setFormulaResultValue] = useState<number>(0);

    useEffect(() => {
        if (!pricingRule?.formulaString) return;
        const timer = setTimeout(() => {
            const inputs: Record<string, any> = { QTDE: quantity, quantidade: quantity };
            Object.entries(dynamicVariables).forEach(([id, data]) => {
                inputs[id.toLowerCase()] = data.value;
                inputs[`${id.toLowerCase()}_unit`] = data.unit;
            });
            setSimulatingPrice(true);
            try {
                const result = calculatePricingResult(pricingRule.formulaString, pricingRule.variables, inputs);
                const formulaVal = Number(result.value || 0);
                setFormulaResultValue(formulaVal);
                
                // Se o produto NÃO tem opções de configuração, a fórmula dita o preço base
                if (configuracoes.length === 0 && !isEditing && unitPrice === 0) {
                    setUnitPrice(formulaVal);
                }
            } catch (err) {
                console.error("Erro no cálculo da fórmula:", err);
            } finally {
                setSimulatingPrice(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [pricingRule, dynamicVariables, quantity, configuracoes.length]);

    // O Motor de Composição sugere o preço, mas ele não deve esmagar a fórmula caso ela gere um valor maior.
    useEffect(() => {
        if (!isEditing) {
            let suggested = 0;
            
            if (composition && configuracoes.length > 0) {
                const compositionSuggested = composition.suggestedPrice / Math.max(1, quantity);
                // Pegamos o maior entre a sugestão da composição (que tem markup sobre insumos)
                // e o valor calculado pela fórmula do produto (ou preço base).
                suggested = Math.max(compositionSuggested, formulaResultValue, Number(produto.salePrice || 0));
            } else if (formulaResultValue > 0) {
                suggested = formulaResultValue;
            } else {
                suggested = Number(produto.salePrice || 0);
            }

            if (suggested > 0) {
                // Atualiza o unitPrice de imediato, e caso mude a opção pra uma + cara
                // Para manter a manualidade, idealmente só preenchemos automático no início ou se a variação forçar muito
                // Como não queremos travar o usuário de digitar, colocamos um limiar ou só se o unitPrice atual for menor
                if (unitPrice === 0 || suggested > unitPrice) {
                    setUnitPrice(Number(Number(suggested).toFixed(2)));
                } else if (configuracoes.length > 0 && unitPrice === 0) {
                   setUnitPrice(Number(Number(suggested).toFixed(2)));
                }
            }
        }
    }, [composition, formulaResultValue, quantity, isEditing, configuracoes.length, produto.salePrice]);

    const handleDynamicVarChange = (id: string, field: 'value' | 'unit', val: any) => {
        setDynamicVariables(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
    };

    const handleSubmit = () => {
        if (quantity <= 0 || unitPrice <= 0) return toast.error('Coloque a quantidade e o preço.');
        onSubmit({
            id: editingData?.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
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
                compositionSnapshot: composition ? {
                    unitCostEstimate: composition.totalCost / quantity,
                    profitEstimate: (unitPrice * quantity) - composition.totalCost
                } : null
            }
        });
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            
            {/* ── GRID DE CAMPOS UNIFICADO ─────────────────────────────────── */}
            <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    
                    {/* Variations */}
                    {configuracoes.map(config => (
                        <div key={config.id} className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">
                                {config.name} {config.required && <span className="text-red-500">*</span>}
                            </Label>
                            <Select
                                value={opcoesSelecionadas[config.id] || ''}
                                onValueChange={(val) => setOpcoesSelecionadas(prev => ({ ...prev, [config.id]: val }))}
                            >
                                <SelectTrigger className="bg-white border-slate-300 h-9 rounded-md text-sm shadow-sm focus:ring-1 focus:ring-indigo-500">
                                    <SelectValue placeholder="Opção..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {config.options.map((opt: any) => (
                                        <SelectItem key={opt.id} value={opt.value} disabled={blockedIds.includes(opt.id) || !opt.isAvailable}>
                                            <div className="flex justify-between items-center w-full min-w-[180px] text-xs">
                                                <span>{opt.label}</span>
                                                {Number(opt.priceModifier) !== 0 && (
                                                    <span className="text-[9px] text-emerald-600 ml-2">
                                                        {Number(opt.priceModifier) > 0 ? '+' : ''} R$ {Number(opt.priceModifier).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}

                    {/* Dimensions Input */}
                    {inputVars.map((v: any) => (
                        <div key={v.id} className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">{v.name}</label>
                            <div className="flex rounded-md overflow-hidden border border-slate-300 bg-white shadow-sm">
                                <Input 
                                    type="text" 
                                    value={dynamicVariables[v.id]?.value ?? ''} 
                                    onChange={(e) => handleDynamicVarChange(v.id, 'value', e.target.value)} 
                                    className="h-9 border-0 bg-transparent flex-1 text-center text-sm font-bold" 
                                />
                                {v.allowedUnits?.length > 0 && (
                                    <span className="flex items-center px-2 bg-slate-100 text-[10px] font-bold text-slate-500 border-l border-slate-200 uppercase">
                                        {dynamicVariables[v.id]?.unit || v.defaultUnit}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Quantity */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Quantidade</label>
                        <Input 
                            type="number" 
                            value={quantity || ''} 
                            onChange={(e) => setQuantity(Number(e.target.value))} 
                            placeholder="1" 
                            min="1" 
                            className="h-9 border-slate-300 bg-white text-center font-bold text-sm shadow-sm" 
                        />
                    </div>

                    {/* PRICE FIELD - THE ONLY ONE */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-indigo-700 uppercase flex items-center gap-1">
                            Preço Unitário (R$)
                        </label>
                        <div className="relative">
                            <CurrencyInput 
                                value={unitPrice} 
                                onValueChange={(val) => setUnitPrice(val || 0)} 
                                className="h-9 border-indigo-400 bg-indigo-50/20 text-center font-black text-sm rounded-md text-indigo-900 shadow-sm focus:ring-2 focus:ring-indigo-500" 
                            />
                            {compLoading && (
                                <div className="absolute inset-y-0 right-2 flex items-center">
                                    <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── RODAPÉ REESTRUTURADO ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                
                {/* Lado Esquerdo: Insumos (3/5) */}
                <div className="lg:col-span-3 space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <Package className="w-3 h-3" />
                        Composição de Insumos
                    </div>
                    <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm min-h-[160px]">
                        <SeletorInsumos insumos={insumos} materiaisIniciais={materiaisSelecionados} onMaterialsChange={setMateriaisSelecionados} />
                    </div>
                </div>

                {/* Lado Direito: Financeiro (2/5) */}
                <div className="lg:col-span-2 space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <Coins className="w-3 h-3" />
                        Resumo de Lucratividade
                    </div>
                    <PriceSummaryPanel
                        composition={composition}
                        loading={compLoading}
                        negotiatedPrice={unitPrice}
                        quantity={quantity}
                        targetMarkup={produto.targetMarkup || 2.0}
                    />
                </div>
            </div>

            {/* Obs e Botão Final */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <div className="flex-1">
                   <textarea 
                        value={notes || ''} 
                        onChange={(e) => setNotes(e.target.value)} 
                        placeholder="Observações do item..." 
                        className="w-full h-10 p-2 border border-slate-200 rounded-lg bg-slate-50 text-[11px] font-medium resize-none focus:h-20 transition-all" 
                    />
                </div>
                <div className="w-full sm:w-64">
                    <Button onClick={handleSubmit} disabled={quantity <= 0 || unitPrice <= 0 || simulatingPrice} className="w-full h-10 text-xs font-bold uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 shadow-md rounded-lg">
                        {isEditing ? <Save className="w-3.5 h-3.5 mr-2" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
                        {isEditing ? 'Salvar Item' : 'Adicionar Item'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ProductItemForm;