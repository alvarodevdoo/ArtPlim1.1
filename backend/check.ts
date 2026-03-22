import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const statuses = await (prisma as any).processStatus.findMany({ take: 5 });
  console.log(JSON.stringify(statuses, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
