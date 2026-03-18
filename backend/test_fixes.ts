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
            ruleVariables.forEach(v => {
                if (v.type === 'FIXED' && v.fixedValue !== undefined) {
                    const val = v.fixedValue;
                    normalizedScope[v.id] = val;
                    normalizedScope[v.id.toLowerCase()] = val;
                    normalizedScope[v.id.toUpperCase()] = val;
                }
            });

            ruleVariables.forEach(variable => {
                const lowerId = variable.id.toLowerCase();
                const upperId = variable.id.toUpperCase();
                const actualId = normalizedScope.hasOwnProperty(variable.id) ? variable.id : (normalizedScope.hasOwnProperty(lowerId) ? lowerId : (normalizedScope.hasOwnProperty(upperId) ? upperId : null));

                if (actualId) {
                    let val = normalizedScope[actualId];
                    const baseUnit = variable.baseUnit || null;
                    const currentUnit = (scope as any)[`${actualId}_unit`] || baseUnit;

                    const unitMapping: Record<string, string> = { 'M': 'm', 'M2': 'm2', 'M²': 'm2', 'CM': 'cm', 'MM': 'mm' };
                    const normalizeUnit = (u: any) => unitMapping[String(u).toUpperCase()] || u;

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

console.log('--- TEST 1 (Comments) ---');
console.log('Result:', evaluateFormula("(10 * 10) # Area * 85", {}));

console.log('--- TEST 2 (Case Insensitivity) ---');
console.log('Result:', evaluateFormula("LARGURA * 2", { largura: 50 }, [{id: 'largura'}]));

console.log('--- TEST 3 (Units M -> m) ---');
const s3 = { largura: 10, largura_unit: 'M' };
const v3 = [{ id: 'largura', baseUnit: 'mm' }];
console.log('Result (10 M -> mm):', evaluateFormula("largura", s3, v3));
