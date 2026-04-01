// UseCase: Criar um novo Departamento/Role customizado
// Valida unicidade e isSystem para evitar sobrescrever os perfis padrão

import { IRoleRepository, RoleData, CreateRoleInput } from '../domain/IRoleRepository';

export class CreateRoleUseCase {
  constructor(private readonly roleRepository: IRoleRepository) {}

  async execute(input: CreateRoleInput): Promise<RoleData> {
    // Impede criação de nomes duplicados na mesma organização
    const existing = await this.roleRepository.findByName(input.name, input.organizationId);
    if (existing) {
      throw new Error(`Já existe um perfil com o nome "${input.name}" nesta organização.`);
    }

    return this.roleRepository.create(input);
  }
}
