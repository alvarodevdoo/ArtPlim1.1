import { FastifyInstance } from 'fastify';
import { listRoles, createRole, updateRolePermissions } from './RoleController';

export async function roleRoutes(fastify: FastifyInstance) {
  // GET /api/roles - Listar departamentos da organização
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, listRoles);

  // POST /api/roles - Criar novo departamento
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, createRole);

  // PUT /api/roles/:id/permissions - Atualizar permissões de um departamento
  fastify.put('/:id/permissions', {
    preHandler: [fastify.authenticate]
  }, updateRolePermissions);
}
