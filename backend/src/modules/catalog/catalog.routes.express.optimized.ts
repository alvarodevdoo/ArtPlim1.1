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
  pricingMode: z.enum(['SIMPLE_AREA', 'SIMPLE_UNIT', 'DYNAMIC_ENGINEER']),
  pricingRuleId: z.string().uuid().optional(),
  salePrice: z.number().min(0).optional(),
  minPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  markup: z.number().positive().default(2.0),
  active: z.boolean().optional()
});

const updateProductSchema = createProductSchema.partial();

const createMaterialSchema = z.object({
  name: z.string().min(2),
  format: z.enum(['ROLL', 'SHEET', 'UNIT']),
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
      // Removido conforme solicitação: não é obrigatório ter materiais para cadastrar produtos
      /*
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
      */

      const product = await prisma.product.create({
        data: {
          name: body.name,
          description: body.description,
          pricingMode: body.pricingMode,
          salePrice: body.salePrice,
          minPrice: body.minPrice,
          costPrice: body.costPrice,
          markup: body.markup,
          active: body.active ?? true,
          organization: { connect: { id: req.user.organizationId } },
          pricingRule: body.pricingRuleId ? { connect: { id: body.pricingRuleId } } : undefined
        },
        select: {
          id: true,
          name: true,
          description: true,
          pricingRuleId: true,
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
        select: {
          id: true,
          name: true,
          description: true,
          pricingMode: true,
          pricingRuleId: true,
          salePrice: true,
          minPrice: true,
          costPrice: true,
          markup: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          components: {
            select: {
              id: true,
              consumptionMethod: true,
              wastePercentage: true,
              isOptional: true,
              priority: true,
              notes: true,
              material: {
                select: {
                  id: true,
                  name: true,
                  format: true,
                  costPerUnit: true,
                  unit: true,
                  standardWidth: true,
                  standardLength: true
                }
              }
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
      if (error instanceof Error) {
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
      }
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : String(error)
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
        data: {
          ...body,
          pricingRule: body.pricingRuleId ? { connect: { id: body.pricingRuleId } } : undefined,
          pricingRuleId: undefined // Let connect handle it
        },
        select: {
          id: true,
          name: true,
          description: true,
          pricingRuleId: true,
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
          name: body.name,
          format: body.format,
          costPerUnit: body.costPerUnit,
          unit: body.unit,
          standardWidth: body.standardWidth,
          standardLength: body.standardLength,
          active: body.active ?? true,
          organization: { connect: { id: req.user.organizationId } }
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

  // ========== PRICING RULES ==========

  // Listar regras
  router.get('/pricing-rules', async (req: any, res) => {
    try {
      const rules = await prisma.pricingRule.findMany({
        where: {
          organizationId: req.user.organizationId,
          active: true
        },
        orderBy: {
          name: 'asc'
        }
      });

      res.json({
        success: true,
        data: rules
      });
    } catch (error) {
      console.error('Erro ao listar regras de precificação:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Criar regra
  router.post('/pricing-rules', async (req: any, res) => {
    try {
      const schema = z.object({
        name: z.string().min(2),
        type: z.enum(['UNIT', 'SQUARE_METER', 'TIME_AREA']),
        formula: z.any(),
        config: z.any().optional(),
        active: z.boolean().optional()
      });

      const body = schema.parse(req.body);

      const rule = await prisma.pricingRule.create({
        data: {
          name: body.name,
          type: body.type,
          formula: body.formula,
          config: body.config,
          active: body.active ?? true,
          organization: { connect: { id: req.user.organizationId } }
        }
      });

      res.status(201).json({
        success: true,
        data: rule
      });
    } catch (error) {
      console.error('Erro ao criar regra de precificação:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Atualizar regra
  router.put('/pricing-rules/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const schema = z.object({
        name: z.string().min(2).optional(),
        type: z.enum(['UNIT', 'SQUARE_METER', 'TIME_AREA']).optional(),
        formula: z.any().optional(),
        config: z.any().optional(),
        active: z.boolean().optional()
      });

      const body = schema.parse(req.body);

      const rule = await prisma.pricingRule.update({
        where: { id },
        data: {
          ...body,
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        data: rule
      });
    } catch (error) {
      console.error('Erro ao atualizar regra de precificação:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  // Deletar regra
  router.delete('/pricing-rules/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      await prisma.pricingRule.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Regra removida com sucesso'
      });
    } catch (error) {
      console.error('Erro ao excluir regra de precificação:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  });

  return router;
}