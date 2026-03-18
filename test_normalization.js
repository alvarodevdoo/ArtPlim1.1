
const mathjs = require('mathjs');

const evaluateFormulaTest = (formulaStr, scope, ruleVariables) => {
    try {
        if (!formulaStr || formulaStr.trim() === '') return 0;
        const cleanFormula = formulaStr.replace(/×/g, '*').replace(/÷/g, '/');
        const normalizedScope = {};
        Object.keys(scope).forEach(key => { normalizedScope[key] = scope[key]; });

        if (ruleVariables && Array.isArray(ruleVariables)) {
            ruleVariables.forEach(variable => {
                const actualId = variable.id;
                let val = normalizedScope[actualId];
                
                const roleMappings = {
                    'LENGTH': 'mm', 'AREA': 'mm2', 'VOLUME': 'ml',
                    'TIME': 's', 'WEIGHT': 'g', 'ENERGY': 'Wh',
                    'POWER': 'W', 'PERCENT': '%'
                };

                const baseUnitFromRole = variable.role ? roleMappings[variable.role] : null;
                const baseUnit = variable.baseUnit || baseUnitFromRole || variable.unit || null;

                const unitKey = `${actualId}_unit`;
                let currentUnit = (scope)[unitKey] || variable.unit || baseUnit;

                const unitMapping = {
                    'KM': 'km', 'M': 'm', 'CM': 'cm', 'MM': 'mm',
                    'M2': 'm2', 'M²': 'm2', 'CM2': 'cm2', 'CM²': 'cm2', 'MM2': 'mm2', 'MM²': 'mm2',
                    'L': 'l', 'ML': 'ml',
                    'H': 'h', 'MIN': 'min', 'S': 's',
                    'KG': 'kg', 'G': 'g', 'MG': 'mg',
                    'KWH': 'kWh', 'WH': 'Wh', 'MWH': 'mWh',
                    'KW': 'kW', 'W': 'W', 'MW': 'mW'
                };

                const normalizeUnit = (u) => {
                    if (!u) return u;
                    const cleanU = u.toUpperCase().replace('^', '');
                    return unitMapping[cleanU] || u.toLowerCase();
                };

                const normalizedBase = normalizeUnit(baseUnit);
                const normalizedCurrent = normalizeUnit(currentUnit);

                if (normalizedBase && normalizedCurrent && normalizedBase !== normalizedCurrent) {
                    try {
                        const converted = mathjs.unit(val, normalizedCurrent).toNumber(normalizedBase);
                        normalizedScope[variable.id] = converted;
                        normalizedScope[variable.id.toLowerCase()] = converted;
                    } catch (e) {
                         console.log("Error converting", actualId, e.message);
                    }
                } else if (variable.role === 'PERCENT') {
                    normalizedScope[variable.id] = val / 100;
                    normalizedScope[variable.id.toLowerCase()] = val / 100;
                }
            });
        }
        return mathjs.evaluate(cleanFormula, normalizedScope);
    } catch (error) { return error.message; }
};

const tests = [
    {
        name: "Comprimento: 1m -> 1000mm",
        formula: "L",
        scope: { L: 1, L_unit: 'M' },
        vars: [{ id: 'L', role: 'LENGTH' }],
        expected: 1000
    },
    {
        name: "Peso: 1kg -> 1000g",
        formula: "P",
        scope: { P: 1, P_unit: 'kg' },
        vars: [{ id: 'P', role: 'WEIGHT' }],
        expected: 1000
    },
    {
        name: "Tempo: 1h -> 3600s",
        formula: "T",
        scope: { T: 1, T_unit: 'H' },
        vars: [{ id: 'T', role: 'TIME' }],
        expected: 3600
    },
    {
        name: "Volume: 1L -> 1000ml",
        formula: "V",
        scope: { V: 1, V_unit: 'L' },
        vars: [{ id: 'V', role: 'VOLUME' }],
        expected: 1000
    },
    {
        name: "Energia: 1kWh -> 1000Wh",
        formula: "E",
        scope: { E: 1, E_unit: 'kWh' },
        vars: [{ id: 'E', role: 'ENERGY' }],
        expected: 1000
    },
    {
        name: "Energia: 100mWh -> 0.1Wh",
        formula: "E",
        scope: { E: 100, E_unit: 'mWh' },
        vars: [{ id: 'E', role: 'ENERGY' }],
        expected: 0.1
    },
    {
        name: "Potência: 1kW -> 1000W",
        formula: "P",
        scope: { P: 1, P_unit: 'kW' },
        vars: [{ id: 'P', role: 'POWER' }],
        expected: 1000
    },
    {
        name: "Área: 1m² -> 1,000,000mm²",
        formula: "A",
        scope: { A: 1, A_unit: 'm²' },
        vars: [{ id: 'A', role: 'AREA' }],
        expected: 1000000
    },
    {
        name: "Percentual: 5% -> 0.05",
        formula: "Pct",
        scope: { Pct: 5 },
        vars: [{ id: 'Pct', role: 'PERCENT' }],
        expected: 0.05
    }
];

console.log("--- TESTE DE NORMALIZAÇÃO DINÂMICA (MENOR UNIDADE) ---");
tests.forEach(t => {
    const result = evaluateFormulaTest(t.formula, t.scope, t.vars);
    const pass = Math.abs(result - t.expected) < 0.0001;
    console.log(`${pass ? '✅' : '❌'} ${t.name}: ${result} (Esp: ${t.expected})`);
});
