import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { Link2, Layers, Sparkles, Check, Ban, ChevronDown, Search, X, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────
// Detecção de cor a partir do label
// ─────────────────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
    'amarelo': '#FBBF24',
    'azul': '#3B82F6',
    'cinza': '#9CA3AF',
    'kiwi': '#84CC16',
    'morango': '#EF4444',
    'preto': '#1F2937',
    'rosa bebe': '#FBCFE8',
    'rosa': '#EC4899',
    'verde': '#22C55E',
    'violeta': '#8B5CF6',
    'roxo': '#9333EA',
    'lilas': '#C4B5FD',
    'lilás': '#C4B5FD',
    'branco': '#F8FAFC',
    'vermelho': '#DC2626',
    'laranja': '#F97316',
    'marrom': '#92400E',
    'dourado': '#D4AF37',
    'ouro': '#D4AF37',
    'prata': '#CBD5E1',
    'bege': '#E7CFA8',
    'turquesa': '#14B8A6',
    'ciano': '#06B6D4'
};

const detectColor = (label: string): { hex: string; translucent: boolean } | null => {
    if (!label) return null;
    const lower = label.toLowerCase();
    const translucent = lower.includes('transparente') || lower.includes('translucid');
    const keys = Object.keys(COLOR_MAP).sort((a, b) => b.length - a.length);
    for (const key of keys) {
        if (lower.includes(key)) return { hex: COLOR_MAP[key], translucent };
    }
    return null;
};

// ─────────────────────────────────────────────────────────────────────────
// Detecção de grupo multi-select (Acabamento)
// ─────────────────────────────────────────────────────────────────────────
const MULTISELECT_GROUP_HINTS = [
    'acabamento', 'acabamentos',
    'acessorio', 'acessório', 'acessorios', 'acessórios',
    'extras', 'extra',
    'adicional', 'adicionais',
    'opcional', 'opcionais',
    'complementar', 'complementares'
];

const isGroupMultiSelect = (config: any): boolean => {
    if (config?.kind === 'FINISHING') return true;
    if (config?.kind === 'VARIATION') return false;
    if (typeof config?.allowMultiple === 'boolean') return config.allowMultiple;
    const name = (config?.name || '').toLowerCase();
    return MULTISELECT_GROUP_HINTS.some(hint => name.includes(hint));
};

const isFinishingGroup = (config: any): boolean => {
    if (config?.kind === 'FINISHING') return true;
    if (config?.kind === 'VARIATION') return false;
    const name = (config?.name || '').toLowerCase();
    return MULTISELECT_GROUP_HINTS.some(hint => name.includes(hint));
};

interface VariationsSectionProps {
    configuracoes: any[];
    opcoesSelecionadas: Record<string, string[]>;
    setOpcoesSelecionadas: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
    opcoesQuantidades?: Record<string, number>;
    setOpcoesQuantidades?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    blockedIds: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Metadata de uma opção lida do backend
// ─────────────────────────────────────────────────────────────────────────
export type OptionMeta = {
    defaultQuantity: number;
    allowCustomQty: boolean;
    materialName: string;
    materialUnit: string;
    materialCost: number;
    quantityHint?: string;
};

export const buildOptionMeta = (opt: any): OptionMeta | null => {
    const mat = opt?.material || null;
    const hasMaterial = Boolean(opt?.materialId || mat || opt?.materialName);
    const allowCustomQty: boolean = Boolean(opt?.allowCustomQty);
    const hasQtyConfig = allowCustomQty || opt?.defaultQuantity != null;

    // Retorna meta mesmo sem material vinculado — desde que tenha config de qty
    // (ex: Ilhos usa priceModifier por unidade, sem material, mas precisa de stepper)
    if (!hasMaterial && !hasQtyConfig) return null;

    const materialName: string =
        mat?.name || opt?.materialName || (hasMaterial ? 'Material vinculado' : '');
    const materialUnit: string =
        mat?.unit || opt?.materialUnit || 'un';
    const materialCost: number = Number(
        mat?.averageCost ?? mat?.costPerUnit ?? opt?.materialCost ?? 0
    );
    const defaultQuantity: number = Number(
        opt?.defaultQuantity ?? opt?.slotQuantity ?? 1
    );

    return { materialName, materialUnit, materialCost, defaultQuantity, allowCustomQty };
};

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL — separa Variações e Acabamentos
// ─────────────────────────────────────────────────────────────────────────
export const VariationsSection: React.FC<VariationsSectionProps> = ({
    configuracoes,
    opcoesSelecionadas,
    setOpcoesSelecionadas,
    opcoesQuantidades = {},
    setOpcoesQuantidades,
    blockedIds
}) => {
    if (!Array.isArray(configuracoes) || configuracoes.length === 0) return null;

    const variations = configuracoes.filter(c => !isFinishingGroup(c));
    const finishings = configuracoes.filter(c => isFinishingGroup(c));

    const allSelectedOptionIds = Object.values(opcoesSelecionadas).flat();

    const allOptions = configuracoes.flatMap(c =>
        Array.isArray(c.options) ? c.options.map((o: any) => ({ ...o, _configId: c.id })) : []
    );

    const isOptionAllowed = (optionId: string, selectedIds: string[]) => {
        // Find the group this option belongs to
        const optionGroup = configuracoes.find(c =>
            Array.isArray(c.options) && c.options.some((o: any) => o.id === optionId)
        );
        const siblings = optionGroup ? optionGroup.options : [];

        // Find all selected options whose groups restrict THIS group
        const restrictingSelectedOptions = allOptions.filter((o: any) => {
            if (!selectedIds.includes(o.id)) return false;
            if (o._configId === optionGroup?.id) return false;
            // Does some option in o's group have allowedChildIds touching this group?
            const oGroup = configuracoes.find(c => c.id === o._configId);
            if (!oGroup) return false;
            return oGroup.options.some((sibling: any) =>
                Array.isArray(sibling.allowedChildIds) &&
                sibling.allowedChildIds.length > 0 &&
                siblings.some((s: any) => sibling.allowedChildIds.includes(s.id))
            );
        });

        if (restrictingSelectedOptions.length === 0) return true;

        // Every restricting selection must explicitly include this option
        return restrictingSelectedOptions.every((sel: any) =>
            Array.isArray(sel.allowedChildIds) && sel.allowedChildIds.includes(optionId)
        );
    };

    const handleGroupChange = (configId: string, ids: string[]) => {
        setOpcoesSelecionadas(prev => {
            const next = { ...prev, [configId]: ids };
            const nowSelected = Object.values(next).flat();
            for (const [gId, gIds] of Object.entries(next)) {
                if (gId === configId) continue;
                const filtered = gIds.filter(optId => isOptionAllowed(optId, nowSelected));
                if (filtered.length !== gIds.length) {
                    next[gId] = filtered;
                }
            }
            return next;
        });
    };

    const renderGroup = (config: any) => (
        <ConfigGroup
            key={config.id}
            config={config}
            selectedIds={opcoesSelecionadas[config.id] || []}
            allSelectedIds={allSelectedOptionIds}
            allOptions={allOptions}
            onChange={(ids) => handleGroupChange(config.id, ids)}
            optionQuantities={opcoesQuantidades}
            setOptionQuantities={setOpcoesQuantidades}
            blockedIds={blockedIds}
        />
    );

    return (
        <div className="space-y-4">
            {/* ── Variações ──────────────────────────────────────────── */}
            {variations.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <Layers className="w-3 h-3 text-indigo-500" />
                        Variações
                    </div>
                    <div className="space-y-2">
                        {variations.map(renderGroup)}
                    </div>
                </div>
            )}

            {/* ── Acabamentos ────────────────────────────────────────── */}
            {finishings.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <Wrench className="w-3 h-3 text-emerald-600" />
                        Acabamentos
                    </div>
                    <div className="space-y-2">
                        {finishings.map(renderGroup)}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────
// SEARCHABLE SELECT — substitui chips para grupos single-select (Variação)
// Mostra apenas o selecionado + dropdown com busca ao expandir
// ─────────────────────────────────────────────────────────────────────────
const SearchableSelect: React.FC<{
    config: any;
    options: any[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    blockedIds: string[];
}> = ({ config, options, selectedId, onSelect, blockedIds }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const selectedOpt = options.find(o => o.id === selectedId);

    const filtered = search.trim()
        ? options.filter(o => {
            const q = search.toLowerCase().normalize('NFC');
            const label = (o.label || '').toLowerCase().normalize('NFC');
            return label.includes(q);
        })
        : options;

    // Reset highlight on filter change
    useEffect(() => { setHighlightIdx(0); }, [filtered.length]);

    // Scroll into view
    useEffect(() => {
        if (!isOpen || !listRef.current) return;
        const el = listRef.current.children[highlightIdx] as HTMLElement;
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlightIdx, isOpen]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const open = useCallback(() => {
        setIsOpen(true);
        setSearch('');
        setTimeout(() => inputRef.current?.focus(), 0);
    }, []);

    const selectOption = useCallback((opt: any) => {
        onSelect(selectedId === opt.id ? null : opt.id);
        setIsOpen(false);
        setSearch('');
    }, [onSelect, selectedId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            setSearch('');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && filtered[highlightIdx]) {
            e.preventDefault();
            selectOption(filtered[highlightIdx]);
        }
    };

    const color = selectedOpt ? detectColor(selectedOpt.label) : null;

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger — usa div com role para evitar button-in-button */}
            <div
                role="combobox"
                aria-expanded={isOpen}
                tabIndex={0}
                onClick={() => isOpen ? (setIsOpen(false), setSearch('')) : open()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isOpen ? (setIsOpen(false), setSearch('')) : open(); } }}
                className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all text-sm cursor-pointer select-none',
                    isOpen
                        ? 'border-indigo-400 ring-2 ring-indigo-100 bg-white'
                        : selectedOpt
                            ? 'border-indigo-200 bg-indigo-50/40 hover:border-indigo-300'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                )}
            >
                {selectedOpt ? (
                    <>
                        {color && (
                            <span
                                className="shrink-0 w-4 h-4 rounded-full border border-slate-200 shadow-inner"
                                style={{
                                    background: color.translucent
                                        ? `linear-gradient(135deg, ${color.hex} 0%, ${color.hex}55 100%)`
                                        : color.hex
                                }}
                            />
                        )}
                        <span className="flex-1 font-semibold text-slate-900 truncate">
                            {selectedOpt.label}
                        </span>
                        {Number(selectedOpt.priceModifier) !== 0 && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                + R$ {Number(selectedOpt.priceModifier).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        )}
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onSelect(null); } }}
                            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 cursor-pointer"
                            title="Limpar seleção"
                        >
                            <X className="w-3 h-3" />
                        </span>
                    </>
                ) : (
                    <>
                        <span className="flex-1 text-slate-400">Selecione {config.name.toLowerCase()}...</span>
                    </>
                )}
                <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform shrink-0', isOpen && 'rotate-180')} />
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Filtrar..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm border-0 bg-slate-50 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:bg-white outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-slate-400">Nenhuma opção encontrada</div>
                        ) : (
                            filtered.map((opt, idx) => {
                                const isSelected = opt.id === selectedId;
                                const isBlocked = blockedIds.includes(opt.id) || !opt.isAvailable;
                                const optColor = detectColor(opt.label);
                                const meta = buildOptionMeta(opt);

                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => !isBlocked && selectOption(opt)}
                                        disabled={isBlocked}
                                        className={cn(
                                            'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors text-sm',
                                            isBlocked && 'opacity-40 cursor-not-allowed',
                                            idx === highlightIdx && !isBlocked && 'bg-indigo-50',
                                            isSelected && 'bg-indigo-50 font-semibold'
                                        )}
                                        onMouseEnter={() => setHighlightIdx(idx)}
                                    >
                                        {optColor ? (
                                            <span
                                                className="shrink-0 w-4 h-4 rounded-full border border-slate-200 shadow-inner"
                                                style={{
                                                    background: optColor.translucent
                                                        ? `linear-gradient(135deg, ${optColor.hex} 0%, ${optColor.hex}55 100%)`
                                                        : optColor.hex
                                                }}
                                            />
                                        ) : (
                                            <span className={cn(
                                                'shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center',
                                                isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                                            )}>
                                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </span>
                                        )}
                                        <span className="flex-1 truncate">{opt.label}</span>
                                        {meta && meta.materialCost > 0 && (
                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                R$ {meta.materialCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/{meta.materialUnit}
                                            </span>
                                        )}
                                        {Number(opt.priceModifier) !== 0 && (
                                            <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                                                + R$ {Number(opt.priceModifier).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        )}
                                        {isSelected && (
                                            <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                                        )}
                                        {isBlocked && (
                                            <Ban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer hint */}
                    <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[9px] text-slate-400">
                        <span>{filtered.length} {filtered.length === 1 ? 'opção' : 'opções'}</span>
                        <span className="flex items-center gap-2">
                            <kbd className="px-1 py-0.5 bg-white border rounded text-[8px]">↑↓</kbd> navegar
                            <kbd className="px-1 py-0.5 bg-white border rounded text-[8px]">⏎</kbd> selecionar
                            <kbd className="px-1 py-0.5 bg-white border rounded text-[8px]">esc</kbd> fechar
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────
// GRUPO — Variação usa SearchableSelect, Acabamento usa chips/cards
// ─────────────────────────────────────────────────────────────────────────
const ConfigGroup: React.FC<{
    config: any;
    selectedIds: string[];
    allSelectedIds: string[];
    allOptions: any[];
    onChange: (ids: string[]) => void;
    optionQuantities: Record<string, number>;
    setOptionQuantities?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    blockedIds: string[];
}> = ({ config, selectedIds, allSelectedIds, allOptions, onChange, optionQuantities, setOptionQuantities, blockedIds }) => {
    const rawOptions = Array.isArray(config.options) ? config.options : [];
    // Determine which other configs restrict THIS group.
    // A config restricts this group if ANY of its options has allowedChildIds
    // referencing ANY option in this group.
    const restrictingConfigIds = new Set<string>();
    allOptions.forEach((opt: any) => {
        if (opt._configId === config.id) return;
        if (!Array.isArray(opt.allowedChildIds) || opt.allowedChildIds.length === 0) return;
        if (rawOptions.some((ro: any) => opt.allowedChildIds.includes(ro.id))) {
            restrictingConfigIds.add(opt._configId);
        }
    });

    // If a restricting config has a selected option WITHOUT allowedChildIds,
    // this group is "skipped" entirely (the parent is standalone).
    let isSkippedByParent = false;
    for (const configId of restrictingConfigIds) {
        const selectedInConfig = allOptions.find((ao: any) =>
            ao._configId === configId && allSelectedIds.includes(ao.id)
        );
        if (!selectedInConfig) continue;
        const allowed = Array.isArray(selectedInConfig.allowedChildIds)
            ? selectedInConfig.allowedChildIds
            : [];
        if (allowed.length === 0) {
            isSkippedByParent = true;
            break;
        }
    }

    if (isSkippedByParent) return null;

    const options = rawOptions.filter((o: any) => {
        if (restrictingConfigIds.size === 0) return true;
        for (const configId of restrictingConfigIds) {
            const selectedInConfig = allOptions.find((ao: any) =>
                ao._configId === configId && allSelectedIds.includes(ao.id)
            );
            if (!selectedInConfig) continue;
            const allowed = Array.isArray(selectedInConfig.allowedChildIds)
                ? selectedInConfig.allowedChildIds
                : [];
            if (!allowed.includes(o.id)) return false;
        }
        return true;
    });
    const isMultiSelect = isGroupMultiSelect(config);
    const isFinishing = isFinishingGroup(config);

    // ── Variação: SearchableSelect (filtro + apenas o selecionado visível) ──
    if (!isFinishing) {
        return (
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        {config.name}
                    </span>
                    <span className="text-[9px] text-slate-400">
                        {options.length} {options.length === 1 ? 'opção' : 'opções'}
                    </span>
                </div>
                <SearchableSelect
                    config={config}
                    options={options}
                    selectedId={selectedIds[0] || null}
                    onSelect={(id) => onChange(id ? [id] : [])}
                    blockedIds={blockedIds}
                />
            </div>
        );
    }

    // ── Acabamento: layout com chips/cards (multi-select) ──
    const hasAnyCompositional = options.some((o: any) => buildOptionMeta(o) !== null);
    // Se qualquer opção permite qty customizada, força layout expandido (card com stepper)
    const hasAnyCustomQty = options.some((o: any) => Boolean(o.allowCustomQty));
    const allPurePicks = !hasAnyCustomQty && options.length > 0 && options.every((o: any) => {
        const m = buildOptionMeta(o);
        return m !== null && m.materialCost === 0;
    });
    const isDenseList = options.length > 8;

    const handleToggle = (optId: string) => {
        const isCurrentlySelected = selectedIds.includes(optId);
        if (isMultiSelect) {
            onChange(
                isCurrentlySelected
                    ? selectedIds.filter(id => id !== optId)
                    : [...selectedIds, optId]
            );
        } else {
            onChange(isCurrentlySelected ? [] : [optId]);
        }
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-3 py-2 bg-gradient-to-r from-emerald-50/60 to-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        {config.name}
                    </span>
                    {hasAnyCompositional && (
                        <span className="inline-flex items-center gap-1 text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full uppercase">
                            <Sparkles className="w-2 h-2" />
                            Compositivo
                        </span>
                    )}
                    <span className="text-[8px] text-slate-500 font-medium uppercase italic">
                        seleção múltipla
                    </span>
                </div>
                <span className="text-[9px] text-slate-400 font-medium uppercase">
                    {options.length} {options.length === 1 ? 'opção' : 'opções'}
                    {selectedIds.length > 0 && (
                        <span className="ml-2 text-emerald-600 font-bold">
                            · {selectedIds.length} selecionada{selectedIds.length > 1 ? 's' : ''}
                        </span>
                    )}
                </span>
            </div>

            <div
                className={cn(
                    allPurePicks
                        ? 'flex flex-wrap gap-1.5 p-3 bg-white'
                        : 'divide-y divide-slate-100',
                    isDenseList && 'max-h-80 overflow-y-auto'
                )}
            >
                {options.map((opt: any) => (
                    <OptionRow
                        key={opt.id}
                        opt={opt}
                        isSelected={selectedIds.includes(opt.id)}
                        isMultiSelect={isMultiSelect}
                        isBlocked={blockedIds.includes(opt.id) || !opt.isAvailable}
                        optionQuantities={optionQuantities}
                        compact={allPurePicks}
                        onToggle={() => handleToggle(opt.id)}
                        onQuantityChange={(q) => {
                            if (!setOptionQuantities) return;
                            setOptionQuantities(prev => ({ ...prev, [opt.id]: q }));
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────
// LINHA DE OPÇÃO (acabamentos — mantém chips compactos e cards expandidos)
// ─────────────────────────────────────────────────────────────────────────
const OptionRow: React.FC<{
    opt: any;
    isSelected: boolean;
    isMultiSelect: boolean;
    isBlocked: boolean;
    optionQuantities: Record<string, number>;
    compact?: boolean;
    onToggle: () => void;
    onQuantityChange: (q: number) => void;
}> = ({ opt, isSelected, isMultiSelect, isBlocked, optionQuantities, compact = false, onToggle, onQuantityChange }) => {
    const meta = buildOptionMeta(opt);
    const hasMeta = meta !== null;
    const hasMaterialLinked = Boolean(opt?.materialId || opt?.material || opt?.materialName);
    // purePick = material sem custo E sem qty customizável (ex: cor).
    // Acabamentos com allowCustomQty sempre expandidos (card com stepper).
    const isPurePick = hasMeta && (meta?.materialCost ?? 0) === 0 && !meta?.allowCustomQty;
    const currentQty = optionQuantities[opt.id] ?? meta?.defaultQuantity ?? 1;
    const isCustomQty = !isPurePick
        && optionQuantities[opt.id] !== undefined
        && meta
        && optionQuantities[opt.id] !== meta.defaultQuantity;

    // Custo previsto:
    // - Com material: qty × custo material
    // - Sem material mas com qty customizável (ex: Ilhos): qty × priceModifier
    // - Sem nenhum: priceModifier fixo
    const priceMod = Number(opt.priceModifier ?? 0);
    const previewCost = hasMeta && meta.materialCost > 0
        ? currentQty * meta.materialCost
        : meta?.allowCustomQty
            ? currentQty * priceMod
            : priceMod;

    const unitCostForDelta = (meta?.materialCost ?? 0) > 0 ? meta!.materialCost : priceMod;
    const deltaCost = (isCustomQty && meta)
        ? (currentQty - meta.defaultQuantity) * unitCostForDelta
        : 0;

    // Modo compacto (chip/pill)
    if (compact || isPurePick) {
        const color = detectColor(opt.label);
        const hasPriceMod = Number(opt.priceModifier) !== 0;

        return (
            <button
                type="button"
                onClick={onToggle}
                disabled={isBlocked}
                title={isBlocked ? 'Indisponível' : opt.label}
                className={cn(
                    'group inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150 select-none',
                    isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-300/40 ring-2 ring-emerald-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700',
                    isBlocked && 'opacity-40 cursor-not-allowed line-through hover:bg-white hover:text-slate-700 hover:border-slate-200'
                )}
            >
                {color ? (
                    <span
                        className={cn(
                            'shrink-0 w-4 h-4 rounded-full border shadow-inner',
                            isSelected ? 'border-white/70 ring-1 ring-white/30' : 'border-slate-300'
                        )}
                        style={{
                            background: color.translucent
                                ? `linear-gradient(135deg, ${color.hex} 0%, ${color.hex}55 100%)`
                                : color.hex
                        }}
                        aria-hidden="true"
                    />
                ) : (
                    <span
                        className={cn(
                            'shrink-0 flex items-center justify-center w-4 h-4 rounded-full transition-colors',
                            isSelected
                                ? 'bg-white/20'
                                : 'bg-slate-100 group-hover:bg-emerald-100'
                        )}
                        aria-hidden="true"
                    >
                        {isSelected ? (
                            <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        ) : isBlocked ? (
                            <Ban className="w-2.5 h-2.5 text-slate-400" strokeWidth={2.5} />
                        ) : null}
                    </span>
                )}

                <span className="truncate max-w-[160px]">{opt.label}</span>

                {color && isSelected && (
                    <Check className="w-3 h-3 ml-0.5 shrink-0" strokeWidth={3} />
                )}

                {hasPriceMod && (
                    <span
                        className={cn(
                            'text-[9px] font-bold tabular-nums shrink-0 px-1 py-0.5 rounded',
                            isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-emerald-50 text-emerald-700'
                        )}
                    >
                        + R$ {Number(opt.priceModifier).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div
            className={cn(
                'flex items-center gap-3 px-3 py-2.5 transition-colors',
                isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50',
                isBlocked && 'opacity-40 cursor-not-allowed'
            )}
        >
            {/* Checkbox (multi-select) ou Radio (single-select) */}
            <button
                type="button"
                onClick={onToggle}
                disabled={isBlocked}
                className={cn(
                    'shrink-0 w-4 h-4 border-2 flex items-center justify-center transition-all',
                    isMultiSelect ? 'rounded-[4px]' : 'rounded-full',
                    isSelected
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-slate-300 bg-white hover:border-emerald-400'
                )}
                title={isSelected ? 'Remover seleção' : 'Selecionar'}
                aria-label={isSelected ? 'Remover seleção' : 'Selecionar'}
            >
                {isSelected && (
                    isMultiSelect ? (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6 5,9 10,3" />
                        </svg>
                    ) : (
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    )
                )}
            </button>

            {/* Identidade + metadata */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
                    {hasMaterialLinked && meta?.materialName && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded">
                            <Link2 className="w-2.5 h-2.5" />
                            {meta.materialName}
                        </span>
                    )}
                    {!hasMaterialLinked && priceMod !== 0 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">
                            R$ {priceMod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / un
                        </span>
                    )}
                </div>

                {hasMaterialLinked && meta ? (
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        {meta.materialCost > 0 && (
                            <span>
                                R$ {meta.materialCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                /{meta.materialUnit}
                            </span>
                        )}
                        {meta?.quantityHint && (
                            <>
                                <span className="text-slate-300">·</span>
                                <span className="italic">{meta.quantityHint}</span>
                            </>
                        )}
                    </div>
                ) : null}
            </div>

            {/* Quantidade editável */}
            {isSelected && hasMeta && meta?.allowCustomQty && (
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                            Qtd
                        </span>
                        {isCustomQty && (
                            <span className="text-[8px] text-amber-600 font-medium uppercase">
                                customizada
                            </span>
                        )}
                    </div>
                    <div className="flex items-center bg-white border border-slate-300 rounded-md overflow-hidden focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-200">
                        <button
                            type="button"
                            onClick={() => onQuantityChange(Math.max(0, currentQty - 1))}
                            className="w-6 h-7 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                            title="Diminuir"
                        >
                            −
                        </button>
                        <Input
                            type="number"
                            min={0}
                            step={meta.materialUnit === 'm' ? 0.1 : 1}
                            value={currentQty}
                            onChange={(e) => onQuantityChange(Number(e.target.value || 0))}
                            className="h-7 w-14 text-sm text-center border-0 focus:ring-0 focus-visible:ring-0 px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                            type="button"
                            onClick={() => onQuantityChange(currentQty + 1)}
                            className="w-6 h-7 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                            title="Aumentar"
                        >
                            +
                        </button>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold w-6">
                        {meta.materialUnit}
                    </span>
                </div>
            )}

            {/* Quantidade fixa (não editável) */}
            {isSelected && hasMeta && !meta?.allowCustomQty && meta?.defaultQuantity > 1 && (
                <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Qtd</span>
                    <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {meta?.defaultQuantity} {meta?.materialUnit}
                    </span>
                </div>
            )}

            {/* Subtotal / Adicional + Delta */}
            <div className="shrink-0 text-right min-w-[92px]">
                <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                    {isSelected ? 'Subtotal' : 'Adicional'}
                </div>
                <div
                    className={cn(
                        'text-sm font-bold tabular-nums',
                        isSelected ? 'text-emerald-600' : 'text-slate-400'
                    )}
                >
                    {previewCost > 0 ? '+' : ''}
                    R$ {previewCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {isSelected && isCustomQty && deltaCost !== 0 && (
                    <div className={cn(
                        'text-[9px] font-bold tabular-nums leading-tight mt-0.5',
                        deltaCost > 0 ? 'text-amber-600' : 'text-sky-600'
                    )}>
                        {deltaCost > 0 ? '↑' : '↓'} R$ {Math.abs(deltaCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vs padrão
                    </div>
                )}
            </div>
        </div>
    );
};
