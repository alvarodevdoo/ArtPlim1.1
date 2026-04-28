import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Carrega .env manualmente para garantir que o Prisma encontre a URL
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🚮 Iniciando limpeza de vendas e transações financeiras...');

  try {
    // 1. Production Steps
    console.log('- Removendo etapas de produção...');
    await prisma.productionStep.deleteMany({});

    // 2. Production Orders
    console.log('- Removendo ordens de produção...');
    await prisma.productionOrder.deleteMany({});

    // 3. Transactions (Limpamos todas as transações de entrada e saída relacionadas a vendas)
    console.log('- Removendo transações financeiras...');
    await prisma.transaction.deleteMany({});

    // 4. Account Receivables
    console.log('- Removendo contas a receber...');
    await prisma.accountReceivable.deleteMany({});

    // 5. Account Payables (Relacionados a compras de insumo via pedido)
    console.log('- Removendo contas a pagar...');
    await prisma.accountPayable.deleteMany({});

    // 6. Material Receipts
    console.log('- Removendo recibos de materiais...');
    await prisma.materialReceipt.deleteMany({});

    // 7. Stock Movements (Limpamos apenas as baixas automáticas de pedidos)
    console.log('- Removendo movimentações de estoque de vendas...');
    await prisma.stockMovement.deleteMany({
      where: {
        OR: [
          { notes: { contains: 'Baixa automática' } },
          { notes: { contains: 'Pedido' } }
        ]
      }
    });

    // 8. Order Items
    console.log('- Removendo itens de pedido...');
    await prisma.orderItem.deleteMany({});

    // 9. Status History
    console.log('- Removendo histórico de status...');
    await prisma.orderStatusHistory.deleteMany({});

    // 10. Orders
    console.log('- Removendo pedidos...');
    await prisma.order.deleteMany({});

    console.log('✅ Limpeza concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
