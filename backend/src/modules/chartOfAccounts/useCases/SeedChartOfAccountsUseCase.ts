import { PrismaClient, ChartAccountType, AccountNature } from '@prisma/client';

export class SeedChartOfAccountsUseCase {
  constructor() {}

  async execute(organizationId: string, client: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) {
    // Basic structured seed with all 9 SPED categories
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
      // Ativos
      { parentCode: '1', code: '1.1', name: 'Ativo Circulante', description: 'Bens e direitos de curto prazo', nature: AccountNature.ASSET },
      
      // Passivos
      { parentCode: '2', code: '2.1', name: 'Passivo Circulante', description: 'Obrigações de curto prazo', nature: AccountNature.LIABILITY },
      
      // Receitas
      { parentCode: '4', code: '4.1', name: 'Receita Operacional', description: 'Vendas de produtos e serviços', nature: AccountNature.REVENUE },
      
      // Custos
      { parentCode: '6', code: '6.1', name: 'Custos de Produção', description: 'Insumos e mão de obra', nature: AccountNature.COST },
      
      // Despesas
      { parentCode: '7', code: '7.1', name: 'Despesas Administrativas', description: 'Aluguel, salários, etc.', nature: AccountNature.EXPENSE },
    ];

    const createdSynthetics = new Set<string>();

    for (const syn of synthetics) {
      const inserted = await (client as any).chartOfAccount.upsert({
        where: { organizationId_code: { organizationId, code: syn.code } },
        create: {
          organizationId,
          code: syn.code,
          name: syn.name,
          description: (syn as any).description,
          nature: syn.nature,
          type: ChartAccountType.SYNTHETIC,
          active: true
        },
        update: {
          name: syn.name,
          description: (syn as any).description,
          nature: syn.nature,
          type: ChartAccountType.SYNTHETIC,
        }
      });
      createdSynthetics.add(syn.code);
    }

    for (const mid of midLevels) {
      await (client as any).chartOfAccount.upsert({
        where: { organizationId_code: { organizationId, code: mid.code } },
        create: {
          organizationId,
          code: mid.code,
          name: mid.name,
          description: (mid as any).description,
          nature: mid.nature,
          type: ChartAccountType.SYNTHETIC,
          parentId: (await (client as any).chartOfAccount.findUnique({ where: { organizationId_code: { organizationId, code: mid.parentCode } } }))?.id,
          active: true
        },
        update: {
          name: mid.name,
          description: (mid as any).description,
          nature: mid.nature,
          type: ChartAccountType.SYNTHETIC,
        }
      });
      createdSynthetics.add(mid.code);
    }
  }
}
