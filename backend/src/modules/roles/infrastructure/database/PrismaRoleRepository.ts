// Implementação concreta do repositório utilizando Prisma ORM
// Princípio SRP: única responsabilidade de persistência de dados
// Princípio DIP: implementa a abstração IRoleRepository

import { PrismaClient } from '@prisma/client';
import {
  IRoleRepository,
  RoleData,
  CreateRoleInput,
  UpdateRolePermissionsInput,
} from '../../domain/IRoleRepository';

export class PrismaRoleRepository implements IRoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toRoleData(role: any): RoleData {
    return {
      id: role.id,
      organizationId: role.organizationId,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      active: role.active,
      createdAt: role.createdAt,
      permissions: role.permissions ?? [],
    };
  }

  async findAllByOrganization(organizationId: string): Promise<RoleData[]> {
    const roles = await this.prisma.role.findMany({
      where: { organizationId, active: true },
      include: { permissions: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map(this.toRoleData);
  }

  async findById(id: string, organizationId: string): Promise<RoleData | null> {
    const role = await this.prisma.role.findFirst({
      where: { id, organizationId },
      include: { permissions: true },
    });
    return role ? this.toRoleData(role) : null;
  }

  async findByName(name: string, organizationId: string): Promise<RoleData | null> {
    const role = await this.prisma.role.findFirst({
      where: { name, organizationId },
      include: { permissions: true },
    });
    return role ? this.toRoleData(role) : null;
  }

  async create(data: CreateRoleInput): Promise<RoleData> {
    const role = await this.prisma.role.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        isSystem: false,
      },
      include: { permissions: true },
    });
    return this.toRoleData(role);
  }

  async updatePermissions(input: UpdateRolePermissionsInput): Promise<RoleData> {
    // Transação atômica: deleta as antigas e insere as novas
    const role = await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: input.roleId } });

      if (input.permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: input.permissions.map((key) => ({
            roleId: input.roleId,
            permissionKey: key,
          })),
        });
      }

      return tx.role.findFirst({
        where: { id: input.roleId, organizationId: input.organizationId },
        include: { permissions: true },
      });
    });

    if (!role) throw new Error('Role não encontrado após atualização.');
    return this.toRoleData(role);
  }

  async deactivate(id: string, organizationId: string): Promise<void> {
    await this.prisma.role.update({
      where: { id },
      data: { active: false },
    });
  }
}
