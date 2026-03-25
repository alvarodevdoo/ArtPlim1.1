import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';
import { AccountService } from './services/AccountService';
import { TransactionService } from './services/TransactionService';
import { CategoryService } from './services/CategoryService';
import { AccountPayableService } from './services/AccountPayableService';
import { PaymentService } from './services/PaymentService';
import { ReceivableService } from './services/ReceivableService';
import { FinancialReportService } from './services/FinancialReportService';
import { AccountType, TransactionType, CategoryType, ChartOfAccountType } from '@prisma/client';

const listQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  days: z.string().transform(val => parseInt(val) || 30).optional(),
  accountId: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  categoryId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

const createAccountSchema = z.object({
  name: z.string(),
  type: z.nativeEnum(AccountType),
  balance: z.number().default(0),
  bank: z.string().optional().nullable(),
  agency: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable()
});

const createCategorySchema = z.object({
  name: z.string(),
  type: z.nativeEnum(CategoryType),
  color: z.string().optional().nullable(),
  parentId: z.string().optional().nullable()
});

const createTransactionSchema = z.object({
  accountId: z.string(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  amount: z.number().min(0.01),
  description: z.string(),
  categoryId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  profileId: z.string().optional().nullable()
});

const createChartAccountSchema = z.object({
  code: z.string(),
  name: z.string(),
  type: z.nativeEnum(ChartOfAccountType)
});

export async function financeRoutes(fastify: FastifyInstance) {

  // ========== CONTAS ==========

  fastify.get('/accounts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const accountService = new AccountService(prisma);
    const accounts = await accountService.list(request.user!.organizationId);
    return reply.send({ success: true, data: accounts });
  });

  fastify.get('/chart-of-accounts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const chartOfAccounts = await prisma.chartOfAccount.findMany({
      where: { organizationId: request.user!.organizationId, active: true },
      orderBy: { code: 'asc' }
    });
    return reply.send({ success: true, data: chartOfAccounts });
  });

  fastify.post('/chart-of-accounts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const data = createChartAccountSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    try {
      const account = await prisma.chartOfAccount.create({
        data: {
          code: data.code,
          name: data.name,
          type: data.type,
          organizationId: request.user!.organizationId
        }
      });
      return reply.code(201).send({ success: true, data: account });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ success: false, message: 'Já existe uma conta cadastrada com este código.' });
      }
      throw error;
    }
  });

  fastify.put('/chart-of-accounts/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = createChartAccountSchema.partial().parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    
    const updateData: any = {};
    if (data.code !== undefined) updateData.code = data.code;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;

    try {
      const account = await prisma.chartOfAccount.update({
        where: { id, organizationId: request.user!.organizationId },
        data: updateData
      });
      return reply.send({ success: true, data: account });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ success: false, message: 'Já existe outra conta cadastrada com este código.' });
      }
      throw error;
    }
  });

  fastify.delete('/chart-of-accounts/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    await prisma.chartOfAccount.update({
      where: { id, organizationId: request.user!.organizationId },
      data: { active: false }
    });
    return reply.send({ success: true, message: 'Conta removida' });
  });

  fastify.post('/accounts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const data = createAccountSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const accountService = new AccountService(prisma);
    const account = await accountService.create({
      ...data,
      organizationId: request.user!.organizationId,
      bank: data.bank || undefined,
      agency: data.agency || undefined,
      accountNumber: data.accountNumber || undefined
    });
    return reply.code(201).send({ success: true, data: account });
  });

  fastify.put('/accounts/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = createAccountSchema.partial().parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const accountService = new AccountService(prisma);
    
    // Remapeando nullable para optional
    const updateData: any = { ...data };
    if (updateData.bank === null) updateData.bank = undefined;
    if (updateData.agency === null) updateData.agency = undefined;
    if (updateData.accountNumber === null) updateData.accountNumber = undefined;

    const account = await accountService.update(id, request.user!.organizationId, updateData);
    return reply.send({ success: true, data: account });
  });

  // ========== CATEGORIAS ==========

  fastify.get('/categories', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { type } = request.query as { type?: CategoryType };
    const prisma = getTenantClient(request.user!.organizationId);
    const categoryService = new CategoryService(prisma);
    const categories = await categoryService.list(request.user!.organizationId, type);
    return reply.send({ success: true, data: categories });
  });

  fastify.post('/categories', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const data = createCategorySchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const categoryService = new CategoryService(prisma);
    const category = await categoryService.create({
      ...data,
      organizationId: request.user!.organizationId,
      color: data.color || undefined,
      parentId: data.parentId || undefined
    });
    return reply.code(201).send({ success: true, data: category });
  });

  fastify.delete('/categories/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const categoryService = new CategoryService(prisma);
    try {
      await categoryService.delete(id, request.user!.organizationId);
      return reply.send({ success: true, message: 'Categoria removida' });
    } catch (error: any) {
      return reply.code(400).send({ success: false, message: error.message });
    }
  });

  // ========== TRANSAÇÕES ==========

  fastify.get('/transactions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const transactionService = new TransactionService(prisma);
    
    const transactions = await transactionService.list(request.user!.organizationId, {
      accountId: query.accountId,
      type: query.type,
      status: query.status,
      categoryId: query.categoryId,
      startDate: query.startDate,
      endDate: query.endDate
    });

    return reply.send({ success: true, data: transactions });
  });

  fastify.post('/transactions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const data = createTransactionSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const transactionService = new TransactionService(prisma);
    
    const transaction = await transactionService.create({
      ...data,
      organizationId: request.user!.organizationId,
      categoryId: data.categoryId || undefined,
      orderId: data.orderId || undefined,
      dueDate: data.dueDate || undefined,
      userId: request.user!.userId,
      profileId: data.profileId || undefined
    });

    return reply.code(201).send({ success: true, data: transaction });
  });

  fastify.patch('/transactions/:id/pay', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const transactionService = new TransactionService(prisma);
    
    try {
      const transaction = await transactionService.markAsPaid(id, request.user!.organizationId);
      return reply.send({ success: true, data: transaction });
    } catch (error: any) {
      return reply.code(400).send({ success: false, message: error.message });
    }
  });

  // ========== DASHBOARD ==========

  fastify.get('/dashboard', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const transactionService = new TransactionService(prisma);
    
    const dashboard = await transactionService.getDashboard(request.user!.organizationId, {
      startDate: query.startDate,
      endDate: query.endDate,
      days: query.days
    });

    return reply.send({ success: true, data: dashboard });
  });

  // ========== CONTAS A PAGAR (FORNECEDORES) ==========
  const payBillSchema = z.object({
    paymentAccountId: z.string().uuid('Conta bancária inválida'),
    supplierAccountId: z.string().uuid('Conta do fornecedor inválida'),
    paymentMethodId: z.string().optional(),
    amountPaid: z.number().positive(),
    notes: z.string().optional(),
    categoryId: z.string().optional()
  });

  fastify.get('/payables', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const payableService = new AccountPayableService(prisma);
    const payables = await payableService.listPayables(request.user!.organizationId);
    return reply.send({ success: true, data: payables });
  });

  fastify.post('/payables/:id/pay', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = payBillSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const paymentService = new PaymentService(prisma);

    const updatedPayable = await paymentService.payBill({
      organizationId: request.user!.organizationId,
      payableId: id,
      paymentAccountId: body.paymentAccountId,
      supplierAccountId: body.supplierAccountId,
      paymentMethodId: body.paymentMethodId,
      amountPaid: body.amountPaid,
      notes: body.notes,
      categoryId: body.categoryId,
      userId: request.user!.userId
    });

    return reply.send({ success: true, data: updatedPayable });
  });

  // ========== CONTAS A RECEBER ==========

  const createReceivableSchema = z.object({
    customerId: z.string().uuid('Cliente inválido'),
    orderId: z.string().uuid().optional(),
    amount: z.number().positive('Valor deve ser positivo'),
    dueDate: z.string(),
    receivableAccountId: z.string().uuid('Conta de Ativo inválida'),
    revenueAccountId: z.string().uuid('Conta de Receita inválida'),
    notes: z.string().optional(),
    categoryId: z.string().optional()
  });

  fastify.post('/receivables', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = createReceivableSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new ReceivableService(prisma);

    const receivable = await service.createReceivableFromOrder({
      organizationId: request.user!.organizationId,
      customerId: body.customerId,
      orderId: body.orderId,
      amount: body.amount,
      dueDate: new Date(body.dueDate),
      receivableAccountId: body.receivableAccountId,
      revenueAccountId: body.revenueAccountId,
      notes: body.notes,
      categoryId: body.categoryId,
      userId: request.user!.userId
    });

    return reply.code(201).send({ success: true, data: receivable });
  });

  fastify.get('/receivables', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new ReceivableService(prisma);
    const receivables = await service.listReceivables(request.user!.organizationId);
    return reply.send({ success: true, data: receivables });
  });

  // ========== RELATÓRIOS FINANCEIROS ==========

  const periodQuerySchema = z.object({
    startDate: z.string(),
    endDate: z.string()
  });

  const cashFlowQuerySchema = periodQuerySchema.extend({
    bankAccountIds: z.string() // CSV de IDs: ?bankAccountIds=id1,id2
  });

  // GET /api/finance/reports/dre?startDate=2025-01-01&endDate=2025-12-31
  fastify.get('/reports/dre', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = periodQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new FinancialReportService(prisma);

    const dre = await service.getDRE({
      organizationId: request.user!.organizationId,
      startDate: new Date(query.startDate),
      endDate: new Date(query.endDate)
    });

    return reply.send({ success: true, data: dre });
  });

  // GET /api/finance/reports/cash-flow?startDate=...&endDate=...&bankAccountIds=id1,id2
  fastify.get('/reports/cash-flow', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = cashFlowQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new FinancialReportService(prisma);

    const bankAccountIds = query.bankAccountIds.split(',').map(id => id.trim()).filter(Boolean);

    const cashFlow = await service.getCashFlow({
      organizationId: request.user!.organizationId,
      bankAccountIds,
      startDate: new Date(query.startDate),
      endDate: new Date(query.endDate)
    });

    return reply.send({ success: true, data: cashFlow });
  });
}