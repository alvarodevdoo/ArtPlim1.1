import { prisma } from './src/shared/infrastructure/database/prisma';

async function main() {
  const targetId = 'ac08c964-1590-486d-8ea9-5bdf2dd99cfa'; // O MDF em questão
  
  console.log('--- INICIANDO ESTABILIZAÇÃO FINAL DO MDF ---');

  // 1. Limpar Histórico de Movimentações
  const deleted = await prisma.stockMovement.deleteMany({
    where: { materialId: targetId }
  });
  console.log(`- ${deleted.count} movimentações removidas.`);

  // 2. Configurar Material para Controle por Unidade (UN/CH)
  // Área total da chapa (2.75 x 1.85) = 5.0875 m2
  // Fracionado em 4 pedaços (CH) -> Cada peça tem 1.271875 m2
  await prisma.material.update({
    where: { id: targetId },
    data: {
      currentStock: 16.0,            // 4 chapas da nota * 4 pedaços = 16 peças
      averageCost: 15.0,             // R$ 240 / 16 peças = R$ 15,00 por peça
      controlUnit: 'UN',             // ESSENCIAL: Controlar por Unidade para ver "16" no saldo
      unit: 'CH',                    // Unidade de exibição (Pedaço)
      purchaseUnit: 'UN',            // Unidade de compra (Chapa)
      multiplicador_padrao_entrada: 4, 
      conversionFactor: 1.271875     // 5.0875 / 4 = Área de UMA peça (CH)
    }
  });

  console.log('--- ESTABILIZAÇÃO CONCLUÍDA ---');
  console.log('Saldo: 16.000 CH');
  console.log('Preço Médio: R$ 15,00');
  console.log('Unidade de Controle: UN (Peças)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
