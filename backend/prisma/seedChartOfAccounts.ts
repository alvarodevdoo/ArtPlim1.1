// backend/prisma/seedChartOfAccounts.ts
import { PrismaClient, ChartOfAccountType } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedChartOfAccounts(organizationId: string) {
  console.log('📊 Estruturando Plano de Contas Completo...');

  const accounts = [
    // --- 1. ATIVOS (ASSET) - Recursos e Bens ---
    { name: 'Caixa Geral', code: '1.1.01', type: ChartOfAccountType.ASSET },
    { name: 'Banco Conta Movimento', code: '1.1.02', type: ChartOfAccountType.ASSET },
    { name: 'Clientes (Contas a Receber)', code: '1.1.03', type: ChartOfAccountType.ASSET },
    { name: 'Estoque de Matérias-Primas', code: '1.1.04', type: ChartOfAccountType.ASSET },
    { name: 'Estoque de Produtos Acabados', code: '1.1.05', type: ChartOfAccountType.ASSET },
    { name: 'Máquinas e Equipamentos', code: '1.2.01', type: ChartOfAccountType.ASSET },

    // --- 2. PASSIVOS (LIABILITY) - Obrigações e Dívidas ---
    { name: 'Fornecedores a Pagar', code: '2.1.01', type: ChartOfAccountType.LIABILITY },
    { name: 'Salários e Encargos', code: '2.1.02', type: ChartOfAccountType.LIABILITY },
    { name: 'Impostos a Recolher', code: '2.1.03', type: ChartOfAccountType.LIABILITY },
    { name: 'Empréstimos Bancários', code: '2.2.01', type: ChartOfAccountType.LIABILITY },

    // --- 3. PATRIMÔNIO LÍQUIDO (EQUITY) - Capital e Reservas ---
    { name: 'Capital Social', code: '2.3.01', type: ChartOfAccountType.EQUITY },
    { name: 'Lucros ou Prejuízos Acumulados', code: '2.3.02', type: ChartOfAccountType.EQUITY },

    // --- 4. RECEITAS (REVENUE) - Entradas de Valor ---
    { name: 'Receita de Venda de Produtos', code: '4.1.01', type: ChartOfAccountType.REVENUE },
    { name: 'Receita de Prestação de Serviços', code: '4.1.02', type: ChartOfAccountType.REVENUE },
    { name: 'Receitas Financeiras (Juros)', code: '4.2.01', type: ChartOfAccountType.REVENUE },

    // --- 5. DESPESAS E CUSTOS (EXPENSE) - Saídas e Consumo ---
    { name: 'Custo de Materiais (CPV)', code: '3.1.01', type: ChartOfAccountType.EXPENSE },
    { name: 'Aluguel de Galpão', code: '3.2.01', type: ChartOfAccountType.EXPENSE },
    { name: 'Energia Elétrica e Água', code: '3.2.02', type: ChartOfAccountType.EXPENSE },
    { name: 'Marketing e Redes Sociais', code: '3.2.03', type: ChartOfAccountType.EXPENSE },
    { name: 'Manutenção de Máquinas', code: '3.2.04', type: ChartOfAccountType.EXPENSE },
  ];

  const createdAccounts = [];
  for (const acc of accounts) {
    const account = await prisma.chartOfAccount.upsert({
      where: { id: `acc-${acc.code}-${organizationId}` },
      update: { name: acc.name, type: acc.type, code: acc.code },
      create: {
        id: `acc-${acc.code}-${organizationId}`,
        organizationId,
        name: acc.name,
        code: acc.code,
        type: acc.type,
        active: true
      }
    });
    createdAccounts.push(account);
  }

  console.log(`✅ Plano de Contas semeado com ${createdAccounts.length} categorias.`);
  return createdAccounts;
}

if (require.main === module) {
  prisma.organization.findFirst().then(org => {
    if (org) seedChartOfAccounts(org.id).finally(() => prisma.$disconnect());
  });
}
