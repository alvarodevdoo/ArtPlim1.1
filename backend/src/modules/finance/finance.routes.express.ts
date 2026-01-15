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
      
      // Implementação temporária - retorna dados mock
      const dashboard = {
        totalIncome: 15000.00,
        totalExpenses: 8500.00,
        netProfit: 6500.00,
        profitMargin: 43.33,
        monthlyGrowth: 12.5,
        topCategories: [
          { name: 'Vendas', amount: 15000.00, percentage: 63.8 },
          { name: 'Materiais', amount: 5000.00, percentage: 21.3 },
          { name: 'Salários', amount: 2500.00, percentage: 10.6 },
          { name: 'Outros', amount: 1000.00, percentage: 4.3 }
        ],
        recentTransactions: [
          {
            id: '1',
            description: 'Venda - Pedido #001',
            amount: 500.00,
            type: 'INCOME',
            date: new Date().toISOString()
          }
        ]
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