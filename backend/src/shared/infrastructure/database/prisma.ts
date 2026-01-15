import { PrismaClient } from '@prisma/client';

// Desabilitar logs do Prisma em produção
const globalPrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Função para criar um cliente Prisma "tenant-aware"
export function getTenantClient(organizationId: string) {
  return globalPrisma.$extends({
    query: {
      // Intercepta todas as queries para injetar o filtro de tenant
      profile: {
        async findMany({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async findUnique({ args, query }) {
          // Para findUnique, precisamos garantir que o registro pertence ao tenant
          const result = await query(args);
          if (result && (result as any).organizationId !== organizationId) {
            return null;
          }
          return result;
        },
        async create({ args, query }) {
          (args.data as any).organizationId = organizationId;
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
      },
      material: {
        async findMany({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async create({ args, query }) {
          (args.data as any).organizationId = organizationId;
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
      },
      product: {
        async findMany({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async create({ args, query }) {
          (args.data as any).organizationId = organizationId;
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
      },
      order: {
        async findMany({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async create({ args, query }) {
          (args.data as any).organizationId = organizationId;
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
      },
    },
  });
}

// Cliente padrão para operações que não precisam de tenant (auth, organizations)
export const prisma = globalPrisma;

export default prisma;