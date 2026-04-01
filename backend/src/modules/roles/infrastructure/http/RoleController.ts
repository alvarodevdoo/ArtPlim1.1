// Controller: Orquestra a ligação entre HTTP e UseCases
// Princípio SRP: apenas traduz requests HTTP para chamadas de UseCase

import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { PrismaRoleRepository } from '../../infrastructure/database/PrismaRoleRepository';
import { ListRolesUseCase } from '../../useCases/ListRolesUseCase';
import { CreateRoleUseCase } from '../../useCases/CreateRoleUseCase';
import { UpdateRolePermissionsUseCase } from '../../useCases/UpdateRolePermissionsUseCase';

function makeRepository() {
  return new PrismaRoleRepository(prisma);
}

export async function listRoles(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.user!;
  const useCase = new ListRolesUseCase(makeRepository());
  const roles = await useCase.execute(organizationId);
  return reply.send({ success: true, data: roles });
}

export async function createRole(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.user!;
  const body = request.body as { name: string; description?: string };

  const useCase = new CreateRoleUseCase(makeRepository());
  const role = await useCase.execute({
    organizationId,
    name: body.name,
    description: body.description,
  });

  return reply.code(201).send({ success: true, data: role });
}

export async function updateRolePermissions(request: FastifyRequest, reply: FastifyReply) {
  const { organizationId } = request.user!;
  const { id } = request.params as { id: string };
  const body = request.body as { permissions: string[] };

  const useCase = new UpdateRolePermissionsUseCase(makeRepository());
  const role = await useCase.execute({
    roleId: id,
    organizationId,
    permissions: body.permissions,
  });

  return reply.send({ success: true, data: role });
}
