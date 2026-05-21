import { prisma } from './src/shared/infrastructure/database/prisma';
import { FinancialReportService } from './src/modules/finance/services/FinancialReportService';

async function test() {
  const org = await prisma.organization.findFirst();
  if(!org) return;
  const s = new FinancialReportService(prisma as any);
  
  const end = new Date('2026-05-11');
  end.setUTCHours(23, 59, 59, 999);

  const d = await s.generateCommissionReport({
    organizationId: org.id,
    startDate: new Date('2026-04-11'),
    endDate: end
  });
  console.log('Resultado do relatorio:', d.length);
  if(d.length > 0) {
      console.log(d[0]);
  }
}
test().then(() => prisma.$disconnect());
