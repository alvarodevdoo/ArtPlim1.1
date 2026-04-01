import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: { email: 'admin@artplim.com.br' },
    data: { role: 'OWNER' as any }
  });
  console.log(`Linhas afetadas: ${result.count}`);
  console.log('Atualização concluída: O usuário admin@artplim.com.br agora é o OWNER do sistema.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
