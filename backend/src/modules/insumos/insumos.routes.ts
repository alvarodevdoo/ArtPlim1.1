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
}
