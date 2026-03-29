import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando limpeza de dados de pedidos...');

  try {
    // A ordem de exclusão é importante devido às restrições de chave estrangeira
    
    console.log('🗑️ Removendo DeliveryItems...');
    await prisma.deliveryItem.deleteMany({});

    console.log('🗑️ Removendo Deliveries...');
    await prisma.delivery.deleteMany({});

    console.log('🗑️ Removendo OrderItemConfigurations...');
    await prisma.orderItemConfiguration.deleteMany({});

    console.log('🗑️ Removendo OrderItems...');
    await prisma.orderItem.deleteMany({});

    console.log('🗑️ Removendo OrderStatusHistory...');
    await prisma.orderStatusHistory.deleteMany({});

    console.log('🗑️ Removendo ProductionOperations...');
    await prisma.productionOperation.deleteMany({});

    console.log('🗑️ Removendo ProductionQueue...');
    await prisma.productionQueue.deleteMany({});

    console.log('🗑️ Removendo ProductionWaste...');
    await prisma.productionWaste.deleteMany({});

    console.log('🗑️ Removendo PendingChanges...');
    await prisma.pendingChanges.deleteMany({});

    console.log('🗑️ Removendo InventoryMovements vinculados a pedidos...');
    await prisma.inventoryMovement.deleteMany({
      where: {
        orderId: { not: null }
      }
    });

    console.log('🗑️ Removendo Transactions vinculadas a pedidos...');
    await prisma.transaction.deleteMany({
      where: {
        orderId: { not: null }
      }
    });

    console.log('🗑️ Removendo AccountsReceivable vinculadas a pedidos...');
    await prisma.accountReceivable.deleteMany({
      where: {
        orderId: { not: null }
      }
    });

    console.log('🗑️ Removendo Orders...');
    const result = await prisma.order.deleteMany({});

    console.log(`✅ Limpeza concluída! ${result.count} pedidos removidos.`);
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
