// backend/prisma/seedChartOfAccounts.ts
import { PrismaClient, ChartOfAccountType } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedChartOfAccounts(organizationId: string) {
  console.log('📊 Estruturando Plano de Contas Completo...');

  const accounts = [
    // --- 1. ATIVOS (ASSET) ---
    { name: 'Ativos', code: '1', type: ChartOfAccountType.ASSET },
    { name: 'Caixa Geral', code: '1.1.01', type: ChartOfAccountType.ASSET },
    { name: 'Banco Conta Movimento', code: '1.1.02', type: ChartOfAccountType.ASSET },
    { name: 'Clientes (Contas a Receber)', code: '1.1.03', type: ChartOfAccountType.ASSET },
    { name: 'Estoque de Matérias-Primas', code: '1.1.04', type: ChartOfAccountType.ASSET },
    { name: 'Máquinas e Equipamentos', code: '1.2.01', type: ChartOfAccountType.ASSET },

    // --- 2. PASSIVOS (LIABILITY) ---
    { name: 'Passivos', code: '2', type: ChartOfAccountType.LIABILITY },
    { name: 'Fornecedores a Pagar', code: '2.1.01', type: ChartOfAccountType.LIABILITY },
    { name: 'Salários e Encargos', code: '2.1.02', type: ChartOfAccountType.LIABILITY },
    { name: 'Impostos a Recolher', code: '2.1.03', type: ChartOfAccountType.LIABILITY },

    // --- 3. PATRIMÔNIO LÍQUIDO (EQUITY) ---
    { name: 'Patrimônio Líquido', code: '3', type: ChartOfAccountType.EQUITY },
    { name: 'Capital Social', code: '3.1.01', type: ChartOfAccountType.EQUITY },
    { name: 'Lucros ou Prejuízos Acumulados', code: '3.1.02', type: ChartOfAccountType.EQUITY },

    // --- 4. RECEITAS (REVENUE) ---
    { name: 'Receitas', code: '4', type: ChartOfAccountType.REVENUE },
    { name: 'Receita de Venda de Produtos', code: '4.1.01', type: ChartOfAccountType.REVENUE },
    { name: 'Receita de Prestação de Serviços', code: '4.1.02', type: ChartOfAccountType.REVENUE },

    // --- 5. DESPESAS E CUSTOS (EXPENSE) ---
    { name: 'Despesas', code: '5', type: ChartOfAccountType.EXPENSE },
    { name: 'Custo de Materiais (CPV)', code: '5.1.01', type: ChartOfAccountType.EXPENSE },
    { name: 'Aluguel de Galpão', code: '5.2.01', type: ChartOfAccountType.EXPENSE },
    { name: 'Energia Elétrica e Água', code: '5.2.02', type: ChartOfAccountType.EXPENSE },
    { name: 'Folha de Pagamento', code: '5.2.03', type: ChartOfAccountType.EXPENSE },
    { name: 'Marketing e Redes Sociais', code: '5.2.04', type: ChartOfAccountType.EXPENSE },
  ];

  const createdAccounts = [];
  for (const acc of accounts) {
    // Usamos o unique constraint [organizationId, code] para o upsert
    const account = await prisma.chartOfAccount.upsert({
      where: { 
        organizationId_code: {
          organizationId,
          code: acc.code
        }
      },
      update: { 
        name: acc.name, 
        type: acc.type,
        active: true 
      },
      create: {
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
