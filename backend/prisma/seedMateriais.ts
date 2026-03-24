// backend/prisma/seedMateriais.ts
import { PrismaClient, MaterialFormat, ConsumptionRule } from '@prisma/client';
import { seedChartOfAccounts } from './seedChartOfAccounts';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  
  if (!org) {
    console.warn('Nenhuma organization encontrada. Crie uma primeiro.');
    return;
  }

  // 1. Garantir que as contas existem
  await seedChartOfAccounts(org.id);
  const inventoryAccount = await prisma.chartOfAccount.findFirst({
    where: { organizationId: org.id, code: '1.1.04' } // 1.1.04 - Estoque de Matérias-Primas
  });
  const expenseAccount = await prisma.chartOfAccount.findFirst({
    where: { organizationId: org.id, code: '3.1.01' } // 3.1.01 - Custo de Materiais (CPV)
  });

  const materiaisIniciais = [
    { name: 'Filamento PLA Branco', category: 'Impressão 3D', unit: 'kg', format: MaterialFormat.UNIT, costPerUnit: 89.90 },
    { name: 'Chapa MDF 3mm (Cru)', category: 'Chapas', unit: 'm2', format: MaterialFormat.SHEET, costPerUnit: 25.50 },
    { name: 'Lona Brilho 440g', category: 'Comunicação Visual', unit: 'm2', format: MaterialFormat.ROLL, costPerUnit: 18.50 },
    { name: 'Ilhós Metálico N0', category: 'Acabamentos', unit: 'un', format: MaterialFormat.UNIT, costPerUnit: 0.15 },
    { name: 'Adesivo Vinil Branco', category: 'Comunicação Visual', unit: 'm2', format: MaterialFormat.ROLL, costPerUnit: 14.00 },
  ];

  console.log('🌱 Atualizando/Criando materiais com vínculos contábeis...');
  for (const mat of materiaisIniciais) {
    // Usamos findFirst para pegar pelo nome na mesma org
    const existing = await prisma.material.findFirst({
        where: { organizationId: org.id, name: mat.name }
    });

    if (existing) {
        await prisma.material.update({
            where: { id: existing.id },
            data: {
                inventoryAccountId: inventoryAccount?.id,
                expenseAccountId: expenseAccount?.id,
                defaultConsumptionRule: ConsumptionRule.FIXED,
                defaultConsumptionFactor: 1.0,
                format: mat.format,
                unit: mat.unit,
                costPerUnit: mat.costPerUnit
            }
        });
        console.log(`✅ Material '${mat.name}' atualizado com contas contábeis.`);
    } else {
        await prisma.material.create({
            data: {
                ...mat,
                organizationId: org.id,
                defaultConsumptionRule: ConsumptionRule.FIXED,
                defaultConsumptionFactor: 1.0,
                active: true,
                inventoryAccountId: inventoryAccount?.id,
                expenseAccountId: expenseAccount?.id
            }
        });
        console.log(`✅ Material '${mat.name}' criado com contas contábeis.`);
    }
  }

  console.log(`\n✨ Seed finalizado com sucesso!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
