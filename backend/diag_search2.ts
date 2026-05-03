import { prisma } from './src/shared/infrastructure/database/prisma';
import { QueryOptimizer } from './src/shared/infrastructure/database/QueryOptimizer';

async function run() {
  const optimizer = new QueryOptimizer(prisma);
  
  const orgId = 'e4e1ae07-489f-4a43-972b-55f544204e77';
  const term = '6733860416';
  
  const results = await optimizer.getOptimizedOrders(orgId, 10, 0, term);
  console.log(`\nSearch for '${term}': Found ${results.length} orders.`);
  results.forEach(r => {
    console.log(`Order: ${r.orderNumber}, Status: ${r.status}`);
  });

  await prisma.$disconnect();
}
run();
