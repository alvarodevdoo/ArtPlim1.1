/**
 * PricingCompositionService
 *
 * Responsabilidade única: calcular em tempo real o custo total e o preço sugerido
 * de um produto com as opções selecionadas, lendo `averageCost` do estoque.
 *
 * Matemática do Snapshot:
 *   unitCostAtSale = Σ (material.averageCost × quantidade)
 *   profit         = unitPriceAtSale − unitCostAtSale
 */

export interface CompositionLineItem {
  materialId: string;
  materialName: string;
  materialCategory?: string; // Categoria do material para filtragem visual
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

export class PricingCompositionService {
  constructor(private readonly prisma: any) {}

  /**
   * Calcula o custo de composição de um produto para as opções selecionadas.
   * Chamado pelo endpoint /simulate-composition (sem efeito colateral no banco).
   */
  async calculate(params: {
    productId: string;
    selectedOptionIds: string[];
    quantity: number;
    organizationId: string;
  }): Promise<CompositionResult> {
    const { productId, selectedOptionIds, quantity, organizationId } = params;

    // 1. Buscar produto com markup alvo e fichas técnicas fixas
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      include: {
        fichasTecnicas: {
          include: {
            material: {
              include: {
                category: { select: { name: true } }
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

      const qtd = Number(ficha.quantidade || 1) * quantity;
      const costPerUnit = Number(mat.averageCost || 0);
      const subtotal = qtd * costPerUnit;
      baseMaterialCost += subtotal;

      breakdown.push({
        materialId: mat.id,
        materialName: mat.name,
        materialCategory: (mat as any).category?.name,
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
              category: { select: { name: true } }
            }
          },
          fichasTecnicas: {
            include: {
              material: {
                include: {
                  category: { select: { name: true } }
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
          const qtd = Number(opt.slotQuantity || 1) * quantity;
          const costPerUnit = Number(mat.averageCost || 0);
          const subtotal = qtd * costPerUnit;
          variableMaterialCost += subtotal;

          breakdown.push({
            materialId: mat.id,
            materialName: mat.name,
            materialCategory: (mat as any).category?.name,
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

          const qtd = Number(ficha.quantidade || 1) * quantity;
          const costPerUnit = Number(mat.averageCost || 0);
          const subtotal = qtd * costPerUnit;
          variableMaterialCost += subtotal;

          breakdown.push({
            materialId: mat.id,
            materialName: mat.name,
            materialCategory: (mat as any).category?.name,
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
