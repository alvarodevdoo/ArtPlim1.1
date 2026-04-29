import { ProfileBalanceService } from '../../../../modules/profiles/services/ProfileBalanceService';

export class OrderPaymentProcessor {
  private balanceService: ProfileBalanceService;

  constructor(private prisma: any) {
    // Nota: Passamos o prisma/tx para o serviço de saldo para consistência
    this.balanceService = new ProfileBalanceService(this.prisma);
  }

  async process(orderId: string, payments: any[], user: any) {
    const organizationId = user.organizationId;
    const userId = user.userId || user.id;

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

    // 2. Identificar transações a serem removidas (as que estão no banco mas não no array 'payments')
    const paymentIds = payments.map(p => p.id).filter(Boolean);
    const transactionsToRemove = existingTransactions.filter((t: any) => !paymentIds.includes(t.id));

    // 3. Buscar conta padrão e configurações da organização
    const [defaultAccount, settings] = await Promise.all([
      this.prisma.account.findFirst({
        where: { active: true, organizationId },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.organizationSettings.findUnique({
        where: { organizationId }
      })
    ]);

    await this.prisma.$transaction(async (tx: any) => {
      // Usar uma instância local do balanceService com o tx da transação para atomicidade
      const txBalanceService = new ProfileBalanceService(tx);

      // A. Remover transações e estornar saldo se necessário
      for (const t of transactionsToRemove) {
        if (t.isVirtual || t.paymentMethodId === 'BALANCE') { 
           // Estornar crédito de saldo do cliente
           await txBalanceService.addCredit({
             profileId: order.customerId,
             organizationId,
             amount: Number(t.amount),
             description: `Estorno Pagamento Pedido #${order.orderNumber} (Remoção)`,
             orderId: order.id,
             userId
           });
        }
        
        // Deletar a transação
        await tx.transaction.delete({ where: { id: t.id } });

        // Registrar no histórico do pedido
        try {
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: order.status,
              notes: `Pagamento removido: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.amount))}`,
              userId: userId
            }
          });
        } catch (err) {
          console.error('[OrderPaymentProcessor] Erro ao gravar histórico de remoção de pagamento:', err);
        }
      }

      // B. Adicionar ou atualizar transações
      for (const p of payments) {
        const isInternalBalance = p.methodId === 'BALANCE';
        
        if (!p.id) {
          // NOVO PAGAMENTO
          if (isInternalBalance) {
            // Se for saldo, o ProfileBalanceService.useCredit já cria a transação INCOME virtual
            await txBalanceService.useCredit({
              profileId: order.customerId,
              organizationId,
              amount: Number(p.amount),
              description: `Pagamento Pedido #${order.orderNumber}`,
              orderId: order.id,
              userId
            });
          } else {
            // Pagamento normal (Pix, Cartão, etc)
            let accountId = defaultAccount?.id;
            
            // Tentar pegar a conta vinculada ao método de pagamento
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

            // Registrar no histórico do pedido
            try {
              await tx.orderStatusHistory.create({
                data: {
                  orderId: order.id,
                  fromStatus: order.status,
                  toStatus: order.status,
                  notes: `Pagamento registrado: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.amount)}`,
                  userId: userId
                }
              });
            } catch (err) {
              console.error('[OrderPaymentProcessor] Erro ao gravar histórico de pagamento:', err);
            }
          }
        } else {
          // PAGAMENTO EXISTENTE - Verificar se mudou o valor (especialmente para BALANCE)
          const existing = existingTransactions.find((t: any) => t.id === p.id);
          if (existing && isInternalBalance && Number(existing.amount) !== Number(p.amount)) {
             const diff = Number(p.amount) - Number(existing.amount);
             if (diff > 0) {
                // Aumentou o uso de saldo
                await txBalanceService.useCredit({
                  profileId: order.customerId,
                  organizationId,
                  amount: diff,
                  description: `Ajuste Pagamento Pedido #${order.orderNumber}`,
                  orderId: order.id,
                  userId
                });
             } else {
                // Diminuiu o uso de saldo (devolve a diferença)
                await txBalanceService.addCredit({
                  profileId: order.customerId,
                  organizationId,
                  amount: Math.abs(diff),
                  description: `Ajuste Pagamento Pedido #${order.orderNumber}`,
                  orderId: order.id,
                  userId
                });
             }
             
             // Atualizar o valor na transação original (a que não é virtual) 
             // Nota: useCredit/addCredit criam NOVAS transações de ajuste.
             // Para manter o histórico limpo, talvez devêssemos consolidar, mas por segurança
             // vamos apenas atualizar a transação principal se ela existir.
             await tx.transaction.update({
               where: { id: p.id },
               data: { amount: p.amount }
             });
          } else if (existing && !isInternalBalance && Number(existing.amount) !== Number(p.amount)) {
             // Atualização de valor de pagamento normal
             await tx.transaction.update({
               where: { id: p.id },
               data: { 
                 amount: p.amount,
                 paymentMethodId: p.methodId,
                 paidAt: p.date ? new Date(p.date) : existing.paidAt
               }
             });
          }
        }
      }
    });
  }
}
