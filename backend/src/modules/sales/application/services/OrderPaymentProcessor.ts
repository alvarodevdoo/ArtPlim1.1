import { ProfileBalanceService } from '../../../../modules/profiles/services/ProfileBalanceService';

export class OrderPaymentProcessor {
  private balanceService: ProfileBalanceService;

  constructor(private prisma: any) {
    // Nota: Passamos o prisma/tx para o serviço de saldo para consistência
    this.balanceService = new ProfileBalanceService(this.prisma);
  }

  async process(orderId: string, payments: any[], user: any) {
    const organizationId = user.organizationId;
    const userId = user.userId || user.id || user.sub || 'system';

    if (!payments) return;

    // 1. Buscar pedido para pegar o customerId e total
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        customer: true,
        transactions: {
          where: { 
            type: 'INCOME',
            status: { not: 'CANCELLED' }
          }
        }
      }
    });

    if (!order) return;

    const existingTransactions = order.transactions || [];
    const paymentIds = payments.map(p => p.id).filter(Boolean);
    const transactionsToRemove = existingTransactions.filter((t: any) => !paymentIds.includes(t.id));

    const [defaultAccount, settings] = await Promise.all([
      this.prisma.account.findFirst({
        where: { active: true, organizationId },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.organizationSettings.findUnique({
        where: { organizationId }
      })
    ]);

    let historyNotes: string[] = [];

    await this.prisma.$transaction(async (tx: any) => {
      const txBalanceService = new ProfileBalanceService(tx);

      // A. Remover transações
      for (const t of transactionsToRemove) {
        if (t.isVirtual || t.paymentMethodId === 'BALANCE') { 
           await txBalanceService.addCredit({
             profileId: order.customerId,
             organizationId,
             amount: Number(t.amount),
             description: `Estorno Pagamento Pedido #${order.orderNumber} (Remoção)`,
             orderId: order.id,
             userId
           });
        }
        
        await tx.transaction.delete({ where: { id: t.id } });
        historyNotes.push(`Pagamento removido: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.amount))}`);
      }

      // B. Adicionar ou atualizar transações
      for (const p of payments) {
        const isInternalBalance = p.methodId === 'BALANCE';
        
        if (!p.id) {
          if (isInternalBalance) {
            await txBalanceService.useCredit({
              profileId: order.customerId,
              organizationId,
              amount: Number(p.amount),
              description: `Pagamento Pedido #${order.orderNumber}`,
              orderId: order.id,
              userId
            });
          } else {
            let accountId = defaultAccount?.id;
            if (p.methodId) {
              const method = await tx.paymentMethod.findUnique({ where: { id: p.methodId } });
              if (method?.accountId) accountId = method.accountId;
            }

            await tx.transaction.create({
              data: {
                organizationId,
                accountId: accountId || '',
                type: 'INCOME',
                amount: p.amount,
                description: `Pagamento Pedido ${order.orderNumber}`,
                status: 'PAID',
                paidAt: p.date ? new Date(p.date) : new Date(),
                paymentMethodId: p.methodId,
                orderId: order.id,
                profileId: order.customerId,
                isVirtual: false,
                userId,
                categoryId: settings?.defaultRevenueCategoryId
              }
            });
          }
          historyNotes.push(`Pagamento registrado: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.amount)}`);
        } else {
          const existing = existingTransactions.find((t: any) => t.id === p.id);
          if (existing && Number(existing.amount) !== Number(p.amount)) {
             if (isInternalBalance) {
                const diff = Number(p.amount) - Number(existing.amount);
                if (diff > 0) {
                   await txBalanceService.useCredit({
                     profileId: order.customerId,
                     organizationId,
                     amount: diff,
                     description: `Ajuste Pagamento Pedido #${order.orderNumber}`,
                     orderId: order.id,
                     userId
                   });
                } else {
                   await txBalanceService.addCredit({
                     profileId: order.customerId,
                     organizationId,
                     amount: Math.abs(diff),
                     description: `Ajuste Pagamento Pedido #${order.orderNumber}`,
                     orderId: order.id,
                     userId
                   });
                }
             }
             
             await tx.transaction.update({
               where: { id: p.id },
               data: { 
                 amount: p.amount,
                 paymentMethodId: p.methodId,
                 paidAt: p.date ? new Date(p.date) : existing.paidAt
               }
             });
             historyNotes.push(`Pagamento alterado de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(existing.amount))} para ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.amount)}`);
          }
        }
      }

      // Criar entrada única de histórico se houve mudanças
      if (historyNotes.length > 0) {
        try {
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: order.status,
              notes: `[Financeiro] ${historyNotes.join('; ')}`,
              userId: userId
            }
          });
        } catch (err) {
          console.error('[OrderPaymentProcessor] Erro ao gravar histórico consolidado:', err);
        }
      }
    });
  }
}
