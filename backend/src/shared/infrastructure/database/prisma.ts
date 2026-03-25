import { PrismaClient } from '@prisma/client';

const globalPrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export function getTenantClient(organizationId: string) {
  return globalPrisma.$extends({
    query: {
      profile: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findUnique({ args, query }) {
          const result = await query(args);
          if (result && (result as any).organizationId !== organizationId) return null;
          return result;
        },
        async create({ args, query }) { (args.data as any).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      material: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as any).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      product: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as any).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      order: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as any).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      transaction: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as any).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      account: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as any).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      category: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as any).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
      chartOfAccount: {
        async findMany({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async findFirst({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async create({ args, query }) { (args.data as any).organizationId = organizationId; return query(args); },
        async update({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
        async delete({ args, query }) { args.where = { ...args.where, organizationId }; return query(args); },
      },
    },
  });
}

export const prisma = globalPrisma;
export default prisma;