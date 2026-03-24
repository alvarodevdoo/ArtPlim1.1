import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ 
    where: { pricingMode: 'SIMPLE_AREA', organizationId: '0b5c5f99-e87f-47e3-b654-3c18e61d98da' },
    select: { id: true, name: true, pricingMode: true, formulaData: true, salePrice: true, pricingRuleId: true }
  });
  console.log(JSON.stringify(products, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
