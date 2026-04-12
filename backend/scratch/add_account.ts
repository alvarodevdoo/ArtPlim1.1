
import { prisma } from '../src/shared/infrastructure/database/prisma';

async function main() {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.log('Nenhuma organização encontrada.');
      return;
    }

    console.log(`Usando organização: ${org.name} (${org.id})`);

    // Criar a conta pai 4.1.1 se não existir
    let grandparent = await prisma.chartOfAccount.findFirst({
        where: { organizationId: org.id, code: '4.1' }
    });

    let parent = await prisma.chartOfAccount.findFirst({
      where: { organizationId: org.id, code: '4.1.1' }
    });

    if (!parent) {
      console.log('Criando conta pai 4.1.1...');
      parent = await prisma.chartOfAccount.create({
        data: {
          organizationId: org.id,
          code: '4.1.1',
          name: 'Insumos e Matérias-Primas',
          nature: 'COST',
          type: 'SYNTHETIC',
          parentId: grandparent?.id,
          active: true
        }
      });
    }

    // Criar a conta 4.1.1.04
    const existing = await prisma.chartOfAccount.findFirst({
      where: { organizationId: org.id, code: '4.1.1.04' }
    });

    if (existing) {
      console.log('A conta 4.1.1.04 já existe no banco de dados.');
    } else {
      const newAccount = await prisma.chartOfAccount.create({
        data: {
          organizationId: org.id,
          code: '4.1.1.04',
          name: 'Consumo e Pequenos Materiais',
          nature: 'COST',
          type: 'ANALYTIC',
          parentId: parent.id,
          systemRole: 'COST_EXPENSE',
          description: 'Baixas de consumo interno, amostras e materiais de apoio.',
          active: true
        }
      });
      console.log(`Conta criada com sucesso: ${newAccount.name} (${newAccount.code})`);
    }

  } catch (error) {
    console.error('Erro ao adicionar conta:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
