
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVinil() {
  const products = await prisma.product.findMany({
    where: { name: { contains: 'Vinil', mode: 'insensitive' } },
    include: {
      fichasTecnicas: true,
      pricingRule: true,
      category: true
    }
  });

  console.log('--- PRODUCTS FOUND ---');
  console.log(JSON.stringify(products, null, 2));

  for (const product of products) {
      const orders = await prisma.orderItem.findMany({
          where: { productId: product.id },
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: { order: true }
      });
      console.log(`--- ORDER ITEMS FOR ${product.name} ---`);
      console.log(JSON.stringify(orders, null, 2));
  }
}

checkVinil().catch(console.error).finally(() => prisma.$disconnect());
