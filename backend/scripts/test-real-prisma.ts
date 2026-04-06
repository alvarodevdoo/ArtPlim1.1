
import { prisma } from '../src/shared/infrastructure/database/prisma';

async function test() {
  console.log('Testing Prisma instance from src/shared/infrastructure/database/prisma.ts...');
  try {
    const start = Date.now();
    const count = await prisma.organization.count();
    console.log(`Success! Orgs: ${count} in ${Date.now() - start}ms`);
  } catch (err) {
    console.error('Test FAILED:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
