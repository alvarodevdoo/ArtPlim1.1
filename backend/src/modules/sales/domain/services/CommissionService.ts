export interface CommissionInput {
  netPrice: number; // finalNetPrice (Bruto - Descontos Acumulados)
  isCommissionable: boolean;
  specificCommissionRate: number | null | undefined;
  defaultCommissionRate: number; // from Organization
}

export interface CommissionOutput {
  commissionRateApplied: number; // rate applied (e.g. 0.05 for 5%)
  commissionAmount: number;
}

export class CommissionService {
  execute(input: CommissionInput): CommissionOutput {
    if (!input.isCommissionable) {
      return {
        commissionRateApplied: 0,
        commissionAmount: 0
      };
    }

    const rateToUse = (input.specificCommissionRate !== null && input.specificCommissionRate !== undefined)
      ? input.specificCommissionRate 
      : input.defaultCommissionRate;

    // The rate is expected to be a decimal multiplier (e.g., 0.05 for 5%).
    // Se o banco armazena "5" em vez de "0.05", o front/back deve tratar. Vamos assumir que rateToUse 
    // já é o multiplicador correto ou vamos checar se é > 1. 
    // Para manter a segurança, assumimos que os valores da tabela já estão no formato final (e.g. 0.05) 
    // da mesma forma que o maxDiscountThreshold.

    const amount = input.netPrice * rateToUse;

    return {
      commissionRateApplied: rateToUse,
      commissionAmount: Math.round(amount * 100) / 100
    };
  }
}
