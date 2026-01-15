import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export function createSalesRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // Placeholder para rotas de vendas
  router.get('/orders', async (req, res) => {
    try {
      const { organizationId } = (req as any).user;
      
      const orders = await prisma.order.findMany({
        where: { organizationId },
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      res.json({
        success: true,
        data: orders
      });
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  return router;
}