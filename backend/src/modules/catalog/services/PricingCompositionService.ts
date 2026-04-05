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
              select: { id: true, name: true, averageCost: true, currentStock: true, unit: true }
            }
          }
        }
      }
    });

    if (!product) throw new Error(`Produto ${productId} não encontrado`);

    const targetMarkup = product.targetMarkup || product.markup || 2.0;
    const breakdown: CompositionLineItem[] = [];
    const insufficientStock: InsufficientStockItem[] = [];

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
          // Slot direto: opção vinculada a um único material
          material: {
            select: { id: true, name: true, averageCost: true, currentStock: true, unit: true }
          },
          // Ficha técnica da opção (pode ter múltiplos materiais)
          fichasTecnicas: {
            include: {
              material: {
                select: { id: true, name: true, averageCost: true, currentStock: true, unit: true }
              }
            }
          }
        }
      });

      for (const opt of options) {
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
    const suggestedPrice = totalCost * targetMarkup;
    const currentMargin = suggestedPrice > 0
      ? (suggestedPrice - totalCost) / suggestedPrice
      : 0;

    return {
      baseMaterialCost,
      variableMaterialCost,
      totalCost,
      suggestedPrice,
      suggestedMarkup: targetMarkup,
      currentMargin,
      breakdown,
      insufficientStock
    };
  }
}
