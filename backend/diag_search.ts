import { prisma } from './src/shared/infrastructure/database/prisma';
import { QueryOptimizer } from './src/shared/infrastructure/database/QueryOptimizer';

async function run() {
  const optimizer = new QueryOptimizer(prisma);
  
  // Try searching for a phone number or document
  const orgId = 'e4e1ae07-489f-4a43-972b-55f544204e77'; // I saw this in previous diag
  const searchTerms = ['6733860416', '33860416']; // The phone number from PED-0015 screenshot
  
  for (const term of searchTerms) {
    const results = await optimizer.getOptimizedOrders(orgId, 10, 0, term);
    console.log(`\nSearch for '${term}': Found ${results.length} orders.`);
    if (results.length > 0) {
       console.log(`Order: ${results[0].orderNumber}, Phone: ${results[0].customer.phone}`);
    }
  }

  await prisma.$disconnect();
}
run();
