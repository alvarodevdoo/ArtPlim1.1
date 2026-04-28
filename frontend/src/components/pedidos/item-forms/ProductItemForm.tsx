import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { 
    Plus, 
    Package, 
    Save,
    Coins,
    X,
    AlertCircle
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
import { cn } from '@/lib/utils';

// Novos Sub-Componentes Especializados
import { VariationsSection } from './sections/VariationsSection';
import { SimpleAreaSection } from './sections/SimpleAreaSection';
import { DynamicRuleSection } from './sections/DynamicRuleSection';
import { PriceQuantitySection } from './sections/PriceQuantitySection';

interface Produto {
    id: string;
    name: string;
    description?: string;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    pricingRuleId?: string;
    pricingRule?: { id: string; name: string; formulaString?: string; formula?: any; salePrice?: number; variables?: any[] };
    formulaData?: any;
    priceLocked?: boolean;
}

interface ProductItemFormProps {
    produto: Produto;
    onSubmit: (itemData: any) => void;
    editingData?: any;
    isEditing?: boolean;
    isPriceUnlocked?: boolean;
    maxDiscountThreshold?: number;
}

const ProductItemForm: React.FC<ProductItemFormProps> = ({
    produto,
    onSubmit,
    editingData,
    isEditing = false,
    isPriceUnlocked: isPriceUnlockedParam = false,
    maxDiscountThreshold = 0.15
}) => {
    // ── Estados Principais ────────────────────────────────────────────
    const [quantity, setQuantity] = useState<number>(editingData?.quantity || 1);
    const [unitPrice, setUnitPrice] = useState<number | string>(
        editingData?.unitPrice ?? (produto.pricingMode === 'SIMPLE_AREA' ? 0 : (produto.salePrice || 0))
    );
    const [discountItem, setDiscountItem] = useState<number | string>(editingData?.discountItem || 0);
    const [notes, setNotes] = useState(editingData?.notes || '');
    const [materiaisSelecionados, setMateriaisSelecionados] = useState<InsumoMaterialSelecionado[]>(
        editingData?.attributes?.insumos || []
    );
    const [dynamicVariables, setDynamicVariables] = useState<Record<string, any>>(
        editingData?.attributes?.dynamicVariables || {}
    );
    const [opcoesSelecionadas, setOpcoesSelecionadas] = useState<Record<string, string>>(
        editingData?.attributes?.selectedOptions || {}
    );
    const [configuracoes, setConfiguracoes] = useState<any[]>([]);
    const { insumos } = useInsumos();
    const [globalUnit, setGlobalUnit] = useState<'M' | 'CM' | 'MM'>('MM');
    const unitInitializedRef = React.useRef<string | null>(null);

    // ── Autorização e Permissões ─────────────────────────────────────
    const { user, hasPermission } = useAuth();
    const [isPriceUnlocked, setIsPriceUnlocked] = useState(isPriceUnlockedParam);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
    const [requestStatus, setRequestStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | null>(null);
    const canEditPriceByRole = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'MANAGER' || hasPermission('sales.edit_price');
    const isPriceLocked = produto.priceLocked && !isPriceUnlocked && !canEditPriceByRole;

    // ── Carregamento de Regras e Variáveis ────────────────────────────
    const pricingRule = useMemo(() => {
        const ruleFromProp = (produto as any)?.pricingRule;
        if (ruleFromProp?.formula) return typeof ruleFromProp.formula === 'string' ? JSON.parse(ruleFromProp.formula) : ruleFromProp.formula;
        return ruleFromProp || null;
    }, [produto]);

    const inputVars = useMemo(() => {
        let vars = pricingRule?.variables?.filter((v: any) => {
            const isHidden = v.visible === false;
            const nameUpper = (v.name || v.id || '').toUpperCase();
            const isPriceField = v.role === 'SALE_PRICE' || v.role === 'MONETARY' || 
                                 nameUpper.includes('PREÇO') || nameUpper.includes('PRECO') ||
                                 nameUpper.includes('PRICE') || nameUpper.includes('VALOR');
            const isInput = v.type === 'INPUT' || !v.type;
            return !isHidden && !isPriceField && isInput;
        }) || [];

        // Se for modo ÁREA e não tiver variáveis na regra, forçamos as dimensões padrão
        if (produto.pricingMode === 'SIMPLE_AREA' && vars.length === 0) {
            vars = [
                { id: 'LARGURA', name: 'Largura', type: 'INPUT', role: 'LENGTH', defaultUnit: globalUnit.toLowerCase() },
                { id: 'ALTURA', name: 'Altura', type: 'INPUT', role: 'LENGTH', defaultUnit: globalUnit.toLowerCase() }
            ];
        }
        return vars;
    }, [pricingRule, produto.pricingMode, globalUnit]);

    // ── Normalização para o Motor de Composição ──────────────────────
    const normalizedDims = useMemo(() => {
        const scope = Object.entries(dynamicVariables).reduce((acc, [key, varObj]) => {
            acc[key] = varObj.value;
            if (varObj.unit) {
                acc[`${key.toUpperCase()}_UNIT`] = varObj.unit;
            }
            return acc;
        }, {} as Record<string, any>);

        const norm = applyNormalization(inputVars, scope);
        return {
            width: Number(norm['LARGURA'] || 0),
            height: Number(norm['ALTURA'] || 0)
        };
    }, [dynamicVariables, inputVars]);

    // ── Motor de Composição ───────────────────────────────────────────
    const { composition, loading: compLoading } = useComposition({
        productId: produto.id,
        selectedOptionIds: Object.values(opcoesSelecionadas).filter(Boolean),
        quantity,
        dynamicVariables,
        width: normalizedDims.width,
        height: normalizedDims.height,
        debounceMs: 200 // Aumentado levemente para estabilidade
    });
    const { blockedIds } = useIncompatibilities(Object.values(opcoesSelecionadas).filter(Boolean));
    const hiddenFormulaVars = useMemo(() => pricingRule?.variables?.filter((v: any) => {
        const nameUpper = (v.name || v.id || '').toUpperCase();
        const isPriceField = v.role === 'SALE_PRICE' || v.role === 'MONETARY' || 
                             nameUpper.includes('PREÇO') || nameUpper.includes('PRECO') ||
                             nameUpper.includes('PRICE') || nameUpper.includes('VALOR');
        return isPriceField && (v.type === 'INPUT' || !v.type);
    }) || [], [pricingRule]);

    // ── Efeitos de Inicialização ──────────────────────────────────────
    useEffect(() => {
        if (!produto?.id || unitInitializedRef.current === produto.id) return;
        
        const loadConfigsAndVariables = async () => {
             try {
                // 1. Unidade Global real resolvida direto da API
                let resolvedGlobalUnit = globalUnit;
                const orgResp = await api.get('/api/organization/settings');
                if (orgResp.data?.success && orgResp.data.data?.defaultSalesUnit) {
                    resolvedGlobalUnit = orgResp.data.data.defaultSalesUnit;
                    setGlobalUnit(resolvedGlobalUnit as any);
                }

                // 2. Configurações (Variações)
                const confResp = await api.get(`/api/catalog/products/${produto.id}/configurations/complete`);
                const itemsList = confResp.data?.data || [];
                setConfiguracoes(Array.isArray(itemsList) ? itemsList : (itemsList.configurations || []));
                
                const defaults: Record<string, string> = {};
                (Array.isArray(itemsList) ? itemsList : []).forEach((c: any) => {
                    if (c.required && Array.isArray(c.options) && c.options.length > 0) {
                        defaults[c.id] = c.options[0].id;
                    }
                });
                setOpcoesSelecionadas(prev => ({ ...defaults, ...prev }));

                // 3. Inicializar Variáveis Dinâmicas
                const currentVariables = inputVars.length > 0 ? inputVars : (produto.pricingMode === 'SIMPLE_AREA' ? [
                    { id: 'LARGURA', name: 'Largura', type: 'INPUT', role: 'LENGTH', defaultUnit: resolvedGlobalUnit.toLowerCase() },
                    { id: 'ALTURA', name: 'Altura', type: 'INPUT', role: 'LENGTH', defaultUnit: resolvedGlobalUnit.toLowerCase() }
                ] : []);

                const newVars: Record<string, any> = { ...dynamicVariables };
                currentVariables.forEach((v: any) => {
                    if (newVars[v.id] === undefined) {
                        let startingUnit = v.defaultUnit || resolvedGlobalUnit.toLowerCase();
                        const isLength = v.role === 'LENGTH' || (v.name || '').toLowerCase().includes('largura') || (v.name || '').toLowerCase().includes('altura');
                        if (isLength) {
                            startingUnit = resolvedGlobalUnit.toLowerCase();
                        }

                        newVars[v.id] = {
                            value: v.defaultValue ?? '',
                            unit: startingUnit,
                            locked: false
                        };
                    }
                });

                // Inicializar variáveis ocultas (preços base, etc)
                hiddenFormulaVars.forEach((v: any) => {
                    if (newVars[v.id] === undefined) {
                        let fallbackVal = v.defaultValue !== undefined ? v.defaultValue : (v.value !== undefined ? v.value : null);
                        
                        // Busca se o valor foi configurado nativamente no Produto (Aba de Variáveis Padrão do Catálogo)
                        const productFormulaData = (produto as any)?.formulaData || (produto as any)?.attributes?.formulaData || {};
                        const definedInProduct = productFormulaData[v.id]?.value ?? productFormulaData[v.name]?.value;
                        if (definedInProduct !== undefined && definedInProduct !== null && definedInProduct !== '') {
                            fallbackVal = definedInProduct;
                        }

                        // Busca profunda se o usuário gravou o valor da variável nos referenceValues da regra
                        if ((fallbackVal === null || fallbackVal === undefined) && pricingRule?.referenceValues) {
                            fallbackVal = pricingRule.referenceValues[v.id] || pricingRule.referenceValues[v.name?.toUpperCase()] || null;
                        }
                        
                        if (fallbackVal === null || fallbackVal === undefined || fallbackVal === '0' || fallbackVal === 0 || fallbackVal === '') {
                            fallbackVal = pricingRule?.salePrice || produto.salePrice || produto.costPrice || 0;
                        }
                        
                        // Forçar a conversão para número
                        newVars[v.id] = { value: Number(fallbackVal) || 0, locked: true };
                    }
                });

                setDynamicVariables(newVars);
                unitInitializedRef.current = produto.id;
            } catch (err) { console.error("Erro na inicialização:", err); }
        };
        loadConfigsAndVariables();
    }, [produto.id]);

    // ── Sincronização de Composição com Regra Dinâmica ──────────────
    // Se a composição (Variações selecionadas) calcular um preço (ex: R$ 80 do Vinil),
    // devemos "injetar" esse preço na variável da fórmula (ex: VALOR_BASE)
    useEffect(() => {
        if (composition?.unitSuggestedPrice && composition.unitSuggestedPrice > 0) {
            let changed = false;
            const updatedVars = { ...dynamicVariables };
            hiddenFormulaVars.forEach((v: any) => {
                const currentVal = updatedVars[v.id]?.value;
                if (currentVal !== composition.unitSuggestedPrice) {
                    updatedVars[v.id] = { ...updatedVars[v.id], value: composition.unitSuggestedPrice };
                    changed = true;
                }
            });
            if (changed) {
                setDynamicVariables(updatedVars);
            }
        }
    }, [composition?.unitSuggestedPrice, hiddenFormulaVars]);

    // ── Lógica de Cálculo de Preço (Motor) ──────────────────────────
    const [formulaResultValue, setFormulaResultValue] = useState<number>(0);
    const lastSuggestedRef = React.useRef<number>(0);
    const isPriceManualRef = React.useRef<boolean>(false);

    useEffect(() => {
        if (!pricingRule?.formulaString) return;
        const inputs: Record<string, any> = { QTDE: quantity, quantidade: quantity };
        Object.entries(dynamicVariables).forEach(([id, data]) => {
            const numVal = parseFloat(String(data.value || 0).replace(',', '.'));
            inputs[id.toUpperCase()] = numVal;
            inputs[`${id.toUpperCase()}_UNIT`] = data.unit || 'mm';
        });

        try {
            const result = calculatePricingResult(pricingRule.formulaString, pricingRule.variables, inputs);
            setFormulaResultValue(Number(result.value || 0));
        } catch (e) { console.error("Erro fórmula", e); }
    }, [pricingRule, dynamicVariables, quantity]);

    useEffect(() => {
        if (compLoading && Number(unitPrice) > 0) return;
        
        let suggested = formulaResultValue;

        const scope = Object.entries(dynamicVariables).reduce((acc, [key, varObj]) => {
            acc[key] = varObj.value;
            if (varObj.unit) {
                acc[`${key.toUpperCase()}_UNIT`] = varObj.unit;
            }
            return acc;
        }, {} as Record<string, any>);

        const norm = applyNormalization(inputVars, scope);
        const l = Number(norm['LARGURA'] || 0);
        const a = Number(norm['ALTURA'] || 0);
        const areaFactor = (l > 0 && a > 0) ? ((l * a) / 1000000) : 1;

        // Lógica de busca do preço base (usada pelo SIMPLE e para exibição de fallback)
        const getBaseValue = () => {
            // 1. Se a composição (Variações) deu um preço, ele é o rei absoluto.
            if (composition?.unitSuggestedPrice && composition.unitSuggestedPrice > 0) return composition.unitSuggestedPrice;
            
            // 2. Se a configuração de fórmula/Variável Padrão tem um Valor Base
            const pVar = Object.entries(dynamicVariables).find(([k]) => 
                k.toUpperCase().includes('PRECO') || k.toUpperCase().includes('VALOR') || k === 'SALE_PRICE'
            );
            if (pVar && (pVar[1]?.value !== undefined && pVar[1]?.value !== '')) {
                const val = pVar[1].value;
                const numVal = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val || 0);
                if (numVal > 0) return numVal;
            }

            // 3. Fallback para Regra Técnica ou Produto base
            if (pricingRule?.salePrice && pricingRule.salePrice > 0) return pricingRule.salePrice;
            if (produto?.salePrice && produto.salePrice > 0) return produto.salePrice;
            
            return 0;
        };

        const basePrice = getBaseValue();

        if (produto.pricingMode === 'SIMPLE_AREA') {
            if (l > 0 && a > 0) {
                suggested = basePrice * areaFactor;
            } else {
                const areaVar = norm['AREA_TOTAL'] || norm['AREA'] || 0;
                if (areaVar > 0) {
                    suggested = basePrice * (areaVar / 1000000);
                }
            }
        } else if (produto.pricingMode === 'DYNAMIC_ENGINEER') {
            // No modo dinâmico, se a formula Result já trouxe algo, respeitamos!
            if (formulaResultValue > 0) {
                suggested = formulaResultValue;
            } else if (l > 0 && a > 0 && basePrice > 0) {
                // Apenas fallback seguro caso a fórmula tenha retornado 0, mas existe price e área
                suggested = basePrice * areaFactor;
            }
        }

        if (suggested <= 0 && formulaResultValue) {
            suggested = Number(formulaResultValue);
        }

        if (suggested <= 0 && composition?.unitSuggestedPrice) {
            suggested = composition.unitSuggestedPrice;
        }

        if (suggested > 0 && !isPriceManualRef.current) {
            let finalSuggested = suggested;

            const rounded = Number(finalSuggested.toFixed(2));
            if (Math.abs(Number(unitPrice) - rounded) >= 0.01) {
                setUnitPrice(rounded);
                lastSuggestedRef.current = rounded;
            }
        }
    }, [composition, formulaResultValue, dynamicVariables, globalUnit, pricingRule, produto, quantity, inputVars]);

    // ── Validação de Desconto ─────────────────────────────────────────
    const effectiveThreshold = useMemo(() => {
        console.log('[ProductItemForm] Threshold debug:', {
            productName: produto?.name,
            productThreshold: produto?.maxDiscountThreshold,
            orgThreshold: maxDiscountThreshold,
            backendVersion: (produto as any)?._debug
        });
        if (produto.maxDiscountThreshold !== null && produto.maxDiscountThreshold !== undefined) {
            return Number(produto.maxDiscountThreshold);
        }
        return maxDiscountThreshold; // Teto da empresa (fallback)
    }, [produto.maxDiscountThreshold, maxDiscountThreshold, produto?.name, (produto as any)?._debug]);

    const discountValidation = useMemo(() => {
        const grossValue = Number(unitPrice) * quantity;
        const discountVal = Number(discountItem) || 0;
        if (grossValue <= 0) return { ok: true, percent: 0, exceedsGross: false };
        
        const exceedsGross = discountVal > grossValue;
        const percent = discountVal / grossValue;
        const exceedsThreshold = percent > effectiveThreshold;
        
        return {
            ok: !exceedsThreshold && !exceedsGross,
            percent: percent * 100,
            exceedsThreshold,
            exceedsGross
        };
    }, [unitPrice, quantity, discountItem, effectiveThreshold]);

    // ── Handlers ─────────────────────────────────────────────────────
    const handleDynamicVarChange = (id: string, field: 'value' | 'unit', val: any) => {
        setDynamicVariables(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
    };

    const handleIndividualUnitChange = (id: string, newUnit: string) => {
        const conversion: Record<string, number> = { 'mm': 1, 'cm': 10, 'm': 1000 };
        const target = newUnit.toLowerCase();
        setDynamicVariables(prev => {
            const cur = prev[id] || { value: '', unit: 'mm' };
            const oldUnit = (cur.unit || 'mm').toLowerCase();
            const numericValue = parseFloat(String(cur.value || '').replace(',', '.'));
            let newVal = cur.value;
            if (!isNaN(numericValue) && cur.value !== '') {
                const converted = (numericValue * (conversion[oldUnit] || 1)) / (conversion[target] || 1);
                newVal = Number.isInteger(converted) ? converted.toString() : converted.toFixed(2).replace('.', ',');
            }
            return { ...prev, [id]: { ...cur, value: newVal, unit: target } };
        });
    };

    const handleAuthorize = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        try {
            await api.post('/api/auth/authorize-supervisor', { email: authEmail, password: authPassword });
            setIsPriceUnlocked(true);
            setShowAuthModal(false);
            toast.success('Edição liberada!');
        } catch (err: any) { toast.error('Credenciais inválidas'); }
        finally { setAuthLoading(false); }
    };

    // Polling removido conforme nova regra: permitir salvamento imediato com status PENDING

    const handleRequestRemoteAuth = async () => {
        setAuthLoading(true);
        try {
            const resp = await api.post('/api/sales/authorizations/request', {
                type: 'DISCOUNT',
                data: {
                    productId: produto.id,
                    productName: produto.name,
                    quantity,
                    unitPrice: Number(unitPrice),
                    discount: Number(discountItem),
                    percent: discountValidation.percent
                }
            });
            if (resp.data.success) {
                const requestId = resp.data.data.id;
                setPendingRequestId(requestId);
                setRequestStatus('PENDING');
                toast.success('Solicitação enviada! Item adicionado ao pedido como pendente.');
                
                // Fecha o modal de autorização e submete o item com status PENDING
                setShowAuthModal(false);
                
                onSubmit({
                    id: editingData?.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
                    productId: produto.id, product: produto,
                    quantity, unitPrice: Number(unitPrice), 
                    // totalPrice aqui será o valor integral no frontend para exibição inicial conforme solicitado
                    totalPrice: (Number(unitPrice) * quantity), 
                    discountItem: Number(discountItem) || 0,
                    discountStatus: 'PENDING',
                    authorizationRequestId: requestId,
                    width: normalizedDims.width || null,
                    height: normalizedDims.height || null,
                    notes, attributes: { dynamicVariables, insumos: materiaisSelecionados, selectedOptions: opcoesSelecionadas }
                });
            }
        } catch (err) {
            toast.error('Erro ao enviar solicitação');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleRequestUnlock = () => {
        setShowAuthModal(true);
    };

    const handleSubmitLocal = () => {
        if (quantity <= 0 || Number(unitPrice) <= 0) return toast.error('Coloque quantidade e preço.');
        
        if (discountValidation.exceedsGross) {
            return toast.error('O desconto não pode ser maior que o valor total do item.');
        }

        // Bloqueio estrito se exceder o teto e não estiver autorizado (E não for uma solicitação remota em curso)
        if (!discountValidation.ok && !isPriceUnlocked) {
            setShowAuthModal(true);
            return;
        }

        onSubmit({
            id: editingData?.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
            productId: produto.id, product: produto,
            quantity, unitPrice: Number(unitPrice), 
            totalPrice: (Number(unitPrice) * quantity) - (Number(discountItem) || 0),
            discountItem: Number(discountItem) || 0,
            discountStatus: isPriceUnlocked ? 'APPROVED' : 'NONE',
            width: normalizedDims.width || null,
            height: normalizedDims.height || null,
            notes, attributes: { dynamicVariables, insumos: materiaisSelecionados, selectedOptions: opcoesSelecionadas }
        });
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Variações e Medidas</span>
                    {produto.pricingMode !== 'DYNAMIC_ENGINEER' && (
                        <div className="flex bg-slate-100 p-1 rounded-md">
                            {(['M', 'CM', 'MM'] as const).map(u => (
                                <button 
                                    key={u} 
                                    type="button" 
                                    onClick={() => {
                                        setGlobalUnit(u);
                                        setDynamicVariables(prev => {
                                            const updated = { ...prev };
                                            inputVars.forEach((v: any) => {
                                                const id = v.id;
                                                if (updated[id]) {
                                                    const curUnit = (updated[id].unit || v.defaultUnit || globalUnit).toLowerCase();
                                                    const targetUnit = u.toLowerCase();
                                                    const conversion: Record<string, number> = { 'mm': 1, 'cm': 10, 'm': 1000 };
                                                    
                                                    const numVal = parseFloat(String(updated[id].value || '').replace(',', '.'));
                                                    let newVal = updated[id].value;
                                                    
                                                    if (!isNaN(numVal) && updated[id].value !== '') {
                                                        const converted = (numVal * (conversion[curUnit] || 1)) / (conversion[targetUnit] || 1);
                                                        newVal = Number.isInteger(converted) ? converted.toString() : converted.toFixed(2).replace('.', ',');
                                                    }
                                                    
                                                    updated[id] = { ...updated[id], value: newVal, unit: targetUnit };
                                                }
                                            });
                                            return updated;
                                        });
                                    }} 
                                    className={cn("px-3 py-1 text-[9px] font-black rounded transition-all", globalUnit === u ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                                >
                                    {u}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-row items-end gap-4 w-full flex-wrap">
                    <VariationsSection 
                        configuracoes={configuracoes} 
                        opcoesSelecionadas={opcoesSelecionadas} 
                        setOpcoesSelecionadas={setOpcoesSelecionadas} 
                        blockedIds={blockedIds} 
                    />

                    {produto.pricingMode === 'SIMPLE_AREA' && (
                        <SimpleAreaSection 
                            inputVars={inputVars}
                            hiddenFormulaVars={hiddenFormulaVars}
                            dynamicVariables={dynamicVariables} 
                            handleDynamicVarChange={handleDynamicVarChange} 
                            handleIndividualUnitChange={handleIndividualUnitChange}
                            globalUnit={globalUnit} 
                            produto={produto} 
                            pricingRule={pricingRule} 
                            composition={composition}
                        />
                    )}

                    {produto.pricingMode === 'DYNAMIC_ENGINEER' && (
                        <DynamicRuleSection 
                            inputVars={inputVars}
                            hiddenFormulaVars={hiddenFormulaVars}
                            dynamicVariables={dynamicVariables} 
                            handleDynamicVarChange={handleDynamicVarChange} 
                            handleIndividualUnitChange={handleIndividualUnitChange} 
                            globalUnit={globalUnit} 
                            produto={produto} 
                            pricingRule={pricingRule} 
                        />
                    )}

                    <PriceQuantitySection 
                        quantity={quantity} setQuantity={setQuantity}
                        unitPrice={unitPrice} setUnitPrice={setUnitPrice}
                        isPriceLocked={isPriceLocked} isPriceUnlocked={isPriceUnlocked}
                        setIsPriceUnlocked={setIsPriceUnlocked} 
                        setShowAuthModal={handleRequestUnlock}
                        isPriceManualRef={isPriceManualRef} compLoading={compLoading}
                        discountItem={discountItem} setDiscountItem={setDiscountItem}
                        discountValidation={discountValidation}
                        maxDiscountThreshold={effectiveThreshold}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-wider"><Package className="w-3 h-3" />Composição</div>
                    <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm min-h-[160px]">
                        <SeletorInsumos insumos={insumos} materiaisIniciais={materiaisSelecionados} onMaterialsChange={setMateriaisSelecionados} />
                    </div>
                </div>
                <div className="lg:col-span-2 space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-wider"><Coins className="w-3 h-3" />Lucratividade</div>
                    <PriceSummaryPanel composition={composition} loading={compLoading} negotiatedPrice={Number(unitPrice)} quantity={quantity} discountItem={Number(discountItem) || 0} />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t mt-4">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações do item..." className="flex-1 h-12 p-3 border border-slate-200 rounded-lg bg-slate-50 text-[11px] font-medium resize-none focus:h-20 transition-all shadow-inner" />
                <Button 
                    onClick={handleSubmitLocal} 
                    disabled={
                        quantity <= 0 || 
                        Number(unitPrice) <= 0 || 
                        discountValidation.exceedsGross ||
                        (!discountValidation.ok && !isPriceUnlocked)
                    } 
                    className={`w-full sm:w-72 h-12 text-sm font-bold uppercase tracking-widest shadow-lg transition-all ${
                        !discountValidation.ok && !isPriceUnlocked 
                        ? 'bg-slate-300 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                >
                    {isEditing ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    {!discountValidation.ok && !isPriceUnlocked ? 'Solicitar Autorização' : (isEditing ? 'Salvar Item' : 'Adicionar Item')}
                </Button>
            </div>

            {showAuthModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
                    <div className="bg-white rounded-2xl w-[400px] overflow-hidden shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="font-bold">Liberação Gerencial</h3>
                            <button title="Fechar" onClick={() => setShowAuthModal(false)}><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={handleAuthorize} className="p-6 space-y-4">
                            <Input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email" required />
                            <Input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Senha" required />
                            <Button type="submit" disabled={authLoading} className="w-full">{authLoading ? 'Validando...' : 'Liberar com Senha'}</Button>
                        </form>
                        <div className="px-6 pb-6 space-y-3">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-500 font-medium">Ou solicitar remotamente</span></div>
                            </div>
                            {pendingRequestId ? (
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-center space-y-2 animate-pulse">
                                    <p className="text-amber-800 text-xs font-bold uppercase tracking-wider">Aguardando Autorização...</p>
                                    <p className="text-amber-600 text-[10px]">Uma notificação foi enviada aos supervisores.</p>
                                </div>
                            ) : (
                                <Button 
                                    variant="outline" 
                                    onClick={handleRequestRemoteAuth} 
                                    disabled={authLoading} 
                                    className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                >
                                    Solicitar Liberação Remota
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductItemForm;
