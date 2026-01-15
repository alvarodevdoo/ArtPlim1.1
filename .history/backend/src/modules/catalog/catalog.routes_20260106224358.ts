import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProductService } from './services/ProductService';
import { MaterialService } from './services/MaterialService';
import { ProductComponentService } from './services/ProductComponentService';
import { ProductConfigurationService } from './services/ProductConfigurationService';
import { getTenantClient } from '../../@core/database/prisma';

const createProductSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  pricingMode: z.enum(['SIMPLE_AREA', 'SIMPLE_UNIT', 'DYNAMIC_ENGINEER']),
  salePrice: z.number().min(0).optional(),
  minPrice: z.number().min(0).optional(),
  markup: z.number().positive().default(2.0)
});

const createMaterialSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  format: z.enum(['ROLL', 'SHEET', 'UNIT']),
  costPerUnit: z.number().positive(),
  unit: z.string().min(1),
  standardWidth: z.number().positive().optional(),
  standardLength: z.number().positive().optional()
});

const createComponentSchema = z.object({
  materialId: z.string().uuid(),
  consumptionMethod: z.enum(['BOUNDING_BOX', 'LINEAR_NEST', 'FIXED_AMOUNT']),
  wastePercentage: z.number().min(0).max(1).optional(),
  manualWastePercentage: z.number().min(0).max(1).optional(),
  isOptional: z.boolean().optional(),
  priority: z.number().int().min(1).optional(),
  notes: z.string().optional()
});

const createConfigurationSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['SELECT', 'NUMBER', 'BOOLEAN', 'TEXT']),
  required: z.boolean().optional(),
  defaultValue: z.string().optional(),
  affectsComponents: z.boolean().optional(),
  affectsPricing: z.boolean().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  step: z.number().positive().optional(),
  displayOrder: z.number().int().min(1).optional()
});

const createOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  priceModifier: z.number().optional(),
  additionalComponents: z.array(z.any()).optional(),
  removedComponents: z.array(z.string()).optional(),
  componentModifiers: z.array(z.any()).optional(),
  displayOrder: z.number().int().min(1).optional()
});

export async function catalogRoutes(fastify: FastifyInstance) {
  
  // ========== PRODUTOS ==========
  
  // Listar produtos
  fastify.get('/products', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { include } = request.query as { include?: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const productService = new ProductService(prisma);
    
    const includeStandardSizes = include?.includes('standardSizes');
    const products = await productService.list(includeStandardSizes);
    
    return reply.send({
      success: true,
      data: products
    });
  });

  // Criar produto
  fastify.post('/products', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = createProductSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const productService = new ProductService(prisma);
    
    const product = await productService.create({
      ...body,
      organizationId: request.user!.organizationId
    });
    
    return reply.code(201).send({
      success: true,
      data: product
    });
  });

  // Buscar produto por ID
  fastify.get('/products/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const productService = new ProductService(prisma);
    
    const product = await productService.findById(id);
    
    return reply.send({
      success: true,
      data: product
    });
  });

  // Atualizar produto
  fastify.put('/products/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createProductSchema.partial().parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const productService = new ProductService(prisma);
    
    const product = await productService.update(id, {
      ...body,
      organizationId: request.user!.organizationId
    });
    
    return reply.send({
      success: true,
      data: product
    });
  });

  // ========== MATERIAIS ==========
  
  // Listar materiais
  fastify.get('/materials', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const materialService = new MaterialService(prisma);
    
    const materials = await materialService.list();
    
    return reply.send({
      success: true,
      data: materials
    });
  });

  // Criar material
  fastify.post('/materials', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = createMaterialSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const materialService = new MaterialService(prisma);
    
    const material = await materialService.create(body);
    
    return reply.code(201).send({
      success: true,
      data: material
    });
  });

  // Buscar material por ID
  fastify.get('/materials/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const materialService = new MaterialService(prisma);
    
    const material = await materialService.findById(id);
    
    return reply.send({
      success: true,
      data: material
    });
  });
}