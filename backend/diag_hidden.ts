import 'dotenv/config';
import { prisma } from './src/shared/infrastructure/database/prisma';

async function diagnose() {
  // 1. Buscar o pedido PED-000031 diretamente
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'PED-000031' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      processStatusId: true,
      processStatus: {
        select: {
          id: true,
          name: true,
          hideFromFlow: true,
          mappedBehavior: true
        }
      },
      transactions: {
        select: {
          amount: true,
          type: true,
          status: true
        }
      }
    }
  });

  console.log('\n=== PED-000031 ===');
  console.log('Status:', order?.status);
  console.log('ProcessStatusId:', order?.processStatusId);
  console.log('ProcessStatus:', JSON.stringify(order?.processStatus, null, 2));
  console.log('Total:', Number(order?.total));
  console.log('Transactions:', JSON.stringify(order?.transactions, null, 2));

  const totalPaid = (order?.transactions || []).reduce((sum: number, t: any) => {
    if ((t.type === 'INCOME' || t.type === 'CREDIT') && t.status === 'PAID') {
      return sum + Number(t.amount || 0);
    }
    return sum;
  }, 0);
  console.log('Total Pago:', totalPaid);
  console.log('Pendência:', Number(order?.total || 0) - totalPaid);
  console.log('hideFromFlow:', order?.processStatus?.hideFromFlow);

  // 2. Buscar pedidos ocultos
  const hiddenOrders = await prisma.order.findMany({
    where: {
      status: { not: 'CANCELLED' },
      processStatus: { hideFromFlow: true }
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      processStatus: { select: { name: true, hideFromFlow: true } },
      transactions: { select: { amount: true, type: true, status: true } }
    }
  });

  console.log('\n=== Pedidos com hideFromFlow=true ===');
  console.log('Total encontrados:', hiddenOrders.length);
  hiddenOrders.forEach((o: any) => {
    const paid = (o.transactions || []).reduce((sum: number, t: any) => {
      if ((t.type === 'INCOME' || t.type === 'CREDIT') && t.status === 'PAID') return sum + Number(t.amount);
      return sum;
    }, 0);
    const pending = Number(o.total) - paid;
    console.log(`  ${o.orderNumber} | status=${o.status} | total=${Number(o.total)} | pago=${paid} | pendência=${pending.toFixed(2)} | hideFromFlow=${o.processStatus?.hideFromFlow}`);
  });

  // 3. Verificar se processStatusId é null
  if (!order?.processStatusId) {
    console.log('\n⚠️ Pedido NÃO tem processStatusId! O filtro hideFromFlow não se aplica.');
    console.log('   O pedido pode ter status DELIVERED diretamente sem processStatus vinculado.');
  }

  // 4. Query principal (sem filtro)
  const visibleOrders = await prisma.order.findMany({
    where: {
      AND: [
        { status: { not: 'CANCELLED' } },
        {
          OR: [
            { processStatusId: null },
            { processStatus: { hideFromFlow: false } }
          ]
        }
      ]
    },
    select: { id: true, orderNumber: true, status: true, processStatusId: true },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  console.log('\n=== Pedidos VISÍVEIS na query principal ===');
  console.log('Total:', visibleOrders.length);
  visibleOrders.forEach((o: any) => console.log(`  ${o.orderNumber} | status=${o.status} | processStatusId=${o.processStatusId}`));

  // 5. Verificar se PED-000031 aparece nos visíveis
  const found = visibleOrders.find((o: any) => o.orderNumber === 'PED-000031');
  console.log('\n🔍 PED-000031 nos visíveis?', found ? 'SIM ✅' : 'NÃO ❌');

  await prisma.$disconnect();
}

diagnose().catch(console.error);
