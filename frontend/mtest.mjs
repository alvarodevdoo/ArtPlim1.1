import * as mathjs from 'mathjs';

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
                        case 'm':
                            break;
                        case 'g':
                            val = val / 1000;
                            break;
                        case 'kg':
                            break;
                    }
                    normalizedScope[variable.id] = val;
                }
            });
        }

        console.log("Scope given to mathjs:", normalizedScope);

        const result = mathjs.evaluate(formulaStr, normalizedScope);
        console.log("raw result is", result);

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
