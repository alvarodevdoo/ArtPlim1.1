/**
 * Rotas do Módulo de Insumos (Matérias-primas)
 *
 * Fastify + Zod para validação. Todas as rotas exigem autenticação.
 * Prefixo registrado em app.ts: /api/insumos
 *
 * Padrão: Package by Feature – src/modules/insumos/
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { InsumoService } from './InsumoService';
import { getTenantClient } from '../../shared/infrastructure/database/tenant';
import { MaterialReceiptService } from './MaterialReceiptService';
import { BillingService } from './BillingService';

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

/** Enum alinhado com o Prisma `UnidadeBase` */
const unidadeBaseEnum = z.enum(['KG', 'M2', 'M', 'UN', 'LITRO']);

/**
 * Schema para criação de Insumo.
 * Todos os campos obrigatórios são validados aqui—
 * o controller não precisa de lógica de validação extra.
 */
const createInsumoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  categoria: z.string().min(1, 'Categoria é obrigatória'),
  unidadeBase: unidadeBaseEnum,
  custoUnitario: z.number().positive('Custo unitário deve ser positivo'),
  ativo: z.boolean().optional().default(true),
});

/**
 * Schema para atualização parcial (PATCH/PUT).
 * Todos os campos viram opcionais via `.partial()`.
 */
const updateInsumoSchema = createInsumoSchema.partial();

/** Schema para query string da listagem */
const listQuerySchema = z.object({
  categoria: z.string().optional(),
  // "true" | "false" em query string → converte para boolean
  ativo: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});

// ─── Registro de Rotas ────────────────────────────────────────────────────────

export async function insumosRoutes(fastify: FastifyInstance) {
  // ── GET /api/insumos ──────────────────────────────────────────────────────
  // Lista insumos com filtros opcionais por categoria e status.
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    const insumos = await service.list(request.user!.organizationId, {
      categoria: query.categoria,
      ativo: query.ativo,
    });

    return reply.send({ success: true, data: insumos });
  });

  // ── GET /api/insumos/categorias ──────────────────────────────────────────
  // Retorna lista de categorias distintas para popular selects no frontend.
  // ⚠ Registrar ANTES de /:id para evitar conflito de rota.
  fastify.get('/categorias', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    const categorias = await service.listCategorias(request.user!.organizationId);
    return reply.send({ success: true, data: categorias });
  });

  // ── GET /api/insumos/:id ──────────────────────────────────────────────────
  // Busca um insumo pelo UUID.
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    const insumo = await service.findById(id, request.user!.organizationId);
    return reply.send({ success: true, data: insumo });
  });

  // ── GET /api/insumos/:id/batches ──────────────────────────────────────────
  // Retorna os lotes ativos seguindo a regra PEPS.
  fastify.get('/:id/batches', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    const batches = await service.getFifoBatches(id, request.user!.organizationId);
    return reply.send({ success: true, data: batches });
  });

  // ── POST /api/insumos ─────────────────────────────────────────────────────
  // Cria um novo insumo.
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const body = createInsumoSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    const insumo = await service.create({
      ...body,
      organizationId: request.user!.organizationId,
    });

    return reply.code(201).send({ success: true, data: insumo });
  });

  // ── PUT /api/insumos/:id ──────────────────────────────────────────────────
  // Atualiza os dados de um insumo (inclui atualização de preço).
  fastify.put('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateInsumoSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    const insumo = await service.update(id, request.user!.organizationId, body);
    return reply.send({ success: true, data: insumo });
  });

  // ── PATCH /api/insumos/:id/status ─────────────────────────────────────────
  // Alterna ativo ↔ inativo de forma segura (soft delete preferível ao DELETE).
  fastify.patch('/:id/status', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    const insumo = await service.toggleStatus(id, request.user!.organizationId);
    return reply.send({ success: true, data: insumo });
  });

  // ── DELETE /api/insumos/:id ───────────────────────────────────────────────
  // Remoção permanente. Use toggleStatus para desativação suave.
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    await service.delete(id, request.user!.organizationId);
    return reply.send({ success: true, message: 'Insumo removido com sucesso.' });
  });

  // ─── Fornecedores Vinculados ───────────────────────────────────────────────

  const addFornecedorSchema = z.object({
    fornecedorId: z.string().uuid(),
    precoCusto: z.number().optional(),
    referencia: z.string().optional(),
    ativo: z.boolean().optional()
  });

  // GET /api/insumos/:id/fornecedores
  fastify.get('/:id/fornecedores', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    const fornecedores = await service.listFornecedores(id, request.user!.organizationId);
    return reply.send({ success: true, data: fornecedores });
  });

  // POST /api/insumos/:id/fornecedores
  fastify.post('/:id/fornecedores', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = addFornecedorSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    const relation = await service.addFornecedor(id, request.user!.organizationId, body);
    return reply.status(201).send({ success: true, data: relation });
  });

  // PATCH /api/insumos/:id/fornecedores/:relationId/active
  fastify.patch('/:id/fornecedores/:relationId/active', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id, relationId } = request.params as { id: string, relationId: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    const relation = await service.setFornecedorAtivo(id, relationId, request.user!.organizationId);
    return reply.send({ success: true, data: relation });
  });

  // DELETE /api/insumos/:id/fornecedores/:relationId
  fastify.delete('/:id/fornecedores/:relationId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id, relationId } = request.params as { id: string, relationId: string };
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new InsumoService(prisma);

    await service.removeFornecedor(id, relationId, request.user!.organizationId);
    return reply.send({ success: true, message: 'Vínculo removido.' });
  });

  // ─── REceipts (Entrada de Materiais / Faturamento) ────────────────────────

  const createReceiptSchema = z.object({
    supplierId: z.string().uuid('Fornecedor inválido'),
    invoiceNumber: z.string().optional(),
    totalAmount: z.number().positive('O valor deve ser positivo'),
    issueDate: z.string().optional(),
  });

  const closeReceiptsSchema = z.object({
    supplierId: z.string().uuid('Fornecedor inválido'),
    receiptIds: z.array(z.string().uuid('ID de recibo inválido')).min(1, 'Selecione ao menos um recibo'),
    dueDate: z.string(),
    stockAccountId: z.string().uuid('Conta de Estoque inválida'),
    supplierAccountId: z.string().uuid('Conta do Fornecedor inválida'),
    notes: z.string().optional()
  });

  // POST /api/insumos/receipts
  fastify.post('/receipts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = createReceiptSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new MaterialReceiptService(prisma);

    const receipt = await service.createReceipt({
      organizationId: request.user!.organizationId,
      supplierId: body.supplierId,
      invoiceNumber: body.invoiceNumber,
      totalAmount: body.totalAmount,
      issueDate: body.issueDate ? new Date(body.issueDate) : undefined
    });

    return reply.code(201).send({ success: true, data: receipt });
  });

  // GET /api/insumos/receipts
  fastify.get('/receipts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new MaterialReceiptService(prisma);

    const pendingReceipts = await service.listPending(request.user!.organizationId);
    return reply.send({ success: true, data: pendingReceipts });
  });

  // POST /api/insumos/receipts/close
  fastify.post('/receipts/close', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = closeReceiptsSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new BillingService(prisma);

    const payable = await service.closeReceipts({
      organizationId: request.user!.organizationId,
      supplierId: body.supplierId,
      receiptIds: body.receiptIds,
      dueDate: new Date(body.dueDate),
      stockAccountId: body.stockAccountId,
      supplierAccountId: body.supplierAccountId,
      notes: body.notes,
      userId: request.user!.userId
    });

    return reply.send({ success: true, data: payable });
  });
}
