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
  // 1. Prioridade: Preço Fixo (se definido, maior que zero e não for cálculo dinâmico)
  if (produto.salePrice > 0 && produto.pricingMode !== 'DYNAMIC_ENGINEER') {
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
      let formula = (pricingRule.formula || {});
      if (typeof pricingRule.formula === 'string') {
        try {
          if (pricingRule.formula.startsWith('{')) {
            formula = JSON.parse(pricingRule.formula);
          } else {
            formula = { formulaString: pricingRule.formula };
          }
        } catch (e) {
          formula = { formulaString: pricingRule.formula };
        }
      }

      // Se a regra estiver configurada para ocultar o preço de referência
      if (formula?.hideReferencePrice) {
        return { price: 'Sob Consulta', cost: null, isStarting: false, note: null };
      }

      const formulaString = formula.formulaString || formula.current || pricingRule.formula || '';
      const variables = formula.variables || [];
      const referenceValues = formula.referenceValues || {};

      // 2. Mesclar com overrides do produto e garantir quantidade padrão 1
      const activeValues: Record<string, any> = { QTDE: 1, QUANTIDADE: 1, ...referenceValues };
      let hasProductOverride = false;
      if (produto.formulaData) {
        const formulaData = typeof produto.formulaData === 'string' ? JSON.parse(produto.formulaData) : produto.formulaData;
        Object.keys(formulaData).forEach(k => {
          const val = formulaData[k];
          if (val !== '' && val !== null && val !== undefined) {
            activeValues[k.toUpperCase()] = val;
            activeValues[k] = val;  // Mapeia tanto normal quanto uppercase
          }
        });
        hasProductOverride = true;
      }

      // 🔑 INJEÇÃO DO SALE PRICE via role (agnóstico ao nome da variável)
      // Para produtos com salePrice > 0, injeta no slot da variável marcada com role='SALE_PRICE'
      if (produto.salePrice && Number(produto.salePrice) > 0) {
        variables.forEach((v: any) => {
          if (v.role === 'SALE_PRICE') {
            const currentVal = activeValues[v.id];
            if (currentVal === undefined || currentVal === null || currentVal === '' || currentVal === 0) {
              activeValues[v.id] = Number(produto.salePrice);
              hasProductOverride = true;
            }
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
