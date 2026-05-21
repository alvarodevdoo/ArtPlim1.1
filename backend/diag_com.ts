import 'dotenv/config';
import { prisma } from './src/shared/infrastructure/database/prisma';

async function diagnose() {
  const org = await prisma.organization.findFirst();
  if(!org) {
    console.log("No org"); return;
  }

  const orders = await prisma.order.findMany({
    where: {
      organizationId: org.id,
      status: { in: ['APPROVED', 'FINISHED', 'DELIVERED'] }
    },
    include: {
      seller: true,
      items: true
    }
  });

  console.log(`Pedidos elegíveis para comissão: ${orders.length}`);

  let totalCommissions = 0;

  orders.forEach(o => {
    console.log(`- ${o.orderNumber} | status=${o.status} | approvedAt=${o.approvedAt?.toISOString()}`);
    o.items.forEach((i, idx) => {
      const comm = Number(i.commissionAmount || 0);
      if (comm > 0) {
        console.log(`   Item ${idx+1}: total=${i.totalPrice} | comissão=${comm}`);
        totalCommissions += comm;
      }
    });
  });

  console.log(`Total geral de comissões nos itens de DB: ${totalCommissions}`);

  await prisma.$disconnect();
}

diagnose().catch(console.error);
