import { PrismaClient, PayableStatus } from '@prisma/client';

export class AccountPayableService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Lista todas as faturas agrapudas (Contas a Pagar).
   * Regra: Isolamento Multi-tenant
   */
  async listPayables(organizationId: string) {
    return this.prisma.accountPayable.findMany({
      where: {
        organizationId
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            document: true
          }
        },
        _count: {
          select: { receipts: true }
        }
      },
      orderBy: [
        { status: 'asc' }, // PENDING primeiro
        { dueDate: 'asc' } // Vencimentos mais próximos
      ]
    });
  }
}
