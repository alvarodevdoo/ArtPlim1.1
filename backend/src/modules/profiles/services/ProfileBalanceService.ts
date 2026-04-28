import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../../shared/infrastructure/errors/AppError';

export class ProfileBalanceService {
  constructor(private prisma: any) {}

  /**
   * Adiciona crédito ao saldo do cliente (ex: por cancelamento de pedido)
   */
  async addCredit(params: {
    profileId: string;
    organizationId: string;
    amount: number;
    description: string;
    orderId?: string;
    userId?: string;
  }) {
    const { profileId, organizationId, amount, description, orderId } = params;

    if (amount <= 0) {
      throw new ValidationError('O valor do crédito deve ser maior que zero');
    }

    return await this.prisma.$transaction(async (tx: any) => {
      // 1. Criar a movimentação de saldo (Extrato do Cliente)
      const movement = await tx.profileBalanceMovement.create({
        data: {
          organizationId,
          profileId,
          amount,
          type: 'CREDIT',
          description,
          orderId
        }
      });

      // 2. Incrementar o saldo no perfil do cliente
      await tx.profile.update({
        where: { id: profileId },
        data: { balance: { increment: amount } }
      });

      // 3. Registrar Transação Virtual para Estorno no DRE (sem afetar Fluxo de Caixa)
      // Buscamos uma categoria de estorno ou usamos a padrão de receita
      const settings = await tx.organizationSettings.findUnique({
        where: { organizationId }
      });

      const account = await tx.account.findFirst({
        where: { organizationId, active: true },
        orderBy: { createdAt: 'asc' }
      });

      if (account) {
        await tx.transaction.create({
          data: {
            organizationId,
            accountId: account.id,
            type: 'EXPENSE', // Estorno de venda entra como despesa/redutor no DRE
            amount,
            description: `[CRÉDITO GERADO] ${description}`,
            categoryId: settings?.defaultRevenueCategoryId,
            orderId,
            profileId,
            status: 'PAID',
            paidAt: new Date(),
            isVirtual: true, // Crucial: Ignora no Fluxo de Caixa, conta no DRE
            userId: params.userId
          }
        });
      }

      return movement;
    });
  }

  /**
   * Consome saldo do cliente para pagamento de pedido
   */
  async useCredit(params: {
    profileId: string;
    organizationId: string;
    amount: number;
    description: string;
    orderId: string;
    userId?: string;
  }) {
    const { profileId, organizationId, amount, description, orderId } = params;

    if (amount <= 0) {
      throw new ValidationError('O valor do débito deve ser maior que zero');
    }

    return await this.prisma.$transaction(async (tx: any) => {
      // 1. Verificar se o cliente tem saldo suficiente
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { balance: true, name: true }
      });

      if (!profile || Number(profile.balance) < amount) {
        throw new ValidationError(`Saldo insuficiente. O cliente ${profile?.name || ''} possui apenas R$ ${profile?.balance || '0,00'}`);
      }

      // 2. Criar a movimentação de saldo (Extrato do Cliente)
      const movement = await tx.profileBalanceMovement.create({
        data: {
          organizationId,
          profileId,
          amount: amount, // Guardamos o valor absoluto do débito ou negativo? 
          // Por padrão extratos costumam salvar o valor da operação. 
          // Mas vamos seguir o padrão de 'DEBIT' para sinalizar sinal.
          type: 'DEBIT',
          description,
          orderId
        }
      });

      // 3. Decrementar o saldo no perfil do cliente
      await tx.profile.update({
        where: { id: profileId },
        data: { balance: { decrement: amount } }
      });

      // 4. Registrar Transação Virtual para Receita no DRE (Venda confirmada)
      const settings = await tx.organizationSettings.findUnique({
        where: { organizationId }
      });

      const account = await tx.account.findFirst({
        where: { organizationId, active: true },
        orderBy: { createdAt: 'asc' }
      });

      if (account) {
        await tx.transaction.create({
          data: {
            organizationId,
            accountId: account.id,
            type: 'INCOME', // Uso de crédito conta como receita no DRE
            amount,
            description: `[USO DE SALDO] ${description}`,
            categoryId: settings?.defaultRevenueCategoryId,
            orderId,
            profileId,
            status: 'PAID',
            paidAt: new Date(),
            isVirtual: true, // Crucial: Ignora no Fluxo de Caixa, conta no DRE
            userId: params.userId
          }
        });
      }

      return movement;
    });
  }
}
