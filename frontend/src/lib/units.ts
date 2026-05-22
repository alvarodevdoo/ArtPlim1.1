/**
 * Unidade de Medida — utilitários centrais (frontend).
 *
 * Use estes helpers em qualquer componente que exiba estoque ou unidade.
 * Mantém a mesma lógica do backend para garantir consistência.
 */

export interface UnitSource {
    unit?: string | null;
    controlUnit?: string | null;
    stockUnit?: string | null;
    purchaseUnit?: string | null;
}

const UNITARY_ALIASES = new Set([
    'PC', 'PCS', 'PCT', 'UN', 'UND', 'UNI', 'PÇ', 'PC.', 'CX', 'PEÇA', 'PECA'
]);

/**
 * Resolve a unidade que deve ser exibida na UI.
 * Prioridade: controlUnit → stockUnit → unit → fallback ('un').
 */
export function resolveDisplayUnit(source: UnitSource | null | undefined, fallback = 'un'): string {
    if (!source) return fallback;
    const candidate =
        source.controlUnit ||
        source.stockUnit ||
        source.unit ||
        fallback;
    return normalizeUnitLabel(candidate);
}

/**
 * Normaliza códigos unitários (PC, PCS, UND, PÇ, UNI...) para "un".
 * Outras unidades (kg, m², L) retornam em minúsculas.
 */
export function normalizeUnitLabel(raw: string | null | undefined): string {
    if (!raw) return 'un';
    const upper = raw.toUpperCase().trim();
    if (UNITARY_ALIASES.has(upper)) return 'un';
    return raw.toLowerCase().trim();
}

/**
 * Detecta se a unidade representa contagem inteira (un, pc, etc).
 */
export function isUnitaryUnit(raw: string | null | undefined): boolean {
    if (!raw) return false;
    return UNITARY_ALIASES.has(raw.toUpperCase().trim());
}

/**
 * Formata um número de acordo com a unidade resolvida.
 * Unitárias → inteiro truncado; demais → 2 casas decimais; inteiros sempre inteiros.
 */
export function formatStockNumber(value: number, source: UnitSource | null | undefined): string {
    const unit = resolveDisplayUnit(source);
    const isUnitary = unit === 'un';
    if (isUnitary || Number.isInteger(value)) {
        return String(Math.trunc(value));
    }
    return value.toFixed(2);
}

/**
 * Formata "value unit" — ex: "400 un", "1.5 m²".
 */
export function formatStockQuantity(value: number, source: UnitSource | null | undefined): string {
    return `${formatStockNumber(value, source)} ${resolveDisplayUnit(source)}`;
}

/**
 * Sublabel padrão para listagens de insumos em comboboxes — ex: "un • R$ 0.50".
 * Aceita o objeto bruto (com possíveis aliases legados: unidadeBase, custoUnitario)
 * e devolve string normalizada — toda UI de seleção de insumo deve usar esta função
 * para garantir que a unidade exibida bata com a centralização em resolveDisplayUnit.
 */
export function buildInsumoSublabel(material: any): string {
    if (!material) return '';
    const unit = resolveDisplayUnit({
        unit: material.unit || material.unidadeBase,
        controlUnit: material.controlUnit,
        stockUnit: material.stockUnit,
        purchaseUnit: material.purchaseUnit,
    });
    const cost = Number(material.averageCost || material.custoUnitario || material.costPerUnit || 0).toFixed(2);
    return `${unit} • R$ ${cost}`;
}
