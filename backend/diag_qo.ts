import 'dotenv/config';
import { prisma } from './src/shared/infrastructure/database/prisma';
import { QueryOptimizer } from './src/shared/infrastructure/database/QueryOptimizer';

async function testOptimized() {
  const qo = new QueryOptimizer(prisma);
  
  // Como no controller o ID da org vem do req.user
  const org = await prisma.organization.findFirst();
  if(!org) {
    console.log("No org"); return;
  }

  const result = await qo.getOptimizedOrders(org.id, 50, 0, undefined, undefined);
  
  console.log(`Retornados ${result.length} pedidos da API de QueryOptimizer`);
  result.forEach((o: any) => {
    console.log(` - ${o.orderNumber} | ${o.status} | pendente? ${o.processStatus?.hideFromFlow ? 'SIM (Forçado visível)' : 'NÃO (Normal)'}`);
  });

  await prisma.$disconnect();
}

testOptimized().catch(console.error);
