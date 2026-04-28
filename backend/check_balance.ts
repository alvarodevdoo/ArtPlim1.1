import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Verificando Perfis ---');
  const profiles = await prisma.profile.findMany({
    where: {
      name: {
        contains: 'Portuguesa',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      name: true,
      balance: true,
      _count: {
        select: {
          balanceMovements: true
        }
      }
    }
  });

  console.log(JSON.stringify(profiles, null, 2));
  
  if (profiles.length > 0) {
    console.log('\n--- Últimas Movimentações ---');
    const movements = await prisma.profileBalanceMovement.findMany({
      where: {
        profileId: profiles[0].id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    console.log(JSON.stringify(movements, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
