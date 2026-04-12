import { prisma } from './src/shared/infrastructure/database/prisma';

async function main() {
  const targetId = 'ac08c964-1590-486d-8ea9-5bdf2dd99cfa'; // O material MDF bagunçado
  
  const m = await prisma.material.findUnique({
    where: { id: targetId }
  });

  if (!m) {
    console.log('Material não encontrado');
    return;
  }

  console.log(`Limpando histórico e zerando estoque de: ${m.name}`);

  // 1. Deletar TODAS as movimentações de estoque desse material
  const deleteMovements = await prisma.stockMovement.deleteMany({
    where: { materialId: targetId }
  });

  console.log(`- ${deleteMovements.count} movimentações removidas.`);

  // 2. Resetar o saldo e o custo para zero
  // Também vamos garantir que a unidade de controle seja UN para começar limpo
  await prisma.material.update({
    where: { id: targetId },
    data: {
      currentStock: 0,
      averageCost: 0,
      controlUnit: 'UN',
      conversionFactor: 1.271875
    }
  });

  console.log('--- RESET COMPLETO ---');
  console.log('Saldo: 0.0');
  console.log('Histórico: Limpo');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
