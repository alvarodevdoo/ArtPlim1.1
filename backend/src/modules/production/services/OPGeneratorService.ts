import { ProductionStatus, StepStatus, Priority } from '@prisma/client';

/**
 * OPGeneratorService
 * 
 * Responsabilidade: Transformar o snapshot de composição de um item de pedido
 * em uma Ordem de Produção (OP) estruturada com tabelas relacionais de Etapas.
 * 
 * Segue o Motor de Execução conforme solicitação de alta performance.
 */
export class OPGeneratorService {
  constructor(private readonly prisma: any) {}

  /**
   * Gera uma Ordem de Produção para um OrderItem aprovado.
   * Suporta a hierarquia de precedência: Produto > Categoria > Genérico.
   */
  async generateForOrderItem(orderItemId: string, organizationId: string, tx?: any): Promise<any> {
    const db = tx || this.prisma;
    // 1. Buscar o item com o snapshot e o produto (incluindo operações e categoria)
    const item = await db.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        product: {
          include: { 
            operations: true,
            category: { select: { defaultProductionSteps: true } }
          }
        }
      }
    });

    if (!item || !item.compositionSnapshot) {
      console.warn(`[OPGenerator] Item ${orderItemId} não possui snapshot de composição. Pulando geração de OP.`);
      return null;
    }

    // 2. Definir Roteiro de Produção (Steps) com Fallback Inteligente
    let rawSteps: any[] = [];

    // Prioridade 1: Operações exclusivas do Produto
    if (item.product.operations && item.product.operations.length > 0) {
      rawSteps = item.product.operations.map((op: any) => ({
        name: op.name
      }));
    } 
    // Prioridade 2: Roteiro padrão da Categoria
    else if (item.product.category?.defaultProductionSteps) {
      rawSteps = item.product.category.defaultProductionSteps as any[];
    }
    // Prioridade 3: Fallback Genérico
    else {
      rawSteps = [
        { name: 'Preparação e Separação' },
        { name: 'Produção / Impressão' },
        { name: 'Acabamento e Revisão' },
        { name: 'Embalagem' }
      ];
    }

    // 3. Criar a ProductionOrder e ProductionSteps no banco (Relacional)
    const productionOrder = await db.productionOrder.create({
      data: {
        organizationId,
        orderItemId: item.id,
        status: 'WAITING' as ProductionStatus,
        priority: 'NORMAL' as Priority,
        pickingList: item.compositionSnapshot,
        notes: `Motor de Execução: ${
          item.product.operations?.length > 0 ? 'Produto' : 
          item.product.category?.defaultProductionSteps ? 'Categoria' : 'Genérico'
        }`,
        steps: {
          create: rawSteps.map((step, index) => ({
            name: step.name,
            order: index + 1,
            status: 'PENDING' as StepStatus
          }))
        }
      },
      include: { steps: true }
    });

    return productionOrder;
  }

  /**
   * Gera OPs para TODOS os itens de um pedido.
   */
  async generateForOrder(orderId: string, organizationId: string, tx?: any): Promise<number> {
    const db = tx || this.prisma;
    const items = await db.orderItem.findMany({
      where: { orderId, organizationId }
    });

    let count = 0;
    for (const item of items) {
      const op = await this.generateForOrderItem(item.id, organizationId, tx);
      if (op) count++;
    }

    return count;
  }
}
