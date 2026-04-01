import { PrismaClient, ChartAccountType, AccountNature } from '@prisma/client';

export class SeedChartOfAccountsUseCase {
  constructor() {}

  async execute(organizationId: string, client: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) {
    const synthetics = [
      { code: '1', name: 'Ativo', description: 'Bens e direitos', nature: AccountNature.ASSET },
      { code: '2', name: 'Passivo', description: 'Dívidas e obrigações', nature: AccountNature.LIABILITY },
      { code: '3', name: 'Patrimônio Líquido', description: 'Capital dos sócios e lucros', nature: AccountNature.EQUITY },
      { code: '4', name: 'Receita', description: 'Vendas e serviços', nature: AccountNature.REVENUE },
      { code: '5', name: 'Deduções da Receita', description: 'Impostos sobre vendas e devoluções', nature: AccountNature.REVENUE_DEDUCTION },
      { code: '6', name: 'Custo', description: 'Gastos diretos de produção', nature: AccountNature.COST },
      { code: '7', name: 'Despesa', description: 'Gastos fixos e operacionais', nature: AccountNature.EXPENSE },
      { code: '8', name: 'Apuração de Resultado', description: 'Conta transitória de resultado', nature: AccountNature.RESULT_CALCULATION },
      { code: '9', name: 'Contas de Controle', description: 'Informações complementares', nature: AccountNature.CONTROL },
    ];

    const midLevels = [
      { parentCode: '1', code: '1.1', name: 'Ativo Circulante', nature: AccountNature.ASSET },
      { parentCode: '2', code: '2.1', name: 'Passivo Circulante', nature: AccountNature.LIABILITY },
      { parentCode: '4', code: '4.1', name: 'Receita Operacional', nature: AccountNature.REVENUE },
      { parentCode: '6', code: '6.1', name: 'Custos de Produção', nature: AccountNature.COST },
      { parentCode: '7', code: '7.1', name: 'Despesas Administrativas', nature: AccountNature.EXPENSE },
    ];

    const analyticals = [
      { parentCode: '1.1', code: '1.1.01.01', name: 'Caixa Geral', nature: AccountNature.ASSET, systemRole: 'BANK_ACCOUNT' },
      { parentCode: '1.1', code: '1.1.04.01', name: 'Estoque de Materiais', nature: AccountNature.ASSET, systemRole: 'INVENTORY' },
      { parentCode: '4.1', code: '4.1.01.01', name: 'Venda de Produtos', nature: AccountNature.REVENUE, systemRole: 'REVENUE_SALE' },
      { parentCode: '6.1', code: '6.1.01.01', name: 'Custos com Insumos', nature: AccountNature.COST, systemRole: 'COST_EXPENSE' },
      { parentCode: '7.1', code: '7.1.01.01', name: 'Aluguéis', nature: AccountNature.EXPENSE, systemRole: 'GENERAL' },
    ];

    // Helper to find parent
    const findParentId = async (code: string) => {
      const p = await (client as any).chartOfAccount.findUnique({
        where: { organizationId_code: { organizationId, code } }
      });
      return p?.id;
    };

    // 1. Synthetics
    for (const syn of synthetics) {
      await (client as any).chartOfAccount.upsert({
        where: { organizationId_code: { organizationId, code: syn.code } },
        create: { organizationId, code: syn.code, name: syn.name, nature: syn.nature, type: ChartAccountType.SYNTHETIC, systemRole: 'GENERAL' },
        update: { name: syn.name, nature: syn.nature }
      });
    }

    // 2. Mid Levels
    for (const mid of midLevels) {
      const parentId = await findParentId(mid.parentCode);
      await (client as any).chartOfAccount.upsert({
        where: { organizationId_code: { organizationId, code: mid.code } },
        create: { organizationId, code: mid.code, name: mid.name, nature: mid.nature, type: ChartAccountType.SYNTHETIC, parentId, systemRole: 'GENERAL' },
        update: { name: mid.name, nature: mid.nature, parentId }
      });
    }

    // 3. Analyticals
    for (const ana of analyticals) {
      const parentId = await findParentId(ana.parentCode);
      await (client as any).chartOfAccount.upsert({
        where: { organizationId_code: { organizationId, code: ana.code } },
        create: { organizationId, code: ana.code, name: ana.name, nature: ana.nature, type: ChartAccountType.ANALYTIC, parentId, systemRole: ana.systemRole },
        update: { name: ana.name, nature: ana.nature, parentId, systemRole: ana.systemRole }
      });
    }
  }
}
