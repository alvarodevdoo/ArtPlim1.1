import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { InventoryService } from './services/InventoryService';
import { prisma } from '../../shared/infrastructure/database/tenant';

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
    const inventoryService = new InventoryService(prisma);
    
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
  
  // Listar movimentações
  fastify.get('/movements', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    
    // Implementação real simplificada ou manter mock se não houver service
    // Por enquanto, vamos retornar vazio se não houver lógica, mas no formato correto
    const inventoryService = new InventoryService(prisma);
    const data = await prisma.inventoryMovement.findMany({
      take: query.limit || 50,
      include: {
        inventoryItem: {
          include: {
            material: true
          }
        },
        user: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return reply.send({
      success: true,
      data
    });
  });

  // ========== ALERTAS ==========
  
  // Listar alertas de estoque
  fastify.get('/alerts', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const inventoryService = new InventoryService(prisma);
    const alerts = await inventoryService.getAlerts();
    
    return reply.send({
      success: true,
      data: alerts
    });
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
    const inventoryService = new InventoryService(prisma);
    
    const item = await inventoryService.addItem(data as any);
    
    return reply.code(201).send({
      success: true,
      data: item
    });
  });
}