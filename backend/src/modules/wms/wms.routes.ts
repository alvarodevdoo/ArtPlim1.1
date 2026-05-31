import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { InventoryService } from './services/InventoryService';
import { StockMovementService } from './services/StockMovementService';
import { ManufactureProductService } from './services/ManufactureProductService';
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

  fastify.get('/movements/stock', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { materialId, limit, type } = request.query as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new StockMovementService(prisma);
    
    // Garantir que limit seja um número válido
    const parsedLimit = parseInt(limit);
    const finalLimit = isNaN(parsedLimit) ? 50 : parsedLimit;

    const data = await service.listMovements(request.user!.organizationId, {
      materialId,
      limit: finalLimit,
      type: type || undefined
    });
    return reply.send({ success: true, data });
  });

  const adjustmentSchema = z.object({
    materialId: z.string().uuid(),
    type: z.enum(['ENTRY', 'CONSUMPTION', 'ADJUSTMENT']),
    quantity: z.coerce.number().positive(),
    unitCost: z.coerce.number().nonnegative(),
    notes: z.string().optional(),
    justification: z.string().min(3),
  });

  fastify.post('/movements/adjustment', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    // Fastify-multipart handles files differently
    // For simplicity with SOLID and current context, we'll parse fields and handle file if exists
    let body: any = {};
    let fileUrl = '';

    if (request.isMultipart()) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          // Em um cenário real, salvaríamos no S3/Local e pegaríamos a URL
          // Por enquanto, vamos apenas simular a URL
          fileUrl = `uploads/${Date.now()}-${part.filename}`;
          // Consumir o stream para não travar
          await part.toBuffer();
        } else {
          body[part.fieldname] = part.value;
        }
      }
    } else {
      body = request.body;
    }

    try {
      const data = adjustmentSchema.parse(body);
      const prisma = getTenantClient(request.user!.organizationId);
      const service = new StockMovementService(prisma);

      let result;
      if (data.type === 'ENTRY') {
        result = await service.registerEntry(request.user!.organizationId, {
          ...data,
          userId: request.user!.id,
          justification: data.justification,
          documentUrl: fileUrl
        } as any);
      } else if (data.type === 'CONSUMPTION') {
        result = await service.registerInternalConsumption(request.user!.organizationId, request.user!.id, {
          ...data,
          machineId: '00000000-0000-0000-0000-000000000000', // Default para manual
        } as any);
      } else {
        result = await service.registerAdjustment(request.user!.organizationId, request.user!.id, {
          ...data,
          averageCost: data.unitCost,
          documentUrl: fileUrl
        });
      }

      return reply.code(201).send({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          success: false, 
          message: `Erro de validação: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` 
        });
      }
      throw error;
    }
  });

  // ========== PRODUÇÃO INTERNA (MANUFATURADOS) ==========
  // Fabrica um produto a partir da ficha técnica. Debita insumos
  // (PRODUCTION_CONSUMPTION, sem lançar no DRE) e credita estoque
  // de produto acabado (PRODUCTION_OUTPUT). Não gera receita nem
  // despesa — é transferência interna de valor entre estoques.

  const manufactureSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().positive(),
    variables: z.record(z.object({
      value: z.any(),
      unit: z.string().nullable()
    })).optional(),
    selectedOptionIds: z.array(z.string().uuid()).optional(),
    width: z.coerce.number().optional(),
    height: z.coerce.number().optional(),
    machineMinutes: z.array(z.object({
      machineId: z.string().uuid(),
      minutes: z.coerce.number().nonnegative()
    })).optional(),
    notes: z.string().optional()
  });

  fastify.post('/manufacture', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const data = manufactureSchema.parse(request.body);
      const prisma = getTenantClient(request.user!.organizationId);
      const service = new ManufactureProductService(prisma);
      const result = await service.execute(request.user!.organizationId, request.user!.id, data);
      return reply.code(201).send({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: `Erro de validação: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        });
      }
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || 'Erro ao registrar produção interna'
      });
    }
  });

  // Lista produções internas recentes (para o feature "Repetir produção")
  fastify.get('/manufacture/recent', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { limit } = request.query as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new ManufactureProductService(prisma);
    const finalLimit = Math.min(parseInt(limit) || 20, 100);
    const data = await service.listRecent(request.user!.organizationId, finalLimit);
    return reply.send({ success: true, data });
  });

  // Repete uma produção anterior com nova quantidade
  const repeatSchema = z.object({
    quantity: z.coerce.number().positive()
  });

  fastify.post('/manufacture/repeat/:presetId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { presetId } = request.params as { presetId: string };
      const { quantity } = repeatSchema.parse(request.body);
      const prisma = getTenantClient(request.user!.organizationId);
      const service = new ManufactureProductService(prisma);
      const result = await service.repeatFromPreset(
        request.user!.organizationId,
        request.user!.id,
        presetId,
        quantity
      );
      return reply.code(201).send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || 'Erro ao repetir produção'
      });
    }
  });

  fastify.post('/movements/:id/cancel', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { justification } = request.body as { justification: string };
    
    if (!justification) throw new Error('Justificativa é obrigatória para o cancelamento.');

    const prisma = getTenantClient(request.user!.organizationId);
    const service = new StockMovementService(prisma);
    const result = await service.cancelMovement(request.user!.organizationId, request.user!.id, id, justification);
    
    return reply.send({ success: true, data: result });
  });
}