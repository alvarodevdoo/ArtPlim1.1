import 'dotenv/config';
import { prisma } from './src/shared/infrastructure/database/prisma';
import { CommissionService } from './src/modules/sales/application/services/CommissionService';
import { OrderStatus } from '@prisma/client';

async function recalculate() {
  const org = await prisma.organization.findFirst();
  if(!org) {
    console.log("No org"); return;
  }

  // 1. Encontrar ou criar role de Vendedor
  let role = await prisma.role.findFirst({
    where: { 
      organizationId: org.id,
      name: { contains: 'Vendedor', mode: 'insensitive' }
    }
  });

  if (!role) {
     role = await prisma.role.create({
       data: {
         organizationId: org.id,
         name: 'Vendedor',
         description: 'Responsável pelas Vendas'
       }
     });
     console.log("Role Vendedor criada.");
  }

  // 2. Garantir regra de 5% ativa
  let rule = await prisma.commissionRule.findFirst({
    where: { organizationId: org.id, roleId: role.id, active: true }
  });

  if (!rule) {
    rule = await prisma.commissionRule.create({
      data: {
        organizationId: org.id,
        roleId: role.id,
        rate: 5.0,
        description: 'Comissão de Venda (Retroativa)'
      }
    });
    console.log("Regra de comissão de 5% criada!");
  }

  // 3. Buscar primeiro usuário ativo para ser fallback de sellerId
  const firstUser = await prisma.user.findFirst({ where: { organizationId: org.id, active: true } });

  // 4. Buscar pedidos passados elegíveis
  const orders = await prisma.order.findMany({
    where: {
      organizationId: org.id,
      status: { in: [OrderStatus.APPROVED, OrderStatus.FINISHED, OrderStatus.DELIVERED] }
    }
  });

  console.log(`Pedidos elegíveis para recálculo: ${orders.length}`);

  const commissionService = new CommissionService(prisma as any);

  let processed = 0;
  for (const order of orders) {
    try {
       // Se o pedido não tem sellerId, a comissão não cai pra ninguém, então vamos forçar no admin principal para teste
       if (!order.sellerId && firstUser) {
          await prisma.order.update({
            where: { id: order.id },
            data: { sellerId: firstUser.id }
          });
          console.log(`Atribuído sellerId provisório ao pedido ${order.orderNumber}`);
       }

       await commissionService.processOrderCommissions(order.id, org.id);
       processed++;
    } catch(err: any) {
       console.log(`Erro ao reprocessar pedido ${order.orderNumber}: ${err.message}`);
    }
  }

  const entries = await prisma.commissionEntry.count({
     where: { organizationId: org.id }
  });

  console.log(`Total de entradas de comissão geradas agora no banco: ${entries}`);

  await prisma.$disconnect();
}

recalculate().catch(console.error);
