import * as mathjs from 'mathjs';

/**
 * Extrai variáveis de uma fórmula em forma de string.
 * Faz um parse na string e busca por "palavras" que sejam potenciais nomes de variáveis.
 */
export const extractVariables = (formulaStr: string): string[] => {
    if (!formulaStr || formulaStr.trim() === '') return [];

    try {
        // Fallback rápido usando Regex para pegar palavras não numéricas
        // Matches de palavras que comecem com letra ou _, seguidos de letras, números ou _
        const matches = formulaStr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
        if (!matches) return [];

        // Palavras reservadas da matemática / mathjs
        const reserved = [
            'pi', 'e', 'sin', 'cos', 'tan', 'sqrt', 'log', 'exp',
            'round', 'ceil', 'floor', 'abs', 'true', 'false', 'min', 'max'
        ];

        // Retorna apenas valores únicos e que não sejam palavras reservadas
        const uniqueVars = Array.from(new Set(matches)).filter(m => !reserved.includes(m.toLowerCase()));
        return uniqueVars;
    } catch (error) {
        console.error('Erro ao extrair variáveis da fórmula:', error);
        return [];
    }
};

/**
 * Renomeia uma variável dentro da fórmula usando regex word-boundary.
 * Evita renomear "largura" acidentalmente se ela fizer parte de "largura_total".
 */
export const renameVariableInFormula = (formulaStr: string, oldName: string, newName: string): string => {
    if (!oldName || !newName || !formulaStr) return formulaStr;
    try {
        // O \\b garante que pegaremos apenas a palavra exata
        const regex = new RegExp(`\\b${oldName}\\b`, 'g');
        return formulaStr.replace(regex, newName);
    } catch (e) {
        return formulaStr;
    }
}

/**
 * Remove uma variável da fórmula, tentando remover de forma inteligente um operador adjacente
 * para não quebrar a sintaxe (ex: remover " * altura" se o usuário deletou a variável "altura").
 */
export const removeVariableFromFormula = (formulaStr: string, varName: string): string => {
    if (!varName || !formulaStr) return formulaStr;
    try {
        let result = formulaStr;

        // Tenta remover " OPERADOR variavel" (ex: " * altura" ou " + altura")
        const regexPrevOperator = new RegExp(`(\\s*[\\+\\-\\*\\/\\^]\\s*)\\b${varName}\\b`, 'g');
        if (regexPrevOperator.test(result)) {
            result = result.replace(regexPrevOperator, '');
        } else {
            // Tenta remover "variavel OPERADOR " (ex: "largura * " ou "largura + ")
            const regexNextOperator = new RegExp(`\\b${varName}\\b(\\s*[\\+\\-\\*\\/\\^]\\s*)`, 'g');
            if (regexNextOperator.test(result)) {
                result = result.replace(regexNextOperator, '');
            } else {
                // Se não tem operador aparente dos lados, remove apenas a variável
                const regexExact = new RegExp(`\\b${varName}\\b`, 'g');
                result = result.replace(regexExact, '');
            }
        }

        return result.trim();
    } catch (e) {
        return formulaStr;
    }
}

/**
 * Verifica se a sintaxe de uma fórmula é válida para o mathjs
 */
export const validateFormulaSyntax = (formulaStr: string): true | string => {
    if (!formulaStr || formulaStr.trim() === '') return "A fórmula está vazia.";

    try {
        mathjs.parse(formulaStr);
        return true;
    } catch (error: any) {
        return error.message || "Erro de sintaxe na fórmula.";
    }
}

/**
 * Avalia o resultado da fórmula com as variáveis fornecidas.
 * Opcionalmente normaliza grandezas conhecidas (mm, cm -> metros / g -> kg) antes do cálculo.
 */
export const evaluateFormula = (formulaStr: string, scope: Record<string, number>, ruleVariables?: any[]): number | string => {
    try {
        if (!formulaStr || formulaStr.trim() === '') return 0;

        // 1. Extrair tanto os valores do simulador (scope) quanto os valores FIXOS das variáveis
        const normalizedScope: Record<string, any> = {};

        // Primeiro: Adicionar os valores vindos do simulador
        Object.keys(scope).forEach(key => {
            normalizedScope[key] = scope[key];
            normalizedScope[key.toLowerCase()] = scope[key];
        });

        // Segundo: Adicionar os valores FIXOS
        if (ruleVariables && Array.isArray(ruleVariables)) {
            ruleVariables.forEach(v => {
                if (v.type === 'FIXED' && v.fixedValue !== undefined) {
                    normalizedScope[v.id] = v.fixedValue;
                    normalizedScope[v.id.toLowerCase()] = v.fixedValue;
                }
            });

            // Terceiro: Aplicar normalizações
            ruleVariables.forEach(variable => {
                const lowerId = variable.id.toLowerCase();
                const actualId = normalizedScope.hasOwnProperty(variable.id) ? variable.id : (normalizedScope.hasOwnProperty(lowerId) ? lowerId : null);

                if (actualId && variable.unit) {
                    let val = normalizedScope[actualId];
                    switch (variable.unit) {
                        case 'mm': val = val / 1000; break;
                        case 'cm': val = val / 100; break;
                        case 'mm2': val = val / 1000000; break;
                        case 'cm2': val = val / 10000; break;
                        case 'g': val = val / 1000; break;
                        case '%': val = val / 100; break;
                    }
                    normalizedScope[variable.id] = val;
                    normalizedScope[lowerId] = val;
                }
            });
        }

        let result = mathjs.evaluate(formulaStr, normalizedScope);

        // Conversão final robusta para número
        let numericResult: number = NaN;
        if (typeof result === 'number') {
            numericResult = result;
        } else if (result && typeof result === 'object') {
            if (result.type === 'Unit' || result.value !== undefined) {
                const val = result.value;
                numericResult = typeof val === 'number' ? val : Number(val);
            } else if (typeof result.toNumber === 'function') {
                numericResult = result.toNumber();
            } else {
                const v = result.valueOf();
                numericResult = typeof v === 'number' ? v : Number(v);
            }
        } else {
            numericResult = Number(result);
        }

        if (typeof numericResult === 'number' && !isNaN(numericResult)) {
            return Math.round(numericResult * 100) / 100;
        }

        return `Erro: Resultado não numérico (${typeof result}). Verifique as variáveis.`;
    } catch (error: any) {
        console.error("MATH ERROR:", error);
        return `Erro: ${error.message}`;
    }
}
