import React from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'SYNTHETIC' | 'ANALYTIC' | string;
  nature: string;
  systemRole?: string;
  description?: string;
}

interface AccountInfoTooltipProps {
  account: Account;
  trigger?: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export const AccountInfoTooltip: React.FC<AccountInfoTooltipProps> = ({ account, trigger, side = 'left' }) => {
  const isAnalytic = account.type === 'ANALYTIC';
  
  const getNatureLabel = (nature: string) => {
    switch (nature) {
      case 'ASSET': return { label: 'Ativo', color: 'bg-emerald-50 text-emerald-700' };
      case 'LIABILITY': return { label: 'Passivo', color: 'bg-rose-50 text-rose-700' };
      case 'EQUITY': return { label: 'Patrimônio', color: 'bg-purple-50 text-purple-700' };
      case 'REVENUE': return { label: 'Receita', color: 'bg-blue-50 text-blue-700' };
      default: return { label: 'Despesa', color: 'bg-orange-50 text-orange-700' };
    }
  };

  const getSystemRoleLabel = (role: string) => {
    switch (role) {
      case 'INVENTORY': return '📦 Conta de Estoque';
      case 'EXPENSE': return '🧳 Conta de Despesa';
      case 'COST_EXPENSE': return '🏭 Custo de Produção';
      case 'COST': return '🏭 Custo Direto';
      case 'REVENUE': return '💰 Conta de Receita';
      case 'RECEIVABLE': return '📋 Contas a Receber';
      case 'PAYABLE': return '📋 Contas a Pagar';
      case 'TAX_ASSET': return '⚖️ Impostos a Recuperar';
      case 'TAX_LIABILITY': return '⚖️ Impostos a Pagar';
      case 'EQUITY': return '🏛️ Patrimônio';
      case 'CASH': return '💵 Caixa/Banco';
      default: return role;
    }
  };

  const natureInfo = getNatureLabel(account.nature);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger || (
          <div
            role="button"
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100/70 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors cursor-help flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Info size={14} />
          </div>
        )}
      </PopoverTrigger>
      <PopoverContent 
        className="w-[340px] p-5 rounded-3xl shadow-2xl border border-slate-200 bg-white z-[9999]" 
        side={side} 
        align="center"
        sideOffset={5}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <span className="font-mono text-[11px] bg-slate-800 text-white px-2 py-1 rounded-md font-bold flex-shrink-0 shadow-sm leading-none">{account.code}</span>
            <span className="font-black text-slate-900 text-base leading-tight break-words">{account.name}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tipo</p>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${isAnalytic ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'}`}>
                {isAnalytic ? 'Analítica' : 'Sintética'}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Natureza</p>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${natureInfo.color}`}>
                {natureInfo.label}
              </span>
            </div>
          </div>

          {account.systemRole && account.systemRole !== 'GENERAL' && (
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Função Contábil</p>
              <span className="text-[11px] font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md inline-block">
                {getSystemRoleLabel(account.systemRole)}
              </span>
            </div>
          )}

          {account.description && (
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Descrição</p>
              <p className="text-[13px] text-slate-700 leading-relaxed font-medium">{account.description}</p>
            </div>
          )}

          {isAnalytic && !['INVENTORY','INVENTORY_ASSET','EXPENSE','COST','COST_EXPENSE','BANK_ACCOUNT','CASH'].includes(account.systemRole || '') && (
            <div className="bg-amber-100/50 text-amber-900 p-3 rounded-xl border border-amber-200/50 flex items-start gap-2 shadow-sm mt-2">
              <span className="text-base leading-none mt-0.5">⚠️</span>
              <p className="text-[11px] font-bold leading-tight">
                Certifique-se que esta conta é adequada para este tipo de lançamento financeiro.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
