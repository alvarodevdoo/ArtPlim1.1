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
          include: { material: true }
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

    const ruleVariables = (formulaDataRaw?.variables || []) as any[];
    
    // 2. Resolver Insumos Vinculados ao Produto (Mapeamento de Variáveis na Ficha Técnica)
    // Isso permite que a mesma fórmula seja usada para diferentes materiais, 
    // definindo qual material ocupa qual variável no cadastro do produto.
    product.fichasTecnicas.forEach(ft => {
      if (ft.linkedVariable) {
        const varName = ft.linkedVariable;
        const price = Number(ft.material.costPerUnit);
        
        // Injeta no escopo de entrada para o evaluateFormula
        if (!variables[varName]) {
          variables[varName] = { value: price, unit: ft.material.unit };
          logs.push(`[Sync] Variável '${varName}' vinculada ao Material '${ft.material.name}' do produto (Preço: R$ ${price})`);
        }
      }
    });

    // O evaluateFormula já cuida de toda a normalização de unidades físicas e taxas
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
        const vid = (v.id || '').toUpperCase();
        const vname = (v.name || '').toUpperCase();

        if (v.role === 'SQUARE_METERS' || v.role === 'AREA' || vid === 'AREA' || vname === 'AREA') {
            BOM_M2 = val * formulaUtils.getConversionFactor(unitAlias || 'm^2', 'm^2');
        } else if (v.role === 'LINEAR_METERS' || v.role === 'LENGTH' || vid === 'LINEAR' || vname === 'LINEAR') {
            BOM_M = val * formulaUtils.getConversionFactor(unitAlias || 'm', 'm');
        } else if (v.role === 'WIDTH' || vid === 'LARGURA' || vid === 'WIDTH' || vname === 'LARGURA' || vname === 'WIDTH') {
            if (physicalWidthMm === 0) physicalWidthMm = val * formulaUtils.getConversionFactor(unitAlias || 'mm', 'mm');
        } else if (v.role === 'HEIGHT' || vid === 'ALTURA' || vid === 'HEIGHT' || vname === 'ALTURA' || vname === 'HEIGHT') {
            if (physicalHeightMm === 0) physicalHeightMm = val * formulaUtils.getConversionFactor(unitAlias || 'mm', 'mm');
        }
      } catch (e: any) {
        logs.push(`⚠️ Erro BOM física [${v.name}]: ${e.message}`);
      }
    }

    // FALLBACK ROBUSTO: Se as dimensões físicas não foram extraídas das variáveis, 
    // usamos os parâmetros width/height passados (que vêm dos campos padrão do produto)
    if (physicalWidthMm === 0 && width) physicalWidthMm = width;
    if (physicalHeightMm === 0 && height) physicalHeightMm = height;




    // Fallback: Se não tem Área direta, calcula via Largura x Altura
    if (BOM_M2 === 0 && physicalWidthMm > 0 && physicalHeightMm > 0) {
      BOM_M2 = (physicalWidthMm * physicalHeightMm) / 1000000;
    }
    // Fallback: Se não tem Metro Linear direto, calcula via Max(Largura, Altura)
    if (BOM_M === 0 && (physicalWidthMm > 0 || physicalHeightMm > 0)) {
      BOM_M = Math.max(physicalWidthMm, physicalHeightMm) / 1000;
    }

    // Injetar variáveis virtuais para vínculo de Ficha Técnica
    normalizedScope['AREA_TOTAL'] = BOM_M2;
    normalizedScope['COMPRIMENTO_TOTAL'] = BOM_M;
    normalizedScope['LARGURA_TOTAL'] = physicalWidthMm / 1000;
    normalizedScope['ALTURA_TOTAL'] = physicalHeightMm / 1000;

    // 4. Coletar e Calcular Itens de Ficha Técnica (BOM)
    const todosItensFicha = [...product.fichasTecnicas];

    if (selectedOptionIds.length > 0) {
      const itensOpcoes = await prisma.fichaTecnicaInsumo.findMany({
        where: {
          configurationOptionId: { in: selectedOptionIds },
          organizationId
        },
        include: { material: true }
      });
      todosItensFicha.push(...itensOpcoes);
    }

    for (const item of todosItensFicha) {
      const material = item.material;
      let custoItem = 0;
      let qtdReal = Number(item.quantidade);

      // NOVO: Se a quantidade estiver vinculada a uma variável, usamos o valor dela resolvido na fórmula
      const itemAny = item as any;
      if (itemAny.linkedQuantityVariable && normalizedScope[itemAny.linkedQuantityVariable] !== undefined) {
        qtdReal = Number(normalizedScope[itemAny.linkedQuantityVariable]);
        logs.push(`[BOM] Quantidade do Material '${material.name}' vinculada à variável '${itemAny.linkedQuantityVariable}' resolvido para ${qtdReal}`);
      } else {
        // PADRÕES INTELIGENTES: Se não houver vínculo manual, tenta detectar automático pela unidade
        const unit = material.unit.toString().toUpperCase();
        if (unit === 'M2' && BOM_M2 > 0) {
          qtdReal = BOM_M2;
          logs.push(`[BOM] Quantidade do Material '${material.name}' (${unit}) associada automaticamente à ÁREA da peça (${qtdReal})`);
        } else if ((unit === 'M' || unit === 'CM' || unit === 'MM') && BOM_M > 0) {
          qtdReal = BOM_M;
          logs.push(`[BOM] Quantidade do Material '${material.name}' (${unit}) associada automaticamente ao COMPRIMENTO da peça (${qtdReal})`);
        }
      }

      switch (material.unit.toUpperCase()) {
        case 'M2':
          custoItem = BOM_M2 * Number(material.costPerUnit) * qtdReal;
          break;
        case 'M':
          custoItem = BOM_M * Number(material.costPerUnit) * qtdReal;
          break;
        default:
          custoItem = Number(material.costPerUnit) * qtdReal;
      }

      totalMaterialCost += custoItem;
      insumosCalculados.push({
        id: material.id,
        nome: material.name,
        quantidade: qtdReal,
        unidade: material.unit,
        custoUnitario: Number(material.costPerUnit),
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

    // FALLBACK: Se não houver custo de materiais (BOM vazia), tenta usar o custo base do produto
    if (finalUnitCost === 0 && product.costPrice) {
      const baseCost = Number(product.costPrice);
      // Se tiver área calculada, assume que o custo é por m2
      if (BOM_M2 > 0) {
        finalUnitCost = baseCost * BOM_M2;
        logs.push(`[Fallback] Custo baseado em Área (sem BOM): ${baseCost} * ${BOM_M2.toFixed(4)} = R$ ${finalUnitCost.toFixed(2)}`);
      } else {
        finalUnitCost = baseCost;
        logs.push(`[Fallback] Usando custo fixo do produto (sem BOM): R$ ${finalUnitCost.toFixed(2)}`);
      }
    }

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