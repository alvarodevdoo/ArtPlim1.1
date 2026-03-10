import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const listQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  days: z.string().transform(val => parseInt(val) || 30).optional()
});

export function createFinanceRoutes(prisma: PrismaClient) {
  const router = Router();

  // ========== CONTAS ==========

  // Listar contas
  router.get('/accounts', async (req: any, res) => {
    try {
      // Implementação temporária - retorna dados mock
      const accounts = [
        {
          id: '1',
          name: 'Conta Corrente Principal',
          type: 'CHECKING',
          balance: 15000.00,
          currency: 'BRL',
          _count: { transactions: 5 }
        },
        {
          id: '2',
          name: 'Conta Poupança',
          type: 'SAVINGS',
          balance: 25000.00,
          currency: 'BRL',
          _count: { transactions: 2 }
        }
      ];

      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      console.error('Erro ao listar contas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== TRANSAÇÕES ==========

  // Listar transações
  router.get('/transactions', async (req: any, res) => {
    try {
      const query = listQuerySchema.parse(req.query);

      // Implementação temporária - retorna dados mock
      const transactions = [
        {
          id: '1',
          description: 'Venda - Pedido #001',
          amount: 500.00,
          type: 'INCOME',
          status: 'PAID',
          createdAt: new Date().toISOString(),
          account: { id: '1', name: 'Conta Corrente Principal', type: 'CHECKING' },
          category: { id: '1', name: 'Vendas', color: '#10B981' }
        },
        {
          id: '2',
          description: 'Compra de Material',
          amount: 200.00,
          type: 'EXPENSE',
          status: 'PENDING',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          account: { id: '1', name: 'Conta Corrente Principal', type: 'CHECKING' },
          category: { id: '2', name: 'Materiais', color: '#EF4444' }
        }
      ].slice(0, query.limit || 50);

      res.json({
        success: true,
        data: transactions
      });
    } catch (error) {
      console.error('Erro ao listar transações:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== CATEGORIAS ==========

  // Listar categorias
  router.get('/categories', async (req: any, res) => {
    try {
      // Implementação temporária - retorna dados mock
      const categories = [
        { id: '1', name: 'Vendas', type: 'INCOME', color: '#10B981' },
        { id: '2', name: 'Materiais', type: 'EXPENSE', color: '#EF4444' },
        { id: '3', name: 'Salários', type: 'EXPENSE', color: '#F59E0B' },
        { id: '4', name: 'Aluguel', type: 'EXPENSE', color: '#8B5CF6' }
      ];

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Erro ao listar categorias:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== DASHBOARD ==========

  // Dashboard financeiro
  router.get('/dashboard', async (req: any, res) => {
    try {
      const query = listQuerySchema.parse(req.query);

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

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      console.error('Erro ao obter dashboard financeiro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  return router;
}