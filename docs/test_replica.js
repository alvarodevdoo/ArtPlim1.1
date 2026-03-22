import { validateFormulaSyntax, extractVariables, renameVariableInFormula, removeVariableFromFormula, evaluateFormula } from './frontend/src/lib/pricing/formulaUtils';

const scope = {
   'M': 100,
   'M_unit': 'G',
   'Pm': 180,
   'Pm_unit': 'R$/KG',
   'Ce': 0,
   'Ce_unit': 'R$/KWH',
   'Mo': 0,
   'Mo_unit': 'MM',
   'T': 0,
   'T_unit': 'S',
   'P': 700,
   'D': 3
};

const formData = {
   formulaString: '(M * Pm) + (T * Ce) + D',
   costFormulaString: '(M * Pm)#Filamento + (T * Ce)#Energia',
   variables: [
       { id: 'M', role: 'WEIGHT', baseUnit: 'g' },
       { id: 'Pm', role: 'COST_RATE', baseUnit: 'R$/g', defaultUnit: 'R$/kg' },
       { id: 'T', role: 'TIME', baseUnit: 's' },
       { id: 'Ce', role: 'COST_RATE', baseUnit: 'R$/Wh', defaultUnit: 'R$/kWh' },
       { id: 'Mo', role: 'LENGTH', baseUnit: 'mm' },
       { id: 'P', role: 'NONE', type: 'FIXED', fixedValue: 700 },
       { id: 'D', role: 'NONE', type: 'FIXED', fixedValue: 3 }
   ]
};

const res = { venda: 0, custo: 0, breakdown: [] };

const saleRes = evaluateFormula(formData.formulaString, scope, formData.variables);
res.venda = typeof saleRes === 'number' ? saleRes : 0;

if (formData.costFormulaString) {
    const costRes = evaluateFormula(formData.costFormulaString, scope, formData.variables);
    res.custo = typeof costRes === 'number' ? costRes : 0;
    
    // Lógica de extração de breakdown manual para a UI
    const breakdown = [];
    const breakdownRegex = /\(([^)]+)\)#([a-zA-ZáàâãééêíïóôõõúüçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ_0-9]+)/g;
    let match;
    while ((match = breakdownRegex.exec(formData.costFormulaString)) !== null) {
        try {
            const subRes = evaluateFormula(match[1], scope, formData.variables);
            breakdown.push({ label: match[2], value: subRes });
        } catch(e){}
    }
    res.breakdown = breakdown;
}

console.log(res);
