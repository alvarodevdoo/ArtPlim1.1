import { evaluateFormula } from './frontend/src/lib/pricing/formulaUtils';

const scope = {
   'M': 100,
   'M_unit': 'G', // The user selected 'G'
   'Pm': 180,
   // 'Pm_unit' IS UNDEFINED! (Because user just loaded it or UI didn't update it in simulationValues)
   'Ce': 0, 'Ce_unit': 'R$/KWH',
   'Mo': 0, 'Mo_unit': 'MM',
   'T': 0, 'T_unit': 'S',
   'P': 700,
   'D': 3
};

const formData = {
   formulaString: '(M * Pm) + (T * Ce) + D',
   variables: [
       { id: 'M', role: 'WEIGHT', baseUnit: 'g', defaultUnit: '' },
       // Note: defaultUnit might be 'R$/kg'
       { id: 'Pm', role: 'COST_RATE', baseUnit: 'R$/g', defaultUnit: 'R$/kg' },
       { id: 'D', role: 'NONE', type: 'FIXED', fixedValue: 3 }
   ]
};

// Now simulate exactly what the UI does:
// "Injetar unidade padrão se não houver escolha manual no simulador"
const scopeMod = { ...scope };
formData.variables.forEach(v => {
    const unitKey = `${v.id}_unit`;
    if (v.defaultUnit && !scopeMod[unitKey]) {
        scopeMod[unitKey] = v.defaultUnit;
    }
});
console.log('Modified Scope from UI:', scopeMod);
const res = evaluateFormula(formData.formulaString, scopeMod, formData.variables);
console.log('Result evaluated:', res);
