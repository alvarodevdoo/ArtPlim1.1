import { prisma } from './src/shared/infrastructure/database/prisma';

async function run() {
  const profile = await prisma.profile.findUnique({
    where: { id: '9b439da2-b574-46f5-ac90-33c10d9c1793' }
  });
  console.log('Profile:', JSON.stringify(profile, null, 2));
  await prisma.$disconnect();
}
run();
