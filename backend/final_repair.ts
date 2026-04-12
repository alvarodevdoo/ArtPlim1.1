import { prisma } from './src/shared/infrastructure/database/prisma';

async function main() {
  const targetId = 'ac08c964-1590-486d-8ea9-5bdf2dd99cfa';
  
  const m = await prisma.material.findUnique({
    where: { id: targetId }
  });

  if (!m) {
    console.log('Material not found');
    return;
  }

  console.log(`Corrigindo material: ${m.name}`);
  console.log(`Saldo antigo: ${m.currentStock} | Unidade Controle antiga: ${m.controlUnit}`);

  // Ajuste Final:
  // 1. Saldo 16 (4 chapas x 4 pedaços)
  // 2. Unidade de controle igual à unidade de estoque (CH) para evitar confusão no banco
  // 3. Área por pedaço salva em conversionFactor (1.27)
  await prisma.material.update({
    where: { id: targetId },
    data: {
      currentStock: 16.0,
      averageCost: 15.0,
      controlUnit: 'UN',
      conversionFactor: 1.271875
    }
  });

  console.log('--- REPARO FINAL CONCLUÍDO ---');
  console.log('Novo saldo: 16.0 CH');
  console.log('Custo: 15.0');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
