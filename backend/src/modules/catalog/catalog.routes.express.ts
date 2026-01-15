import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export function createCatalogRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // Placeholder para rotas de catálogo
  router.get('/products', async (req, res) => {
    try {
      const { organizationId } = (req as any).user;
      
      const products = await prisma.product.findMany({
        where: { organizationId },
        include: {
          components: {
            include: {
              material: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      res.json({
        success: true,
        data: products
      });
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  return router;
}