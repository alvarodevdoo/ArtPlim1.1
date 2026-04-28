import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const profileName = 'Portuguesa';
  const profile = await prisma.profile.findFirst({
    where: { name: { contains: profileName, mode: 'insensitive' } }
  });

  if (!profile) {
    console.log('Cliente não encontrado');
    return;
  }

  console.log(`Cliente: ${profile.name}, ID: ${profile.id}, Saldo Atual: ${profile.balance}`);

  const newBalance = 50.00;
  await prisma.profile.update({
    where: { id: profile.id },
    data: { balance: newBalance }
  });

  console.log(`Saldo atualizado para: ${newBalance}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
