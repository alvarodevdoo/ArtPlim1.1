
import { prisma } from '../src/shared/infrastructure/database/prisma';
import { QueryOptimizer } from '../src/shared/infrastructure/database/QueryOptimizer';

async function run() {
  console.log('Starting Database Optimization...');
  const optimizer = new QueryOptimizer(prisma);
  try {
    await optimizer.createOptimizedIndexes();
    console.log('Database Optimization Completed Successfully!');
  } catch (err) {
    console.error('Optimization FAILED:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
