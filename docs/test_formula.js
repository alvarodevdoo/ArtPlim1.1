import { evaluateFormula } from './frontend/src/lib/pricing/formulaUtils';

const scope1 = {
   'M': 100, 'M_unit': 'G',
   'Pm': 180, 'Pm_unit': 'R$/KG',
   'D': 3,
};
console.log('Test 100g:', evaluateFormula('M * Pm + D', scope1, [
    { id: 'M', role: 'WEIGHT' },
    { id: 'Pm', role: 'COST_RATE' }
]));

const scope2 = {
   'M': 100, 'M_unit': 'KG',
   'Pm': 180, 'Pm_unit': 'R$/KG',
   'D': 3,
};
console.log('Test 100kg:', evaluateFormula('M * Pm + D', scope2, [
    { id: 'M', role: 'WEIGHT' },
    { id: 'Pm', role: 'COST_RATE' }
]));
