import { PrismaClient } from '@prisma/client';
import { SeedChartOfAccountsUseCase } from '../src/modules/chartOfAccounts/useCases/SeedChartOfAccountsUseCase';

async function reset() {
  const prisma = new PrismaClient();
  // We need to find the organization first
  const org = await prisma.organization.findFirst();
  
  if (!org) {
    console.log("Nenhuma organização encontrada.");
    return;
  }

  console.log(`Resetando plano de contas para organização: ${org.name} (${org.id})`);

  // 1. Deletar existentes
  await prisma.chartOfAccount.deleteMany({
    where: { organizationId: org.id }
  });

  // 2. Rodar Seed
  const seed = new SeedChartOfAccountsUseCase();
  await seed.execute(org.id, prisma as any);

  console.log("Plano de contas resetado com sucesso!");
  await prisma.$disconnect();
}

reset().catch(console.error);
