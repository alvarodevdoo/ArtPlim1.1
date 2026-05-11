import { BarChart3, TrendingUp, DollarSign, Users, Package, Boxes } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import type { ReportId, ReportTypeConfig } from '../types';

const ALL_REPORTS: ReportTypeConfig[] = [
  {
    id: 'financeiro',
    title: 'DRE + Fluxo de Caixa',
    description: 'Demonstrativo de resultado e projeção de caixa',
    icon: TrendingUp,
    color: 'text-orange-500',
    permission: 'finance.reports',
    implemented: true,
  },
  {
    id: 'comissoes',
    title: 'Comissões por Vendedor',
    description: 'Cálculo de comissões por vendedor no período',
    icon: DollarSign,
    color: 'text-yellow-600',
    permission: 'finance.reports',
    implemented: true,
  },
  {
    id: 'vendas',
    title: 'Relatório de Vendas',
    description: 'Análise completa de vendas e pedidos',
    icon: BarChart3,
    color: 'text-green-500',
    permission: 'finance.reports',
    implemented: false,
  },
  {
    id: 'clientes',
    title: 'Relatório de Clientes',
    description: 'Estatísticas e análise da base de clientes',
    icon: Users,
    color: 'text-blue-500',
    implemented: false,
  },
  {
    id: 'produtos',
    title: 'Relatório de Produtos',
    description: 'Performance e ranking dos produtos',
    icon: Package,
    color: 'text-purple-500',
    implemented: false,
  },
  {
    id: 'producao',
    title: 'Relatório de Produção',
    description: 'Eficiência e capacidade produtiva',
    icon: BarChart3,
    color: 'text-indigo-500',
    permission: 'production.view',
    implemented: false,
  },
  {
    id: 'estoque',
    title: 'Relatório de Estoque',
    description: 'Movimentação e níveis de estoque',
    icon: Boxes,
    color: 'text-red-500',
    permission: 'inventory.view',
    implemented: false,
  },
];

interface Props {
  selected: ReportId | null;
  onSelect: (id: ReportId) => void;
  hasPermission: (perm: string) => boolean;
}

export function RelatorioSelector({ selected, onSelect, hasPermission }: Props) {
  const visible = ALL_REPORTS.filter(
    r => !r.permission || hasPermission(r.permission),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selecione o Relatório</CardTitle>
        <CardDescription>Escolha o tipo de análise que deseja visualizar</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visible.map(report => {
            const Icon = report.icon;
            const isSelected = selected === report.id;
            return (
              <button
                key={report.id}
                onClick={() => onSelect(report.id)}
                className={`relative p-4 border rounded-xl text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                {!report.implemented && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                    Em breve
                  </span>
                )}
                <Icon className={`w-5 h-5 mb-2 ${report.color}`} />
                <p className="font-semibold text-sm leading-tight">{report.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{report.description}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
