// UseCase: Listar todos os roles de uma organização
// Princípio SRP: uma única operação de negócio

import { IRoleRepository, RoleData } from '../domain/IRoleRepository';

export class ListRolesUseCase {
  constructor(private readonly roleRepository: IRoleRepository) {}

  async execute(organizationId: string): Promise<RoleData[]> {
    return this.roleRepository.findAllByOrganization(organizationId);
  }
}
