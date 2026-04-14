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
  // 1. Prioridade: Preço Fixo ou Por Unidade Simples (se não for cálculo dinâmico)
  if (produto.pricingMode !== 'DYNAMIC_ENGINEER') {
    let basePrice = Number(produto.salePrice || 0);
    let isStarting = false;

    // Se existirem configurações/variações, encontraremos o menor preço global
    if (produto.configurations && Array.isArray(produto.configurations) && produto.configurations.length > 0) {
      let lowestOverride: number | null = null;
      let hasAnyOverride = false;

      produto.configurations.forEach((group: any) => {
        if (group.options && Array.isArray(group.options)) {
          const overrides = group.options
            .filter((o: any) => o.priceOverride != null && Number(o.priceOverride) > 0)
            .map((o: any) => Number(o.priceOverride));

          if (overrides.length > 0) {
            hasAnyOverride = true;
            const minInGroup = Math.min(...overrides);
            if (lowestOverride === null || minInGroup < lowestOverride) {
              lowestOverride = minInGroup;
            }
          }
        }
      });

      if (hasAnyOverride && lowestOverride !== null) {
        basePrice = lowestOverride;
        isStarting = true; // Mostra "A partir de"
      }
    }

    if (basePrice > 0 || !produto.pricingRule) {
      return {
        price: formatCurrency(basePrice),
        cost: produto.costPrice > 0 ? formatCurrency(produto.costPrice) : null,
        isStarting: isStarting,
        note: null
      };
    }
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

      // 2. Mesclar com overrides do produto e variáveis fixas da regra
      const activeValues: Record<string, any> = { QTDE: 1, QUANTIDADE: 1, ...referenceValues };
      
      variables.forEach((v: any) => {
        if (v.fixedValue !== undefined && v.fixedValue !== null && v.fixedValue !== 0) {
          activeValues[v.id] = Number(v.fixedValue);
          activeValues[v.id.toUpperCase()] = Number(v.fixedValue);
        }
      });

      let hasProductOverride = false;
      if (produto.formulaData) {
        const formulaData = typeof produto.formulaData === 'string' ? JSON.parse(produto.formulaData) : produto.formulaData;
        Object.keys(formulaData).forEach(k => {
          const val = formulaData[k];
          if (val !== '' && val !== null && val !== undefined) {
            activeValues[k.toUpperCase()] = val;
            activeValues[k] = val;
            hasProductOverride = true;
          }
        });
      }

      // Calcula Preço de Venda
      let res = calculatePricingResult(formulaString, variables, activeValues);
      let usedFallback = false;
 
      // 🛡️ Inteligência de Vitrine
      if (res.value < 0.01) {
        const priceKeywords = ['VALOR', 'PRECO', 'BASE', 'M2', 'UNIT'];
        Object.keys(activeValues).forEach(key => {
          const rawVal = activeValues[key];
          const val = typeof rawVal === 'object' && rawVal !== null && 'value' in rawVal ? Number(rawVal.value) : Number(rawVal || 0);
          
          if (val > 0 && !usedFallback) {
            const upperKey = key.toUpperCase();
            if (priceKeywords.some(k => upperKey.includes(k))) {
              res.value = val;
              usedFallback = true;
            }
          }
        });
 
        if (!usedFallback) {
          const dimensionKeywords = ['L', 'A', 'W', 'H', 'LARG', 'ALT', 'DIM'];
          const fallbackValues = { ...activeValues };
          let hasFixedZeros = false;
 
          variables.forEach((v: any) => {
            const vid = v.id.toUpperCase();
            const isDim = dimensionKeywords.some(k => vid === k || vid.startsWith(k));
            if (isDim && (Number(fallbackValues[v.id]) === 0)) {
              fallbackValues[v.id] = 1000;
              fallbackValues[`${v.id}_unit`] = 'mm';
              hasFixedZeros = true;
            }
          });
 
          if (hasFixedZeros) {
            const fallbackRes = calculatePricingResult(formulaString, variables, fallbackValues);
            if (fallbackRes.value > 0) {
              res = fallbackRes;
              usedFallback = true;
            }
          }
        }
      }
 
      // Calcula Preço de Custo (se houver costFormulaString)
      let calculatedCost: string | null = null;
      if (formula.costFormulaString) {
        const costRes = calculatePricingResult(formula.costFormulaString, variables, activeValues);
        if (costRes.value > 0) {
          calculatedCost = formatCurrency(costRes.value);
        }
      }
 
      // Prepara a nota informativa
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
        isStarting: false,
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
