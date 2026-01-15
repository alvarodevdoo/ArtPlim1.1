import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProductionService } from './services/ProductionService';
import { MachineService } from './services/MachineService';
import { getTenantClient } from '../../@core/database/prisma';

const createProductionSchema = z.object({
  orderId: z.string().uuid(),
  priority: z.number().int().min(1).max(5).default(3),
  scheduledStart: z.string().datetime().optional(),
  estimatedEnd: z.string().datetime().optional(),
  machineId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  notes: z.string().optional()
});

const updateProductionSchema = z.object({
  priority: z.number().int().min(1).max(5).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
  scheduledStart: z.string().datetime().optional(),
  actualStart: z.string().datetime().optional(),
  estimatedEnd: z.string().datetime().optional(),
  actualEnd: z.string().datetime().optional(),
  assignedTo: z.string().uuid().optional(),
  machineId: z.string().uuid().optional(),
  notes: z.string().optional()
});

const createMachineSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['PRINTER', 'CUTTER', 'LAMINATOR', 'PLOTTER', 'OTHER']),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  maxWidth: z.number().positive().optional(),
  maxHeight: z.number().positive().optional(),
  speedPerMinute: z.number().positive().optional()
});

export async function productionRoutes(fastify: FastifyInstance) {
  
  // ========== FILA DE PRODUÇÃO ==========
  
  // Listar fila de produção (Kanban)
  fastify.get('/queue', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = request.query as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const productionService = new ProductionService(prisma);
    
    const queue = await productionService.getQueue({
      status: query.status,
      priority: query.priority ? parseInt(query.priority) : undefined,
      machineId: query.machineId,
      assignedTo: query.assignedTo
    });
    
    return reply.send({
      success: true,
      data: queue
    });
  });

  // Adicionar pedido à fila de produção
  fastify.post('/queue', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = createProductionSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const productionService = new ProductionService(prisma);
    
    const production = await productionService.addToQueue(body);
    
    return reply.code(201).send({
      success: true,
      data: production
    });
  });

  // Atualizar item da fila
  fastify.put('/queue/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateProductionSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const productionService = new ProductionService(prisma);
    
    const production = await productionService.updateQueue(id, body);
    
    return reply.send({
      success: true,
      data: production
    });
  });

  // Iniciar produção
  fastify.post('/queue/:id/start', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const productionService = new ProductionService(prisma);
    
    const production = await productionService.startProduction(id);
    
    return reply.send({
      success: true,
      data: production
    });
  });

  // Pausar produção
  fastify.post('/queue/:id/pause', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const productionService = new ProductionService(prisma);
    
    const production = await productionService.pauseProduction(id);
    
    return reply.send({
      success: true,
      data: production
    });
  });

  // Finalizar produção
  fastify.post('/queue/:id/complete', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const productionService = new ProductionService(prisma);
    
    const production = await productionService.completeProduction(id);
    
    return reply.send({
      success: true,
      data: production
    });
  });

  // ========== MÁQUINAS ==========
  
  // Listar máquinas
  fastify.get('/machines', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const machineService = new MachineService(prisma);
    
    const machines = await machineService.list();
    
    return reply.send({
      success: true,
      data: machines
    });
  });

  // Criar máquina
  fastify.post('/machines', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const body = createMachineSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const machineService = new MachineService(prisma);
    
    const machine = await machineService.create(body);
    
    return reply.code(201).send({
      success: true,
      data: machine
    });
  });

  // Atualizar status da máquina
  fastify.patch('/machines/:id/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const machineService = new MachineService(prisma);
    
    const machine = await machineService.updateStatus(id, status);
    
    return reply.send({
      success: true,
      data: machine
    });
  });

  // ========== RELATÓRIOS DE PRODUÇÃO ==========
  
  // Dashboard de produção
  fastify.get('/dashboard', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const productionService = new ProductionService(prisma);
    
    const dashboard = await productionService.getDashboard();
    
    return reply.send({
      success: true,
      data: dashboard
    });
  });

  // Relatório de eficiência
  fastify.get('/reports/efficiency', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const query = request.query as any;
    const prisma = getTenantClient(request.user!.organizationId);
    const productionService = new ProductionService(prisma);
    
    const report = await productionService.getEfficiencyReport({
      startDate: query.startDate,
      endDate: query.endDate,
      machineId: query.machineId
    });
    
    return reply.send({
      success: true,
      data: report
    });
  });
}