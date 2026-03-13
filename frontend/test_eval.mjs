const mathjs = require('mathjs');

const evalFormula = (formulaStr, scope, ruleVariables) => {
    try {
        if (!formulaStr || formulaStr.trim() === '') return 0;

        const normalizedScope = { ...scope };

        if (ruleVariables && Array.isArray(ruleVariables)) {
            ruleVariables.forEach(variable => {
                if (variable.unit && normalizedScope.hasOwnProperty(variable.id)) {
                    let val = normalizedScope[variable.id];
                    switch (variable.unit) {
                        case 'mm':
                            val = val / 1000;
                            break;
                        case 'cm':
                            val = val / 100;
                            break;
                        case 'mm2':
                            val = val / 1000000;
                            break;
                        case 'cm2':
                            val = val / 10000;
                            break;
                        case 'g':
                            val = val / 1000;
                            break;
                    }
                    normalizedScope[variable.id] = val;
                }
            });
        }

        const result = mathjs.evaluate(formulaStr, normalizedScope);

        console.log("RESULT", result, typeof result, isNaN(result));

        if (typeof result === 'number' && !isNaN(result)) {
            return Math.round(result * 100) / 100;
        }

        return "Erro matemático (Divisão por zero, etc)";
    } catch (error) {
        return error.message || 'Dados insuficientes';
    }
}

const f = "((g / 1000) * precoKg + (potenciaw / 1000) * horas * valorKwh + desgaste + (horas * maoHora)) * (1 + margem)";
const vars = [
    { id: 'g', unit: 'g' },
    { id: 'precoKg', unit: 'moeda' },
    { id: 'potenciaw', unit: 'X' },
    { id: 'horas', unit: 'hora' },
    { id: 'valorKwh', unit: 'moeda' },
    { id: 'desgaste', unit: 'moeda' },
    { id: 'maoHora', unit: 'moeda' },
    { id: 'margem', unit: '%' }
];

const scope1 = { g: 5, precoKg: 180, potenciaw: 10, horas: 2, valorKwh: 2, desgaste: 3, maoHora: 1, margem: 0.6 };

console.log(evalFormula(f, scope1, vars));

