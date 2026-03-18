import { prisma } from '../../infrastructure/database/prisma';
import { all, create } from 'mathjs';

const math = create(all);

interface CalculationInput {
  productId: string;
  quantity: number;
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
    const { productId, quantity = 1, variables = {}, selectedOptionIds = [], organizationId } = input;

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
    const normalizedScope: Record<string, number> = {};

    // Mapear variáveis do frontend para o escopo, normalizando se necessário
    for (const v of ruleVariables) {
      const lowerId = v.id.toLowerCase();
      const upperId = v.id.toUpperCase();
      
      const received = (variables as any)[v.id] || (variables as any)[lowerId] || (variables as any)[upperId];
      const baseUnit = v.baseUnit || v.unit || null;
      
      let val = 0;
      try {
        if (received && typeof received === 'object' && received.value !== undefined) {
          val = typeof received.value === 'string' ? Number(received.value.replace(',', '.')) : received.value;
          
          // Lista de unidades "não-físicas" - não converter no mathjs
          const nonPhysicalUnits = ['X', 'moeda', '%', 'un', 'unidade', 'und', 'pç', 'pcas', 'folhas'];
          const isPhysical = (u: string) => u && !nonPhysicalUnits.includes(u.toLowerCase());

          if (baseUnit && received.unit && isPhysical(baseUnit) && isPhysical(received.unit)) {
            const unitMapping: Record<string, string> = {
              'M': 'm', 'M2': 'm2', 'M²': 'm2', 'CM': 'cm', 'MM': 'mm',
              'KG': 'kg', 'G': 'g', 'L': 'l', 'H': 'h'
            };
            const normalize = (u: string) => unitMapping[u.toUpperCase()] || u;
            const normBase = normalize(baseUnit);
            const normCurrent = normalize(received.unit);

            if (normBase !== normCurrent) {
              val = math.unit(val, normCurrent).toNumber(normBase);
              logs.push(`Variável [${v.name}] normalizada: ${received.value}${received.unit} -> ${val}${baseUnit}`);
            }
          }
        } else {
          val = v.fixedValue !== undefined ? Number(v.fixedValue) : 0;
        }

        // Registrar no escopo por ID e por Nome (para facilitar fórmulas amigáveis)
        normalizedScope[v.id] = val;
        
        // Injetar por nome normalizado (ex: "Largura do Produto" -> "LARGURA_DO_PRODUTO")
        const cleanName = v.name.toUpperCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (!normalizedScope[cleanName]) normalizedScope[cleanName] = val;
        
        // Injetar por Role (Papeis fixos) - Isso garante que LARGURA sempre funcione se marcada como WIDTH
        if (v.role === 'WIDTH') normalizedScope['LARGURA'] = normalizedScope['WIDTH'] = val;
        if (v.role === 'HEIGHT') normalizedScope['ALTURA'] = normalizedScope['HEIGHT'] = val;
        if (v.role === 'DEPTH') normalizedScope['PROFUNDIDADE'] = normalizedScope['DEPTH'] = val;
        if (v.role === 'LENGTH') normalizedScope['COMPRIMENTO'] = normalizedScope['LENGTH'] = val;
        if (v.role === 'SQUARE_METERS') normalizedScope['M2'] = normalizedScope['AREA'] = val;

      } catch (err: any) {
        logs.push(`⚠️ Variável [${v.name}]: Erro de conversão (${err.message}). Usando valor bruto.`);
        normalizedScope[v.id] = val;
      }
    }

    // Identificar Dimensões Físicas para o BOM (Consumo de Material)
    let BOM_M2 = 0;
    let BOM_M = 0;
    let physicalWidthMm = 0;
    let physicalHeightMm = 0;

    for (const v of ruleVariables) {
      const val = normalizedScope[v.id] || 0;
      const unit = v.baseUnit;

      try {
        if (v.role === 'SQUARE_METERS') BOM_M2 = unit ? math.unit(val, unit).toNumber('m2') : val;
        if (v.role === 'LINEAR_METERS') BOM_M = unit ? math.unit(val, unit).toNumber('m') : val;
        if (v.role === 'WIDTH') physicalWidthMm = unit ? math.unit(val, unit).toNumber('mm') : val;
        if (v.role === 'HEIGHT') physicalHeightMm = unit ? math.unit(val, unit).toNumber('mm') : val;
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
        finalUnitCost = Number(math.evaluate(costFormulaString, finalScope));
        logs.push(`Custo Financeiro resolvido (${costFormulaString}) = R$ ${finalUnitCost.toFixed(2)}`);
      }
      
      if (formulaString) {
        finalUnitPrice = Number(math.evaluate(formulaString, finalScope));
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