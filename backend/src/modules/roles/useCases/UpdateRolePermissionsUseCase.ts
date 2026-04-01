// UseCase: Atualizar as permissões de um Role específico
// Princípio OCP: extensível adicionando novos permissionKeys sem alterar esta classe

import { IRoleRepository, RoleData, UpdateRolePermissionsInput } from '../domain/IRoleRepository';

export class UpdateRolePermissionsUseCase {
  constructor(private readonly roleRepository: IRoleRepository) {}

  async execute(input: UpdateRolePermissionsInput): Promise<RoleData> {
    const role = await this.roleRepository.findById(input.roleId, input.organizationId);

    if (!role) {
      throw new Error('Perfil de acesso não encontrado.');
    }

    if (role.isSystem && role.name === 'Proprietário') {
      throw new Error('As permissões do Proprietário não podem ser alteradas.');
    }

    return this.roleRepository.updatePermissions(input);
  }
}
