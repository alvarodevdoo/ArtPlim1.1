import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';
import { AccountService } from './services/AccountService';
import { TransactionService } from './services/TransactionService';
import { CategoryService } from './services/CategoryService';
import { AccountType, TransactionType, CategoryType } from '@prisma/client';

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
  dueDate: z.string().optional().nullable()
});

export async function financeRoutes(fastify: FastifyInstance) {

  // ========== CONTAS ==========

  fastify.get('/accounts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const accountService = new AccountService(prisma);
    const accounts = await accountService.list(request.user!.organizationId);
    return reply.send({ success: true, data: accounts });
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
      dueDate: data.dueDate || undefined
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
}