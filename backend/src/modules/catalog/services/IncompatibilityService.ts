/**
 * IncompatibilityService
 *
 * Responsabilidade única: gerenciar e consultar regras de incompatibilidade
 * entre opções de configuração de produto.
 *
 * Uma incompatibilidade é simétrica: A⊕B significa que A e B não podem
 * coexistir em um mesmo pedido, independentemente da ordem de seleção.
 */

export interface IncompatibilityRule {
  id: string;
  optionAId: string;
  optionBId: string;
  reason?: string;
  optionALabel?: string;
  optionBLabel?: string;
}

export class IncompatibilityService {
  constructor(private readonly prisma: any) {}

  /**
   * Retorna os IDs de todas as opções incompatíveis com as opções atualmente selecionadas.
   * Usado pelo frontend para desabilitar botões em tempo real.
   */
  async getIncompatibleOptionIds(selectedOptionIds: string[]): Promise<{
    blockedIds: string[];
    reasons: Record<string, string>; // optionId -> motivo exibível
  }> {
    if (selectedOptionIds.length === 0) {
      return { blockedIds: [], reasons: {} };
    }

    // Buscar todas as regras onde qualquer opção selecionada está envolvida
    const rules = await this.prisma.optionIncompatibility.findMany({
      where: {
        OR: [
          { optionAId: { in: selectedOptionIds } },
          { optionBId: { in: selectedOptionIds } }
        ]
      },
      include: {
        optionA: { select: { id: true, label: true } },
        optionB: { select: { id: true, label: true } }
      }
    });

    const blockedIds = new Set<string>();
    const reasons: Record<string, string> = {};

    for (const rule of rules) {
      // Se A está selecionada, B é incompatível, e vice-versa
      const aSelected = selectedOptionIds.includes(rule.optionAId);
      const bSelected = selectedOptionIds.includes(rule.optionBId);

      if (aSelected && !bSelected) {
        blockedIds.add(rule.optionBId);
        reasons[rule.optionBId] = rule.reason ||
          `Incompatível com "${rule.optionA.label}"`;
      }

      if (bSelected && !aSelected) {
        blockedIds.add(rule.optionAId);
        reasons[rule.optionAId] = rule.reason ||
          `Incompatível com "${rule.optionB.label}"`;
      }
    }

    return {
      blockedIds: Array.from(blockedIds),
      reasons
    };
  }

  /**
   * Valida se um conjunto de opções selecionadas contém algum conflito.
   * Lança exceção com descrição se houver incompatibilidade.
   */
  async validate(selectedOptionIds: string[]): Promise<void> {
    const { blockedIds, reasons } = await this.getIncompatibleOptionIds(selectedOptionIds);

    const conflicts = selectedOptionIds.filter(id => blockedIds.includes(id));
    if (conflicts.length > 0) {
      const msgs = conflicts.map(id => reasons[id] || id).join('; ');
      throw new Error(`Combinação inválida de opções: ${msgs}`);
    }
  }

  /**
   * Lista todas as regras de incompatibilidade de um produto.
   */
  async listByProduct(productId: string): Promise<IncompatibilityRule[]> {
    // Buscar IDs de todas as opções do produto
    const configs = await this.prisma.productConfiguration.findMany({
      where: { productId },
      select: { options: { select: { id: true, label: true } } }
    });

    const allOptionIds = configs.flatMap((c: any) =>
      c.options.map((o: any) => o.id)
    );

    if (allOptionIds.length === 0) return [];

    const rules = await this.prisma.optionIncompatibility.findMany({
      where: {
        OR: [
          { optionAId: { in: allOptionIds } },
          { optionBId: { in: allOptionIds } }
        ]
      },
      include: {
        optionA: { select: { label: true } },
        optionB: { select: { label: true } }
      }
    });

    return rules.map((r: any) => ({
      id: r.id,
      optionAId: r.optionAId,
      optionBId: r.optionBId,
      reason: r.reason,
      optionALabel: r.optionA.label,
      optionBLabel: r.optionB.label
    }));
  }

  /**
   * Cria (ou garante idempotência) de uma regra de incompatibilidade.
   * A relação é simétrica: não importa qual é A e qual é B.
   */
  async upsert(optionAId: string, optionBId: string, reason?: string): Promise<void> {
    // Garante ordem canônica para evitar duplicatas simétricas
    const [a, b] = [optionAId, optionBId].sort();

    await this.prisma.optionIncompatibility.upsert({
      where: { optionAId_optionBId: { optionAId: a, optionBId: b } },
      create: { optionAId: a, optionBId: b, reason },
      update: { reason }
    });
  }

  /**
   * Remove uma regra de incompatibilidade.
   */
  async remove(id: string): Promise<void> {
    await this.prisma.optionIncompatibility.delete({ where: { id } });
  }
}
