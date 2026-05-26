// backend/prisma/seedAutomationRules.ts
import { prisma } from '../src/shared/infrastructure/database/prisma';

export async function seedAutomationRules(organizationId: string) {
  console.log('🤖 Semeando regras de automação...');

  const rules = [
    {
      name: 'Aviso de Pedido Finalizado',
      description:
        'Envia WhatsApp para o cliente assim que o pedido for marcado como finalizado. Fora do expediente, agenda o envio para o próximo dia útil no início do expediente.',
      trigger: 'status_change',
      action: 'whatsapp',
      conditions: {
        toStatus: 'FINISHED',
        respectBusinessHours: true,
        businessHours: {
          start: '08:00',
          end: '18:00',
          weekdays: [1, 2, 3, 4, 5],
          timezone: 'America/Sao_Paulo',
        },
        outsideHoursBehavior: 'schedule_next_business_day',
        scheduleAt: 'start_of_business_hours',
        messageTemplate:
          'Olá {{customerName}}! Seu pedido #{{orderNumber}} foi finalizado e está pronto. Em breve entraremos em contato para combinar a entrega/retirada. Obrigado pela preferência!',
      },
      enabled: true,
    },
  ];

  for (const rule of rules) {
    await prisma.automationRule.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: rule.name,
        },
      },
      update: {
        description: rule.description,
        trigger: rule.trigger,
        action: rule.action,
        conditions: rule.conditions,
        enabled: rule.enabled,
      },
      create: {
        organizationId,
        name: rule.name,
        description: rule.description,
        trigger: rule.trigger,
        action: rule.action,
        conditions: rule.conditions,
        enabled: rule.enabled,
      },
    });
  }

  console.log(`✅ ${rules.length} regra(s) de automação semeada(s).`);
}

if (require.main === module) {
  prisma.organization.findFirst().then(org => {
    if (org) {
      seedAutomationRules(org.id).finally(() => prisma.$disconnect());
    } else {
      console.error('Nenhuma organização encontrada para seed.');
      prisma.$disconnect();
    }
  });
}
