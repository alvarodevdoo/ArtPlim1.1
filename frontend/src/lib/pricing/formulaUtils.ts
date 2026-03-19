import { evaluate, parse, unit, EvalFunction } from 'mathjs';

/**
 * CONSTANTES E CONFIGURAÇÕES GLOBAIS
 */
const RESERVED_WORDS = new Set(['pi', 'e', 'sin', 'cos', 'tan', 'sqrt', 'log', 'exp', 'round', 'ceil', 'floor', 'abs', 'true', 'false', 'min', 'max']);

const UNIT_MAPPING: Record<string, string> = {
    'KM': 'km', 'M': 'm', 'CM': 'cm', 'MM': 'mm', 'KG': 'kg', 'G': 'g',
    'KWH': 'kWh', 'WH': 'Wh', 'J': 'J', 'H': 'h', 'MIN': 'min', 'S': 's',
    'W': 'W', 'KW': 'kW', 'M2': 'm2', 'CM2': 'cm2', 'MM2': 'mm2'
};

const TARGET_BASE: Record<string, string> = {
    'WEIGHT': 'g', 'LENGTH': 'mm', 'AREA': 'mm2', 'VOLUME': 'ml',
    'TIME': 's', 'ENERGY': 'J', 'POWER': 'W', 'PERCENT': '%'
};

const RATE_TARGETS: Record<string, string> = {
    'kg': 'g', 'g': 'g', 'mg': 'g', 'ton': 'g',
    'km': 'mm', 'm': 'mm', 'cm': 'mm', 'mm': 'mm',
    'l': 'ml', 'ml': 'ml', 'm3': 'ml',
    'm2': 'mm2', 'cm2': 'mm2', 'mm2': 'mm2',
    'kWh': 'J', 'Wh': 'J', 'J': 'J',
    'd': 's', 'h': 's', 'min': 's', 's': 's'
};

const compileCache = new Map<string, EvalFunction>();

const getNormalizedUnit = (u: string | null): string | null => {
    if (!u) return null;
    const clean = u.toUpperCase().replace(/[²^]/g, '2');
    return UNIT_MAPPING[clean] || u.toLowerCase();
};

/**
 * FUNÇÕES EXPORTADAS
 */

export const extractVariables = (formulaStr: string): string[] => {
    if (!formulaStr?.trim()) return [];
    try {
        const clean = formulaStr.replace(/#[a-zA-ZáàâãééêíïóôõõúüçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ_0-9]*/g, '');
        const matches = clean.match(/[a-zA-ZáàâãééêíïóôõõúüçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ_][a-zA-Z0-9áàâãééêíïóôõõúüçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ_]*/g);
        if (!matches) return [];
        return Array.from(new Set(matches)).filter(m => !RESERVED_WORDS.has(m.toLowerCase()));
    } catch { return []; }
};

export const renameVariableInFormula = (formulaStr: string, oldName: string, newName: string): string => {
    if (!oldName || !newName || !formulaStr) return formulaStr;
    return formulaStr.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
};

// Restaurada para corrigir o erro de import no PricingRuleEditorModal
export const removeVariableFromFormula = (formulaStr: string, varName: string): string => {
    if (!varName || !formulaStr) return formulaStr;
    try {
        // Remove a variável e operadores adjacentes de forma segura
        const regexPrev = new RegExp(`(\\s*[\\+\\-\\*\\/\\^]\\s*)\\b${varName}\\b`, 'g');
        const regexNext = new RegExp(`\\b${varName}\\b(\\s*[\\+\\-\\*\\/\\^]\\s*)`, 'g');
        const regexAlone = new RegExp(`\\b${varName}\\b`, 'g');

        let result = formulaStr.replace(regexPrev, '');
        if (result === formulaStr) result = formulaStr.replace(regexNext, '');
        if (result === formulaStr) result = formulaStr.replace(regexAlone, '');

        return result.trim();
    } catch { return formulaStr; }
};

export const validateFormulaSyntax = (formulaStr: string): true | string => {
    if (!formulaStr?.trim()) return "A fórmula está vazia.";
    try { parse(formulaStr); return true; }
    catch (error: any) { return error.message || "Erro de sintaxe."; }
};

export const evaluateFormula = (formulaStr: string, scope: Record<string, any> = {}, ruleVariables: any[] = []): number | string => {
    if (!formulaStr?.trim()) return 0;

    try {
        const cleanFormula = formulaStr
            .replace(/#[a-zA-ZáàâãééêíïóôõõúüçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ_0-9]+/g, '')
            .replace(/×/g, '*')
            .replace(/÷/g, '/');

        let compiled = compileCache.get(cleanFormula);
        if (!compiled) {
            compiled = parse(cleanFormula).compile();
            compileCache.set(cleanFormula, compiled);
        }

        const normalizedScope: Record<string, any> = {};
        const inputs: Record<string, any> = Object.fromEntries(
            Object.entries(scope).map(([k, v]) => [k.toLowerCase(), v])
        );

        for (const v of ruleVariables) {
            const vid = v.id.toLowerCase();
            const rawValue = inputs[vid] ?? v.fixedValue ?? 0;
            const currentUnit = inputs[`${vid}_unit`] || v.defaultUnit || v.unit || null;

            let numVal = typeof rawValue === 'string' ? parseFloat(rawValue.replace(',', '.')) : rawValue;
            if (isNaN(numVal)) numVal = 0;

            const role = v.role || 'NONE';

            if (role === 'COST_RATE' || (currentUnit?.includes('/'))) {
                const unitPart = getNormalizedUnit(currentUnit?.split('/').pop()?.trim() || null);
                const targetRate = unitPart ? RATE_TARGETS[unitPart] : null;
                if (unitPart && targetRate && unitPart !== targetRate) {
                    try { numVal /= unit(1, unitPart).toNumber(targetRate); } catch { }
                }
            } else if (role === 'PERCENT' || currentUnit === '%') {
                numVal /= 100;
            } else {
                const normTarget = getNormalizedUnit(TARGET_BASE[role]);
                const normCurrent = getNormalizedUnit(currentUnit);
                if (normTarget && normCurrent && normTarget !== normCurrent) {
                    try { numVal = unit(numVal, normCurrent).toNumber(normTarget); } catch { }
                }
            }

            normalizedScope[v.id] = numVal;
            normalizedScope[vid] = numVal;
            normalizedScope[v.id.toUpperCase()] = numVal;
        }

        const result = compiled.evaluate(normalizedScope);
        const finalNum = typeof result === 'number' ? result : (result?.value || Number(result));

        return isNaN(finalNum) ? "Erro no cálculo" : Math.round(finalNum * 100) / 100;

    } catch (error: any) {
        if (error.message?.includes('Undefined symbol')) return `Pendente: ${error.message.split('symbol ')[1]}`;
        return `Erro: ${error.message}`;
    }
};

export const calculatePricingResult = (formulaStr: string | null | undefined, variables: any[] = [], inputValues: Record<string, any> = {}): { value: number; breakdown: any[] } => {
    if (!formulaStr) return { value: 0, breakdown: [] };

    const scope: Record<string, any> = {};
    for (const v of variables) {
        const isFixed = v.type === 'FIXED';
        scope[v.id] = isFixed ? (v.fixedValue ?? 0) : (inputValues[v.id] ?? 0);
        scope[`${v.id}_unit`] = isFixed ? (v.defaultUnit || v.unit || '') : (inputValues[`${v.id}_unit`] || v.defaultUnit || v.unit || '');
    }

    try {
        const valueResult = evaluateFormula(formulaStr, scope, variables);
        const numericVal = typeof valueResult === 'number' ? valueResult : 0;
        const breakdown: any[] = [];

        const breakdownRegex = /\(([^)]+)\)#([a-zA-ZáàâãééêíïóôõõúüçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ_0-9]+)/g;
        let match;
        while ((match = breakdownRegex.exec(formulaStr)) !== null) {
            try {
                const subRes = evaluateFormula(match[1], scope, variables);
                if (typeof subRes === 'number') breakdown.push({ label: match[2], value: subRes });
            } catch { }
        }

        return { value: numericVal, breakdown };
    } catch {
        return { value: 0, breakdown: [] };
    }
};