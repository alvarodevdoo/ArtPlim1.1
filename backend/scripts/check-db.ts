import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const orgs = await prisma.organization.findMany();
    console.log('Organizations:', orgs);
    const users = await prisma.user.findMany();
    console.log('Users:', users);
    const settings = await prisma.organizationSettings.findMany();
    console.log('Settings:', settings);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
