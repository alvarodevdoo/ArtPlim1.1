import { prisma } from './src/shared/infrastructure/database/prisma';

async function main() {
  const settings = await prisma.organizationSettings.findFirst();
  console.log('CONFIGURAÇÃO ATUAL DE ESTOQUE:', settings?.inventoryValuationMethod);
  
  if (settings?.inventoryValuationMethod !== 'PEPS') {
    console.log('Ativando modo PEPS (FIFO)...');
    await prisma.organizationSettings.update({
      where: { id: settings.id },
      data: { inventoryValuationMethod: 'PEPS' }
    });
    console.log('Modo PEPS ativado com sucesso.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
