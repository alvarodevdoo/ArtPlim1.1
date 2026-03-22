import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOrder() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: {
      items: true
    }
  });

  if (orders.length === 0) {
    console.log('No orders found.');
    return;
  }

  const order = orders[0];
  console.log(`Checking order: ${order.id}`);
  
  for (const item of order.items) {
    console.log(`Item productId: ${item.productId}, pricingRuleId: ${item.pricingRuleId}`);

    // Try finding the pricing rule
    if (item.pricingRuleId) {
      const rule = await prisma.pricingRule.findUnique({
        where: { id: item.pricingRuleId }
      });
      console.log('Fixed Rule:', rule ? 'Found' : 'NULL');
    }

    // Checking product
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: {
        id: true,
        pricingRuleId: true,
        pricingRule: true
      }
    });

    console.log('Product Pricing Rule ID:', product?.pricingRuleId);
    console.log('Product Pricing Rule relation:', product?.pricingRule ? 'Exists' : 'NULL');
  }
}

checkOrder().catch(console.error).finally(() => prisma.$disconnect());
