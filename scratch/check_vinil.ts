
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkVinil() {
  const product = await prisma.product.findFirst({
    where: { name: { contains: 'Vinil', mode: 'insensitive' } },
    include: {
      fichasTecnicas: true,
      pricingRule: true
    }
  });

  console.log('--- PRODUCT ---');
  console.log(JSON.stringify(product, null, 2));

  if (product) {
      const orders = await prisma.orderItem.findMany({
          where: { productId: product.id },
          take: 5,
          orderBy: { createdAt: 'desc' }
      });
      console.log('--- ORDER ITEMS ---');
      console.log(JSON.stringify(orders, null, 2));
  }
}

checkVinil().catch(console.error).finally(() => prisma.$disconnect());
