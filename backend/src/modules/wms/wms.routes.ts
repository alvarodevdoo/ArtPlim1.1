import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const listQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  search: z.string().optional()
});

export async function wmsRoutes(fastify: FastifyInstance) {
  
  // ========== ESTOQUE ==========
  
  // Listar itens do estoque
  fastify.get('/inventory', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    
    // Implementação temporária - retorna dados mock
    const inventory = [
      {
        id: '1',
        materialId: 'mat-1',
        materialName: 'Papel Couché 300g',
        quantity: 500,
        unit: 'folhas',
        location: 'A1-01',
        minStock: 100,
        maxStock: 1000,
        lastMovement: new Date().toISOString()
      },
      {
        id: '2',
        materialId: 'mat-2',
        materialName: 'Tinta Cyan',
        quantity: 25,
        unit: 'litros',
        location: 'B2-03',
        minStock: 10,
        maxStock: 50,
        lastMovement: new Date(Date.now() - 86400000).toISOString()
      }
    ].slice(0, query.limit || 50);
    
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
    
    // Implementação temporária - retorna dados mock
    const movements = [
      {
        id: '1',
        materialId: 'mat-1',
        materialName: 'Papel Couché 300g',
        type: 'IN',
        quantity: 100,
        unit: 'folhas',
        reason: 'Compra',
        date: new Date().toISOString(),
        user: 'João Silva'
      },
      {
        id: '2',
        materialId: 'mat-1',
        materialName: 'Papel Couché 300g',
        type: 'OUT',
        quantity: 50,
        unit: 'folhas',
        reason: 'Produção - Pedido #001',
        date: new Date(Date.now() - 3600000).toISOString(),
        user: 'Maria Santos'
      }
    ].slice(0, query.limit || 50);
    
    return reply.send({
      success: true,
      data: movements
    });
  });

  // ========== ALERTAS ==========
  
  // Listar alertas de estoque
  fastify.get('/alerts', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    // Implementação temporária - retorna dados mock
    const alerts = [
      {
        id: '1',
        type: 'LOW_STOCK',
        materialId: 'mat-3',
        materialName: 'Papel A4 75g',
        currentStock: 15,
        minStock: 50,
        severity: 'HIGH',
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        type: 'OUT_OF_STOCK',
        materialId: 'mat-4',
        materialName: 'Tinta Magenta',
        currentStock: 0,
        minStock: 10,
        severity: 'CRITICAL',
        createdAt: new Date(Date.now() - 1800000).toISOString()
      }
    ];
    
    return reply.send({
      success: true,
      data: alerts
    });
  });
}