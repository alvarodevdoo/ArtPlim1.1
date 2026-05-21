import { PrismaClient, OrderStatus } from '@prisma/client';

export class CommissionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Processa as comissões de um pedido baseado no seu status atual.
   * Geralmente chamado quando o pedido é APROVADO ou FINALIZADO.
   */
  async processOrderCommissions(orderId: string, organizationId: string, tx?: any) {
    const client = tx || this.prisma;
    
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: {
        seller: true,
        items: true,
      },
    });

    if (!order || order.organizationId !== organizationId) {
      throw new Error('Pedido não encontrado ou acesso negado');
    }

    // Verifica se as comissões estão habilitadas globalmente para a organização
    const settings = await client.organizationSettings.findUnique({
      where: { organizationId }
    });

    if (settings && !settings.enableCommissions) {
      // Se estiver desabilitado, remove entradas existentes (caso o pedido tenha sido re-processado) e retorna
      await client.commissionEntry.deleteMany({
        where: { orderId }
      });
      return;
    }

    if (order.status === OrderStatus.APPROVED || order.status === OrderStatus.FINISHED || order.status === OrderStatus.DELIVERED) {
      await this.calculateAndCreateEntries(order, organizationId, client);
    }
  }

  private async calculateAndCreateEntries(order: any, organizationId: string, client?: any) {
    const db = client || this.prisma;
    
    // Busca as regras ativas incluindo as roles para validar o nome/descrição
    const rules = await db.commissionRule.findMany({
      where: { 
        organizationId,
        active: true 
      },
      include: {
        role: true
      }
    });

    if (rules.length === 0) return;

    // Remove entradas antigas para esse pedido, para evitar duplicação em caso de re-processamento
    await db.commissionEntry.deleteMany({
      where: { orderId: order.id }
    });

    const commissionEntries: any[] = [];

    // Base de cálculo é o Total do Pedido, ou a soma das comissões dos itens (OrderItem.commissionAmount)
    // Se a regra diz que é X% do pedido, pegamos o order.total.
    const baseAmount = Number(order.total || 0);

    // Helper para processar um papel específico
    const processRole = (userId: string | null, roleKeys: string[], description: string) => {
      if (!userId) return;
      
      const rule = rules.find((r: any) => 
        roleKeys.some(key => r.role.name.toLowerCase().includes(key.toLowerCase()) || r.role.name === key)
      );

      if (rule) {
        // Se a taxa for 5, significa 5%.
        const rate = Number(rule.rate);
        const amount = (baseAmount * rate) / 100;
        
        commissionEntries.push({
          orderId: order.id,
          userId: userId,
          roleId: rule.roleId,
          organizationId,
          amount,
          rateApplied: rate,
          status: 'PENDING',
          categoryId: rule.categoryId ?? null,
          description: `${description} - Pedido #${order.orderNumber || order.id.substring(0,8)}`,
        });
      }
    };

    // 1. Vendedor (Sales / Vendas / Vendedor)
    processRole(order.sellerId, ['sales', 'vendedor', 'vendas'], 'Comissão de venda');

    // 2. Arte Finalista (Art / Arte / Designer)
    processRole(order.artDesignerId, ['art', 'arte', 'designer'], 'Comissão de arte final');

    // 3. Produção (Production / Produção)
    processRole(order.productionUserId, ['production', 'produção'], 'Comissão de produção');

    // 4. Embalagem (Packaging / Embalagem / Acabamento)
    processRole(order.packagingUserId, ['packaging', 'embalagem', 'acabamento'], 'Comissão de embalagem');

    if (commissionEntries.length > 0) {
      await db.commissionEntry.createMany({
        data: commissionEntries
      });
    }
  }

  /**
   * Retorna o relatório de comissões de um usuário.
   */
  async getUserCommissionReport(userId: string, organizationId: string, startDate?: Date, endDate?: Date) {
    return this.prisma.commissionEntry.findMany({
      where: {
        userId,
        organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            customer: {
               select: { name: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}
