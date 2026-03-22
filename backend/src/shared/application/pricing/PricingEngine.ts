import { prisma } from '../../infrastructure/database/prisma';
import * as formulaUtils from './formulaUtils';

interface CalculationInput {
  productId: string;
  quantity: number;
  width?: number;
  height?: number;
  variables?: Record<string, { value: any; unit: string | null }>;
  selectedOptionIds?: string[];
  organizationId: string;
}

interface CalculationOutput {
  costPrice: number;       // Custo total de insumos (CUSTO_MATERIAIS)
  unitPrice: number;       // Preço final calculado/validado
  totalPrice: number;      // unitPrice * quantity
  details: string[];       // Log do cálculo para debug
  insumos: Array<{
    id: string;
    nome: string;
    quantidade: number;
    unidade: string;
    custoUnitario: number;
    custoTotal: number;
  }>;
}

export class PricingEngine {
  constructor() {}

  async execute(input: CalculationInput): Promise<CalculationOutput> {
    const { productId, quantity = 1, width, height, variables = {}, selectedOptionIds = [], organizationId } = input;

    // 1. Buscar Produto com Ficha Técnica Base e Regra
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        fichasTecnicas: {
          include: { insumo: true }
        },
        pricingRule: true
      }
    });

    if (!product) throw new Error("Produto não encontrado.");

    const logs: string[] = [];
    let totalMaterialCost = 0;
    const insumosCalculados: any[] = [];

    // 2. Resolver Variáveis e Unidades (Normalização via MathJS)
    const rawFormula = product.pricingRule?.formula;
    let formulaDataRaw: any = {};
    
    if (typeof rawFormula === 'string') {
      try {
        formulaDataRaw = JSON.parse(rawFormula);
      } catch (e) {
        console.error("[PricingEngine] Erro ao parsear formula JSON:", e);
      }
    } else if (rawFormula && typeof rawFormula === 'object') {
      formulaDataRaw = rawFormula;
    }

    const ruleVariables = formulaDataRaw?.variables || [];

    // O evaluateFormula já cuida de toda a normalização de unidades físicas e taxas
    // e popula o normalizedScope com tudo o que é necessário.
    const result = formulaUtils.evaluateFormula(
      formulaDataRaw.formulaString || "0",
      variables,
      ruleVariables,
      logs
    );

    // Para manter a compatibilidade com o cálculo de BOM abaixo, precisamos rodar a normalização
    // Isso garante que o normalizedScope tenha os valores corretos para AREA, WIDTH, etc.
    const normalizedScope: Record<string, number> = {};
    for (const v of ruleVariables) {
        const vid = v.id.toLowerCase();
        const rawValue = (variables as any)[v.id] || 
                        (variables as any)[vid] || 
                        (variables as any).dynamicVariables?.[v.id] ||
                        (variables as any).dynamicVariables?.[vid];
        
        const currentUnit = (received: any) => (typeof received === 'object' && received?.unit) ? received.unit : (v.defaultUnit || v.unit);
        const normVal = formulaUtils.evaluateFormula(v.id, variables, [v]);
        normalizedScope[v.id] = Number(normVal);

        // Aliases para o BOM e regras legadas
        if (v.role === 'WIDTH') { normalizedScope['LARGURA'] = normalizedScope['WIDTH'] = Number(normVal); }
        if (v.role === 'HEIGHT') { normalizedScope['ALTURA'] = normalizedScope['HEIGHT'] = Number(normVal); }
        if (v.role === 'SQUARE_METERS' || v.role === 'AREA') { normalizedScope['M2'] = normalizedScope['AREA'] = Number(normVal); }
    }

    // Injeção de fallback para dimensões caso não tenham sido encontradas nas variáveis
    if (width && !normalizedScope['LARGURA']) normalizedScope['LARGURA'] = width;
    if (height && !normalizedScope['ALTURA']) normalizedScope['ALTURA'] = height;

    // Identificar Dimensões Físicas para o BOM (Consumo de Material)
    let BOM_M2 = 0;
    let BOM_M = 0;
    let physicalWidthMm = 0;
    let physicalHeightMm = 0;

    for (const v of ruleVariables) {
      const val = normalizedScope[v.id] || 0;
      const unitAlias = v.baseUnit ? formulaUtils.normalizeUnit(v.baseUnit) : null;

      try {
        if (v.role === 'SQUARE_METERS' || v.role === 'AREA') {
            BOM_M2 = val * formulaUtils.getConversionFactor(unitAlias || 'm^2', 'm^2');
        }
        if (v.role === 'LINEAR_METERS' || v.role === 'LENGTH') {
            BOM_M = val * formulaUtils.getConversionFactor(unitAlias || 'm', 'm');
        }
        if (v.role === 'WIDTH') {
            physicalWidthMm = val * formulaUtils.getConversionFactor(unitAlias || 'mm', 'mm');
        }
        if (v.role === 'HEIGHT') {
            physicalHeightMm = val * formulaUtils.getConversionFactor(unitAlias || 'mm', 'mm');
        }
      } catch (e: any) {
        logs.push(`⚠️ Erro BOM física [${v.name}]: ${e.message}`);
      }
    }




    // Fallback: Se não tem Área direta, calcula via Largura x Altura
    if (BOM_M2 === 0 && physicalWidthMm > 0 && physicalHeightMm > 0) {
      BOM_M2 = (physicalWidthMm * physicalHeightMm) / 1000000;
    }
    // Fallback: Se não tem Metro Linear direto, calcula via Max(Largura, Altura)
    if (BOM_M === 0 && (physicalWidthMm > 0 || physicalHeightMm > 0)) {
      BOM_M = Math.max(physicalWidthMm, physicalHeightMm) / 1000;
    }

    // 4. Coletar e Calcular Itens de Ficha Técnica (BOM)
    const todosItensFicha = [...product.fichasTecnicas];

    if (selectedOptionIds.length > 0) {
      const itensOpcoes = await prisma.fichaTecnicaInsumo.findMany({
        where: {
          configurationOptionId: { in: selectedOptionIds },
          organizationId
        },
        include: { insumo: true }
      });
      todosItensFicha.push(...itensOpcoes);
    }

    for (const item of todosItensFicha) {
      const insumo = item.insumo;
      let custoItem = 0;
      let qtdReal = Number(item.quantidade);

      switch (insumo.unidadeBase) {
        case 'M2':
          custoItem = BOM_M2 * Number(insumo.custoUnitario) * qtdReal;
          break;
        case 'M':
          custoItem = BOM_M * Number(insumo.custoUnitario) * qtdReal;
          break;
        default:
          custoItem = Number(insumo.custoUnitario) * qtdReal;
      }

      totalMaterialCost += custoItem;
      insumosCalculados.push({
        id: insumo.id,
        nome: insumo.nome,
        quantidade: qtdReal,
        unidade: insumo.unidadeBase,
        custoUnitario: Number(insumo.custoUnitario),
        custoTotal: custoItem
      });
    }

    // 5. Avaliar Fórmulas de Custo e Venda
    const formulaString = product.customFormula || formulaDataRaw?.formulaString;
    const costFormulaString = formulaDataRaw?.costFormulaString;

    if (product.customFormula) {
      logs.push(`Usando fórmula customizada do produto: ${product.customFormula}`);
    } else if (formulaDataRaw?.formulaString) {
      logs.push(`Usando fórmula da regra [${product.pricingRule?.name}]: ${formulaDataRaw.formulaString}`);
    }

    const finalScope = {
      ...normalizedScope,
      CUSTO_MATERIAIS: totalMaterialCost,
      QUANTIDADE: quantity
    };

    let finalUnitCost = totalMaterialCost;
    let finalUnitPrice = Number(product.salePrice) || 0;

    try {
      if (costFormulaString) {
        // Passamos [] nas variáveis para evitar dupla normalização, pois o finalScope já está normalizado
        const val = formulaUtils.evaluateFormula(costFormulaString, finalScope, [], logs);
        finalUnitCost = typeof val === 'number' ? val : 0;
        logs.push(`Custo Financeiro resolvido (${costFormulaString}) = R$ ${finalUnitCost.toFixed(2)}`);
      }
      
      if (formulaString) {
        const val = formulaUtils.evaluateFormula(formulaString, finalScope, [], logs);
        finalUnitPrice = typeof val === 'number' ? val : 0;
        logs.push(`Preço de Venda resolvido (${formulaString}) = R$ ${finalUnitPrice.toFixed(2)}`);
      } else if (!product.salePrice) {
        finalUnitPrice = finalUnitCost; // Safe fallback
      }
    } catch (err: any) {
      throw new Error(`Erro na avaliação da fórmula: ${err.message}`);
    }



    return {
      costPrice: finalUnitCost,
      unitPrice: finalUnitPrice,
      totalPrice: finalUnitPrice * quantity,
      details: logs,
      insumos: insumosCalculados
    };
  }
}