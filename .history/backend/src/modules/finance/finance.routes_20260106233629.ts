import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AccountService } from './services/AccountService';
import { TransactionService } from './services/TransactionService';
import { CategoryService } from './services/CategoryService';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

const createAccountSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['CHECKING', 'SAVINGS', 'CASH', 'CREDIT_CARD']),
  balance: z.number().default(0),
  bank: z.string().optional(),
  agency: z.string().optional(),
  accountNumber: z.string().optional()
});

const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  amount: z.number().positive(),
  description: z.string().min(1),
  categoryId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional()
});

const createCategorySchema = z.object({
  name: z.string().min(2),
  type: z.enum(['INCOME', 'EXPENSE']),
  color: z.string().optional(),
  parentId: z.string().uuid().optional()
});

export async function financeRoutes(fastify: FastifyInstance) {
  
  // ========== CONTAS ==========
  
  // Listar contas
  fastify.get('/accounts', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const accountService = new AccountService(prisma);
    
    const accounts = await accountService.list();
    
    return reply.send({
      success: true,
      data: accounts
    });
  });

  // Criar conta
  fastify.post('/accounts', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = createAccountSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const accountService = new AccountService(prisma);
    
    const account = await accountService.create(body);
    
    return reply.code(201).send({
      success: true,
      data: account
    });
  });

  // Atualizar conta
  fastify.put('/accounts/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createAccountSchema.partial().parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const accountService = new AccountService(prisma);
    
    const account = await accountService.update(id, body);
    
    return reply.send({
      success: true,
      data: account
    });
  });

  // ========== TRANSAÇÕES ==========
  
  // Listar transações
  fastify.get('/transactions', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = request.query as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const transactionService = new TransactionService(prisma);
    
    const transactions = await transactionService.list({
      accountId: query.accountId,
      type: query.type,
      status: query.status,
      categoryId: query.categoryId,
      startDate: query.startDate,
      endDate: query.endDate
    });
    
    return reply.send({
      success: true,
      data: transactions
    });
  });

  // Criar transação
  fastify.post('/transactions', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = createTransactionSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const transactionService = new TransactionService(prisma);
    
    const transaction = await transactionService.create(body);
    
    return reply.code(201).send({
      success: true,
      data: transaction
    });
  });

  // Marcar transação como paga
  fastify.post('/transactions/:id/pay', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const transactionService = new TransactionService(prisma);
    
    const transaction = await transactionService.markAsPaid(id);
    
    return reply.send({
      success: true,
      data: transaction
    });
  });

  // ========== CATEGORIAS ==========
  
  // Listar categorias
  fastify.get('/categories', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = request.query as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const categoryService = new CategoryService(prisma);
    
    const categories = await categoryService.list(query.type);
    
    return reply.send({
      success: true,
      data: categories
    });
  });

  // Criar categoria
  fastify.post('/categories', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = createCategorySchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const categoryService = new CategoryService(prisma);
    
    const category = await categoryService.create(body);
    
    return reply.code(201).send({
      success: true,
      data: category
    });
  });

  // Criar categorias padrão
  fastify.post('/categories/default', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const prisma = getTenantClient(request.user!.organizationId);
      const categoryService = new CategoryService(prisma);
      
      const categories = await categoryService.createDefaultCategories();
      
      return reply.code(201).send({
        success: true,
        data: categories,
        message: `${categories.length} categorias padrão criadas com sucesso`
      });
    } catch (error: any) {
      fastify.log.error('Erro ao criar categorias padrão:', error);
      return reply.code(500).send({
        success: false,
        error: {
          message: error.message || 'Erro interno do servidor',
          statusCode: 500
        }
      });
    }
  });

  // ========== RELATÓRIOS FINANCEIROS ==========
  
  // Dashboard financeiro
  fastify.get('/dashboard', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = request.query as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const transactionService = new TransactionService(prisma);
    
    const dashboard = await transactionService.getDashboard({
      startDate: query.startDate,
      endDate: query.endDate,
      days: query.days ? parseInt(query.days) : undefined
    });
    
    return reply.send({
      success: true,
      data: dashboard
    });
  });

  // Fluxo de caixa
  fastify.get('/cash-flow', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = request.query as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const transactionService = new TransactionService(prisma);
    
    const cashFlow = await transactionService.getCashFlow({
      startDate: query.startDate,
      endDate: query.endDate,
      accountId: query.accountId
    });
    
    return reply.send({
      success: true,
      data: cashFlow
    });
  });

  // Contas a receber
  fastify.get('/receivables', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const transactionService = new TransactionService(prisma);
    
    const receivables = await transactionService.getReceivables();
    
    return reply.send({
      success: true,
      data: receivables
    });
  });

  // Contas a pagar
  fastify.get('/payables', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const transactionService = new TransactionService(prisma);
    
    const payables = await transactionService.getPayables();
    
    return reply.send({
      success: true,
      data: payables
    });
  });
}