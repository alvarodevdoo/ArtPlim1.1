/**
 * Unidade de Medida — utilitários centrais.
 *
 * Regra única: o "controlUnit" é o que o usuário cadastrou como unidade de
 * controle interno e é a SEMPRE a unidade que deve aparecer na UI quando o
 * estoque é exibido para o operador. O campo legado "unit" pode estar
 * dessincronizado (derivado do formato/dimensões) e só é usado como fallback.
 *
 * Use estes helpers em QUALQUER endpoint que retorne estoque ao frontend.
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
 * Normaliza códigos unitários diversos (PC, PCS, UND, PÇ, UNI...) para "un".
 * Para outras unidades (kg, m², L), retorna em minúsculas.
 */
export function normalizeUnitLabel(raw: string | null | undefined): string {
    if (!raw) return 'un';
    const upper = raw.toUpperCase().trim();
    if (UNITARY_ALIASES.has(upper)) return 'un';
    return raw.toLowerCase().trim();
}

/**
 * Formata uma quantidade de estoque de acordo com a unidade.
 * Unidades unitárias → inteiro; demais → 2 casas decimais.
 */
export function formatStockQuantity(value: number, source: UnitSource | null | undefined): string {
    const unit = resolveDisplayUnit(source);
    const isUnitary = unit === 'un';
    const formatted = isUnitary || Number.isInteger(value)
        ? String(Math.trunc(value))
        : value.toFixed(2);
    return `${formatted} ${unit}`;
}
