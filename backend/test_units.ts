import * as mathjs from 'mathjs';

const evaluateFormula = (formulaStr: string, scope: Record<string, number>, ruleVariables?: any[]): any => {
    try {
        const cleanFormula = formulaStr.replace(/#.*?(?=\+|$)/g, '');
        const normalizedScope: Record<string, any> = {};
        Object.keys(scope).forEach(key => {
            normalizedScope[key] = scope[key];
            normalizedScope[key.toLowerCase()] = scope[key];
        });

        if (ruleVariables) {
            ruleVariables.forEach(variable => {
                const lowerId = variable.id.toLowerCase();
                const actualId = normalizedScope.hasOwnProperty(variable.id) ? variable.id : (normalizedScope.hasOwnProperty(lowerId) ? lowerId : null);
                if (actualId) {
                    let val = normalizedScope[actualId];
                    const baseUnit = variable.baseUnit || null;
                    const currentUnit = (scope as any)[`${actualId}_unit`] || baseUnit;
                    const nonPhysicalUnits = ['X', 'moeda', '%', 'un', 'unidade', 'und', 'pç', 'pcas', 'folhas'];
                    const isPhysical = (u: string) => u && !nonPhysicalUnits.includes(u.toLowerCase());

                    if (baseUnit && currentUnit && isPhysical(baseUnit) && isPhysical(currentUnit) && baseUnit !== currentUnit) {
                        try {
                            normalizedScope[variable.id] = mathjs.unit(val, currentUnit).toNumber(baseUnit);
                            normalizedScope[lowerId] = normalizedScope[variable.id];
                        } catch (e) {
                            console.log(`Conversion error for ${actualId} (${val} ${currentUnit} -> ${baseUnit}):`, e.message);
                        }
                    }
                }
            });
        }
        console.log('Final Scope:', JSON.stringify(normalizedScope, null, 2));
        return mathjs.evaluate(cleanFormula, normalizedScope);
    } catch (e) { return e.message; }
};

console.log('--- TEST 2 (M vs m) ---');
const s2 = { largura: 10, altura: 10, largura_unit: 'M', altura_unit: 'M' };
const v2 = [{ id: 'largura', baseUnit: 'm' }, { id: 'altura', baseUnit: 'm' }];
evaluateFormula("largura * altura", s2, v2);

console.log('--- TEST 3 (Case Sensitivity) ---');
console.log('Result:', evaluateFormula("LARGURA * 2", { largura: 50 }, [{id: 'largura'}]));
