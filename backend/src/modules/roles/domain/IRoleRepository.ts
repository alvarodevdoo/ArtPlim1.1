// Domain: Tipos e Interfaces puras (sem dependência de infraestrutura)
// Princípio ISP: interfaces pequenas e específicas por responsabilidade

export interface RolePermissionData {
  id: string;
  roleId: string;
  permissionKey: string;
}

export interface RoleData {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  active: boolean;
  createdAt: Date;
  permissions: RolePermissionData[];
}

export interface CreateRoleInput {
  organizationId: string;
  name: string;
  description?: string;
}

export interface UpdateRolePermissionsInput {
  roleId: string;
  organizationId: string;
  permissions: string[];
}

// Princípio DIP: Repositório como abstração pura
export interface IRoleRepository {
  findAllByOrganization(organizationId: string): Promise<RoleData[]>;
  findById(id: string, organizationId: string): Promise<RoleData | null>;
  findByName(name: string, organizationId: string): Promise<RoleData | null>;
  create(data: CreateRoleInput): Promise<RoleData>;
  updatePermissions(input: UpdateRolePermissionsInput): Promise<RoleData>;
  deactivate(id: string, organizationId: string): Promise<void>;
}
