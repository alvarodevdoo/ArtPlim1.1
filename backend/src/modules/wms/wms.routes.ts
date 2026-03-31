import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { InventoryService } from './services/InventoryService';
import { StockMovementService } from './services/StockMovementService';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';

const listQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  search: z.string().optional(),
  location: z.string().optional(),
  isOffcut: z.string().transform(val => val === 'true').optional()
});

export async function wmsRoutes(fastify: FastifyInstance) {
  
  // ========== ESTOQUE ==========
  
  // Listar itens do estoque
  fastify.get('/inventory', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const filters = listQuerySchema.parse(request.query);
    const inventoryService = new InventoryService(getTenantClient(request.user!.organizationId));
    
    const inventory = await inventoryService.list({
      location: filters.location,
      isOffcut: filters.isOffcut
    });
    
    return reply.send({
      success: true,
      data: inventory
    });
  });

  // ========== MOVIMENTAÇÕES ==========
  
  // Listar movimentações (legacy InventoryMovement)
  fastify.get('/movements', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const data = await prisma.inventoryMovement.findMany({
      take: query.limit || 50,
      include: {
        inventoryItem: { include: { material: true } },
        user: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return reply.send({ success: true, data });
  });

  // ========== ALERTAS ==========
  
  fastify.get('/alerts', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const inventoryService = new InventoryService(getTenantClient(request.user!.organizationId));
    const alerts = await inventoryService.getAlerts();
    return reply.send({ success: true, data: alerts });
  });

  // ========== ADICIONAR ITEM ==========
  const addItemSchema = z.object({
    materialId: z.string().uuid(),
    width: z.number(),
    length: z.number().optional(),
    height: z.number().optional(),
    quantity: z.number().min(1),
    location: z.string().optional(),
    isOffcut: z.boolean().default(false)
  });

  fastify.post('/inventory', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const data = addItemSchema.parse(request.body);
    const inventoryService = new InventoryService(getTenantClient(request.user!.organizationId));
    const item = await inventoryService.addItem(data as any);
    return reply.code(201).send({ success: true, data: item });
  });

  // ========== STOCK MOVEMENTS (CUSTO MÉDIO) ==========

  const entrySchema = z.object({
    materialId: z.string().uuid(),
    quantity: z.number().positive(),
    unitCost: z.number().positive(),
    totalCost: z.number().positive().optional(),
    notes: z.string().optional(),
    documentKey: z.string().optional(),
    supplierId: z.string().uuid().optional(),
  });

  const consumptionSchema = z.object({
    materialId: z.string().uuid(),
    quantity: z.number().positive(),
    machineId: z.string().uuid(),
    machineCounter: z.number().int().positive().optional(),
    notes: z.string().optional(),
  });

  const listMovementsQuerySchema = z.object({
    materialId: z.string().uuid().optional(),
    type: z.enum(['ENTRY', 'INTERNAL_CONSUMPTION', 'ADJUSTMENT']).optional(),
    limit: z.string().transform(val => parseInt(val) || 50).optional(),
  });

  // Listar movimentações de custo médio
  fastify.get('/stock-movements', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = listMovementsQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new StockMovementService(prisma);
    const data = await service.listMovements(request.user!.organizationId, {
      materialId: query.materialId,
      type: query.type,
      limit: query.limit,
    });
    return reply.send({ success: true, data });
  });

  // Registrar Entrada de Material (Nota Fiscal / Compra)
  fastify.post('/stock-movements/entry', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = entrySchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new StockMovementService(prisma);
    const movement = await service.registerEntry(request.user!.organizationId, body);
    return reply.code(201).send({ success: true, data: movement });
  });

  // Registrar Baixa por Consumo Interno (Tinta/Toner em Máquina)
  fastify.post('/stock-movements/consumption', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = consumptionSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new StockMovementService(prisma);
    const movement = await service.registerInternalConsumption(
      request.user!.organizationId,
      request.user!.userId,
      body
    );
    return reply.code(201).send({ success: true, data: movement });
  });

  // Registrar Ajuste Manual de Estoque (Inventário)
  fastify.post('/stock-movements/adjustment', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const adjSchema = z.object({
      materialId: z.string().uuid(),
      quantity: z.number(),
      averageCost: z.number().nonnegative(),
      notes: z.string().optional(),
    });
    const body = adjSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new StockMovementService(prisma);
    const movement = await service.registerAdjustment(request.user!.organizationId, body);
    return reply.code(201).send({ success: true, data: movement });
  });

  // Registrar Recebimento de NF (Múltiplos Itens)
  fastify.post('/stock-movements/receipt', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const receiptSchema = z.object({
      supplierId: z.string().uuid(),
      notes: z.string().optional(),
      documentKey: z.string().optional(),
      items: z.array(z.object({
        materialId: z.string().uuid(),
        quantity: z.number().positive(),
        unitCost: z.number().positive(),
        totalCost: z.number().positive(),
        notes: z.string().optional(),
      }))
    });

    const body = receiptSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new StockMovementService(prisma);

    const movements = await service.registerReceipt(
      request.user!.organizationId,
      request.user!.userId,
      body
    );

    return reply.code(201).send({ success: true, data: movements });
  });
}