
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing database connection...');
    await prisma.$connect();
    console.log('Connected!');

    console.log('Fetching first organization...');
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.log('No organization found in DB!');
      return;
    }
    console.log('Using Org:', org.id);

    console.log('Testing Category model with INCLUDES...');
    // Tentativa deliberada de disparar erros de relação se o esquema estiver inconsistente
    const categories = await prisma.category.findMany({
      where: { organizationId: org.id },
      include: {
        chartOfAccount: true,
        inventoryAccount: true,
        expenseAccount: true
      },
      take: 1
    });
    console.log('Result:', categories.length > 0 ? 'Success' : 'No categories found (but query works)');

  } catch (err: any) {
    console.error('DB TEST FAILED:', err);
    console.error('Error Code:', err.code);
    console.error('Stack:', err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
