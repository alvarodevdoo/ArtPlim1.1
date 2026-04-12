import { prisma } from './src/shared/infrastructure/database/prisma';

async function main() {
  const m = await prisma.material.findFirst({
    where: { name: { contains: 'MDF', mode: 'insensitive' } }
  });

  if (!m) {
    console.log('Material não encontrado');
    return;
  }

  const movements = await prisma.stockMovement.findMany({
    where: { materialId: m.id },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log('=== ESTADO ATUAL DO MATERIAL ===');
  console.log(JSON.stringify({
    id: m.id,
    name: m.name,
    unit: m.unit,
    controlUnit: m.controlUnit,
    currentStock: m.currentStock,
    multiplier: m.multiplicador_padrao_entrada,
    conversionFactor: m.conversionFactor,
    averageCost: m.averageCost
  }, null, 2));

  console.log('\n=== ÚLTIMAS MOVIMENTAÇÕES ===');
  movements.forEach(mov => {
    console.log(`[${mov.createdAt.toISOString()}] ${mov.type} | Qtd: ${mov.quantity} | Custo: ${mov.unitCost}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
