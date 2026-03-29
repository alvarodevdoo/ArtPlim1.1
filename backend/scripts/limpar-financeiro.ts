import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando limpeza total dos dados financeiros (LIMPEZA SELETIVA/RESETE)...');

  try {
    // 1. Limpar Transações (dependem de Account e Category)
    const tCount = await prisma.transaction.deleteMany();
    console.log(`✅ ${tCount.count} Transações financeiras removidas.`);

    // 2. Limpar Contas a Pagar/Receber e Recibos relacionados
    await prisma.materialReceiptItem.deleteMany();
    await prisma.materialReceipt.deleteMany();
    await prisma.accountPayable.deleteMany();
    await prisma.accountReceivable.deleteMany();
    console.log(`✅ Contas a Pagar, Receber e Recibos de Insumos removidos.`);

    // 3. Limpar Categorias (dependem de ChartOfAccount)
    const catCount = await prisma.category.deleteMany();
    console.log(`✅ ${catCount.count} Categorias financeiras removidas.`);

    // 4. Desvincular matérias-primas e métodos de pagamento
    await prisma.material.updateMany({
      data: {
        expenseAccountId: null,
        inventoryAccountId: null
      }
    });
    
    await prisma.paymentMethod.updateMany({
      data: {
        accountId: null
      }
    });
    console.log('✅ Vínculos em Materiais e Métodos de Pagamento limpos.');

    // 5. Limpar Plano de Contas (Chart of Account)
    // Devido à auto-relação (parentId), removemos a hierarquia primeiro para evitar erro de FK
    await prisma.chartOfAccount.updateMany({
      data: { parentId: null }
    });
    const coaCount = await prisma.chartOfAccount.deleteMany();
    console.log(`✅ ${coaCount.count} Contas do Plano de Contas removidas.`);

    // 6. Limpar Contas Bancárias/Caixas (Final)
    const accCount = await prisma.account.deleteMany();
    console.log(`✅ ${accCount.count} Contas Financeiras (Bancos/Caixa) removidas.`);

    console.log('\n✨ O Módulo Financeiro agora está completamente vazio e pronto para nova configuração!');
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
