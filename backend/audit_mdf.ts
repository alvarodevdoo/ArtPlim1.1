import { prisma } from './src/shared/infrastructure/database/prisma';

async function main() {
  const m = await prisma.material.findFirst({
    where: { name: { contains: 'MDF', mode: 'insensitive' } }
  });

  if (!m) {
    console.log('Material not found');
    return;
  }

  const movements = await prisma.stockMovement.findMany({
    where: { materialId: m.id },
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: { user: { select: { name: true } } }
  });

  console.log('=== MATERIAL DATA ===');
  console.log(JSON.stringify(m, null, 2));
  console.log('\n=== LAST 15 MOVEMENTS ===');
  movements.forEach(mov => {
    console.log(`[${mov.createdAt.toISOString()}] ${mov.type} | Qty: ${mov.quantity} | Cost: ${mov.unitCost} | Note: ${mov.notes}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
