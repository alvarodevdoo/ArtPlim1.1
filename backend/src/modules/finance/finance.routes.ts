import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const listQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  days: z.string().transform(val => parseInt(val) || 30).optional()
});

export async function financeRoutes(fastify: FastifyInstance) {

  // ========== CONTAS ==========

  // Listar contas
  fastify.get('/accounts', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    // Implementação temporária - retorna dados mock
    const accounts = [
      {
        id: '1',
        name: 'Conta Corrente Principal',
        type: 'CHECKING',
        balance: 15000.00,
        currency: 'BRL'
      },
      {
        id: '2',
        name: 'Conta Poupança',
        type: 'SAVINGS',
        balance: 25000.00,
        currency: 'BRL'
      }
    ];

    return reply.send({
      success: true,
      data: accounts
    });
  });

  // ========== TRANSAÇÕES ==========

  // Listar transações
  fastify.get('/transactions', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);

    // Implementação temporária - retorna dados mock
    const transactions = [
      {
        id: '1',
        description: 'Venda - Pedido #001',
        amount: 500.00,
        type: 'INCOME',
        date: new Date().toISOString(),
        category: 'Vendas'
      },
      {
        id: '2',
        description: 'Compra de Material',
        amount: -200.00,
        type: 'EXPENSE',
        date: new Date(Date.now() - 86400000).toISOString(),
        category: 'Materiais'
      }
    ].slice(0, query.limit || 50);

    return reply.send({
      success: true,
      data: transactions
    });
  });

  // ========== CATEGORIAS ==========

  // Listar categorias
  fastify.get('/categories', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    // Implementação temporária - retorna dados mock
    const categories = [
      { id: '1', name: 'Vendas', type: 'INCOME', color: '#10B981' },
      { id: '2', name: 'Materiais', type: 'EXPENSE', color: '#EF4444' },
      { id: '3', name: 'Salários', type: 'EXPENSE', color: '#F59E0B' },
      { id: '4', name: 'Aluguel', type: 'EXPENSE', color: '#8B5CF6' }
    ];

    return reply.send({
      success: true,
      data: categories
    });
  });

  // ========== DASHBOARD ==========

  // Dashboard financeiro
  fastify.get('/dashboard', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);

    // Estrutura atualizada para coincidir com o frontend (Financeiro.tsx)
    const dashboard = {
      summary: {
        totalIncome: 15000.00,
        totalExpense: 8500.00,
        profit: 6500.00,
        profitMargin: 43.33
      },
      pending: {
        receivables: 12450.00,
        payables: 3200.00
      },
      accounts: {
        totalBalance: 40000.00,
        balanceByType: {
          'CHECKING': 15000.00,
          'SAVINGS': 25000.00
        }
      },
      cashFlow: [
        { date: new Date(Date.now() - 86400000 * 2).toISOString(), income: 2000, expense: 500, balance: 1500 },
        { date: new Date(Date.now() - 86400000).toISOString(), income: 1500, expense: 800, balance: 2200 },
        { date: new Date().toISOString(), income: 3000, expense: 1200, balance: 4000 }
      ],
      categoryStats: [
        { name: 'Vendas', value: 15000.00, color: '#10B981', type: 'INCOME' },
        { name: 'Materiais', value: 5000.00, color: '#EF4444', type: 'EXPENSE' },
        { name: 'Salários', value: 2500.00, color: '#F59E0B', type: 'EXPENSE' },
        { name: 'Aluguel', value: 1000.00, color: '#8B5CF6', type: 'EXPENSE' }
      ],
      monthlyComparison: {
        currentMonth: { income: 15000, expense: 8500, profit: 6500 },
        previousMonth: { income: 12000, expense: 7000, profit: 5000 },
        growth: { income: 25, expense: 21.4, profit: 30 }
      }
    };

    return reply.send({
      success: true,
      data: dashboard
    });
  });
}