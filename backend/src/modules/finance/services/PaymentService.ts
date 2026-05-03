import { PrismaClient, PayableStatus, TransactionType, TransactionStatus } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';
import { ProfileBalanceService } from '../../profiles/services/ProfileBalanceService';

export interface PayBillInput {
  organizationId: string;
  payableId: string;
  paymentAccountId: string; // Caixa/Bancos (ativo que sai)
  supplierAccountId: string; // Fornecedores a Pagar (passivo que é baixado)
  paymentMethodId?: string;
  amountPaid: number;
  notes?: string;
  categoryId?: string;
  userId: string;
}

export class PaymentService {
  private balanceService: ProfileBalanceService;
  constructor(private prisma: PrismaClient) {
    this.balanceService = new ProfileBalanceService(this.prisma);
  }

  /**
   * Paga uma conta a pagar (AccountPayable), realizando o lançamento
   * de Partidas Dobradas correto para liquidação:
   *
   *   DÉBITO  → Conta de Fornecedores a Pagar (Passivo ↓) – baixa a obrigação
   *   CRÉDITO → Conta Caixa/Banco (Ativo ↓)               – sai dinheiro
   *
   * Desta forma, o lançamento NÃO interfere no DRE (INCOME/EXPENSE),
   * pois trata-se de uma movimentação patrimonial, não de resultado.
   *
   * Regras Estritas:
   * 1. Isolamento Multi-tenant (organizationId em todos os where)
   * 2. Prevenção de Concorrência (status: PENDING no findFirst e update)
   * 3. Rastreabilidade (payableId vinculada a cada Transaction gerada)
   */
  async payBill(input: PayBillInput) {
    const {
      organizationId,
      payableId,
      paymentAccountId,
      supplierAccountId,
      paymentMethodId,
      amountPaid,
      notes,
      categoryId,
      userId
    } = input;

    if (amountPaid <= 0) {
      throw new AppError('O valor pago deve ser maior que zero.', 400);
    }

    return await this.prisma.$transaction(async (tx) => {
      // ── 1. Buscar e validar a Fatura
      const payable = await tx.accountPayable.findFirst({
        where: {
          id: payableId,
          organizationId,
          status: PayableStatus.PENDING
        }
      });

      if (!payable) {
        throw new AppError(
          'Fatura não encontrada, já liquidada ou pertencente a outra organização.',
          404
        );
      }

      if (amountPaid > Number(payable.amount)) {
        throw new AppError('O valor pago não pode ser maior que o valor da fatura.', 400);
      }

      const updatedPayable = await tx.accountPayable.update({
        where: {
          id: payableId,
          organizationId,
          status: PayableStatus.PENDING
        },
        data: {
          status: amountPaid >= Number(payable.amount) ? PayableStatus.PAID : PayableStatus.PENDING,
          notes: notes ? `${payable.notes ?? ''}\nPGTO: ${notes}` : payable.notes
        }
      });

      const today = new Date();

      // ── 2. PARTIDAS DOBRADAS (Auditoria incluída)

      // 2a. DÉBITO – Passivo: Fornecedores a Pagar
      await tx.transaction.create({
        data: {
          organizationId,
          accountId: supplierAccountId,
          type: TransactionType.DEBIT,
          amount: amountPaid,
          description: `Baixa Fatura Fornecedor #${payable.id.slice(-8)}`,
          dueDate: today,
          status: TransactionStatus.PAID,
          paidAt: today,
          categoryId,
          paymentMethodId,
          payableId: payable.id,
          userId,
          profileId: payable.supplierId
        }
      });

      await tx.account.update({
        where: { id: supplierAccountId, organizationId },
        data: { balance: { decrement: amountPaid } }
      });

      // 2b. CRÉDITO – Ativo: Caixa/Banco
      await tx.transaction.create({
        data: {
          organizationId,
          accountId: paymentAccountId,
          type: TransactionType.CREDIT,
          amount: amountPaid,
          description: `Pagamento Fatura Fornecedor #${payable.id.slice(-8)}`,
          dueDate: today,
          status: TransactionStatus.PAID,
          paidAt: today,
          categoryId,
          paymentMethodId,
          payableId: payable.id,
          userId,
          profileId: payable.supplierId
        }
      });

      await tx.account.update({
        where: { id: paymentAccountId, organizationId },
        data: { balance: { decrement: amountPaid } }
      });

      return updatedPayable;
    });
  }

  /**
   * Recebe o pagamento de uma conta a receber (AccountReceivable), realizando
   * a liquidação patrimonial correta:
   *
   *   DÉBITO  → Conta Caixa/Banco (Ativo ↑)               – entra dinheiro
   *   CRÉDITO → Conta de Contas a Receber (Ativo ↓)       – baixa o direito
   *   EXPENSE → Categoria de Taxas (Resultado ↓)          – se houver taxa (ex: cartão)
   *
   * @param input Dados da liquidação
   */
  async receiveReceivablePayment(input: {
    organizationId: string;
    receivableId: string;
    paymentAccountId: string;   // Banco/Caixa onde o dinheiro entra
    receivableAccountId: string; // Conta de Ativo "Contas a Receber" que será baixada
    paymentMethodId: string;
    amountPaid: number;          // Valor bruto pago pelo cliente
    feeAmount?: number;          // Valor da taxa descontada (ex: operadora)
    feeCategoryId?: string;      // Categoria de despesa para a taxa
    notes?: string;
    userId: string;
  }) {
    const {
      organizationId,
      receivableId,
      paymentAccountId,
      receivableAccountId,
      paymentMethodId,
      amountPaid,
      feeAmount = 0,
      feeCategoryId,
      notes,
      userId
    } = input;

    if (amountPaid <= 0) {
      throw new AppError('O valor recebido deve ser maior que zero.', 400);
    }

    // Se não informou conta (ex: pagamento via Saldo), tenta pegar a conta padrão
    let finalAccountId = paymentAccountId;
    if (!finalAccountId) {
      const defaultAccount = await this.prisma.account.findFirst({
        where: { organizationId, active: true }
      });
      finalAccountId = defaultAccount?.id || '';
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Validar recebível
      const receivable = await (tx as any).accountReceivable.findFirst({
        where: { id: receivableId, organizationId, status: 'PENDING' }
      });

      if (!receivable) {
        throw new AppError('Conta a receber não encontrada ou já liquidada.', 404);
      }

      const today = new Date();
      const netAmount = amountPaid - feeAmount;

      // 1.1 Verificar tipo do método de pagamento
      let isInternalBalance = paymentMethodId === 'BALANCE';
      let paymentMethod = null;

      if (!isInternalBalance) {
        paymentMethod = await tx.paymentMethod.findUnique({
          where: { id: paymentMethodId }
        });
        isInternalBalance = paymentMethod?.type === 'CUSTOMER_BALANCE';
      }

      if (isInternalBalance) {
        // Se for saldo interno, usar o serviço de saldo
        await this.balanceService.useCredit({
          profileId: receivable.customerId,
          organizationId,
          amount: amountPaid,
          description: `Pagamento de Recebível #${receivable.id.slice(-8)} via Saldo Interno`,
          orderId: receivable.orderId || '',
          userId
        });
      }

      // 2. Calcular total já pago (incluindo transações CREDIT vinculadas)
      const existingPayments = await tx.transaction.aggregate({
        where: { receivableId, type: TransactionType.CREDIT, status: TransactionStatus.PAID },
        _sum: { amount: true }
      });
      
      const totalPaidSoFar = Number(existingPayments._sum.amount || 0) + amountPaid;
      const isFullyPaid = totalPaidSoFar >= Number(receivable.amount) - 0.01; // Tolerância de centavos

      // 3. Atualizar Recebível
      await (tx as any).accountReceivable.update({
        where: { id: receivableId },
        data: {
          status: isFullyPaid ? 'PAID' : 'PENDING',
          notes: notes ? `${receivable.notes ?? ''}\nPGTO (${today.toLocaleDateString()}): ${notes}` : receivable.notes
        }
      });

      // 3. PARTIDAS DOBRADAS

      // 3a. DÉBITO – Ativo: Caixa/Banco (Entrada Líquida)
      await tx.transaction.create({
        data: {
          organizationId,
          accountId: finalAccountId,
          type: TransactionType.DEBIT,
          amount: netAmount,
          description: isInternalBalance ? `[VIRTUAL] Recebimento Pedido #${receivable.orderId?.slice(-8)}` : `Recebimento Pedido #${receivable.orderId?.slice(-8)}`,
          status: TransactionStatus.PAID,
          paidAt: today,
          paymentMethodId: isInternalBalance ? null : paymentMethodId,
          receivableId: receivable.id,
          orderId: receivable.orderId,
          isVirtual: isInternalBalance, // Se for saldo, é virtual
          userId,
          profileId: receivable.customerId
        }
      });
      
      if (!isInternalBalance) {
        await tx.account.update({
          where: { id: finalAccountId, organizationId },
          data: { balance: { increment: netAmount } }
        });
      }

      // 3b. CRÉDITO – Ativo: Contas a Receber (Baixa Bruta)
      await tx.transaction.create({
        data: {
          organizationId,
          accountId: receivableAccountId,
          type: TransactionType.CREDIT,
          amount: amountPaid,
          description: `Baixa de Recebível #${receivable.id.slice(-8)}`,
          status: TransactionStatus.PAID,
          paidAt: today,
          paymentMethodId,
          receivableId: receivable.id,
          orderId: receivable.orderId,
          isVirtual: isInternalBalance, // Se for saldo, é virtual
          userId,
          profileId: receivable.customerId
        }
      });

      if (!isInternalBalance) {
        await tx.account.update({
          where: { id: receivableAccountId, organizationId },
          data: { balance: { decrement: amountPaid } }
        });
      }

      // 3c. DESPESA – Resultado: Taxas de Pagamento (Se houver)
      if (feeAmount > 0 && feeCategoryId) {
        await tx.transaction.create({
          data: {
            organizationId,
            accountId: paymentAccountId, // Registramos na conta de entrada para conciliação
            type: TransactionType.EXPENSE,
            amount: feeAmount,
            description: `Taxa de Pagamento - Pedido #${receivable.orderId?.slice(-8)}`,
            status: TransactionStatus.PAID,
            paidAt: today,
            categoryId: feeCategoryId,
            paymentMethodId,
            receivableId: receivable.id,
            orderId: receivable.orderId,
            userId,
            profileId: receivable.customerId
          }
        });
        // Note: O saldo da conta já foi atualizado pelo valor LÍQUIDO (netAmount).
        // A transação de EXPENSE serve para o DRE e conciliação, mas não subtraímos de novo da conta.
      }

      return receivable;
    });
  }
}
