import { prisma } from './src/shared/infrastructure/database/prisma';
async function run() {
  const account = await prisma.account.findUnique({
    where: { id: '75167cee-3977-4d46-afea-777933c99bc0' }
  });
  console.log('Account Info:', JSON.stringify(account, null, 2));

  await prisma.$disconnect();
}
run();
