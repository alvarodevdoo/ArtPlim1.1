/**
 * CardBillReminderService
 *
 * Verifica, para cada PaymentMethod do tipo CARD com `cardDueDay` configurado,
 * se a fatura está próxima do vencimento (janelas: 3 dias antes, 1 dia antes, no dia).
 * Cria notificações idempotentes (uma única por janela por dia) do tipo CARD_BILL_DUE.
 *
 * Execução: ao subir o servidor + a cada 6h via setInterval (em server.ts).
 */

import type { PrismaClient } from '@prisma/client';

const REMINDER_WINDOWS_DAYS = [3, 1, 0];

export class CardBillReminderService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Computa a próxima data de vencimento ≥ hoje para `dueDay`.
   */
  private nextDueDate(dueDay: number, today: Date = new Date()): Date {
    const candidate = new Date(today.getFullYear(), today.getMonth(), dueDay);
    candidate.setHours(0, 0, 0, 0);
    const todayMidnight = new Date(today);
    todayMidnight.setHours(0, 0, 0, 0);
    if (candidate < todayMidnight) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate;
  }

  /**
   * Roda a varredura — cria notificações para todos os cartões nas janelas configuradas.
   * Retorna estatísticas para log.
   */
  async runCheck(): Promise<{ scanned: number; created: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let scanned = 0;
    let created = 0;

    const cards = await this.prisma.paymentMethod.findMany({
      where: {
        type: 'CARD',
        active: true,
        cardDueDay: { not: null },
        usageScope: { in: ['PURCHASES', 'BOTH'] }
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        cardDueDay: true
      }
    });

    for (const card of cards) {
      if (!card.cardDueDay) continue;
      scanned++;
      const due = this.nextDueDate(card.cardDueDay, today);
      const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);

      if (!REMINDER_WINDOWS_DAYS.includes(daysUntil)) continue;

      // Idempotência: checa se já existe notificação CARD_BILL_DUE
      // para este cartão e esta janela criada HOJE
      const startOfDay = new Date(today);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const dedupeKey = `${card.id}::${due.toISOString().slice(0, 10)}::${daysUntil}`;
      const existing = await this.prisma.notifications.findFirst({
        where: {
          organizationId: card.organizationId,
          type: 'CARD_BILL_DUE',
          createdAt: { gte: startOfDay, lte: endOfDay },
          data: { path: ['dedupeKey'], equals: dedupeKey } as any
        }
      });
      if (existing) continue;

      const title = daysUntil === 0
        ? `Fatura do ${card.name} vence HOJE`
        : daysUntil === 1
          ? `Fatura do ${card.name} vence amanhã`
          : `Fatura do ${card.name} vence em ${daysUntil} dias`;

      const formattedDue = due.toLocaleDateString('pt-BR');
      const message = `Não esqueça de pagar a fatura do cartão "${card.name}". Vencimento: ${formattedDue}.`;

      await this.prisma.notifications.create({
        data: {
          organizationId: card.organizationId,
          type: 'CARD_BILL_DUE',
          title,
          message,
          data: {
            paymentMethodId: card.id,
            paymentMethodName: card.name,
            dueDate: due.toISOString(),
            daysUntil,
            dedupeKey
          } as any
        }
      });
      created++;
    }

    return { scanned, created };
  }
}
