require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL não encontrada no ambiente.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚮 Iniciando limpeza de vendas e transações financeiras...');
  
  try {
    // Ordem de deleção respeitando FKs
    console.log('- Removendo etapas de produção...');
    await prisma.productionStep.deleteMany({});

    console.log('- Removendo ordens de produção...');
    await prisma.productionOrder.deleteMany({});

    console.log('- Removendo transações financeiras...');
    await prisma.transaction.deleteMany({});

    console.log('- Removendo contas a receber...');
    await prisma.accountReceivable.deleteMany({});

    console.log('- Removendo contas a pagar...');
    await prisma.accountPayable.deleteMany({});

    console.log('- Removendo recibos de materiais...');
    await prisma.materialReceipt.deleteMany({});

    console.log('- Removendo movimentações de estoque de vendas...');
    await prisma.stockMovement.deleteMany({
      where: {
        OR: [
          { notes: { contains: 'Baixa automática' } },
          { notes: { contains: 'Pedido' } }
        ]
      }
    });

    console.log('- Removendo itens de pedido...');
    await prisma.orderItem.deleteMany({});

    console.log('- Removendo histórico de status...');
    await prisma.orderStatusHistory.deleteMany({});

    console.log('- Removendo pedidos...');
    await prisma.order.deleteMany({});

    console.log('✅ Limpeza concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
