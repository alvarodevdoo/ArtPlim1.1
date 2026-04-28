/**
 * OrderFinanceHelper
 * 
 * Centraliza cálculos financeiros relacionados a pedidos para garantir
 * consistência entre os regimes de Caixa e Competência.
 */
export class OrderFinanceHelper {
  /**
   * Calcula o saldo devedor real de um pedido.
   * Saldo = Total do Pedido - Somatório de transações INCOME e PAID vinculadas.
   */
  static calculateRemainingBalance(order: any): number {
    const totalOrder = Number(order.total || 0);
    
    // Consideramos apenas transações de ENTRADA (INCOME) que já foram PAGAS (PAID)
    const paidTotal = order.transactions
      ? (order.transactions as any[])
          .filter((t: any) => t.type === 'INCOME' && t.status === 'PAID')
          .reduce((sum: number, t: any) => sum + Number(t.amount), 0)
      : 0;
    return Number(Math.max(0, totalOrder - paidTotal).toFixed(2));
  }

  /**
   * Formata valor numérico para BRL.
   */
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }
}
