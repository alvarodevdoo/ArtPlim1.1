/**
 * PricingCompositionService
 *
 * Responsabilidade única: calcular em tempo real o custo total e o preço sugerido
 * de um produto com as opções selecionadas.
 *
 * Hierarquia de custo (ordem de prioridade):
 *   1. averageCost  — custo médio ponderado do estoque (mais preciso, atualizado por entradas)
 *   2. costPerUnit  — custo unitário cadastrado manualmente (já convertido para a unidade de uso)
 *   3. purchasePrice derivado — purchasePrice / (purchaseWidth × purchaseHeight) para materiais de área
 *   4. purchasePrice direto — apenas para formato UNIT (carimbo, etc.)
 *   5. 0            — material sem custo configurado
 *
 * Matemática do Snapshot:
 *   unitCostAtSale = Σ (resolvedCost × quantidade)
 *   profit         = unitPriceAtSale − unitCostAtSale
 */

export interface CompositionLineItem {
  materialId: string;
  materialName: string;
  materialCategory?: string;   // Nome da categoria (visual)
  materialCategoryId?: string; // ID da categoria (apropriação financeira)
  quantity: number;
  costPerUnit: number;   // averageCost do estoque
  subtotal: number;
  source: 'FICHA_TECNICA' | 'OPTION_SLOT' | 'ADDITIONAL_COMPONENT';
  optionLabel?: string;
}

export interface CompositionResult {
  baseMaterialCost: number;      // Custo da ficha técnica fixa do produto
  variableMaterialCost: number;  // Custo das opções selecionadas
  totalCost: number;             // baseMaterialCost + variableMaterialCost
  suggestedPrice: number;        // totalCost × targetMarkup
  unitSuggestedPrice: number;    // suggestedPrice / quantity
  suggestedMarkup: number;       // targetMarkup configurado (ou 2.0 padrão)
  currentMargin: number;         // (suggestedPrice - totalCost) / suggestedPrice
  breakdown: CompositionLineItem[];
  insufficientStock: InsufficientStockItem[];
}

export interface InsufficientStockItem {
  materialId: string;
  materialName: string;
  requiredQuantity: number;
  currentStock: number;
  deficit: number;
}


import { InventoryValuationService } from '../../../shared/services/InventoryValuationService';

export class PricingCompositionService {
  private readonly valuationSvc: InventoryValuationService;

  constructor(private readonly prisma: any) {
    this.valuationSvc = new InventoryValuationService(prisma);
  }

  /**
   * Calcula o custo de composição de um produto para as opções selecionadas.
   * Chamado pelo endpoint /simulate-composition (sem efeito colateral no banco).
   */
  async calculate(params: {
    productId: string;
    selectedOptionIds: string[];
    quantity: number;
    width?: number;
    height?: number;
    dynamicVariables?: any;
    organizationId: string;
  }): Promise<CompositionResult> {
    let { productId, selectedOptionIds, quantity, width, height, dynamicVariables, organizationId } = params;

    // Fallback de segurança para pedidos legados ou com divergência de formulário:
    // Tenta resgatar largura e altura dos Atributos Dinâmicos se não foram enviados explícitos
    if ((!width || !height) && dynamicVariables) {
      const vars = Object.keys(dynamicVariables);
      const widthKey = vars.find(k => k.toUpperCase() === 'LARGURA');
      const heightKey = vars.find(k => k.toUpperCase() === 'ALTURA');

      if (!width && widthKey) {
        width = Number(dynamicVariables[widthKey]?.value) || width;
        if (dynamicVariables[widthKey]?.unit?.toLowerCase() === 'cm') width = (width || 0) * 10;
        if (dynamicVariables[widthKey]?.unit?.toLowerCase() === 'm') width = (width || 0) * 1000;
      }
      if (!height && heightKey) {
        height = Number(dynamicVariables[heightKey]?.value) || height;
        if (dynamicVariables[heightKey]?.unit?.toLowerCase() === 'cm') height = (height || 0) * 10;
        if (dynamicVariables[heightKey]?.unit?.toLowerCase() === 'm') height = (height || 0) * 1000;
      }
    }

    // 1. Buscar produto com markup alvo e fichas técnicas fixas
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      include: {
        fichasTecnicas: {
          include: {
            material: {
              include: {
                category: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    });

    if (!product) throw new Error(`Produto ${productId} não encontrado`);

    const breakdown: CompositionLineItem[] = [];
    const insufficientStock: InsufficientStockItem[] = [];
    
    let maxOverride = 0;
    let totalModifiers = 0;

    // 2. Calcular custo da ficha técnica FIXA do produto (sem opções)
    let baseMaterialCost = 0;

    for (const ficha of product.fichasTecnicas) {
      // Só inclui fichas sem vínculo de opção (ficha global do produto)
      if (ficha.configurationOptionId) continue;

      const mat = ficha.material;
      if (!mat) continue;

      let consumptionMultiplier = 1;
      if (mat.defaultConsumptionRule === 'PRODUCT_AREA' && width && height) {
        consumptionMultiplier = (width * height) / 1000000;
      }

      const qtd = Number(ficha.quantidade || 1) * quantity * consumptionMultiplier;
      // Custo unitário resolvido com hierarquia: averageCost → costPerUnit → purchasePrice derivado
      const costPerUnit = this.valuationSvc.resolveAverageCost(mat);
      const subtotal = qtd * costPerUnit;
      baseMaterialCost += subtotal;

      breakdown.push({
        materialId: mat.id,
        materialName: mat.name,
        materialCategory: (mat as any).category?.name,
        materialCategoryId: (mat as any).category?.id,
        quantity: qtd,
        costPerUnit,
        subtotal,
        source: 'FICHA_TECNICA'
      });

      // Verificar estoque suficiente
      const currentStock = Number(mat.currentStock || 0);
      if (mat.currentStock !== null && currentStock < qtd) {
        insufficientStock.push({
          materialId: mat.id,
          materialName: mat.name,
          requiredQuantity: qtd,
          currentStock,
          deficit: qtd - currentStock
        });
      }
    }

    // 3. Calcular custo das opções selecionadas
    let variableMaterialCost = 0;

    if (selectedOptionIds.length > 0) {
      const options = await this.prisma.configurationOption.findMany({
        where: { id: { in: selectedOptionIds } },
        include: {
          material: {
            include: {
              category: { select: { id: true, name: true } }
            }
          },
          fichasTecnicas: {
            include: {
              material: {
                include: {
                  category: { select: { id: true, name: true } }
                }
              }
            }
          }
        }
      });

      for (const opt of options) {
        // Acumular modificadores e acompanhar o maior preço fixo (override ou fixedValue)
        const modifier = Number(opt.priceModifier || 0) * quantity;
        totalModifiers += modifier;
        
        // fixedValue é o novo campo para Preço Fixo de Venda da opção
        // priceOverride é o campo legado que tinha o mesmo propósito
        const optFixedValue = Number(opt.fixedValue || 0) * quantity;
        const optOverride = Number(opt.priceOverride || 0) * quantity;
        const currentMax = Math.max(optFixedValue, optOverride);
        
        if (currentMax > maxOverride) {
            maxOverride = currentMax;
        }

        // 3a. Slot direto (materialId na própria option)
        if (opt.materialId && opt.material) {
          const mat = opt.material;

          let consumptionMultiplier = 1;
          if (mat.defaultConsumptionRule === 'PRODUCT_AREA' && width && height) {
            consumptionMultiplier = (width * height) / 1000000;
          }

          const qtd = Number(opt.slotQuantity || 1) * quantity * consumptionMultiplier;
          // Custo unitário resolvido com hierarquia: averageCost → costPerUnit → purchasePrice derivado
          const costPerUnit = this.valuationSvc.resolveAverageCost(mat);
          const subtotal = qtd * costPerUnit;
          variableMaterialCost += subtotal;

          breakdown.push({
            materialId: mat.id,
            materialName: mat.name,
            materialCategory: (mat as any).category?.name,
            materialCategoryId: (mat as any).category?.id,
            quantity: qtd,
            costPerUnit,
            subtotal,
            source: 'OPTION_SLOT',
            optionLabel: opt.label
          });

          const currentStock = Number(mat.currentStock || 0);
          if (mat.currentStock !== null && currentStock < qtd) {
            insufficientStock.push({
              materialId: mat.id,
              materialName: mat.name,
              requiredQuantity: qtd,
              currentStock,
              deficit: qtd - currentStock
            });
          }
        }

        // 3b. Ficha técnica da opção (via FichaTecnicaInsumo)
        for (const ficha of (opt.fichasTecnicas || [])) {
          const mat = ficha.material;
          if (!mat) continue;

          let consumptionMultiplier = 1;
          if (mat.defaultConsumptionRule === 'PRODUCT_AREA' && width && height) {
            consumptionMultiplier = (width * height) / 1000000;
          }

          const qtd = Number(ficha.quantidade || 1) * quantity * consumptionMultiplier;
          // Custo unitário resolvido com hierarquia: averageCost → costPerUnit → purchasePrice derivado
          const costPerUnit = this.valuationSvc.resolveAverageCost(mat);
          const subtotal = qtd * costPerUnit;
          variableMaterialCost += subtotal;

          breakdown.push({
            materialId: mat.id,
            materialName: mat.name,
            materialCategory: (mat as any).category?.name,
            materialCategoryId: (mat as any).category?.id,
            quantity: qtd,
            costPerUnit,
            subtotal,
            source: 'ADDITIONAL_COMPONENT',
            optionLabel: opt.label
          });
        }
      }
    }

    const totalCost = baseMaterialCost + variableMaterialCost;
    
    // Lógica Final de Preço Sugerido:
    // REMOVIDO: Custo x Markup. Agora o preço sugerido é APENAS o preço fixo das opções + modificadores.
    // Se não houver preço fixo definido nas opções, o sistema sugere o PREÇO BASE do produto (product.salePrice).
    // Se nem o produto tiver preço base, usamos o custo total.
    let suggestedPrice = 0;
    
    if (maxOverride > 0) {
        suggestedPrice = maxOverride + totalModifiers;
    } else {
        suggestedPrice = (Number(product.salePrice || 0) * quantity) + totalModifiers;
    }

    // Fallback absoluto: se o preço sugerido ainda for 0, usamos o custo total para não ficar vazio
    if (suggestedPrice === 0) {
        suggestedPrice = totalCost;
    }

    const unitSuggestedPrice = suggestedPrice / Math.max(1, quantity);

    return {
      baseMaterialCost,
      variableMaterialCost,
      totalCost,
      suggestedPrice,
      unitSuggestedPrice,
      suggestedMarkup: 1.0,
      currentMargin: 0,
      breakdown,
      insufficientStock
    };
  }
}
