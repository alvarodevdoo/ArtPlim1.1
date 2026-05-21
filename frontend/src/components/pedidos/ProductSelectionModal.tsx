import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, ArrowRight, PackageSearch, Package, AlertTriangle, Boxes } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ItemType } from '@/types/item-types';
import { getProductDisplayInfo } from '@/lib/pricing/displayUtils';
import { Produto } from '@/types/sales';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { resolveDisplayUnit } from '@/lib/units';

interface SelectableProduct extends Produto {
    usageCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Configurations fetchadas do backend, agrupadas por productId.
// Substitui o MOCK anterior — agora consome `kind` real (VARIATION/FINISHING).
// ─────────────────────────────────────────────────────────────────────────
type LoadedMaterial = {
    id: string;
    name: string;
    unit?: string | null;
    controlUnit?: string | null;
    trackStock?: boolean;
    currentStock?: number;
    minStockQuantity?: number | null;
    sourcingMode?: 'STOCK' | 'ON_DEMAND';
};

type LoadedConfig = {
    id: string;
    name: string;
    type: string;
    kind?: 'VARIATION' | 'FINISHING';
    options: Array<{
        id: string;
        label: string;
        value: string;
        priceModifier?: number;
        fixedValue?: number | null;
        priceOverride?: number | null;
        allowedChildIds?: string[] | null;
        materialId?: string | null;
        material?: LoadedMaterial | null;
    }>;
};

const ADDITIVE_HINTS = [
    'acabamento', 'acabamentos',
    'acessorio', 'acessório', 'acessorios', 'acessórios',
    'extras', 'extra',
    'adicional', 'adicionais',
    'opcional', 'opcionais',
    'complementar', 'complementares'
];

// Fonte primária: campo `kind`. Fallback heurístico para grupos pré-migration.
const isAdditiveConfig = (cfg: LoadedConfig) => {
    if (cfg.kind === 'FINISHING') return true;
    if (cfg.kind === 'VARIATION') return false;
    const lower = (cfg.name || '').toLowerCase();
    return ADDITIVE_HINTS.some(h => lower.includes(h));
};

// ─────────────────────────────────────────────────────────────────────────
// SKU virtual: cada linha da lista é uma combinação concreta
// ─────────────────────────────────────────────────────────────────────────
type VirtualSKU = {
    id: string;
    productId: string;
    product: SelectableProduct;
    displayName: string;
    priceLabel: string;
    isStartingPrice: boolean;
    presets: Array<{ configName: string; optionLabel: string }>;
    hasMoreConfig: boolean; // dimensional ou aditivos pendentes
    categoryHint: string;   // sublabel (ex: "Impressão", para diferenciar quando o nome não tem)
    materials: LoadedMaterial[]; // materiais envolvidos no SKU (para badge de estoque)
};

export type SelectionPresets = {
    optionLabels?: Array<{ configName: string; optionLabel: string }>;
    favoriteName?: string;
};

// Produto cartesiano de arrays
const cartesian = <T,>(arrays: T[][]): T[][] => {
    if (arrays.length === 0) return [[]];
    const [head, ...rest] = arrays;
    const restProduct = cartesian(rest);
    const result: T[][] = [];
    for (const item of head) {
        for (const r of restProduct) {
            result.push([item, ...r]);
        }
    }
    return result;
};

const formatBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Calcula o preço previsto de uma combinação concreta (SKU).
 * Regra (alinhada com PricingCompositionService):
 *  - maxOverride = max(fixedValue, priceOverride) entre as opções selecionadas
 *  - totalModifiers = soma dos priceModifier
 *  - Se maxOverride > 0: price = maxOverride + totalModifiers
 *  - Senão: price = product.salePrice + totalModifiers
 */
const computeSKUPrice = (
    product: SelectableProduct,
    selectedOpts: Array<{ option: LoadedConfig['options'][number] }>
): { label: string; isStarting: boolean } => {
    let maxOverride = 0;
    let totalModifiers = 0;
    for (const { option } of selectedOpts) {
        totalModifiers += Number(option.priceModifier || 0);
        const fixed = Number(option.fixedValue || 0);
        const override = Number(option.priceOverride || 0);
        const cur = Math.max(fixed, override);
        if (cur > maxOverride) maxOverride = cur;
    }

    const baseSale = Number((product as any).salePrice || 0);
    const finalPrice = maxOverride > 0 ? maxOverride + totalModifiers : baseSale + totalModifiers;
    // Dimensional: preço é "a partir de" (será multiplicado pela área)
    const isAreaBased = (product as any).pricingMode === 'SIMPLE_AREA';

    if (finalPrice > 0) {
        return { label: formatBRL(finalPrice), isStarting: isAreaBased };
    }
    // Fallback: usa o display info do produto
    const fallback = getProductDisplayInfo(product);
    return { label: fallback.price, isStarting: fallback.isStarting };
};

const buildVirtualSKUs = (
    produtos: SelectableProduct[],
    configsByProductId: Record<string, LoadedConfig[]>
): VirtualSKU[] => {
    const skus: VirtualSKU[] = [];
    for (const product of produtos) {
        const allConfigs = configsByProductId[product.id] || [];
        const exclusiveGroups = allConfigs.filter(c => !isAdditiveConfig(c));
        const additiveGroups = allConfigs.filter(c => isAdditiveConfig(c));
        const isDimensional = (product as any).pricingMode === 'SIMPLE_AREA';
        const hasMoreConfig = additiveGroups.length > 0 || isDimensional;
        const baseDisplay = getProductDisplayInfo(product);

        // Sem grupos exclusivos → 1 SKU "Produto" (acabamentos / dimensões resolvidos no modal)
        if (exclusiveGroups.length === 0) {
            skus.push({
                id: product.id,
                productId: product.id,
                product,
                displayName: product.name,
                priceLabel: baseDisplay.price,
                isStartingPrice: baseDisplay.isStarting,
                presets: [],
                hasMoreConfig,
                categoryHint: product.productType === ItemType.SERVICE ? 'Serviço' : 'Produto',
                materials: []
            });
            continue;
        }

        // Estrutura de opções por grupo
        const optionGrid = exclusiveGroups.map(g =>
            g.options.map(opt => ({
                configName: g.name,
                optionLabel: opt.label,
                _option: opt
            }))
        );

        // Pre-compute which group indices restrict which other group indices.
        // Group i restricts group j if ANY option in group i has allowedChildIds
        // referencing ANY option in group j.
        const groupRestrictions = new Map<number, Set<number>>();
        for (let i = 0; i < optionGrid.length; i++) {
            for (let j = 0; j < optionGrid.length; j++) {
                if (i === j) continue;
                const iRestrictsJ = optionGrid[i].some(opt => {
                    const ids = opt._option.allowedChildIds;
                    if (!Array.isArray(ids) || ids.length === 0) return false;
                    return optionGrid[j].some(other => ids.includes(other._option.id));
                });
                if (iRestrictsJ) {
                    if (!groupRestrictions.has(i)) groupRestrictions.set(i, new Set());
                    groupRestrictions.get(i)!.add(j);
                }
            }
        }

        // Geração recursiva com suporte a "pular" grupo quando o pai
        // não tem allowedChildIds num grupo cascateado.
        type ComboEntry = { configName: string; optionLabel: string; _option: any };
        const combinations: Array<Array<ComboEntry | null>> = [];

        const build = (groupIdx: number, partial: Array<ComboEntry | null>) => {
            if (groupIdx >= optionGrid.length) {
                combinations.push(partial);
                return;
            }

            // Este grupo deve ser pulado? Sim, se algum grupo anterior restringe ESTE
            // e a opção escolhida desse grupo anterior tem allowedChildIds vazio.
            let skip = false;
            for (let i = 0; i < groupIdx; i++) {
                const prev = partial[i];
                if (!prev) continue;
                if (groupRestrictions.get(i)?.has(groupIdx)) {
                    const ids = prev._option.allowedChildIds;
                    if (!Array.isArray(ids) || ids.length === 0) {
                        skip = true;
                        break;
                    }
                }
            }
            if (skip) {
                build(groupIdx + 1, [...partial, null]);
                return;
            }

            for (const entry of optionGrid[groupIdx]) {
                // Compatibilidade com seleções anteriores que restringem este grupo
                let compatible = true;
                for (let i = 0; i < groupIdx; i++) {
                    const prev = partial[i];
                    if (!prev) continue;
                    if (!groupRestrictions.get(i)?.has(groupIdx)) continue;
                    const ids = prev._option.allowedChildIds;
                    if (Array.isArray(ids) && ids.length > 0 && !ids.includes(entry._option.id)) {
                        compatible = false;
                        break;
                    }
                }
                if (compatible) {
                    build(groupIdx + 1, [...partial, entry]);
                }
            }
        };
        build(0, []);

        for (const combo of combinations) {
            const presentEntries = combo.filter((c): c is ComboEntry => c !== null);
            // Pais com allowedChildIds são filtros puros — escondem o label
            const labelParts = presentEntries
                .filter(c => !c._option.allowedChildIds || c._option.allowedChildIds.length === 0)
                .map(c => c.optionLabel);
            const displayName = labelParts.length > 0
                ? `${product.name} ${labelParts.join(' ')}`
                : product.name;
            const price = computeSKUPrice(product, presentEntries.map(c => ({ option: c._option })));
            const materials: LoadedMaterial[] = presentEntries
                .map(c => (c._option as any).material as LoadedMaterial | null | undefined)
                .filter((m): m is LoadedMaterial => !!m);
            skus.push({
                id: `${product.id}::${presentEntries.map(c => c._option.id).join('|')}`,
                productId: product.id,
                product,
                displayName,
                priceLabel: price.label,
                isStartingPrice: price.isStarting,
                presets: presentEntries.map(c => ({ configName: c.configName, optionLabel: c.optionLabel })),
                hasMoreConfig,
                categoryHint: product.name,
                materials
            });
        }
    }
    return skus;
};

// ─────────────────────────────────────────────────────────────────────────
// Matching multi-palavra com highlighting
// ─────────────────────────────────────────────────────────────────────────
const matchQuery = (text: string, query: string): { matched: boolean; ranges: Array<[number, number]>; rank: number } => {
    if (!query.trim()) return { matched: true, ranges: [], rank: 0 };
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase().trim();
    const words = lowerQuery.split(/\s+/).filter(Boolean);
    const ranges: Array<[number, number]> = [];
    let rank = 0;
    for (const word of words) {
        const idx = lowerText.indexOf(word);
        if (idx < 0) return { matched: false, ranges: [], rank: 0 };
        ranges.push([idx, idx + word.length]);
        // Bonus se a palavra está no começo do texto
        if (idx === 0) rank += 100;
        else if (lowerText[idx - 1] === ' ') rank += 50;
        else rank += 1;
    }
    return { matched: true, ranges, rank };
};

const renderHighlighted = (text: string, ranges: Array<[number, number]>): React.ReactNode => {
    if (ranges.length === 0) return text;
    const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const r of sorted) {
        if (merged.length && r[0] <= merged[merged.length - 1][1]) {
            merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1]);
        } else {
            merged.push([r[0], r[1]] as [number, number]);
        }
    }
    const parts: React.ReactNode[] = [];
    let prev = 0;
    for (let i = 0; i < merged.length; i++) {
        const [start, end] = merged[i];
        if (start > prev) parts.push(<span key={`p-${i}`}>{text.slice(prev, start)}</span>);
        parts.push(
            <span key={`m-${i}`} className="text-indigo-600 font-bold">
                {text.slice(start, end)}
            </span>
        );
        prev = end;
    }
    if (prev < text.length) parts.push(<span key="tail">{text.slice(prev)}</span>);
    return <>{parts}</>;
};

// ─────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────
interface ProductSelectionModalProps {
    produtos: SelectableProduct[];
    onSelect: (produto: SelectableProduct, presets?: SelectionPresets) => void;
    onCancel: () => void;
    isOpen: boolean;
}

const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({
    produtos,
    onSelect,
    onCancel,
    isOpen
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [hoveredIndex, setHoveredIndex] = useState<number>(0);
    const [configsByProductId, setConfigsByProductId] = useState<Record<string, LoadedConfig[]>>({});
    const [loadingConfigs, setLoadingConfigs] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const cacheRef = useRef<Record<string, LoadedConfig[]>>({});

    // Fetch das configurations dos produtos ao abrir o modal (paralelo + cache em ref)
    useEffect(() => {
        if (!isOpen || produtos.length === 0) return;
        const productsToFetch = produtos.filter(p => !cacheRef.current[p.id]);
        if (productsToFetch.length === 0) {
            setConfigsByProductId({ ...cacheRef.current });
            return;
        }
        let cancelled = false;
        setLoadingConfigs(true);
        Promise.all(
            productsToFetch.map(p =>
                api
                    .get(`/api/catalog/products/${p.id}/configurations/complete`)
                    .then(res => {
                        const raw = res.data?.data;
                        const list: any[] = Array.isArray(raw)
                            ? raw
                            : Array.isArray(raw?.configurations)
                                ? raw.configurations
                                : [];
                        const normalized: LoadedConfig[] = list.map((c: any) => ({
                            id: c.id,
                            name: c.name,
                            type: c.type,
                            kind: c.kind === 'FINISHING' || c.kind === 'VARIATION' ? c.kind : undefined,
                            options: (c.options || []).map((o: any) => ({
                                id: o.id,
                                label: o.label,
                                value: o.value,
                                priceModifier: Number(o.priceModifier || 0),
                                fixedValue: o.fixedValue != null ? Number(o.fixedValue) : null,
                                priceOverride: o.priceOverride != null ? Number(o.priceOverride) : null,
                                allowedChildIds: Array.isArray(o.allowedChildIds) ? o.allowedChildIds : null,
                                materialId: o.materialId ?? null,
                                material: o.material
                                    ? {
                                        id: o.material.id,
                                        name: o.material.name,
                                        unit: o.material.unit ?? null,
                                        controlUnit: o.material.controlUnit ?? null,
                                        trackStock: o.material.trackStock === true,
                                        currentStock: Number(o.material.currentStock ?? 0),
                                        minStockQuantity: o.material.minStockQuantity != null
                                            ? Number(o.material.minStockQuantity)
                                            : null,
                                        sourcingMode: o.material.sourcingMode === 'ON_DEMAND' ? 'ON_DEMAND' : 'STOCK'
                                    }
                                    : null
                            }))
                        }));
                        cacheRef.current[p.id] = normalized;
                    })
                    .catch(() => {
                        cacheRef.current[p.id] = [];
                    })
            )
        ).finally(() => {
            if (!cancelled) {
                setConfigsByProductId({ ...cacheRef.current });
                setLoadingConfigs(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [isOpen, produtos]);

    const allSKUs = useMemo(
        () => buildVirtualSKUs(produtos, configsByProductId),
        [produtos, configsByProductId]
    );

    const filteredSKUs = useMemo(() => {
        const trimmed = searchTerm.trim();
        if (!trimmed) {
            // Agrupa por produto: ordena produtos por uso/nome, mantém SKUs do mesmo
            // produto juntos e em ordem alfabética entre si.
            const productOrder = new Map<string, number>();
            [...allSKUs]
                .sort((a, b) =>
                    (b.product.usageCount || 0) - (a.product.usageCount || 0) ||
                    a.product.name.localeCompare(b.product.name)
                )
                .forEach(sku => {
                    if (!productOrder.has(sku.productId)) {
                        productOrder.set(sku.productId, productOrder.size);
                    }
                });
            return [...allSKUs].sort((a, b) =>
                (productOrder.get(a.productId)! - productOrder.get(b.productId)!) ||
                a.displayName.localeCompare(b.displayName)
            ).map(sku => ({ sku, ranges: [] as Array<[number, number]> }));
        }
        const results: Array<{ sku: VirtualSKU; ranges: Array<[number, number]>; rank: number }> = [];
        for (const sku of allSKUs) {
            const m = matchQuery(sku.displayName, trimmed);
            if (m.matched) results.push({ sku, ranges: m.ranges, rank: m.rank });
        }
        results.sort((a, b) =>
            b.rank - a.rank ||
            (b.sku.product.usageCount || 0) - (a.sku.product.usageCount || 0) ||
            a.sku.displayName.localeCompare(b.sku.displayName)
        );
        return results.map(r => ({ sku: r.sku, ranges: r.ranges }));
    }, [allSKUs, searchTerm]);

    useEffect(() => {
        if (filteredSKUs.length > 0) setHoveredIndex(0);
        else setHoveredIndex(-1);
    }, [filteredSKUs.length, searchTerm]);

    useEffect(() => {
        if (!isOpen) return;
        if (searchInputRef.current) searchInputRef.current.focus();
        const scrollY = window.scrollY;
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            window.scrollTo(0, scrollY);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setHoveredIndex(prev => Math.min(prev + 1, filteredSKUs.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setHoveredIndex(prev => Math.max(prev - 1, 0));
                    break;
                case 'Home':
                    e.preventDefault();
                    setHoveredIndex(0);
                    break;
                case 'End':
                    e.preventDefault();
                    setHoveredIndex(filteredSKUs.length - 1);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (hoveredIndex >= 0 && filteredSKUs[hoveredIndex]) {
                        const { sku } = filteredSKUs[hoveredIndex];
                        onSelect(sku.product, sku.presets.length > 0 ? { optionLabels: sku.presets } : undefined);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onCancel();
                    break;
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, hoveredIndex, filteredSKUs, onCancel, onSelect]);

    useEffect(() => {
        if (listRef.current && hoveredIndex >= 0) {
            const el = listRef.current.querySelector(`[data-index="${hoveredIndex}"]`) as HTMLElement;
            if (el) el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }
    }, [hoveredIndex]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-3xl mx-4 rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
                {/* ── Header ── */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 to-white">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                        <PackageSearch className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-slate-800 leading-tight">Selecionar Item</h2>
                        <p className="text-[11px] text-slate-500">
                            Escolha um produto ou variação para adicionar ao pedido
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Fechar (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Search ── */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-white">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <Input
                        ref={searchInputRef}
                        placeholder="Buscar item, variação, tamanho..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 border-0 shadow-none focus-visible:ring-0 px-0 text-base placeholder:text-slate-400"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors"
                            title="Limpar"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                        Esc
                    </kbd>
                </div>

                {/* List */}
                <div ref={listRef} className="flex-1 overflow-y-auto py-2">
                    {filteredSKUs.length === 0 ? (
                        <div className="px-4 py-12 text-center text-slate-400">
                            <p className="text-sm font-medium">Nenhum item encontrado</p>
                            <p className="text-xs mt-1">Tente outro termo de busca</p>
                        </div>
                    ) : (() => {
                        // Agrupamento por produto (apenas quando sem busca)
                        const isGrouped = !searchTerm.trim();
                        const rendered: React.ReactNode[] = [];
                        let lastProductId: string | null = null;

                        filteredSKUs.forEach((entry, index) => {
                            const { sku, ranges } = entry;
                            const isHovered = index === hoveredIndex;
                            const showHeader = isGrouped && sku.productId !== lastProductId;
                            lastProductId = sku.productId;

                            // Texto de cada item: para SKUs agrupados, mostrar só a variante;
                            // se não houver variante (produto sem variações), mostrar nome do produto.
                            const variantLabel = sku.presets
                                .filter(p => {
                                    // ocultar labels de pais com allowedChildIds (filtros puros)
                                    // já vem filtrado em buildVirtualSKUs via displayName
                                    return true;
                                })
                                .map(p => p.optionLabel)
                                .join(' · ');
                            const itemText = isGrouped
                                ? (variantLabel || sku.product.name)
                                : sku.displayName;
                            const itemRanges = isGrouped && variantLabel ? [] : ranges;

                            if (showHeader) {
                                rendered.push(
                                    <div
                                        key={`hdr-${sku.productId}`}
                                        className="px-4 pt-3 pb-1 first:pt-0"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                                                {sku.product.name}
                                            </div>
                                            <div className="flex-1 h-px bg-slate-100" />
                                            {sku.hasMoreConfig && (
                                                <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                                                    {sku.product.pricingMode === 'SIMPLE_AREA'
                                                        ? 'sob medida'
                                                        : 'com acabamentos'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            // Estoque: derivado dos materiais (insumos) vinculados às
                            // opções selecionadas. O SKU usa o material como gargalo —
                            // menor estoque entre os materiais rastreados.
                            const productRaw: any = sku.product;
                            const allMaterials = sku.materials || [];
                            const onDemandMaterials = allMaterials.filter(m => m.sourcingMode === 'ON_DEMAND');
                            const trackedMaterials = allMaterials.filter(m =>
                                m.trackStock && m.sourcingMode !== 'ON_DEMAND'
                            );
                            const isOnDemand = onDemandMaterials.length > 0 && trackedMaterials.length === 0;
                            let stockState: 'ok' | 'low' | 'out' | 'ondemand' | null = null;
                            let stockQty = 0;
                            let stockMin = 0;
                            let stockUnit = 'un';

                            if (isOnDemand) {
                                stockState = 'ondemand';
                            } else if (trackedMaterials.length > 0) {
                                // gargalo = material com menor currentStock
                                const bottleneck = trackedMaterials.reduce((a, b) =>
                                    Number(a.currentStock ?? 0) <= Number(b.currentStock ?? 0) ? a : b
                                );
                                stockQty = Number(bottleneck.currentStock ?? 0);
                                stockMin = Number(bottleneck.minStockQuantity ?? 0);
                                stockUnit = resolveDisplayUnit(bottleneck);
                                stockState = stockQty <= 0
                                    ? 'out'
                                    : stockMin > 0 && stockQty <= stockMin
                                        ? 'low'
                                        : 'ok';
                            } else if (productRaw.trackStock === true || productRaw.stockQuantity != null) {
                                // Fallback: estoque do próprio produto
                                stockQty = Number(productRaw.availableStock != null
                                    ? productRaw.availableStock
                                    : (productRaw.stockQuantity ?? 0));
                                stockMin = Number(productRaw.stockMinQuantity ?? 0);
                                stockUnit = resolveDisplayUnit(productRaw);
                                stockState = stockQty <= 0
                                    ? 'out'
                                    : stockMin > 0 && stockQty <= stockMin
                                        ? 'low'
                                        : 'ok';
                            }

                            rendered.push(
                                <div
                                    key={sku.id}
                                    data-index={index}
                                    className={cn(
                                        'group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-l-2 mx-2 rounded-lg',
                                        isHovered
                                            ? 'bg-indigo-50 border-l-indigo-500'
                                            : 'border-l-transparent hover:bg-slate-50/80',
                                        isGrouped && 'pl-6'
                                    )}
                                    onMouseEnter={() => setHoveredIndex(index)}
                                    onClick={() =>
                                        onSelect(
                                            sku.product,
                                            sku.presets.length > 0 ? { optionLabels: sku.presets } : undefined
                                        )
                                    }
                                >
                                    {/* Nome + meta (sob medida / acabamentos) */}
                                    <div className="min-w-0 max-w-[55%]">
                                        <div className={cn(
                                            "text-sm truncate",
                                            isHovered ? "font-semibold text-slate-900" : "font-medium text-slate-700"
                                        )}>
                                            {renderHighlighted(itemText, itemRanges)}
                                        </div>
                                        {!isGrouped && sku.hasMoreConfig && (
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {sku.product.pricingMode === 'SIMPLE_AREA'
                                                    ? 'sob medida · informe largura × altura'
                                                    : '+ acabamentos opcionais'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Linha pontilhada de ligação */}
                                    <div className="flex-1 min-w-[16px] border-b border-dotted border-slate-200 mx-1 self-center" />

                                    {/* Badge de estoque inline (alinhado à direita) */}
                                    {stockState && (
                                        <span className={cn(
                                            'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold shrink-0',
                                            stockState === 'ok' && 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                                            stockState === 'low' && 'bg-amber-50 text-amber-700 border border-amber-200',
                                            stockState === 'out' && 'bg-red-50 text-red-700 border border-red-200',
                                            stockState === 'ondemand' && 'bg-blue-50 text-blue-700 border border-blue-200'
                                        )}>
                                            {stockState === 'out' && <AlertTriangle className="w-3 h-3" />}
                                            {stockState === 'ondemand' && <PackageSearch className="w-3 h-3" />}
                                            {(stockState === 'ok' || stockState === 'low') && <Boxes className="w-3 h-3" />}
                                            {stockState === 'out' && 'Sem estoque'}
                                            {stockState === 'ondemand' && 'Sob Demanda'}
                                            {(stockState === 'ok' || stockState === 'low') &&
                                                `${stockQty.toLocaleString('pt-BR')} ${stockUnit}`}
                                        </span>
                                    )}

                                    {/* Preço */}
                                    <div className="text-right shrink-0 min-w-[88px]">
                                        {sku.isStartingPrice && (
                                            <div className="text-[9px] text-slate-400 font-medium uppercase tracking-wider leading-none">
                                                a partir de
                                            </div>
                                        )}
                                        <div className={cn(
                                            "text-sm font-bold tabular-nums",
                                            isHovered ? "text-indigo-600" : "text-slate-900"
                                        )}>
                                            {sku.priceLabel}
                                        </div>
                                    </div>
                                    <ArrowRight
                                        className={cn(
                                            'w-3.5 h-3.5 shrink-0 transition-all',
                                            isHovered
                                                ? 'text-indigo-500 translate-x-0'
                                                : 'text-transparent group-hover:text-slate-300 -translate-x-1'
                                        )}
                                    />
                                </div>
                            );
                        });

                        return rendered;
                    })()}
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60 gap-3">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 min-w-0 flex-1">
                        <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                            <span className="font-semibold text-slate-700">{filteredSKUs.length}</span>
                            {' '}{filteredSKUs.length === 1 ? 'item disponível' : 'itens disponíveis'}
                            {searchTerm && (
                                <> para "<span className="font-semibold text-slate-700">{searchTerm}</span>"</>
                            )}
                            {loadingConfigs && (
                                <span className="text-[10px] text-indigo-500 italic animate-pulse ml-1">
                                    · carregando variações...
                                </span>
                            )}
                        </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] text-slate-500">
                        <span className="hidden sm:inline-flex items-center gap-1">
                            <kbd className="font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 shadow-sm">↑↓</kbd>
                            navegar
                        </span>
                        <span className="hidden sm:inline-flex items-center gap-1">
                            <kbd className="font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 shadow-sm">↵</kbd>
                            adicionar
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onCancel}
                        className="shrink-0"
                    >
                        Cancelar
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ProductSelectionModal;
