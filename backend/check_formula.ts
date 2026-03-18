
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findFirst({
    where: { name: { contains: 'Adesivo Vinil' } },
    include: { pricingRule: true }
  });

  if (!product) {
    console.log('Product not found');
    return;
  }

  console.log('Product ID:', product.id);
  console.log('Pricing Rule Formula:', product.pricingRule?.formula);
}

main().catch(console.error).finally(() => prisma.$disconnect());
