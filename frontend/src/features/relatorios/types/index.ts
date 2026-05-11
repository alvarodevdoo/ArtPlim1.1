import type { LucideIcon } from 'lucide-react';

export type ReportId =
  | 'financeiro'
  | 'comissoes'
  | 'vendas'
  | 'clientes'
  | 'produtos'
  | 'producao'
  | 'estoque';

export interface ReportTypeConfig {
  id: ReportId;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  /** permission key required to see this report */
  permission?: string;
  /** whether the report is fully implemented */
  implemented: boolean;
}

export interface CommissionRow {
  sellerId: string;
  sellerName: string;
  totalSales: number;
  totalItems: number;
  totalCommission: number;
}

export interface DashboardStats {
  summary: {
    totalIncome: number;
    totalExpense: number;
    profit: number;
    profitMargin: number;
  };
  pending: {
    receivables: number;
    payables: number;
  };
  accounts: {
    totalBalance: number;
  };
  monthlyComparison: {
    growth: {
      income: number;
      expense: number;
      profit: number;
    };
  };
}
