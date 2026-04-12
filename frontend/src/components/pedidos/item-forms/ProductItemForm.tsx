import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import CurrencyInput from '@/components/ui/CurrencyInput';
import {
    Plus, 
    Package, 
    Save,
    Coins,
    Lock,
    Unlock,
    Edit3,
    X,
    Info,
    Shield
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useInsumos } from '@/features/supplies/useInsumos';
import { SeletorInsumos } from '@/features/supplies/SeletorInsumos';
import { InsumoMaterialSelecionado } from '@/features/supplies/types';
import { calculatePricingResult, applyNormalization } from '@/lib/pricing/formulaUtils';
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
import { cn } from '@/lib/utils';

interface Produto {
    id: string;
    name: string;
    description?: string;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    pricingRuleId?: string;
    pricingRule?: { id: string; name: string; formula: any; };
    formulaData?: any;
    priceLocked?: boolean;
}

interface ProductItemFormProps {
    produto: Produto;
    onSubmit: (itemData: any) => void;
    editingData?: any;
    isEditing?: boolean;
    isPriceUnlocked?: boolean;
}

const ProductItemForm: React.FC<ProductItemFormProps> = ({
    produto,
    onSubmit,
    editingData,
    isEditing = false,
    isPriceUnlocked: isPriceUnlockedParam = false
}) => {
    // ── Estados Principais ────────────────────────────────────────────
    const [quantity, setQuantity] = useState<number>(editingData?.quantity || 1);
    const isStaticAreaBased = produto.pricingMode === 'SIMPLE_AREA';
    const [unitPrice, setUnitPrice] = useState<number | string>(
        editingData?.unitPrice ?? (isStaticAreaBased ? 0 : (produto.salePrice || 0))
    );
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
    const [globalUnit, setGlobalUnit] = useState<'M' | 'CM' | 'MM'>('MM');
    // Adicionamos um ref para controlar se já inicializamos a unidade global para este produto
    const unitInitializedRef = React.useRef<string | null>(null);

    // Buscar unidade padrão da organização
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await api.get('/api/organization/settings');
                if (response.data?.success && response.data.data?.defaultSalesUnit) {
                    setGlobalUnit(response.data.data.defaultSalesUnit as any);
                }
            } catch (err) {
                console.error('Erro ao buscar unidade padrão:', err);
            }
        };
        fetchSettings();
    }, []);

    // ── Lógica de Conversão Unitária ──────────────────────────────────

    // ── Estados de Autorização ───────────────────────────────────────
    const { user, hasPermission } = useAuth();
    const [isPriceUnlocked, setIsPriceUnlocked] = useState(isPriceUnlockedParam);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    const canEditPriceByRole = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'MANAGER' || hasPermission('sales.edit_price');
    const isPriceLocked = produto.priceLocked && !isPriceUnlocked && !canEditPriceByRole;

    const handleAuthorize = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authEmail || !authPassword) {
            toast.error('Preencha email e senha');
            return;
        }
        setAuthLoading(true);
        try {
            await api.post('/api/auth/authorize-supervisor', { email: authEmail, password: authPassword });
            setIsPriceUnlocked(true);
            setShowAuthModal(false);
            setAuthPassword('');
            toast.success('Edição de preço liberada!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Credenciais inválidas ou sem permissão gerencial');
        } finally {
            setAuthLoading(false);
        }
    };

    // ── Motor de Composição ───────────────────────────────────────────
    const { composition, loading: compLoading } = useComposition({
        productId: produto.id,
        selectedOptionIds: Object.values(opcoesSelecionadas).filter(Boolean),
        quantity,
        debounceMs: 50 // UX ultra rápida
    });

    const { blockedIds } = useIncompatibilities(Object.values(opcoesSelecionadas).filter(Boolean));

    const handleIndividualUnitChange = (id: string, newUnit: string) => {
        const conversionMap: Record<string, number> = { 'mm': 1, 'cm': 10, 'm': 1000 };
        const targetUnit = newUnit.toLowerCase();
        
        setDynamicVariables(prev => {
            const currentVar = prev[id] || { value: '', unit: 'mm' };

            const oldUnit = (currentVar.unit || 'mm').toLowerCase();
            if (oldUnit === targetUnit) return prev;

            const oldFactor = conversionMap[oldUnit] || 1;
            const newFactor = conversionMap[targetUnit] || 1;
            const numericValue = parseFloat(String(currentVar.value || '').replace(',', '.'));
            
            let newValue = currentVar.value;
            if (!isNaN(numericValue) && currentVar.value !== '') {
                const converted = (numericValue * oldFactor) / newFactor;
                newValue = Number.isInteger(converted) ? converted.toString() : converted.toFixed(2).replace('.', ',');
            }

            return {
                ...prev,
                [id]: { ...currentVar, value: newValue, unit: targetUnit }
            };
        });
    };

    // ── Carregamento de Dados ─────────────────────────────────────────
    useEffect(() => {
        if (!produto?.id) return;
        
        isPriceManualRef.current = false;
        
        api.get(`/api/catalog/products/${produto.id}/configurations/complete`)
            .then(res => {
                    if (res.data?.success && res.data.data) {
                        const rawData = res.data.data;
                        const items = Array.isArray(rawData) ? rawData : (Array.isArray(rawData.configurations) ? rawData.configurations : []);
                        
                        setConfiguracoes(items);
                        
                        const defaults: Record<string, string> = {};
                        items.forEach((c: any) => {
                            if (c.required && Array.isArray(c.options) && c.options.length > 0) {
                                defaults[c.id] = c.options[0].id;
                            }
                        });
                        setOpcoesSelecionadas(defaults);
                    } else {
                        setConfiguracoes([]);
                    }
            })
            .catch(err => console.error("Erro ao carregar variações:", err));
    }, [produto.id]);

    const pricingRule = useMemo(() => {
        const ruleFromProp = (produto as any)?.pricingRule;
        if (ruleFromProp?.formula) return typeof ruleFromProp.formula === 'string' ? JSON.parse(ruleFromProp.formula) : ruleFromProp.formula;
        return null;
    }, [produto]);

    // Vars visíveis para o vendedor editar (dim ensões, etc.)
    const inputVars = useMemo(() => pricingRule?.variables?.filter((v: any) => {
        const isHidden = v.visible === false;
        const isPriceField = v.role === 'SALE_PRICE' || v.role === 'MONETARY' || 
                             (v.name || '').toUpperCase().includes('PREÇO') || 
                             (v.name || '').toUpperCase().includes('PRECO') ||
                             (v.name || '').toUpperCase().includes('PRICE');
        const isInput = v.type === 'INPUT' || !v.type;
        return !isHidden && !isPriceField && isInput;
    }) || [], [pricingRule]);

    // Vars ocultas que alimentam a fórmula silenciosamente (ex: VALOR_BASE)
    const hiddenFormulaVars = useMemo(() => pricingRule?.variables?.filter((v: any) => {
        const isPriceField = v.role === 'SALE_PRICE' || v.role === 'MONETARY';
        const isInput = v.type === 'INPUT' || !v.type;
        return isPriceField && isInput;
    }) || [], [pricingRule]);

    // Mantém o resultado da fórmula em estado para compor
    const [formulaResultValue, setFormulaResultValue] = useState<number>(0);
    const lastSuggestedRef = React.useRef<number>(0);
    const isPriceManualRef = React.useRef<boolean>(false);
    
    const isDynamic = produto.pricingMode === 'DYNAMIC_ENGINEER';
    const isAreaBased = produto.pricingMode === 'SIMPLE_AREA';

    // ── Inicialização de Variáveis via formulaData do Produto ──
    useEffect(() => {
        if (!pricingRule?.variables || unitInitializedRef.current === produto.id) return;
        
        // Se estamos editando um item já existente do pedido, priorizamos os valores salvos
        if (isEditing && Object.keys(dynamicVariables).length > 0) {
            unitInitializedRef.current = produto.id;
            return;
        }

        const newVars: Record<string, { value: any; unit: string | null }> = { ...dynamicVariables };
        let hasChanges = false;

        pricingRule.variables.forEach((v: any) => {
            const key = v.id;
            const fallbackKey = v.name;
            const productConfig = produto.formulaData?.[key] || produto.formulaData?.[fallbackKey];

            // Se for uma variável de preço e estiver vazia, pré-preenchemos com o preço da regra/produto
            let initialValue = v.defaultValue ?? '';
            if (v.role === 'SALE_PRICE' && (!initialValue || initialValue === '0')) {
                initialValue = (pricingRule?.salePrice ?? produto.salePrice ?? 0).toString().replace('.', ',');
            }

            if (newVars[key] === undefined) {
                newVars[key] = {
                    value: productConfig?.value ?? initialValue,
                    unit: productConfig?.unit || v.unit || v.defaultUnit || 'mm',
                    locked: productConfig?.locked ?? false
                } as any;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setDynamicVariables(newVars);
        }

        // BLOQUEIO CRUCIAL: Marcar como inicializado para nunca mais mexer nestes valores enquanto este produto estiver aberto
        unitInitializedRef.current = produto.id;
    }, [pricingRule, produto.id, isEditing]); // Reduzi as dependências para evitar loops

    useEffect(() => {
        if (!pricingRule?.formulaString) return;
        
        const inputs: Record<string, any> = { QTDE: quantity, quantidade: quantity };
        Object.entries(dynamicVariables).forEach(([id, data]) => {
            const numVal = typeof data.value === 'string' 
                ? parseFloat(String(data.value).replace(',', '.')) 
                : Number(data.value || 0);
            // Injeta em minúsculo, maiúsculo e capitalizado para máxima compatibilidade
            inputs[id.toLowerCase()] = numVal;
            inputs[id.toUpperCase()] = numVal;
            inputs[id] = numVal;
            
            const unit = (data as any).unit || globalUnit.toLowerCase() || 'mm';
            inputs[`${id.toLowerCase()}_unit`] = unit;
            inputs[`${id.toUpperCase()}_UNIT`] = unit;
            inputs[`${id}_unit`] = unit;
        });

        try {
            const result = calculatePricingResult(pricingRule.formulaString, pricingRule.variables, inputs);
            const formulaVal = Number(result.value || 0);
            setFormulaResultValue(formulaVal);
            // O resultado da fórmula é apenas armazenado no estado. 
            // O "Motor de Preço" abaixo cuidará de aplicar esse valor ao unitPrice.
        } catch (err) {
            console.error("Erro no cálculo da fórmula:", err);
        }
    }, [pricingRule, dynamicVariables, quantity, configuracoes.length]);

    // ── Motor de Preço e Sugestões ────────────────────────────────────
    useEffect(() => {
        let larguraMM = 0;
        let alturaMM = 0;

        console.log(`[ArtPlim Debug] Motor acionado. globalUnit: ${globalUnit}, formulaResult: ${formulaResultValue}`);
        
        // Se o preço estiver 0, tentamos calcular mesmo com compLoading como fallback.
        if (compLoading && Number(unitPrice) > 0) return;

        let suggested = 0;
        
        // 1. Prioridade Máxima: Fórmula Dinâmica (Cálculo Técnico)
        if (formulaResultValue > 0) {
            suggested = formulaResultValue;
        }

        // 2. Fallback: Cálculo Manual de Área caso a fórmula técnica não retorne valor
        const isAreaBased = produto.pricingMode === 'SIMPLE_AREA' || produto.pricingMode === 'DYNAMIC_ENGINEER';

        if (isAreaBased && suggested <= 0) {
            const fallbackVars = [
                { id: 'LARGURA', name: 'Largura', type: 'INPUT', role: 'LENGTH', defaultUnit: globalUnit.toLowerCase() },
                { id: 'ALTURA', name: 'Altura', type: 'INPUT', role: 'LENGTH', defaultUnit: globalUnit.toLowerCase() }
            ];
            
            const scopeToNormalize: Record<string, any> = {};
            Object.entries(dynamicVariables).forEach(([id, data]: [string, any]) => {
                const searchKey = id.toUpperCase();
                scopeToNormalize[searchKey] = data.value;
                
                // Se NÃO for dinâmico, ignoramos a unidade salva e usamos a do seletor global (M/CM/MM)
                const unitToUse = (produto.pricingMode === 'DYNAMIC_ENGINEER') 
                    ? (data.unit || globalUnit.toLowerCase() || 'mm')
                    : (globalUnit.toLowerCase() || 'mm');
                
                scopeToNormalize[`${searchKey}_UNIT`] = unitToUse;
            });

            const currentVariables = pricingRule?.variables || fallbackVars;
            const normalized = applyNormalization(currentVariables, scopeToNormalize);
            
            // Busca a variável de LARGURA/ALTURA na regra
            const varLargura = currentVariables.find((v: any) => 
                (v.role === 'LENGTH' || v.role === 'AREA' || v.role === 'DIMENSION') && 
                ['LARGURA', 'WIDTH', 'LAR', 'COMPRIMENTO'].some(k => (v.name || v.id || '').toUpperCase().includes(k))
            ) || currentVariables.find((v: any) => ['LARGURA', 'WIDTH', 'LAR'].some(k => (v.name || v.id || '').toUpperCase().includes(k)));

            const varAltura = currentVariables.find((v: any) => 
                (v.role === 'LENGTH' || v.role === 'AREA' || v.role === 'DIMENSION') && 
                ['ALTURA', 'HEIGHT', 'ALT'].some(k => (v.name || v.id || '').toUpperCase().includes(k))
            ) || currentVariables.find((v: any) => ['ALTURA', 'HEIGHT', 'ALT'].some(k => (v.name || v.id || '').toUpperCase().includes(k)));

            // Tenta obter o valor normalizado por ID ou Nome (Case Insensitive)
            const getVal = (v: any) => {
                if (!v) return 0;
                return normalized[v.id] || normalized[v.id.toUpperCase()] || normalized[v.name] || normalized[v.name.toUpperCase()] || 0;
            };

            larguraMM = Number(getVal(varLargura));
            alturaMM = Number(getVal(varAltura));

            if (larguraMM > 0 && alturaMM > 0) {
                const m2 = (larguraMM * alturaMM) / 1000000;
                
                // Busca o preço base nas variáveis (ex: Valor do M²) ou no produto
                const varPreco = currentVariables.find((v: any) => v.role === 'SALE_PRICE' || v.role === 'MONETARY');
                
                const rawPriceText = varPreco ? (dynamicVariables[varPreco.id]?.value || '0') : '0';
                const precoBaseBruto = typeof rawPriceText === 'string' 
                    ? parseFloat(rawPriceText.replace(',', '.')) 
                    : Number(rawPriceText || 0);
                
                const baseSalePrice = precoBaseBruto > 0 ? precoBaseBruto : (pricingRule?.salePrice ?? produto.salePrice ?? 0);
                const basePrice = Number(baseSalePrice || 0);
                
                suggested = basePrice * m2;
                console.log(`[ArtPlim Debug] Calc: L:${larguraMM} H:${alturaMM} M2:${m2} Base:${basePrice} Sug:${suggested}`);
            }
        }

        // 3. Fallback: Motor de Composição (Custo + Markup)
        // Só aplicamos se sugerido continuar 0 e NÃO houver erro de medida em produtos de área
        const hasValidDimensions = larguraMM > 0 && alturaMM > 0;
        
        if (suggested <= 0 && composition && (!isAreaBased || hasValidDimensions)) {
            suggested = (composition as any).unitSuggestedPrice || (Number(composition.suggestedPrice) || 0) / Math.max(1, quantity);
        }

        // 4. Fallback Final: Preço Base do Produto no Cadastro (Unitário)
        // Só usamos o Preço Fixo do Cadastro se NÃO for um modo Dinâmico/Área e as medidas forem inválidas
        if (suggested <= 0 && !isDynamic && !isAreaBased) {
            suggested = Number(produto.salePrice || 0);
        }

        // 5. Decisão de Aplicação
        if (suggested > 0) {
            const currentPrice = Number(unitPrice) || 0;
            const lastSuggested = Number(lastSuggestedRef.current) || 0;
            const isFirstTime = currentPrice === 0;
            const userHasNotTouchedManualPrice = Math.abs(currentPrice - lastSuggested) < 0.01;

            console.log(`[ArtPlim Debug] Decisão Preço: Sug:${suggested}, Atual:${currentPrice}, LastSug:${lastSuggested}, Manual:${isPriceManualRef.current}`);

            // Se for Dinâmico ou Área, e houver mudança de valor sugerido devido a variáveis,
            if ((isFirstTime || userHasNotTouchedManualPrice) && !isPriceManualRef.current) {
                const roundedSuggested = Number(suggested.toFixed(2));
                
                if (Math.abs(currentPrice - roundedSuggested) >= 0.01) {
                    setUnitPrice(roundedSuggested);
                    lastSuggestedRef.current = roundedSuggested;
                }
            }
        }
    }, [composition, formulaResultValue, quantity, isEditing, compLoading, produto.salePrice, produto.pricingMode, dynamicVariables, globalUnit]);

    // ── Sincronização de Materiais de Acabamento ─────────────────────
    useEffect(() => {
        if (!composition?.breakdown || !Array.isArray(composition.breakdown)) return;

        // Extrair apenas o que é ACABAMENTO da composição total
        const finishes = (composition.breakdown
            .filter(item => {
                const category = (item as any).materialCategory || '';
                return category.toUpperCase().includes('ACABAMENTO');
            })
            .map(item => ({
                insumoId: item.materialId,
                nome: item.materialName,
                precoBase: item.costPerUnit,
                quantidadeUtilizada: item.quantity / Math.max(1, quantity), // Normalizar por unidade
                unidadeBase: 'UN' as const
            })) as InsumoMaterialSelecionado[]);

        // Atualizamos materiais selecionados mantendo o que o usuário adicionou manualmente (se houver)
        // mas priorizando o que veio da composição automática.
        setMateriaisSelecionados(prev => {
            const currentBreakdown = Array.isArray(composition.breakdown) ? composition.breakdown : [];
            const manualItems = prev.filter(p => !currentBreakdown.some(b => b.materialId === p.insumoId));
            return [...manualItems, ...finishes];
        });
    }, [composition, quantity]);

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
                    totalCost: composition.totalCost
                } : null
            }
        });
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            
            {/* ── GRID DE CAMPOS UNIFICADO ─────────────────────────────────── */}
            <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-4">
                
                {/* Cabeçalho de Dimensões e Seletor Global */}
                {inputVars.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Configurações de Medida</span>
                            <div className="group relative">
                                <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                                <div className="absolute top-full left-0 mt-2 hidden group-hover:block w-64 p-3 bg-slate-800 text-white text-[11px] leading-relaxed rounded-lg shadow-xl z-[100] border border-slate-700">
                                    <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-800 rotate-45"></div>
                                    A unidade global define o padrão inicial, mas você pode alterar medidas individualmente nos campos.
                                </div>
                            </div>
                        </div>

                        {/* Seletor Global de Unidade: Apenas para produtos que não são DYNAMIC_ENGINEER */}
                        {produto.pricingMode !== 'DYNAMIC_ENGINEER' && (
                            <div className="flex bg-slate-100 p-1 rounded-md">
                                {(['M', 'CM', 'MM'] as const).map((unit) => (
                                    <button
                                        key={unit}
                                        type="button"
                                        onClick={() => setGlobalUnit(unit)}
                                        className={cn(
                                            "px-3 py-1 text-[9px] font-black rounded transition-all uppercase",
                                            globalUnit === unit 
                                                ? "bg-white text-indigo-600 shadow-sm" 
                                                : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {unit}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-row items-end gap-4 w-full">
                    
                    {/* Variations */}
                    {Array.isArray(configuracoes) && configuracoes.map(config => (
                        <div key={config.id} className="space-y-1 flex-1 min-w-[150px]">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase truncate">
                                {config.name}
                            </Label>
                            <Select
                                value={opcoesSelecionadas[config.id] || ''}
                                onValueChange={(val) => setOpcoesSelecionadas(prev => ({ ...prev, [config.id]: val }))}
                            >
                                <SelectTrigger className="bg-white border-slate-300 h-9 rounded-md text-sm shadow-sm focus:ring-1 focus:ring-indigo-500">
                                    <SelectValue placeholder="Opção..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.isArray(config.options) && config.options.map((opt: any) => (
                                        <SelectItem key={opt.id} value={opt.id} disabled={blockedIds.includes(opt.id) || !opt.isAvailable}>
                                            <div className="flex justify-between items-center w-full min-w-[180px] text-xs">
                                                <span>{opt.label}</span>
                                                {Number(opt.priceModifier) !== 0 && (
                                                    <span className="text-[9px] text-emerald-600 ml-2">
                                                        {Number(opt.priceModifier) > 0 ? '+' : ''} R$ {Number(opt.priceModifier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}

                    {/* Dimensions Input Individuais */}
                    {inputVars.map((v: any) => {
                        const cleanName = (v.name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
                        const isLockedByProduct = (dynamicVariables[v.id] as any)?.locked === true;
                        const currentUnitRaw = (dynamicVariables[v.id]?.unit || v.defaultUnit || 'mm').toLowerCase();
                        const currentUnitDisplay = currentUnitRaw.toUpperCase();
                        const allowedUnitsRaw = Array.isArray(v.allowedUnits) && v.allowedUnits.length > 0 
                                            ? v.allowedUnits.map((u: string) => u.toLowerCase())
                                            : [currentUnitRaw];

                        return (
                            <div key={v.id} className="space-y-1 flex-1 min-w-[140px]">
                                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                    {cleanName} ({currentUnitDisplay})
                                    {isLockedByProduct && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                                </label>
                                <div className={cn(
                                    "flex rounded-md overflow-hidden border transition-all shadow-sm",
                                    isLockedByProduct 
                                        ? "bg-slate-100 border-slate-200 opacity-80" 
                                        : "bg-white border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500"
                                )}>
                                    <Input 
                                        type="text" 
                                        value={dynamicVariables[v.id]?.value ?? ''} 
                                        onChange={(e) => {
                                            if (isLockedByProduct) return;
                                            handleDynamicVarChange(v.id, 'value', e.target.value);
                                        }}
                                        placeholder="0,00"
                                        disabled={isLockedByProduct}
                                        className={cn(
                                            "h-9 border-0 bg-transparent flex-1 text-center text-sm font-bold focus-visible:ring-0 px-2",
                                            isLockedByProduct && "text-slate-400 cursor-not-allowed"
                                        )} 
                                    />
                                    
                                    {/* Seletor Individual de Unidade */}
                                    <div className="flex border-l border-slate-200 bg-slate-50 min-w-[65px] relative items-center">
                                        {produto.pricingMode === 'DYNAMIC_ENGINEER' && allowedUnitsRaw.length > 1 ? (
                                            <div className="relative w-full h-full flex items-center">
                                                <select
                                                    value={currentUnitRaw}
                                                    onChange={(e) => handleIndividualUnitChange(v.id, e.target.value)}
                                                    className="w-full h-full bg-white/50 pl-2 pr-4 text-[10px] font-black text-indigo-700 uppercase appearance-none cursor-pointer focus:outline-none hover:bg-white transition-all border-0 ring-0 outline-none"
                                                    style={{ border: 'none', background: 'transparent' }}
                                                >
                                                    {allowedUnitsRaw.map((u: string) => (
                                                        <option key={u} value={u} className="bg-white text-slate-900 font-bold p-2 uppercase">
                                                            {u.toUpperCase()}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-1.5 pointer-events-none text-indigo-500">
                                                    <svg width="8" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="flex items-center px-3 text-[10px] font-black text-slate-400 uppercase">
                                                {produto.pricingMode === 'DYNAMIC_ENGINEER' ? currentUnitDisplay : globalUnit}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Preço Base (da Fórmula ou do Cadastro) */}
                    {(isAreaBased || isDynamic) && (
                        <>
                            {/* Debug Renderização */}
                            {(() => {
                                console.log(`[ArtPlim Render] pricingRule:${!!pricingRule}, rulePrice:${pricingRule?.salePrice}, prodPrice:${produto.salePrice}, hiddenVars:${hiddenFormulaVars.length}`);
                                return null;
                            })()}

                            {/* Se for dinâmico, mostramos as variáveis de preço da fórmula (ex: VALOR_BASE) */}
                            {hiddenFormulaVars.map((v: any) => {
                                const val = dynamicVariables[v.id]?.value;
                                // Se a variável estiver vazia, usamos o preço da regra ou do produto
                                const displayVal = (val === undefined || val === '' || Number(val) === 0) 
                                    ? (pricingRule?.salePrice ?? produto.salePrice ?? 0) 
                                    : val;
                                
                                return (
                                    <div key={v.id} className="space-y-1 flex-1 min-w-[120px]">
                                        <Label className="text-[10px] font-bold uppercase text-indigo-600 truncate">
                                            {v.name || 'Valor Base'}
                                        </Label>
                                        <CurrencyInput
                                            value={displayVal}
                                            disabled={true}
                                            className="h-9 bg-indigo-50/20 border-indigo-100 font-extrabold text-indigo-700 text-center text-sm rounded-md shadow-sm"
                                        />
                                    </div>
                                );
                            })}
                            
                            {/* Se for SIMPLE_AREA e não tiver variáveis de preço na regra, mostramos o salePrice do produto */}
                            {isAreaBased && hiddenFormulaVars.length === 0 && (
                                <div className="space-y-1 flex-1 min-w-[120px]">
                                    <Label className="text-[10px] font-bold uppercase text-indigo-600 truncate">
                                        Valor do M²
                                    </Label>
                                    <CurrencyInput
                                        value={pricingRule?.salePrice ?? produto.salePrice ?? 0}
                                        disabled={true}
                                        className="h-9 bg-indigo-50/20 border-indigo-100 font-extrabold text-indigo-700 text-center text-sm rounded-md shadow-sm"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* Quantity */}
                    <div className="space-y-1 w-20 shrink-0">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Qtde</label>
                        <Input 
                            type="number" 
                            value={quantity || ''} 
                            onChange={(e) => setQuantity(Number(e.target.value))} 
                            placeholder="1" 
                            min="1" 
                            className="h-9 border-slate-300 bg-white text-center font-black text-sm shadow-sm" 
                        />
                    </div>

                    {/* Preço Unitário */}
                    <div className="space-y-1 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-bold text-indigo-700 uppercase flex items-center justify-between">
                            <span>Unitário (R$)</span>
                        </label>
                        <div className="relative flex items-center gap-1">
                            <div className="relative flex-1">
                                <CurrencyInput 
                                    value={unitPrice} 
                                    onValueChange={(val) => {
                                        setUnitPrice(val || 0);
                                        isPriceManualRef.current = true;
                                    }}
                                    disabled={isPriceLocked} 
                                    className={`h-9 border-indigo-400 bg-indigo-50/20 text-center font-black text-sm rounded-md text-indigo-900 shadow-sm focus:ring-2 focus:ring-indigo-500 w-full transition-all ${isPriceLocked ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-300 text-slate-500' : ''}`} 
                                />
                                {compLoading && (
                                    <div className="absolute inset-y-0 right-2 flex items-center">
                                        <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>
                            {produto.priceLocked && !canEditPriceByRole && (
                                <button 
                                    type="button"
                                    onClick={() => isPriceUnlocked ? setIsPriceUnlocked(false) : setShowAuthModal(true)}
                                    className={`shrink-0 h-9 w-9 flex justify-center items-center rounded-md border ${isPriceUnlocked ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100 shrink-0'}`}
                                    title={isPriceUnlocked ? "Bloquear novamente" : "Solicitar liberação gerencial"}
                                >
                                    {isPriceUnlocked ? <Unlock className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                                </button>
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

            {/* Modal de Autorização do Supervisor */}
            {showAuthModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
                    <div className="bg-white rounded-2xl w-[400px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-50 border-b px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Autorização Necessária</h3>
                                    <p className="text-xs text-slate-500">Este item requer senha gerencial</p>
                                </div>
                            </div>
                            <button title="Fechar" onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAuthorize} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-600">Email do Autorizador</Label>
                                <Input 
                                    type="email" 
                                    value={authEmail} 
                                    onChange={(e) => setAuthEmail(e.target.value)} 
                                    className="bg-slate-50 font-medium h-11"
                                    placeholder="gerente@artplim.com"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-600">Senha</Label>
                                <Input 
                                    type="password" 
                                    value={authPassword} 
                                    onChange={(e) => setAuthPassword(e.target.value)} 
                                    className="bg-slate-50 font-medium h-11"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <Button type="submit" disabled={authLoading} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 mt-2 tracking-wider">
                                {authLoading ? 'VERIFICANDO...' : 'LIBERAR EDIÇÃO'}
                            </Button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductItemForm;
