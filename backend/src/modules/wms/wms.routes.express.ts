import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const listQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  search: z.string().optional()
});

export function createWmsRoutes(prisma: PrismaClient) {
  const router = Router();
  
  // ========== ESTOQUE ==========
  
  // Listar itens do estoque
  router.get('/inventory', async (req: any, res) => {
    try {
      const query = listQuerySchema.parse(req.query);
      
      // Implementação temporária - retorna dados mock
      const inventory = [
        {
          id: '1',
          materialId: 'mat-1',
          materialName: 'Papel Couché 300g',
          quantity: 500,
          unit: 'folhas',
          location: 'A1-01',
          minStock: 100,
          maxStock: 1000,
          lastMovement: new Date().toISOString()
        },
        {
          id: '2',
          materialId: 'mat-2',
          materialName: 'Tinta Cyan',
          quantity: 25,
          unit: 'litros',
          location: 'B2-03',
          minStock: 10,
          maxStock: 50,
          lastMovement: new Date(Date.now() - 86400000).toISOString()
        }
      ].slice(0, query.limit || 50);
      
      res.json({
        success: true,
        data: inventory
      });
    } catch (error) {
      console.error('Erro ao listar estoque:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== MOVIMENTAÇÕES ==========
  
  // Listar movimentações
  router.get('/movements', async (req: any, res) => {
    try {
      const query = listQuerySchema.parse(req.query);
      
      // Implementação temporária - retorna dados mock
      const movements = [
        {
          id: '1',
          materialId: 'mat-1',
          materialName: 'Papel Couché 300g',
          type: 'IN',
          quantity: 100,
          unit: 'folhas',
          reason: 'Compra',
          date: new Date().toISOString(),
          user: 'João Silva'
        },
        {
          id: '2',
          materialId: 'mat-1',
          materialName: 'Papel Couché 300g',
          type: 'OUT',
          quantity: 50,
          unit: 'folhas',
          reason: 'Produção - Pedido #001',
          date: new Date(Date.now() - 3600000).toISOString(),
          user: 'Maria Santos'
        }
      ].slice(0, query.limit || 50);
      
      res.json({
        success: true,
        data: movements
      });
    } catch (error) {
      console.error('Erro ao listar movimentações:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== ALERTAS ==========
  
  // Listar alertas de estoque
  router.get('/alerts', async (req: any, res) => {
    try {
      // Implementação temporária - retorna dados mock
      const alerts = [
        {
          id: '1',
          type: 'LOW_STOCK',
          materialId: 'mat-3',
          materialName: 'Papel A4 75g',
          currentStock: 15,
          minStock: 50,
          severity: 'HIGH',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          type: 'OUT_OF_STOCK',
          materialId: 'mat-4',
          materialName: 'Tinta Magenta',
          currentStock: 0,
          minStock: 10,
          severity: 'CRITICAL',
          createdAt: new Date(Date.now() - 1800000).toISOString()
        }
      ];
      
      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      console.error('Erro ao listar alertas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  return router;
}