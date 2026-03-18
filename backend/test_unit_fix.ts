import * as mathjs from 'mathjs';

const evaluateFormula = (formulaStr: string, scope: Record<string, any>, ruleVariables?: any[]): any => {
    try {
        const cleanFormula = formulaStr.replace(/#.*?(?=\+|$)/g, ' ');
        const normalizedScope: Record<string, any> = {};
        Object.keys(scope).forEach(key => {
            const val = scope[key];
            normalizedScope[key] = val;
            normalizedScope[key.toLowerCase()] = val;
            normalizedScope[key.toUpperCase()] = val;
        });

        if (ruleVariables) {
            ruleVariables.forEach(variable => {
                const lowerId = variable.id.toLowerCase();
                const upperId = variable.id.toUpperCase();
                const actualId = normalizedScope.hasOwnProperty(variable.id) ? variable.id : (normalizedScope.hasOwnProperty(lowerId) ? lowerId : (normalizedScope.hasOwnProperty(upperId) ? upperId : null));

                if (actualId) {
                    let val = normalizedScope[actualId];
                    const baseUnit = variable.baseUnit || variable.unit || null;
                    
                    // NEW LOGIC
                    const unitKey = `${actualId}_unit`;
                    const lowerUnitKey = `${variable.id.toLowerCase()}_unit`;
                    const upperUnitKey = `${variable.id.toUpperCase()}_unit`;
                    
                    let currentUnit = (scope as any)[unitKey] 
                        || (scope as any)[lowerUnitKey] 
                        || (scope as any)[upperUnitKey] 
                        || variable.unit 
                        || baseUnit;

                    const unitMapping: Record<string, string> = { 'M': 'm', 'M2': 'm2', 'M²': 'm2', 'CM': 'cm' };
                    const normalizeUnit = (u: any) => {
                        if (!u) return u;
                        return unitMapping[String(u).toUpperCase()] || u;
                    };

                    const normalizedBase = normalizeUnit(baseUnit);
                    const normalizedCurrent = normalizeUnit(currentUnit);

                    if (normalizedBase && normalizedCurrent && normalizedBase !== normalizedCurrent) {
                        try {
                            const converted = mathjs.unit(val, normalizedCurrent).toNumber(normalizedBase);
                            normalizedScope[variable.id] = converted;
                            normalizedScope[lowerId] = converted;
                            normalizedScope[upperId] = converted;
                        } catch (e: any) { }
                    }
                }
            });
        }
        return mathjs.evaluate(cleanFormula, normalizedScope);
    } catch (e: any) { return e.message; }
};

console.log('--- TEST: Case mismatch in unit key ---');
const scope = { largura: 10, largura_unit: 'M' };
const vars = [{ id: 'largura', baseUnit: 'm', unit: 'cm' }]; // Fallback unit is cm
// Formula uses uppercase LARGURA
console.log('Result (expected 10):', evaluateFormula("LARGURA", scope, vars));

// Simulation of the bug state:
const buggyScope = { largura: 10, largura_unit: 'M' };
const buggyVars = [{ id: 'largura', baseUnit: 'm', unit: 'cm' }];
// If we DID NOT have the exhaustive search, it would look for LARGURA_unit, fail, use 'cm'.
// 10 cm -> 0.1 m.
// ((0.1 * 0.1) * 80) = 0.80.
console.log('Result for area (expected 100):', evaluateFormula("LARGURA * ALTURA", { largura: 10, largura_unit: 'M', altura: 10, altura_unit: 'M' }, [{id: 'largura', baseUnit: 'm', unit: 'cm'}, {id: 'altura', baseUnit: 'm', unit: 'cm'}]));
