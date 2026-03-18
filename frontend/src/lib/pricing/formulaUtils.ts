import { evaluate, parse, unit } from 'mathjs';

/**
 * Extrai variáveis de uma fórmula em forma de string.
 * Faz um parse na string e busca por "palavras" que sejam potenciais nomes de variáveis.
 */
export const extractVariables = (formulaStr: string): string[] => {
    if (!formulaStr || formulaStr.trim() === '') return [];

    try {
        // Primeiro: Remover os rótulos de detalhamento (#) para não extrair "Filamento" se estiver em (expr)#Filamento
        const formulaWithoutLabels = formulaStr.replace(/#[a-zA-ZáàâãééêíïóôõõúüçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ_0-9]*/g, '');

        // Suporte a caracteres acentuados (PT-BR) e underscores
        const matches = formulaWithoutLabels.match(/[a-zA-ZáàâãééêíïóôõõúüçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ_][a-zA-Z0-9áàâãééêíïóôõõúüçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ_]*/g);
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
        parse(formulaStr);
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

        // 0. Preparar detalhamento (BREAKDOWN)
        const breakdown: { label: string, value: number }[] = [];
        
        // Identificar blocos de detalhamento: (expressao)#Rotulo
        const breakdownRegex = /\(([^)]+)\)#([a-zA-ZáàâãééêíïóôõõúüçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ_0-9]+)/g;
        let match;

        // 0. Limpar comentários e normalizar operadores comuns (×, ÷)
        const cleanFormula = formulaStr
            .replace(/#[a-zA-ZáàâãééêíïóôõõúüçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ_0-9]+/g, '') // Remove os rótulos # para o mathjs não quebrar
            .replace(/×/g, '*')
            .replace(/÷/g, '/');

        // 1. Extrair tanto os valores do simulador (scope) quanto os valores FIXOS das variáveis
        const normalizedScope: Record<string, any> = {};

        // Primeiro: Adicionar os valores vindos do simulador
        Object.keys(scope).forEach(key => {
            const val = scope[key];
            normalizedScope[key] = val;
            normalizedScope[key.toLowerCase()] = val;
            normalizedScope[key.toUpperCase()] = val;
        });

        // Segundo: Adicionar os valores FIXOS
        if (ruleVariables && Array.isArray(ruleVariables)) {
            ruleVariables.forEach(v => {
                if (v.type === 'FIXED' && v.fixedValue !== undefined) {
                    const val = v.fixedValue;
                    normalizedScope[v.id] = val;
                    normalizedScope[v.id.toLowerCase()] = val;
                    normalizedScope[v.id.toUpperCase()] = val;
                }
            });

            // Terceiro: Aplicar normalizações universais via MathJS
            ruleVariables.forEach(variable => {
                const lowerId = variable.id.toLowerCase();
                const upperId = variable.id.toUpperCase();

                // Prioridade: ID exato > lowercase > uppercase
                const actualId = normalizedScope.hasOwnProperty(variable.id)
                    ? variable.id
                    : (normalizedScope.hasOwnProperty(lowerId) ? lowerId : (normalizedScope.hasOwnProperty(upperId) ? upperId : null));

                if (actualId) {
                    let val = typeof normalizedScope[actualId] === 'string' 
                        ? parseFloat((normalizedScope[actualId] as string).replace(',', '.')) 
                        : normalizedScope[actualId];
                    
                    if (isNaN(val)) val = 0;
                    // TIPOS DE VARIÁVEL - Normalização Estrita para a Menor Unidade Comum
                    const roleMappings: Record<string, string> = {
                        'LENGTH': 'mm',
                        'AREA': 'mm2',
                        'VOLUME': 'ml',
                        'TIME': 's',
                        'WEIGHT': 'g',
                        'ENERGY': 'Wh',
                        'POWER': 'W',
                        'PERCENT': '%'
                    };

                    const baseUnitFromRole = (variable.role && variable.role !== 'NONE') ? roleMappings[variable.role] : null;
                    const baseUnit = variable.baseUnit || baseUnitFromRole || variable.unit || null;

                    // Busca exaustiva pela unidade no escopo (insensível à caixa)
                    const unitKey = `${actualId}_unit`;
                    const lowerUnitKey = `${variable.id.toLowerCase()}_unit`;
                    const upperUnitKey = `${variable.id.toUpperCase()}_unit`;

                    let currentUnit = (scope as any)[unitKey]
                        || (scope as any)[lowerUnitKey]
                        || (scope as any)[upperUnitKey]
                        || variable.unit
                        || baseUnit;

                    // Mapeamento exaustivo de unidades de UI para unidades MathJS
                    const unitMapping: Record<string, string> = {
                        // Comprimento
                        'KM': 'km', 'M': 'm', 'CM': 'cm', 'MM': 'mm',
                        // Área
                        'M2': 'm2', 'M²': 'm2', 'CM2': 'cm2', 'CM²': 'cm2', 'MM2': 'mm2', 'MM²': 'mm2',
                        // Volume
                        'L': 'l', 'ML': 'ml',
                        // Tempo
                        'H': 'h', 'MIN': 'min', 'S': 's',
                        // Peso
                        'KG': 'kg', 'G': 'g', 'MG': 'mg',
                        // Energia
                        'KWH': 'kWh', 'WH': 'Wh', 'MWH': 'mWh',
                        // Potência
                        'KW': 'kW', 'W': 'W', 'MW': 'mW'
                    };

                    const normalizeUnit = (u: string) => {
                        if (!u) return u;
                        const upperU = u.toUpperCase();
                        // Remover ^ para compatibilidade se vier M^2
                        const cleanU = upperU.replace('^', '');
                        return unitMapping[cleanU] || u.toLowerCase();
                    };

                    const normalizedBase = normalizeUnit(baseUnit);
                    const normalizedCurrent = normalizeUnit(currentUnit);

                    // Lista de unidades "não-físicas"
                    const nonPhysicalUnits = ['X', 'moeda', 'un', 'unidade', 'und', 'pç', 'pcas', 'folhas'];
                    const isPhysical = (u: string) => u && !nonPhysicalUnits.includes(u.toLowerCase()) && u !== '%';

                    if (variable.role === 'COST_RATE') {
                        // Se for uma taxa (Ex: R$/kg), normaliza para a menor unidade (Ex: R$/g)
                        const rateUnit = currentUnit || '';
                        if (rateUnit.includes('/')) {
                            const [_curr, unitPart] = rateUnit.split('/');
                            const normalizedUnitPart = normalizeUnit(unitPart.trim());
                            
                            // Determinar a unidade base de destino (Ex: kWh -> Wh, KG -> G)
                            const targetBaseMap: Record<string, string> = {
                                'kWh': 'Wh', 'Wh': 'Wh', 'mWh': 'Wh',
                                'kg': 'g', 'g': 'g', 'mg': 'g',
                                'km': 'mm', 'm': 'mm', 'cm': 'mm', 'mm': 'mm',
                                'l': 'ml', 'ml': 'ml'
                            };
                            
                            const normalizedBasePart = targetBaseMap[normalizedUnitPart] || normalizedUnitPart;
                            
                            if (normalizedUnitPart !== normalizedBasePart) {
                                try {
                                    // Para taxas (Ex: R$/kg), se kg vira g (fator 1000), o preço deve ser DIVIDIDO por 1000
                                    const factor = unit(1, normalizedUnitPart).toNumber(normalizedBasePart);
                                    const converted = val / factor;
                                    normalizedScope[variable.id] = converted;
                                    normalizedScope[lowerId] = converted;
                                    normalizedScope[upperId] = converted;
                                } catch (e: any) {
                                    console.warn(`Erro na conversão de taxa ${actualId}:`, e);
                                    return `Erro conversao taxa ${actualId}: ` + e.message;
                                }
                            }
                        }
                    } else if (baseUnit === '%' || variable.role === 'PERCENT') {
                        const converted = val / 100;
                        normalizedScope[variable.id] = converted;
                        normalizedScope[lowerId] = converted;
                        normalizedScope[upperId] = converted;
                    } else if (normalizedBase && normalizedCurrent && isPhysical(normalizedBase) && isPhysical(normalizedCurrent) && normalizedBase !== normalizedCurrent) {
                        try {
                            const converted = unit(val, normalizedCurrent).toNumber(normalizedBase);
                            normalizedScope[variable.id] = converted;
                            normalizedScope[lowerId] = converted;
                            normalizedScope[upperId] = converted;
                        } catch (e: any) {
                            console.warn(`Erro na conversão de ${actualId}:`, e);
                            return `Erro conversao ${actualId} (${normalizedCurrent} para ${normalizedBase}): ` + e.message;
                        }
                    }
                }
            });
        }

        // AGORA: Calcular os sub-blocos do breakdown usando o scope já normalizado

        breakdownRegex.lastIndex = 0; // Reset regex
        while ((match = breakdownRegex.exec(formulaStr)) !== null) {
            const subExpr = match[1];
            const label = match[2];
            try {
                const subRes = evaluate(subExpr.replace(/×/g, '*').replace(/÷/g, '/'), normalizedScope);
                const val = typeof subRes === 'number' ? subRes : (subRes?.value || 0);
                breakdown.push({ label, value: Math.round(val * 100) / 100 });
            } catch (e) {}
        }

        let result = evaluate(cleanFormula, normalizedScope);

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

        return `Erro: Resultado não numérico.`;
    } catch (error: any) {
        // Tentar capturar nome de variável indefinida de forma amigável
        if (error.message && error.message.includes('Undefined symbol')) {
            const sym = error.message.split('Undefined symbol ')[1];
            return `Pendente: ${sym}`;
        }
        return `Erro: ${error.message}`;
    }
}

/**
 * Quebra a fórmula em componentes baseados no operador de soma (+).
 * Retorna uma lista de { name, value } para exibição em tooltips.
 */
export interface FormulaComponent {
    name: string;
    value: number;
    raw: string;
}

export const getFormulaComponentBreakdown = (
    formulaStr: string,
    scope: Record<string, number>,
    ruleVariables?: any[]
): FormulaComponent[] => {
    if (!formulaStr) return [];

    try {
        // Função auxiliar para quebrar strings em + respeitando parênteses
        const parts: string[] = [];
        let current = "";
        let parenLevel = 0;

        for (let i = 0; i < formulaStr.length; i++) {
            const char = formulaStr[i];
            if (char === '(') parenLevel++;
            if (char === ')') parenLevel--;

            if (char === '+' && parenLevel === 0) {
                parts.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }
        parts.push(current.trim());

        const breakdown: FormulaComponent[] = [];

        parts.forEach(part => {
            if (!part || part.trim() === "") return;

            // Extrair nome amigável do comentário #
            let name = "";
            let expression = part;

            if (part.includes('#')) {
                const subParts = part.split('#');
                expression = subParts[0].trim();
                name = subParts[1].trim();
            }

            // Se não tiver nome, tenta inferir algo ou usa "Custo Adicional"
            if (!name) {
                const vars = extractVariables(expression);
                if (vars.length === 1) {
                    name = vars[0].charAt(0).toUpperCase() + vars[0].slice(1).replace(/_/g, ' ');
                } else {
                    name = "Outro Custo";
                }
            }

            const val = evaluateFormula(expression, scope, ruleVariables);
            if (typeof val === 'number') {
                breakdown.push({ name, value: val, raw: expression });
            }
        });

        return breakdown;
    } catch (e) {
        console.error("Erro ao gerar detalhamento da fórmula:", e);
        return [];
    }
}
