import { parse } from 'mathjs';

const compileCache = new Map<string, any>();

/**
 * Normaliza unidades de medida
 */
export const getConversionFactor = (from: string, to: string): number => {
  const units: Record<string, number> = {
    'mm': 1, 'cm': 10, 'm': 1000, 'ml': 1000, 
    'un': 1, 'ct': 1, 'par': 1,
    'm2': 1000000, 'm^2': 1000000, 'cm2': 100, 'mm2': 1,
    'km': 1000000, 'g': 1, 'kg': 1000, 't': 1000000,
  };

  const f = from.toLowerCase().replace('²', '2');
  const t = to.toLowerCase().replace('²', '2');

  const fromVal = units[f] || 1;
  const toVal = units[t] || 1;

  return fromVal / toVal;
};

/**
 * Avalia uma fórmula matemática com suporte a variáveis e unidades
 */
export const evaluateFormula = (
  formulaStr: string,
  scope: Record<string, any> = {},
  ruleVariables: any[] = [],
  logs?: string[]
): number | string => {
  if (!formulaStr || !formulaStr.trim()) return 0;

  try {
    const cleanFormula = formulaStr.trim();
    let compiled = compileCache.get(cleanFormula);
    if (!compiled) {
      compiled = parse(cleanFormula).compile();
      compileCache.set(cleanFormula, compiled);
    }

    const normalizedScope: Record<string, any> = { ...scope };
    
    // Normalização agressiva do escopo (Uppercase e Lowercase)
    Object.entries(scope).forEach(([k, v]) => {
        normalizedScope[k.toLowerCase()] = v;
        normalizedScope[k.toUpperCase()] = v;
    });

    // Mapeia variáveis da regra para o escopo do MathJS
    for (const v of ruleVariables) {
      const vid = v.id.toUpperCase();
      const rawValue = normalizedScope[vid] ?? normalizedScope[v.id.toLowerCase()] ?? v.fixedValue ?? 0;
      const numVal = typeof rawValue === 'string' ? parseFloat(rawValue.replace(',', '.')) : Number(rawValue || 0);
      
      normalizedScope[v.id] = isNaN(numVal) ? 0 : numVal;
      normalizedScope[v.id.toLowerCase()] = isNaN(numVal) ? 0 : numVal;
      normalizedScope[vid] = isNaN(numVal) ? 0 : numVal;
    }

    const result = compiled.evaluate(normalizedScope);
    
    let finalNum = 0;
    if (typeof result === 'number') {
      finalNum = result;
    } else if (result && typeof result.toNumber === 'function') {
      finalNum = result.toNumber();
    } else if (result && typeof result.value === 'number') {
      finalNum = result.value;
    } else {
      finalNum = Number(result);
    }

    if (logs) logs.push(`Eval: ${cleanFormula} = ${finalNum}`);
    return isNaN(finalNum) ? 0 : Math.round(finalNum * 100) / 100;

  } catch (error: any) {
    if (logs) logs.push(`Erro formula: ${error.message}`);
    return 0;
  }
};

/**
 * Aplica normalização de unidades ao escopo de cálculo.
 * Converte cm para mm, m para mm, m2 para mm2, e ajusta preços inversamente.
 */
export const applyNormalization = (
  variables: any[],
  inputValues: Record<string, any>,
  logs?: string[]
): Record<string, any> => {
  const scope: Record<string, any> = { ...inputValues };
  const normalizedInputs: Record<string, any> = {};
  
  // Normaliza entradas para Uppercase para facilitar busca
  Object.keys(inputValues).forEach(k => {
    normalizedInputs[k.toUpperCase()] = inputValues[k];
  });
  
  variables.forEach((v: any) => {
    if (v.type === 'INPUT') {
      const vid = v.id.toUpperCase();
      // Busca a unidade (ex: LARGURA_unit ou LARGURA_UNIT)
      const unitVal = normalizedInputs[`${vid}_UNIT`] || v.defaultUnit || v.unit || 'mm';
      // Normaliza strings de unidade (ex: m² para m2)
      const unit = String(unitVal).toLowerCase().trim().replace('²', '2');
      
      // Busca o valor bruto
      const rawVal = normalizedInputs[vid] ?? 0;
      const numVal = typeof rawVal === 'string' ? parseFloat(String(rawVal).replace(',', '.')) : Number(rawVal || 0);

      if (isNaN(numVal)) return;

      let factor = 1;
      let isArea = unit.includes('2');

      if (unit.includes('mm2')) factor = 1;
      else if (unit.includes('cm2')) factor = 100;
      else if (unit.includes('m2')) factor = 1000000;
      else if (unit === 'cm' || unit.includes('/cm')) factor = 10;
      else if (unit === 'm' || unit === 'ml' || unit.includes('/m') || unit.includes('linear')) factor = 1000;
      else if (unit === 'in' || unit.includes('pol')) factor = 25.4;

      let normalizedVal = numVal * factor;
      
      if (vid.includes('PRECO') || vid.includes('VALOR')) {
        normalizedVal = numVal / factor;
      }

      scope[v.id] = normalizedVal;
      scope[vid] = normalizedVal;

      // Altera a unidade no escopo de retorno para evitar dupla normalização 
      const normalizedUnit = isArea ? 'mm2' : 'mm';
      scope[`${v.id}_unit`] = normalizedUnit;
      scope[`${v.id}_UNIT`] = normalizedUnit;
      scope[`${vid}_unit`] = normalizedUnit;
      scope[`${vid}_UNIT`] = normalizedUnit;
      
      if (factor !== 1 && logs && logs.length < 50) {
        logs.push(`Norm: ${v.id} (${numVal}${unit}) -> ${normalizedVal.toFixed(4)} ${isArea ? 'mm²' : 'mm'}`);
      }
    }
  });

  return scope;
};

/**
 * Principal ponto de entrada para o cálculo de precificação
 */
export const calculatePricingResult = (
  formulaStr: string | null | undefined,
  variables: any[] = [],
  inputValues: Record<string, any> = {},
  logs?: string[]
): { value: number; scope: any; breakdown: any[] } => {
  if (!formulaStr || formulaStr === '0') return { value: 0, scope: inputValues, breakdown: [] };

  if (logs) logs.push("=== Início do Cálculo ===");

  // 1. Aplica normalização de unidades (cm -> mm, m2 -> mm2, etc)
  const normalizedScope = applyNormalization(variables, inputValues, logs);

  // 2. Prepara escopo final para o avaliador
  const evaluationScope: Record<string, any> = {};
  for (const v of variables) {
    const vid = v.id.toUpperCase();
    const isFixed = v.type === 'FIXED';
    
    // O valor normalizado já está no normalizedScope (ou o valor fixo se não houver entrada)
    const val = normalizedScope[vid] !== undefined ? normalizedScope[vid] : (isFixed ? (v.fixedValue ?? 0) : 0);
    evaluationScope[v.id] = val;
    evaluationScope[vid] = val;
    
    if (logs) logs.push(`${v.name} (${v.id}): ${val}`);
  }

  // 3. Executa a fórmula
  const valueResult = evaluateFormula(formulaStr, evaluationScope, variables, logs);
  const numericVal = typeof valueResult === 'number' ? valueResult : 0;

  if (logs) logs.push(`Total: R$ ${numericVal}`);
  
  return { value: numericVal, scope: normalizedScope, breakdown: [] };
};

/**
 * Valida a sintaxe de uma fórmula
 */
export const validateFormulaSyntax = (formula: string): boolean | string => {
    if (!formula || !formula.trim()) return true;
    try {
        parse(formula);
        return true;
    } catch (e: any) {
        return e.message;
    }
};

/**
 * Extrai todas as variáveis (símbolos) de uma fórmula
 */
export const extractVariables = (formula: string): string[] => {
    if (!formula) return [];
    try {
        const node = parse(formula);
        const symbols: string[] = [];
        
        node.traverse((n: any) => {
            if (n.isSymbolNode && !n.isFunctionNode) {
                // Filtra constantes conhecidas do mathjs se necessário, 
                // mas para nossa lógica, qualquer símbolo não-função é variável.
                const name = n.name;
                if (!['pi', 'e', 'i', 'true', 'false', 'null', 'undefined'].includes(name.toLowerCase())) {
                    if (!symbols.includes(name)) symbols.push(name);
                }
            }
        });
        
        return symbols;
    } catch {
        return [];
    }
};

/**
 * Renomeia uma variável dentro da fórmula
 */
export const renameVariableInFormula = (formula: string, oldId: string, newId: string): string => {
    if (!formula) return '';
    try {
        const node = parse(formula);
        const transformed = node.transform((n: any) => {
            if (n.isSymbolNode && n.name === oldId) {
                n.name = newId;
            }
            return n;
        });
        return transformed.toString();
    } catch {
        return formula;
    }
};

/**
 * Remove (tenta limpar) referências a uma variável na fórmula
 */
export const removeVariableFromFormula = (formula: string, _varId: string): string => {
    // Implementação simples: apenas avisa ou deixa como está se for complexo.
    // O mathjs não tem um "remove node" fácil que mantenha a validade matemática sem contexto.
    return formula;
};