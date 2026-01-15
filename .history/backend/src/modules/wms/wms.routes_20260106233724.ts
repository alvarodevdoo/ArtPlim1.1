import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { InventoryService } from './services/InventoryService';
import { MovementService } from './services/MovementService';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

const addInventorySchema = z.object({
  materialId: z.string().uuid(),
  width: z.number().positive(),
  length: z.number().positive().optional(),
  height: z.number().positive().optional(),
  thickness: z.number().positive().optional(),
  quantity: z.number().int().positive(),
  location: z.string().optional(),
  isOffcut: z.boolean().default(false)
});

const movementSchema = z.object({
  inventoryItemId: z.string().uuid(),
  type: z.enum(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'WASTE']),
  quantity: z.number().int().positive(),
  reason: z.string().optional(),
  orderId: z.string().uuid().optional()
});

export async function wmsRoutes(fastify: FastifyInstance) {
  
  // ========== INVENTÁRIO ==========
  
  // Listar itens de estoque
  fastify.get('/inventory', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = request.query as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const inventoryService = new InventoryService(prisma);
    
    const inventory = await inventoryService.list({
      materialId: query.materialId,
      location: query.location,
      isOffcut: query.isOffcut === 'true'
    });
    
    return reply.send({
      success: true,
      data: inventory
    });
  });

  // Adicionar item ao estoque
  fastify.post('/inventory', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = addInventorySchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const inventoryService = new InventoryService(prisma);
    
    const item = await inventoryService.addItem(body);
    
    return reply.code(201).send({
      success: true,
      data: item
    });
  });

  // Buscar item por ID
  fastify.get('/inventory/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const inventoryService = new InventoryService(prisma);
    
    const item = await inventoryService.findById(id);
    
    return reply.send({
      success: true,
      data: item
    });
  });

  // Atualizar item
  fastify.put('/inventory/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = addInventorySchema.partial().parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const inventoryService = new InventoryService(prisma);
    
    const item = await inventoryService.updateItem(id, body);
    
    return reply.send({
      success: true,
      data: item
    });
  });

  // ========== MOVIMENTAÇÕES ==========
  
  // Listar movimentações
  fastify.get('/movements', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = request.query as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const movementService = new MovementService(prisma);
    
    const movements = await movementService.list({
      materialId: query.materialId,
      type: query.type,
      startDate: query.startDate,
      endDate: query.endDate
    });
    
    return reply.send({
      success: true,
      data: movements
    });
  });

  // Registrar movimentação
  fastify.post('/movements', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = movementSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const movementService = new MovementService(prisma);
    
    const movement = await movementService.create({
      ...body,
      userId: request.user!.userId
    });
    
    return reply.code(201).send({
      success: true,
      data: movement
    });
  });

  // ========== RELATÓRIOS WMS ==========
  
  // Relatório de estoque por material
  fastify.get('/reports/stock-by-material', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const inventoryService = new InventoryService(prisma);
    
    const report = await inventoryService.getStockByMaterial();
    
    return reply.send({
      success: true,
      data: report
    });
  });

  // Relatório de retalhos
  fastify.get('/reports/offcuts', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const inventoryService = new InventoryService(prisma);
    
    const offcuts = await inventoryService.getOffcuts();
    
    return reply.send({
      success: true,
      data: offcuts
    });
  });

  // Alertas de estoque
  fastify.get('/alerts', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const inventoryService = new InventoryService(prisma);
    
    const alerts = await inventoryService.getAlerts();
    
    return reply.send({
      success: true,
      data: alerts
    });
  });
}