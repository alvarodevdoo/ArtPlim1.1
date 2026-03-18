import * as mathjs from 'mathjs';

// Mocking the behavior of formulaUtils.ts
const extractVariables = (formulaStr: string): string[] => {
    if (!formulaStr || formulaStr.trim() === '') return [];
    try {
        const matches = formulaStr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
        if (!matches) return [];
        const reserved = ['pi', 'e', 'sin', 'cos', 'tan', 'sqrt', 'log', 'exp', 'round', 'ceil', 'floor', 'abs', 'true', 'false', 'min', 'max'];
        return Array.from(new Set(matches)).filter(m => !reserved.includes(m.toLowerCase()));
    } catch (error) { return []; }
};

const evaluateFormula = (formulaStr: string, scope: Record<string, number>, ruleVariables?: any[]): number | string => {
    try {
        if (!formulaStr || formulaStr.trim() === '') return 0;
        const cleanFormula = formulaStr.replace(/#.*?(?=\+|$)/g, '');
        console.log('Clean Formula:', cleanFormula);
        const normalizedScope: Record<string, any> = {};
        Object.keys(scope).forEach(key => {
            normalizedScope[key] = scope[key];
            normalizedScope[key.toLowerCase()] = scope[key];
        });

        if (ruleVariables && Array.isArray(ruleVariables)) {
            ruleVariables.forEach(v => {
                if (v.type === 'FIXED' && v.fixedValue !== undefined) {
                    normalizedScope[v.id] = v.fixedValue;
                    normalizedScope[v.id.toLowerCase()] = v.fixedValue;
                }
            });

            ruleVariables.forEach(variable => {
                const lowerId = variable.id.toLowerCase();
                const actualId = normalizedScope.hasOwnProperty(variable.id) ? variable.id : (normalizedScope.hasOwnProperty(lowerId) ? lowerId : null);

                if (actualId) {
                    let val = normalizedScope[actualId];
                    const baseUnit = variable.baseUnit || variable.unit || null;
                    const currentUnit = (scope as any)[`${actualId}_unit`] || variable.unit || baseUnit;
                    const nonPhysicalUnits = ['X', 'moeda', '%', 'un', 'unidade', 'und', 'pç', 'pcas', 'folhas'];
                    const isPhysical = (u: string) => u && !nonPhysicalUnits.includes(u.toLowerCase());

                    if (baseUnit && currentUnit && isPhysical(baseUnit) && isPhysical(currentUnit) && baseUnit !== currentUnit) {
                        try {
                            normalizedScope[variable.id] = mathjs.unit(val, currentUnit).toNumber(baseUnit);
                            normalizedScope[lowerId] = normalizedScope[variable.id];
                        } catch (e) {
                            console.warn(`Conversion error for ${actualId}:`, e.message);
                        }
                    } else if (baseUnit === '%') {
                        normalizedScope[variable.id] = val / 100;
                        normalizedScope[lowerId] = val / 100;
                    }
                }
            });
        }

        console.log('Scope:', JSON.stringify(normalizedScope, null, 2));
        let result = mathjs.evaluate(cleanFormula, normalizedScope);
        return result;
    } catch (error: any) {
        return `Error: ${error.message}`;
    }
};

// Test Case 1: Comment eating the formula
const f1 = "(LARGURA * ALTURA) # Area * PRECO_M2";
const s1 = { LARGURA: 10, ALTURA: 10, PRECO_M2: 85 };
const v1 = [
    { id: 'LARGURA', type: 'INPUT', baseUnit: 'm' },
    { id: 'ALTURA', type: 'INPUT', baseUnit: 'm' },
    { id: 'PRECO_M2', type: 'INPUT', baseUnit: 'un' }
];
console.log('Result 1:', evaluateFormula(f1, s1, v1));

// Test Case 2: Unit case sensitivity
const f2 = "largura * altura * preco";
const s2 = { largura: 10, altura: 10, preco: 85, largura_unit: 'M', altura_unit: 'M' };
const v2 = [
    { id: 'largura', type: 'INPUT', baseUnit: 'm' },
    { id: 'altura', type: 'INPUT', baseUnit: 'm' },
    { id: 'preco', type: 'INPUT', baseUnit: 'un' }
];
console.log('Result 2:', evaluateFormula(f2, s2, v2));

// Test Case 3: ID with spaces or special chars
const f3 = "Preço por m² * qde";
const s3 = { "Preço por m²": 85, "qde": 10 };
console.log('Result 3:', evaluateFormula(f3, s3));
