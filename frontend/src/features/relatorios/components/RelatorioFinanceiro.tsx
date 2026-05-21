import { useState } from 'react';
import { RelatorioDRE } from '@/features/financeiro/RelatorioDRE';
import { RelatorioFluxoCaixa } from '@/features/financeiro/RelatorioFluxoCaixa';

type FinanceTab = 'dre' | 'fluxo';

const TABS: { id: FinanceTab; label: string }[] = [
  { id: 'dre', label: 'DRE — Demonstrativo de Resultado' },
  { id: 'fluxo', label: 'Fluxo de Caixa' },
];

export function RelatorioFinanceiro() {
  const [tab, setTab] = useState<FinanceTab>('dre');

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              tab === t.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dre' && <RelatorioDRE />}
      {tab === 'fluxo' && <RelatorioFluxoCaixa />}
    </div>
  );
}
