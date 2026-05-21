import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { QuickStats } from '@/features/relatorios/components/QuickStats';
import { RelatorioSelector } from '@/features/relatorios/components/RelatorioSelector';
import { RelatorioFinanceiro } from '@/features/relatorios/components/RelatorioFinanceiro';
import { RelatorioComissoes } from '@/features/relatorios/components/RelatorioComissoes';
import { RelatorioVendas } from '@/features/relatorios/components/RelatorioVendas';
import { RelatorioPendente } from '@/features/relatorios/components/RelatorioPendente';
import { useRelatoriosStats } from '@/features/relatorios/hooks/useRelatoriosStats';
import type { ReportId } from '@/features/relatorios/types';

const PENDING_LABELS: Partial<Record<ReportId, string>> = {
  clientes: 'Relatório de Clientes',
  produtos: 'Relatório de Produtos',
  producao: 'Relatório de Produção',
  estoque: 'Relatório de Estoque',
};

const Relatorios: React.FC = () => {
  const { hasPermission } = useAuth();
  const { stats, loading: statsLoading } = useRelatoriosStats();
  const [selectedReport, setSelectedReport] = useState<ReportId | null>(null);

  function renderActiveReport() {
    if (!selectedReport) return null;
    if (selectedReport === 'financeiro') return <RelatorioFinanceiro />;
    if (selectedReport === 'comissoes') return <RelatorioComissoes />;
    if (selectedReport === 'vendas') return <RelatorioVendas />;
    const label = PENDING_LABELS[selectedReport as keyof typeof PENDING_LABELS];
    if (label) return <RelatorioPendente title={label} />;
    return null;
  }

  const showStats = hasPermission('finance.reports');

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Análises e insights do seu negócio</p>
      </div>

      {/* KPIs do mês atual — visíveis apenas para quem tem permissão financeira */}
      {showStats && <QuickStats stats={stats} loading={statsLoading} />}

      {/* Seletor de tipo de relatório */}
      <RelatorioSelector
        selected={selectedReport}
        onSelect={setSelectedReport}
        hasPermission={hasPermission}
      />

      {/* Conteúdo do relatório selecionado */}
      {renderActiveReport()}
    </div>
  );
};

export default Relatorios;
