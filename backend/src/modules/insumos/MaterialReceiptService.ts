import { PrismaClient, ReceiptStatus } from '@prisma/client';
import { AppError } from '../../shared/infrastructure/errors/AppError';

export interface CreateReceiptInput {
  organizationId: string;
  supplierId: string;
  invoiceNumber?: string;
  totalAmount: number;
  issueDate?: Date;
}

export class MaterialReceiptService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Lista recibos pendentes (ainda não faturados).
   * Regra: Isolamento Multi-tenant
   */
  async listPending(organizationId: string) {
    return this.prisma.materialReceipt.findMany({
      where: {
        organizationId,
        status: ReceiptStatus.PENDING
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            document: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Cria um novo recibo físico de entrada de material.
   * Regra: Isolamento Multi-tenant
   */
  async createReceipt(input: CreateReceiptInput) {
    if (input.totalAmount <= 0) {
      throw new AppError('O valor total do recibo deve ser maior que zero.', 400);
    }

    return this.prisma.materialReceipt.create({
      data: {
        organizationId: input.organizationId,
        supplierId: input.supplierId,
        invoiceNumber: input.invoiceNumber,
        totalAmount: input.totalAmount,
        issueDate: input.issueDate || new Date(),
        status: ReceiptStatus.PENDING
      }
    });
  }
}
