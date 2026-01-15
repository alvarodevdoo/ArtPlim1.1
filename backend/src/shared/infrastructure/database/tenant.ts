import { PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

// For now, we'll use a single database instance
// In the future, this can be extended for multi-tenancy
export function getTenantClient(tenantId?: string): PrismaClient {
  // TODO: Implement proper multi-tenant database selection
  return prisma;
}

// Export prisma for direct access when needed
export { prisma };