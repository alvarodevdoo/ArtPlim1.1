/**
 * OPGeneratorService
 * 
 * Responsabilidade: Transformar o snapshot de composição de um item de pedido
 * em uma Ordem de Produção (OP) estruturada com Picking List e Roteiro.
 */

import { ProductionStatus } from '@prisma/client';

export class OPGeneratorService {
  constructor(private readonly prisma: any) {}

  /**
   * Gera uma Ordem de Produção para um OrderItem aprovado.
   * Chamado pelo ConfirmOrderService após a confirmação do pedido.
   */
  async generateForOrderItem(orderItemId: string, organizationId: string): Promise<any> {
    // 1. Buscar o item com o snapshot e o produto (incluindo operações e categoria)
    const item = await this.prisma.orderItem.findUnique({
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

    // 2. Traduzir o snapshot em Picking List (Lista de Separação)
    const snapshot = item.compositionSnapshot as any[];
    const pickingList = snapshot.map(line => ({
      materialId: line.materialId,
      name: line.materialName,
      quantity: line.quantity,
      unit: line.unit || 'un',
      source: line.source,
      optionLabel: line.optionLabel
    }));

    // 3. Definir Roteiro de Produção (Steps) com Fallback Inteligente
    let steps = [];

    // Prioridade 1: Operações exclusivas do Produto
    if (item.product.operations && item.product.operations.length > 0) {
      steps = item.product.operations.map((op: any, idx: number) => ({
        name: op.name,
        sequence: idx + 1,
        status: 'PENDING',
        estimatedTime: op.setupTime || 0
      }));
    } 
    // Prioridade 2: Roteiro padrão da Categoria
    else if (item.product.category?.defaultProductionSteps) {
      const categorySteps = item.product.category.defaultProductionSteps as any[];
      steps = categorySteps.map((step: any, idx: number) => ({
        name: step.name,
        sequence: step.sequence || idx + 1,
        status: 'PENDING'
      }));
    }
    // Prioridade 3: Fallback Genérico
    else {
      steps = [
        { name: 'Preparação e Separação', sequence: 1, status: 'PENDING' },
        { name: 'Produção / Impressão', sequence: 2, status: 'PENDING' },
        { name: 'Acabamento e Revisão', sequence: 3, status: 'PENDING' },
        { name: 'Embalagem', sequence: 4, status: 'PENDING' }
      ];
    }

    // 4. Criar a ProductionOrder no banco
    const productionOrder = await this.prisma.productionOrder.create({
      data: {
        organizationId,
        orderItemId: item.id,
        status: 'PENDING',
        priority: 1,
        pickingList,
        steps,
        notes: `Gerada automaticamente. Item: ${item.product.name}. Roteiro: ${
          item.product.operations?.length > 0 ? 'Customizado por Produto' : 
          item.product.category?.defaultProductionSteps ? 'Padrão da Categoria' : 'Genérico'
        }`
      }
    });

    return productionOrder;
  }

  /**
   * Gera OPs para TODOS os itens de um pedido.
   */
  async generateForOrder(orderId: string, organizationId: string): Promise<number> {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId, organizationId }
    });

    let count = 0;
    for (const item of items) {
      const op = await this.generateForOrderItem(item.id, organizationId);
      if (op) count++;
    }

    return count;
  }
}
