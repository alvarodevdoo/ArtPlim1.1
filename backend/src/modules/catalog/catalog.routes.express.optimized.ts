import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';

const listQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  offset: z.string().transform(val => parseInt(val) || 0).optional(),
  search: z.string().optional()
});

const createProductSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  productType: z.enum(['PRODUCT', 'SERVICE', 'PRINT_SHEET', 'PRINT_ROLL', 'LASER_CUT']).default('PRODUCT'),
  pricingMode: z.enum(['SIMPLE_AREA', 'COMPLEX_AREA', 'UNIT', 'SIMPLE_UNIT']),
  salePrice: z.number().positive().optional(),
  minPrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(), // Novo campo para custo
  markup: z.number().positive().optional(),
  active: z.boolean().optional()
});

const updateProductSchema = createProductSchema.partial();

const createMaterialSchema = z.object({
  name: z.string().min(2),
  format: z.enum(['SHEET', 'ROLL', 'LIQUID', 'POWDER', 'OTHER']),
  costPerUnit: z.number().positive(),
  unit: z.string().min(1),
  standardWidth: z.number().positive().optional(),
  standardLength: z.number().positive().optional(),
  active: z.boolean().optional()
});

const updateMaterialSchema = createMaterialSchema.partial();

export function createOptimizedCatalogRoutes(prisma: PrismaClient) {
  const router = Router();

  // ========== PRODUTOS OTIMIZADOS ==========

  // Listar produtos com QueryOptimizer
  router.get('/products', async (req: any, res) => {
    try {
      const query = listQuerySchema.parse(req.query);
      const queryOptimizer = new QueryOptimizer(prisma);

      const products = await queryOptimizer.getOptimizedProducts(
        req.user.organizationId,
        query.limit || 50,
        query.offset || 0
      );

      res.json({
        success: true,
        data: products
      });
    } catch (error) {
      console.error('Erro ao listar produtos otimizados:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== MATERIAIS OTIMIZADOS ==========

  // Listar materiais com QueryOptimizer
  router.get('/materials', async (req: any, res) => {
    try {
      const queryOptimizer = new QueryOptimizer(prisma);

      const materials = await queryOptimizer.getOptimizedMaterials(
        req.user.organizationId
      );

      res.json({
        success: true,
        data: materials
      });
    } catch (error) {
      console.error('Erro ao listar materiais otimizados:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== PRODUTOS CRUD ==========

  // Criar produto
  router.post('/products', async (req: any, res) => {
    try {
      const body = createProductSchema.parse(req.body);

      // Validar se há materiais cadastrados na organização
      const materialCount = await prisma.material.count({
        where: {
          organizationId: req.user.organizationId,
          active: true
        }
      });

      if (materialCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível criar produtos sem materiais cadastrados. Cadastre materiais primeiro.',
          code: 'NO_MATERIALS_AVAILABLE'
        });
      }

      const product = await prisma.product.create({
        data: {
          ...body,
          organizationId: req.user.organizationId,
          active: body.active ?? true
        },
        select: {
          id: true,
          name: true,
          description: true,
          productType: true,
          pricingMode: true,
          salePrice: true,
          minPrice: true,
          markup: true,
          active: true,
          createdAt: true
        }
      });

      res.status(201).json({
        success: true,
        data: product
      });
    } catch (error) {
      console.error('Erro ao criar produto:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Buscar produto por ID
  router.get('/products/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      const product = await prisma.product.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        },
        include: {
          components: {
            include: {
              material: true
            }
          }
        }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Buscar componentes de um produto
  router.get('/products/:id/components', async (req: any, res) => {
    try {
      const { id } = req.params;

      // Verificar se o produto existe e pertence à organização
      const product = await prisma.product.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      const components = await prisma.productComponent.findMany({
        where: {
          productId: id
        },
        include: {
          material: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      res.json({
        success: true,
        data: components
      });
    } catch (error) {
      console.error('Erro ao buscar componentes do produto:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Atualizar produto
  router.put('/products/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const body = updateProductSchema.parse(req.body);

      // Verificar se o produto existe e pertence à organização
      const existingProduct = await prisma.product.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        }
      });

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      const product = await prisma.product.update({
        where: { id },
        data: body,
        select: {
          id: true,
          name: true,
          description: true,
          productType: true,
          pricingMode: true,
          salePrice: true,
          minPrice: true,
          markup: true,
          active: true,
          updatedAt: true
        }
      });

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Deletar produto
  router.delete('/products/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      // Verificar se o produto existe e pertence à organização
      const existingProduct = await prisma.product.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        }
      });

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado'
        });
      }

      // Verificar se o produto não está sendo usado em pedidos
      const orderItemsCount = await prisma.orderItem.count({
        where: {
          productId: id
        }
      });

      if (orderItemsCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível excluir este produto pois ele possui pedidos associados'
        });
      }

      await prisma.product.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Produto excluído com sucesso'
      });
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // ========== MATERIAIS CRUD ==========

  // Criar material
  router.post('/materials', async (req: any, res) => {
    try {
      const body = createMaterialSchema.parse(req.body);

      const material = await prisma.material.create({
        data: {
          ...body,
          organizationId: req.user.organizationId,
          active: body.active ?? true
        },
        select: {
          id: true,
          name: true,
          format: true,
          costPerUnit: true,
          unit: true,
          standardWidth: true,
          standardLength: true,
          active: true,
          createdAt: true
        }
      });

      res.status(201).json({
        success: true,
        data: material
      });
    } catch (error) {
      console.error('Erro ao criar material:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Buscar material por ID
  router.get('/materials/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      const material = await prisma.material.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        },
        include: {
          components: {
            include: {
              product: true
            }
          }
        }
      });

      if (!material) {
        return res.status(404).json({
          success: false,
          message: 'Material não encontrado'
        });
      }

      res.json({
        success: true,
        data: material
      });
    } catch (error) {
      console.error('Erro ao buscar material:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Atualizar material
  router.put('/materials/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const body = updateMaterialSchema.parse(req.body);

      // Verificar se o material existe e pertence à organização
      const existingMaterial = await prisma.material.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        }
      });

      if (!existingMaterial) {
        return res.status(404).json({
          success: false,
          message: 'Material não encontrado'
        });
      }

      const material = await prisma.material.update({
        where: { id },
        data: body,
        select: {
          id: true,
          name: true,
          format: true,
          costPerUnit: true,
          unit: true,
          standardWidth: true,
          standardLength: true,
          active: true,
          updatedAt: true
        }
      });

      res.json({
        success: true,
        data: material
      });
    } catch (error) {
      console.error('Erro ao atualizar material:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Deletar material
  router.delete('/materials/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      // Verificar se o material existe e pertence à organização
      const existingMaterial = await prisma.material.findFirst({
        where: {
          id,
          organizationId: req.user.organizationId
        }
      });

      if (!existingMaterial) {
        return res.status(404).json({
          success: false,
          message: 'Material não encontrado'
        });
      }

      // Verificar se o material não está sendo usado em componentes
      const componentsCount = await prisma.productComponent.count({
        where: {
          materialId: id
        }
      });

      if (componentsCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível excluir este material pois ele está sendo usado em produtos'
        });
      }

      await prisma.material.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Material excluído com sucesso'
      });
    } catch (error) {
      console.error('Erro ao excluir material:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  return router;
}