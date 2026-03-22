import { parse, unit, EvalFunction } from 'mathjs';

/**
 * 🛡️ MOTOR DE PRECIFICAÇÃO UNIFICADO (ARTPLIM ERP)
 * ⚠️ AVISO: Este arquivo DEVE ser mantido idêntico entre Frontend e Backend.
 * Caminhos:
 * - Frontend: frontend/src/lib/pricing/formulaUtils.ts
 * - Backend: backend/src/shared/application/pricing/formulaUtils.ts
 */

const compileCache = new Map<string, EvalFunction>();

// 1. MAPEAMENTO DE UNIDADES (Normalização de Nomes para o MathJS)
const UNIT_MAPPING: Record<string, string> = {
    'KM': 'km', 'M': 'm', 'CM': 'cm', 'MM': 'mm', 
    'KG': 'kg', 'G': 'g', 'MG': 'mg', 'TON': 'ton',
    'KWH': 'kWh', 'WH': 'Wh', 'J': 'J', 
    'H': 'h', 'MIN': 'min', 'S': 's', 'D': 'd',
    'W': 'W', 'KW': 'kW', 
    'M2': 'm^2', 'CM2': 'cm^2', 'MM2': 'mm^2',
    'M3': 'm^3', 'CM3': 'cm^3', 'MM3': 'mm^3',
    'L': 'l', 'ML': 'ml'
};

// 2. UNIDADES BASE PARA CADA PAPEL (ROLE)
const ROLE_TO_BASE_UNIT: Record<string, string> = {
    'LENGTH': 'mm', 'WIDTH': 'mm', 'HEIGHT': 'mm', 'DEPTH': 'mm',
    'AREA': 'mm^2', 'SQUARE_METERS': 'mm^2',
    'VOLUME': 'ml',
    'WEIGHT': 'g', 'MASS': 'g',
    'TIME': 's',
    'ENERGY': 'J',
    'POWER': 'W',
    'PERCENT': '%',
    'COST_RATE': 'mm^2'
};

// 3. TABELA DE FATORES FIXOS (Fallback de Segurança para o MathJS)
// mm, mm2, g, ml, s, J, W são as bases internas.
const HARDCODED_FACTORS: Record<string, number> = {
    'm': 1000, 'cm': 10, 'mm': 1,
    'm^2': 1000000, 'cm^2': 100, 'mm^2': 1,
    'm^3': 1000000, 'cm^3': 1, 'mm^3': 0.001,
    'kg': 1000, 'g': 1, 'mg': 0.001, 'ton': 1000000,
    'l': 1000, 'ml': 1,
    'h': 3600, 'min': 60, 's': 1, 'd': 86400,
    'kWh': 3600000, 'Wh': 3600, 'J': 1,
    'W': 1, 'kW': 1000
};

/**
 * Normaliza uma string de unidade para o padrão interno (m^2, mm, etc)
 */
export const normalizeUnit = (u: string | null | undefined): string | null => {
    if (!u) return null;
    const clean = u.toString().toUpperCase()
        .replace(/\^/g, '')
        .replace(/²/g, '2')
        .replace(/³/g, '3')
        .trim();
    return UNIT_MAPPING[clean] || u.toLowerCase();
};

/**
 * Retorna o fator de conversão de uma unidade para outra.
 */
export const getConversionFactor = (from: string, to: string): number => {
    const nFrom = normalizeUnit(from) || from;
    const nTo = normalizeUnit(to) || to;

    if (nFrom === nTo) return 1;

    // Tentar via tabela fixa (mais rápido e seguro no browser)
    if (HARDCODED_FACTORS[nFrom] && HARDCODED_FACTORS[nTo]) {
        return HARDCODED_FACTORS[nFrom] / HARDCODED_FACTORS[nTo];
    }

    // Fallback para MathJS
    try {
        return unit(1, nFrom).toNumber(nTo);
    } catch {
        return 1;
    }
};

/**
 * Avalia uma fórmula matemática com variáveis normalizadas.
 */
export const evaluateFormula = (
    formulaStr: string, 
    scope: Record<string, any> = {}, 
    ruleVariables: any[] = [],
    logs?: string[]
): number | string => {
    if (!formulaStr?.trim()) return 0;

    try {
        const cleanFormula = formulaStr
            .replace(/#[a-zA-ZáàâãéêíïóôõúüçÁÀÂÃÉÊÍÏÓÔÕÚÜÇ_0-9]+/g, '') // Remove comentários internos
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
            
            let numVal = typeof rawValue === 'string' ? parseFloat(rawValue.replace(',', '.')) : Number(rawValue);
            if (isNaN(numVal)) numVal = 0;

            const role = v.role || 'NONE';
            const baseUnit = ROLE_TO_BASE_UNIT[role];

            // 1. Normalização de TAXAS (R$/m2, etc)
            if (role === 'COST_RATE' || (currentUnit && currentUnit.toString().includes('/'))) {
                let unitPart = normalizeUnit(currentUnit.toString().split('/').pop()?.trim());
                
                // Se a unidade for genérica (moeda, un, etc) e for COST_RATE, assumimos m^2
                if ((!unitPart || unitPart === 'moeda' || unitPart === 'un') && role === 'COST_RATE') {
                    unitPart = 'm^2';
                }

                const targetUnit = normalizeUnit(baseUnit) || 'mm^2';

                if (unitPart && targetUnit && unitPart !== targetUnit) {
                    const factor = getConversionFactor(unitPart, targetUnit);
                    if (factor > 0) numVal /= factor;
                    if (logs) logs.push(`[Rate] ${v.id}: ${unitPart} -> ${targetUnit} (DIV ${factor})`);
                }
            } 
            // 2. Normalização de PERCENTUAL
            else if (role === 'PERCENT' || currentUnit === '%') {
                numVal /= 100;
            } 
            // 3. Normalização de MEDIDAS FÍSICAS
            else if (baseUnit && currentUnit) {
                const normCurrent = normalizeUnit(currentUnit);
                const normBase = normalizeUnit(baseUnit);
                if (normCurrent && normBase && normCurrent !== normBase) {
                    const factor = getConversionFactor(normCurrent, normBase);
                    numVal *= factor;
                    if (logs) logs.push(`[Unit] ${v.id}: ${normCurrent} -> ${normBase} (MULT ${factor})`);
                }
            }

            // Injeta no escopo em múltiplos formatos para evitar erros de case
            normalizedScope[v.id] = numVal;
            normalizedScope[vid] = numVal;
            normalizedScope[v.id.toUpperCase()] = numVal;
            
            // Aliases de compatibilidade para o Backend
            if (v.role === 'WIDTH') normalizedScope['LARGURA'] = normalizedScope['WIDTH'] = numVal;
            if (v.role === 'HEIGHT') normalizedScope['ALTURA'] = normalizedScope['HEIGHT'] = numVal;
            if (v.role === 'AREA' || v.role === 'SQUARE_METERS') normalizedScope['M2'] = normalizedScope['AREA'] = numVal;
        }

        const result = compiled.evaluate(normalizedScope);
        const finalNum = typeof result === 'number' ? result : (result?.value || Number(result));

        return isNaN(finalNum) ? "Erro no cálculo" : Math.round(finalNum * 100) / 100;

    } catch (error: any) {
        if (error.message?.includes('Undefined symbol')) return `Pendente: ${error.message.split('symbol ')[1]}`;
        return `Erro: ${error.message}`;
    }
};

/**
 * Função de conveniência para calcular o preço e o detalhamento (breakdown).
 */
export const calculatePricingResult = (
    formulaStr: string | null | undefined, 
    variables: any[] = [], 
    inputValues: Record<string, any> = {}
): { value: number; breakdown: any[] } => {
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

        // Extrai sub-cálculos marcados com # (ex: (custo * 2)#MARGEM)
        const breakdownRegex = /\(([^)]+)\)#([a-zA-ZáàâãéêíïóôõúüçÁÀÂÃÉÊÍÏÓÔÕÚÜÇ_0-9]+)/g;
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

// Funções utilitárias de árvore para compatibilidade
export const extractVariables = (formulaStr: string): string[] => {
    if (!formulaStr?.trim()) return [];
    try {
        const RESERVED = new Set(['pi', 'e', 'sin', 'cos', 'tan', 'sqrt', 'log', 'round', 'ceil', 'floor', 'abs', 'min', 'max']);
        const clean = formulaStr.replace(/#[a-zA-ZáàâãéêíïóôõúüçÁÀÂÃÉÊÍÏÓÔÕÚÜÇ_0-9]*/g, '');
        const matches = clean.match(/[a-zA-ZáàâãéêíïóôõúüçÁÀÂÃÉÊÍÏÓÔÕÚÜÇ_][a-zA-Z0-9áàâãéêíïóôõúüçÁÀÂÃÉÊÍÏÓÔÕÚÜÇ_]*/g);
        if (!matches) return [];
        return Array.from(new Set(matches)).filter(m => !RESERVED.has(m.toLowerCase()));
    } catch { return []; }
};

export const renameVariableInFormula = (formulaStr: string, oldName: string, newName: string): string => {
    if (!oldName || !newName || !formulaStr) return formulaStr;
    return formulaStr.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
};

export const removeVariableFromFormula = (formulaStr: string, varName: string): string => {
    if (!varName || !formulaStr) return formulaStr;
    try {
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
