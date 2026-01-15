import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProductService } from './services/ProductService';
import { MaterialService } from './services/MaterialService';
import { ProductComponentService } from './services/ProductComponentService';
import { ProductConfigurationService } from './services/ProductConfigurationService';
import { ConfigurationValidationService } from './services/ConfigurationValidationService';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

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
  manualWastePercentage: z.number().min(0).max(1).nullable().optional(),
  isOptional: z.boolean().optional(),
  priority: z.number().int().min(1).optional(),
  notes: z.string().nullable().optional()
});

const createConfigurationSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  helpText: z.string().optional(),
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
  description: z.string().optional(),
  priceModifier: z.number().optional(),
  priceModifierType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
  additionalComponents: z.array(z.object({
    materialId: z.string().uuid(),
    consumptionMethod: z.string(),
    quantity: z.number().positive(),
    wastePercentage: z.number().min(0),
    isOptional: z.boolean()
  })).optional(),
  removedComponents: z.array(z.string().uuid()).optional(),
  componentModifiers: z.array(z.object({
    componentId: z.string().uuid(),
    modificationType: z.enum(['MULTIPLY', 'ADD', 'REPLACE']),
    value: z.number(),
    unit: z.string().optional()
  })).optional(),
  displayOrder: z.number().int().min(1).optional(),
  isAvailable: z.boolean().optional()
});

const createTemplateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().default('custom')
});

const importConfigurationsSchema = z.object({
  version: z.string(),
  configurations: z.array(z.any()),
  options: z.object({
    overwriteExisting: z.boolean().default(false),
    preserveIds: z.boolean().default(false),
    validateIntegrity: z.boolean().default(true)
  })
});

const reorderOptionsSchema = z.object({
  optionIds: z.array(z.string().uuid())
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

  // ========== COMPONENTES DE PRODUTO ==========
  
  // Listar componentes de um produto
  fastify.get('/products/:id/components', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const componentService = new ProductComponentService(prisma);
    
    const components = await componentService.listComponents(id);
    
    return reply.send({
      success: true,
      data: components
    });
  });

  // Adicionar componente a um produto
  fastify.post('/products/:id/components', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createComponentSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const componentService = new ProductComponentService(prisma);
    
    const component = await componentService.addComponent(id, body);
    
    return reply.code(201).send({
      success: true,
      data: component
    });
  });

  // Atualizar componente
  fastify.put('/products/:productId/components/:componentId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { componentId } = request.params as { productId: string; componentId: string };
    const body = createComponentSchema.partial().parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const componentService = new ProductComponentService(prisma);
    
    const component = await componentService.updateComponent(componentId, body);
    
    return reply.send({
      success: true,
      data: component
    });
  });

  // Remover componente de um produto
  fastify.delete('/products/:productId/components/:componentId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { productId, componentId } = request.params as { productId: string; componentId: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const componentService = new ProductComponentService(prisma);
    
    const result = await componentService.removeComponent(productId, componentId);
    
    return reply.send({
      success: true,
      data: result
    });
  });

  // Validar configuração de produto
  fastify.get('/products/:id/validate', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const componentService = new ProductComponentService(prisma);
    
    const validation = await componentService.validateProductConfiguration(id);
    
    return reply.send({
      success: true,
      data: validation
    });
  });

  // ========== CONFIGURAÇÕES DE PRODUTO ==========
  
  // Listar configurações de um produto
  fastify.get('/products/:id/configurations', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const configService = new ProductConfigurationService(prisma);
    
    const configurations = await configService.listConfigurations(id);
    
    return reply.send({
      success: true,
      data: configurations
    });
  });

  // Criar configuração para um produto
  fastify.post('/products/:id/configurations', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createConfigurationSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const configService = new ProductConfigurationService(prisma);
    
    const configuration = await configService.createConfiguration(id, body);
    
    return reply.code(201).send({
      success: true,
      data: configuration
    });
  });

  // Atualizar configuração
  fastify.put('/products/:productId/configurations/:configId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { configId } = request.params as { productId: string; configId: string };
    const body = createConfigurationSchema.partial().parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const configService = new ProductConfigurationService(prisma);
    
    const configuration = await configService.updateConfiguration(configId, body);
    
    return reply.send({
      success: true,
      data: configuration
    });
  });

  // Remover configuração
  fastify.delete('/products/:productId/configurations/:configId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { configId } = request.params as { productId: string; configId: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const configService = new ProductConfigurationService(prisma);
    
    const result = await configService.deleteConfiguration(configId);
    
    return reply.send({
      success: true,
      data: result
    });
  });

  // Adicionar opção a uma configuração SELECT
  fastify.post('/configurations/:configId/options', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { configId } = request.params as { configId: string };
    const body = createOptionSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const configService = new ProductConfigurationService(prisma);
    
    const option = await configService.addOption(configId, body);
    
    return reply.code(201).send({
      success: true,
      data: option
    });
  });

  // Atualizar opção
  fastify.put('/configurations/:configId/options/:optionId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { optionId } = request.params as { configId: string; optionId: string };
    const body = createOptionSchema.partial().parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const configService = new ProductConfigurationService(prisma);
    
    const option = await configService.updateOption(optionId, body);
    
    return reply.send({
      success: true,
      data: option
    });
  });

  // Remover opção
  fastify.delete('/configurations/:configId/options/:optionId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { optionId } = request.params as { configId: string; optionId: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const configService = new ProductConfigurationService(prisma);
    
    const result = await configService.deleteOption(optionId);
    
    return reply.send({
      success: true,
      data: result
    });
  });

  // Obter configurações completas de um produto (com opções)
  fastify.get('/products/:id/configurations/complete', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const configService = new ProductConfigurationService(prisma);
    
    const productConfigurations = await configService.getProductConfigurations(id);
    
    return reply.send({
      success: true,
      data: productConfigurations
    });
  });

  // Validar configurações selecionadas
  fastify.post('/products/:id/configurations/validate', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { selectedConfigurations } = request.body as { selectedConfigurations: Record<string, any> };
    const prisma = getTenantClient(request.user!.organizationId);
    const configService = new ProductConfigurationService(prisma);
    
    const validation = await configService.validateSelectedConfigurations(id, selectedConfigurations);
    
    return reply.send({
      success: true,
      data: validation
    });
  });
}