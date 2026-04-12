import { prisma } from './src/shared/infrastructure/database/prisma';

async function main() {
  const material = await prisma.material.findFirst({
    where: { name: { contains: 'MDF', mode: 'insensitive' } }
  });

  if (!material) {
    console.log('Material não encontrado');
    return;
  }

  console.log(`Corrigindo material: ${material.name} (ID: ${material.id})`);
  console.log(`Saldo antigo: ${material.currentStock} | Custo antigo: ${material.averageCost}`);

  // Ajuste para 16 unidades (4 chapas x 4 pedaços)
  // Valor total de R$ 240,00 -> R$ 15,00 por pedaço
  await prisma.material.update({
    where: { id: material.id },
    data: {
      currentStock: 16,
      averageCost: 15,
      // Também corrigimos o fator de conversão para a área real do pedaço (5.0875 / 4 = 1.2718)
      conversionFactor: 1.2718
    }
  });

  console.log('--- Material corrigido com sucesso! ---');
  console.log('Novo saldo: 16.0');
  console.log('Novo custo: 15.0');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
