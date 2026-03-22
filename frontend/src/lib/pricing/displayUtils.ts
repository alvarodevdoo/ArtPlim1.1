import { formatCurrency } from '@/lib/utils';
import { calculatePricingResult } from '@/lib/pricing/formulaUtils';

export interface DisplayInfo {
  price: string;
  cost: string | null;
  isStarting: boolean;
  note: string | null;
}

/**
 * Calcula as informações de exibição de preço e custo para um produto,
 * considerando regras de precificação dinâmica ou preços fixos.
 */
export const getProductDisplayInfo = (produto: any): DisplayInfo => {
  // 1. Prioridade: Preço Fixo (se definido e maior que zero)
  if (produto.salePrice > 0) {
    return {
      price: formatCurrency(produto.salePrice),
      cost: produto.costPrice > 0 ? formatCurrency(produto.costPrice) : null,
      isStarting: false,
      note: null
    };
  }

  // 2. Prioridade: Regra de Precificação Dinâmica
  const pricingRule = produto.pricingRule;
  if (pricingRule) {
    try {
      const formula = typeof pricingRule.formula === 'string' 
        ? JSON.parse(pricingRule.formula) 
        : (pricingRule.formula || {});

      // Se a regra estiver configurada para ocultar o preço de referência
      if (formula?.hideReferencePrice) {
        return { price: 'Sob Consulta', cost: null, isStarting: false, note: null };
      }

      const formulaString = formula.formulaString || formula.current || pricingRule.formula || '';
      const variables = formula.variables || [];
      const referenceValues = formula.referenceValues || {};

      // Mesclar com overrides do produto
      const activeValues = { ...referenceValues };
      let hasProductOverride = false;
      if (produto.formulaData) {
        Object.keys(produto.formulaData).forEach(k => {
          const val = produto.formulaData[k];
          const isEmpty = val === '' || val === 0 || val === '0' || val === null || val === undefined;
          if (!isEmpty && !k.endsWith('_unit') && !k.endsWith('_locked')) {
            activeValues[k] = val;
            hasProductOverride = true;
            if (produto.formulaData[`${k}_unit`]) activeValues[`${k}_unit`] = produto.formulaData[`${k}_unit`];
          }
        });
      }

      // Calcula Preço de Venda
      const res = calculatePricingResult(formulaString, variables, activeValues);
      
      // Calcula Preço de Custo (se houver costFormulaString)
      let calculatedCost: string | null = null;
      if (formula.costFormulaString) {
        const costRes = calculatePricingResult(formula.costFormulaString, formula.variables, activeValues);
        if (costRes.value > 0) {
          calculatedCost = formatCurrency(costRes.value);
        }
      }

      // Prepara a nota informativa (ex: "Base 100x100cm")
      const inputVars = variables.filter((v: any) => v.type === 'INPUT');
      const noteParts = inputVars
        .map((v: any) => {
          const val = activeValues[v.id];
          const unit = activeValues[`${v.id}_unit`] || v.defaultUnit || '';
          return val ? `${val}${unit}` : null;
        })
        .filter(Boolean);

      return {
        price: formatCurrency(res.value),
        cost: calculatedCost,
        isStarting: !hasProductOverride,
        note: noteParts.length > 0 ? noteParts.join(' x ') : null
      };
    } catch (error) {
      console.error('Erro ao calcular preço de vitrine:', error);
    }
  }

  // 3. Fallback: Preço sob consulta
  return {
    price: 'Sob Consulta',
    cost: null,
    isStarting: false,
    note: null
  };
};
