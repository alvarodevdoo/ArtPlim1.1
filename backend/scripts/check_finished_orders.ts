import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.order.findMany({
    where: {
      status: { in: ['FINISHED', 'DELIVERED'] }
    },
    include: {
      items: {
        include: {
          product: true
        }
      }
    }
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
