import { PrismaClient, OrderStatus, CommissionStatus } from '@prisma/client';

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

    // Regras de negócio: 
    // 1. Comissões são geradas quando o pedido é APROVADO (para o vendedor)
    // 2. Comissões de produção podem ser geradas quando o pedido é FINALIZADO
    
    if (order.status === OrderStatus.APPROVED || order.status === OrderStatus.FINISHED) {
      await this.calculateAndCreateEntries(order, organizationId, client);
    }
  }

  private async calculateAndCreateEntries(order: any, organizationId: string, client?: any) {
    const db = client || this.prisma;
    const rules = await db.commissionRule.findMany({
      where: { 
        organizationId,
        active: true 
      }
    });

    if (rules.length === 0) return;

    const commissionEntries = [];

    // Helper para processar um papel específico
    const processRole = (userId: string | null, roleKeys: string[], description: string) => {
      if (!userId) return;
      
      const rule = rules.find(r => 
        roleKeys.some(key => r.roleName.toLowerCase().includes(key.toLowerCase()))
      );

      if (rule) {
        const amount = (order.totalAmount * rule.percentage) / 100;
        commissionEntries.push({
          orderId: order.id,
          userId: userId,
          organizationId,
          amount,
          percentage: rule.percentage,
          roleName: rule.roleName,
          status: CommissionStatus.PENDING,
          description: `${description} - Pedido #${order.orderNumber || order.id.substring(0,8)}`,
        });
      }
    };

    // 1. Vendedor (Sales)
    processRole(order.sellerId, ['sales', 'vendedor'], 'Comissão de venda');

    // 2. Arte Finalista (Art)
    processRole(order.artDesignerId, ['art', 'arte', 'designer'], 'Comissão de arte final');

    // 3. Produção (Production)
    processRole(order.productionUserId, ['production', 'produção'], 'Comissão de produção');

    // 4. Embalagem (Packaging)
    processRole(order.packagingUserId, ['packaging', 'embalagem', 'pacote'], 'Comissão de embalagem');

    if (commissionEntries.length > 0) {
      for (const entry of commissionEntries) {
        const existing = await db.commissionEntry.findFirst({
          where: {
            orderId: entry.orderId,
            userId: entry.userId,
            roleName: entry.roleName
          }
        });

        if (!existing) {
          await db.commissionEntry.create({
            data: entry
          });
        }
      }
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
            totalAmount: true,
            status: true,
            customerName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}
