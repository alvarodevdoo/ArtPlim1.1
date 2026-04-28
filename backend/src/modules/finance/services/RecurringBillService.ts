import { PrismaClient, PayableStatus } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';

export interface CreateRecurringBillInput {
  organizationId: string;
  name: string;
  description?: string;
  amount: number;
  dueDay: number;
  categoryId?: string;
  supplierId?: string;
  active?: boolean;
}

export interface UpdateRecurringBillInput extends Partial<CreateRecurringBillInput> {}

export class RecurringBillService {
  constructor(private prisma: PrismaClient) {}

  /** Lista todas as contas recorrentes da organização */
  async list(organizationId: string) {
    return this.prisma.recurringBill.findMany({
      where: { organizationId },
      orderBy: [{ active: 'desc' }, { dueDay: 'asc' }]
    });
  }

  /** Cria uma nova conta recorrente */
  async create(input: CreateRecurringBillInput) {
    if (input.dueDay < 1 || input.dueDay > 31) {
      throw new AppError('O dia de vencimento deve estar entre 1 e 31.', 400);
    }
    if (input.amount <= 0) {
      throw new AppError('O valor deve ser maior que zero.', 400);
    }
    return this.prisma.recurringBill.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        amount: input.amount,
        dueDay: input.dueDay,
        categoryId: input.categoryId || null,
        supplierId: input.supplierId || null,
        active: input.active ?? true
      }
    });
  }

  /** Atualiza uma conta recorrente */
  async update(id: string, organizationId: string, input: UpdateRecurringBillInput) {
    const existing = await this.prisma.recurringBill.findFirst({ where: { id, organizationId } });
    if (!existing) throw new AppError('Conta recorrente não encontrada.', 404);

    if (input.dueDay !== undefined && (input.dueDay < 1 || input.dueDay > 31)) {
      throw new AppError('O dia de vencimento deve estar entre 1 e 31.', 400);
    }

    return this.prisma.recurringBill.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        amount: input.amount,
        dueDay: input.dueDay,
        categoryId: input.categoryId ?? undefined,
        supplierId: input.supplierId ?? undefined,
        active: input.active
      }
    });
  }

  /** Remove uma conta recorrente */
  async delete(id: string, organizationId: string) {
    const existing = await this.prisma.recurringBill.findFirst({ where: { id, organizationId } });
    if (!existing) throw new AppError('Conta recorrente não encontrada.', 404);
    return this.prisma.recurringBill.delete({ where: { id } });
  }

  /**
   * Gera AccountPayable para todas as contas recorrentes ativas
   * que ainda não foram geradas no mês/ano especificado.
   * 
   * Regra: só gera se `lastGeneratedAt` é nulo ou de um mês anterior ao solicitado.
   */
  async generateMonthlyPayables(organizationId: string, year: number, month: number) {
    const bills = await this.prisma.recurringBill.findMany({
      where: { organizationId, active: true }
    });

    const generated: string[] = [];
    const skipped: string[] = [];

    for (const bill of bills) {
      // Verifica se já foi gerado neste mês
      if (bill.lastGeneratedAt) {
        const lastDate = new Date(bill.lastGeneratedAt);
        if (lastDate.getFullYear() === year && lastDate.getMonth() + 1 === month) {
          skipped.push(bill.name);
          continue;
        }
      }

      // Calcula o dia de vencimento (ajusta para o último dia do mês se necessário)
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const dueDay = Math.min(bill.dueDay, lastDayOfMonth);
      const dueDate = new Date(year, month - 1, dueDay);

      await this.prisma.$transaction(async (tx) => {
        // Cria o AccountPayable
        const payable = await tx.accountPayable.create({
          data: {
            organizationId,
            supplierId: bill.supplierId || organizationId, // fallback para org se sem fornecedor
            amount: bill.amount,
            dueDate,
            status: PayableStatus.PENDING,
            notes: `[RECORRENTE] ${bill.name}${bill.description ? ' — ' + bill.description : ''}`
          }
        });

        // Atualiza o lastGeneratedAt
        await tx.recurringBill.update({
          where: { id: bill.id },
          data: { lastGeneratedAt: new Date() }
        });

        return payable;
      });

      generated.push(bill.name);
    }

    return { generated, skipped };
  }
}
