import React, { useState, useEffect } from 'react';
import { Info, Check, X, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import api from '@/lib/api';
import { toast } from 'sonner';

interface DefaultChartOfAccountsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type AccountNature = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'REVENUE_DEDUCTION' | 'COST' | 'EXPENSE' | 'RESULT_CALCULATION' | 'CONTROL';
type AccountType = 'SYNTHETIC' | 'ANALYTIC';

interface AccountEntry {
  code: string;
  name: string;
  nature: AccountNature;
  type: AccountType;
  parentCode?: string;
  description?: string;
  systemRole?: 'GENERAL' | 'BANK_ACCOUNT' | 'INVENTORY' | 'REVENUE_SALE' | 'COST_EXPENSE' | 'RECEIVABLE' | 'PAYABLE' | 'TAX' | 'FIXED_ASSET' | 'EQUITY';
}

// =============================================
import chartOfAccountsTemplate from './chart_of_accounts_template.json';

const ALL_ACCOUNTS = chartOfAccountsTemplate.accounts as AccountEntry[];
const GROUPS = chartOfAccountsTemplate.groups;

const SYSTEM_ROLE_LABELS: Record<string, { label: string, color: string }> = {
  BANK_ACCOUNT: { label: '🏦 BANCO/CAIXA', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  INVENTORY: { label: '📦 ESTOQUE', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  REVENUE_SALE: { label: '💰 VENDA', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  COST_EXPENSE: { label: '📉 CUSTO/DESP', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  RECEIVABLE: { label: '🤝 A RECEBER', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  PAYABLE: { label: '💳 A PAGAR', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  TAX: { label: '🏛️ IMPOSTO', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  FIXED_ASSET: { label: '🏗️ PATRIMÔNIO', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  EQUITY: { label: '⚖️ CAPITAL', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  GENERAL: { label: '⚙️ OUTROS', color: 'bg-slate-50 text-slate-500 border-slate-200' },
};

/** Returns all ancestor codes of a given account code. E.g. '1.1.2.01' → ['1', '1.1', '1.1.2'] */
function getAncestorCodes(code: string): string[] {
  const parts = code.split('.');
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('.'));
  }
  return ancestors;
}

/** Returns all descendant codes of a given account. */
function getDescendantCodes(code: string): string[] {
  return ALL_ACCOUNTS
    .filter(a => a.code !== code && (a.code.startsWith(code + '.')))
    .map(a => a.code);
}

export const HelpTooltip = ({ title, description, children, side = "top" }: { title: string, description: string, children: React.ReactNode, side?: "top" | "bottom" | "left" | "right" }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div 
          className="inline-block cursor-help"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        side={side}
        align="center"
        sideOffset={8}
        className="w-80 bg-slate-950 text-white p-4 rounded-xl shadow-2xl border-slate-800 z-[99999] pointer-events-none"
      >
        <div className="font-bold border-b border-slate-800 mb-2 pb-1 uppercase tracking-wider text-[10px] text-amber-400">
          {title}
        </div>
        <div className="text-[12px] text-slate-100 leading-relaxed font-normal">
          {description}
        </div>
        {/* Arrow implementation for standard Radix Popover usually uses PopoverArrow, but here we can rely on Radix built-in or custom */}
      </PopoverContent>
    </Popover>
  );
};

export const DefaultChartOfAccountsModal: React.FC<DefaultChartOfAccountsModalProps> = ({ onClose, onSuccess }) => {
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [existingIdentity, setExistingIdentity] = useState<Set<string>>(new Set()); // name|nature
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set<string>());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch existing accounts on open
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await api.get('/api/finance/v2/chart-of-accounts?includeInactive=true');
        const rootData = res.data?.data || [];
        
        // Flat collection of ALL existing codes and identities from the tree
        const codes = new Set<string>();
        const identities = new Set<string>();

        const flatten = (items: any[]) => {
          items.forEach(item => {
            if (item.code) codes.add(item.code);
            if (item.name && item.nature) {
              const idKey = `${item.name.trim().toLowerCase()}|${item.nature}`;
              identities.add(idKey);
            }
            if (item.children && item.children.length > 0) flatten(item.children);
          });
        };
        flatten(rootData);
        
        setExistingCodes(codes);
        setExistingIdentity(identities);
        setSelectedCodes(new Set());
      } catch (err) {
        console.error('Erro ao buscar contas:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExisting();
  }, []);

  /**
   * Toggle selection for an account:
   * - Selecting   → also selects all ancestors (mandatory)
   * - Deselecting → also deselects all descendants
   * - Existing accounts are locked (cannot be toggled)
   */
  const toggleAccount = (acc: AccountEntry) => {
    const idKey = `${acc.name.trim().toLowerCase()}|${acc.nature}`;
    if (existingCodes.has(acc.code) || existingIdentity.has(idKey)) return; // locked

    setSelectedCodes(prev => {
      const next = new Set(prev);
      const isSelected = next.has(acc.code);

      if (isSelected) {
        // DESMARCAR: Se desmarcamos um pai, desmarcamos TODOS os descendentes dele também
        const descendants = getDescendantCodes(acc.code);
        next.delete(acc.code);
        descendants.forEach(dc => next.delete(dc));
      } else {
        // MARCAR:
        // 1. Se marcamos um pai, marcamos TODOS os descendentes dele também (conveniência)
        const descendants = getDescendantCodes(acc.code);
        // 2. Se marcamos um filho, marcamos TODOS os ancestrais dele também (obrigatório para estrutura)
        const ancestors = getAncestorCodes(acc.code);
        
        next.add(acc.code);
        descendants.forEach(dc => next.add(dc));
        ancestors.forEach(ac => next.add(ac));
      }
      return next;
    });
  };

  const toggleExpand = (code: string) => {
    setExpandedGroups(prev => {
      // Accordion Exclusivo: Limpa o grupo anterior se estiver abrindo um novo
      const next = new Set<string>();
      if (!prev.has(code)) {
        next.add(code);
      }
      return next;
    });
  };

  // Counts: selected NEW accounts only (not existing) - ONLY ANALYTIC counts for user perception
  const newToImportCount = [...selectedCodes].filter(code => {
    const acc = ALL_ACCOUNTS.find(a => a.code === code);
    if (!acc || acc.type === 'SYNTHETIC') return false;
    const idKey = `${acc.name.trim().toLowerCase()}|${acc.nature}`;
    return !existingCodes.has(acc.code) && !existingIdentity.has(idKey);
  }).length;

  const handleSelectAll = () => {
    const allSelectable = ALL_ACCOUNTS.filter(a => {
      const idKey = `${a.name.trim().toLowerCase()}|${a.nature}`;
      return !existingCodes.has(a.code) && !existingIdentity.has(idKey);
    }).map(a => a.code);
    setSelectedCodes(new Set(allSelectable));
  };

  const handleDeselectAll = () => {
    setSelectedCodes(new Set());
  };

  const handleImport = async () => {
    const toImport = ALL_ACCOUNTS.filter(a => {
      const idKey = `${a.name.trim().toLowerCase()}|${a.nature}`;
      return selectedCodes.has(a.code) && !existingCodes.has(a.code) && !existingIdentity.has(idKey);
    });
    if (toImport.length === 0) { toast.error('Nenhuma conta nova para importar.'); return; }

    setIsSubmitting(true);
    let count = 0;
    try {
      for (const acc of toImport) {
        await api.post('/api/finance/v2/chart-of-accounts', {
          code: acc.code,
          name: acc.name,
          nature: acc.nature,
          type: acc.type,
          description: acc.description || null,
          parentCode: acc.parentCode || null,
          systemRole: acc.systemRole || 'GENERAL'
        });
        count++;
      }
      toast.success(`${count} contas contábeis importadas com sucesso!`);
      onSuccess();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Erro desconhecido';
      toast.error(`Erro após ${count} contas: ${msg}`);
      if (count > 0) onSuccess();
      else setIsSubmitting(false);
    }
  };


  return (
    <div className="modal-overlay z-[9999] flex items-center justify-center p-4">
      <Card className="modal-content-card max-w-3xl w-full max-h-[90vh] flex flex-col">
        <CardHeader className="bg-slate-50 border-b shrink-0 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl text-primary">Plano de Contas Padrão</CardTitle>
            <CardDescription className="mt-1">
              Estrutura contábil <strong>completa (9 naturezas)</strong>, otimizada para Gráfica e Papelaria.
              Contas com <span className="inline-block w-3 h-3 rounded bg-slate-300 align-middle mx-1" /> cinza já existem e serão ignoradas.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        <CardContent className="overflow-y-auto overflow-x-hidden p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Verificando contas já existentes...</span>
            </div>
          ) : (
            <>
              <div className="flex justify-end gap-2 mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSelectAll}
                  className="text-xs text-primary font-medium hover:bg-white"
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Marcar Tudo
                </Button>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  onClick={handleDeselectAll}
                  className="text-xs text-slate-500 font-medium hover:bg-white"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Desmarcar Tudo
                </Button>
              </div>
              
              {GROUPS.map(group => {
              const groupAccounts = ALL_ACCOUNTS.filter(a => a.code === group.code || a.code.startsWith(group.code + '.'));
              const expanded = expandedGroups.has(group.code);
              
              // Contagem exclusiva de Analíticas para exibição no grupo
              const totalAnalyticInGroup = groupAccounts.filter(a => a.type === 'ANALYTIC').length;
              const selectedAnalyticInGroup = groupAccounts.filter(a => {
                if (a.type !== 'ANALYTIC') return false;
                const idKey = `${a.name.trim().toLowerCase()}|${a.nature}`;
                return selectedCodes.has(a.code) || existingCodes.has(a.code) || existingIdentity.has(idKey);
              }).length;

              return (
                <div key={group.code} className={`border rounded-lg relative hover:z-50 transition-all ${group.border} bg-white`}>
                  {/* Group Header */}
                  <div
                    className={`flex items-center gap-3 p-3 cursor-pointer rounded-lg ${group.bg} hover:brightness-95 transition select-none`}
                    onClick={() => toggleExpand(group.code)}
                  >
                    <span className={`font-bold text-sm flex-1 ${group.color} flex items-center gap-2 group/help relative`}>
                      {group.label}
                      <HelpTooltip title="Entenda este Grupo" description={group.description} side="top">
                        <Info className="w-4 h-4 text-slate-400 hover:text-primary transition-colors" />
                      </HelpTooltip>
                      <span className="ml-2 font-normal text-slate-500 text-xs">
                        ({selectedAnalyticInGroup}/{totalAnalyticInGroup} selecionadas)
                      </span>
                    </span>
                    <button className="text-slate-400 hover:text-slate-700 transition">
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Accounts list */}
                  {expanded && (
                    <div className="divide-y bg-white">
                      {groupAccounts.map(acc => {
                        const depth = acc.code.split('.').length;
                        const indent = (depth - 1) * 16;
                        const isSynthetic = acc.type === 'SYNTHETIC';
                        const idKey = `${acc.name.trim().toLowerCase()}|${acc.nature}`;
                        const isExistingByCode = existingCodes.has(acc.code);
                        const isExistingByName = existingIdentity.has(idKey);
                        const isExisting = isExistingByCode || isExistingByName;
                        const isChecked = selectedCodes.has(acc.code) || isExisting;
                        const locked = isExisting; // Somente bloqueia se já existir no banco
                        const canToggle = !locked;

                        return (
                          <div
                            key={acc.code}
                            className={`flex items-center gap-3 py-2 px-3 transition ${canToggle ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}
                            style={{ paddingLeft: `${12 + indent}px` }}
                            onClick={() => canToggle && toggleAccount(acc)}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              ref={el => {
                                if (el) {
                                  // Estado parcial: Synthetic account que não está "Full" mas tem descendentes marcados
                                  const analyticDescendants = ALL_ACCOUNTS.filter(a => a.type === 'ANALYTIC' && a.code.startsWith(acc.code + '.'));
                                  const isFull = analyticDescendants.length > 0 && analyticDescendants.every(ad => {
                                    const adKey = `${ad.name.trim().toLowerCase()}|${ad.nature}`;
                                    return selectedCodes.has(ad.code) || existingCodes.has(ad.code) || existingIdentity.has(adKey);
                                  });
                                  const hasAny = ALL_ACCOUNTS.filter(a => a.code.startsWith(acc.code + '.')).some(d => {
                                    const dKey = `${d.name.trim().toLowerCase()}|${d.nature}`;
                                    return selectedCodes.has(d.code) || existingCodes.has(d.code) || existingIdentity.has(dKey);
                                  });

                                  el.indeterminate = isSynthetic && !isFull && hasAny;
                                }
                              }}
                              disabled={!canToggle}
                              onChange={() => canToggle && toggleAccount(acc)}
                              className="w-3.5 h-3.5 rounded cursor-pointer disabled:cursor-not-allowed"
                              style={{ accentColor: isExisting ? '#94A3B8' : group.accent }}
                              onClick={e => e.stopPropagation()}
                            />
                            <span className={`font-mono text-xs w-24 shrink-0 text-slate-400`}>
                              {acc.code}
                            </span>
                            <span className={`text-sm flex-1 ${isSynthetic ? 'font-semibold' : ''} text-slate-700 flex items-center gap-2 group/help relative`}>
                              {acc.name}
                              {!isSynthetic && acc.systemRole && SYSTEM_ROLE_LABELS[acc.systemRole] && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded border font-bold uppercase transition-all whitespace-nowrap ${SYSTEM_ROLE_LABELS[acc.systemRole].color}`}>
                                  {SYSTEM_ROLE_LABELS[acc.systemRole].label}
                                </span>
                              )}
                              {acc.description && (
                                <HelpTooltip title="Dica Financeira" description={acc.description} side="top">
                                  <Info className="w-3.5 h-3.5 text-slate-400 hover:text-primary transition-colors" />
                                </HelpTooltip>
                              )}
                            </span>
                            <span 
                              key={`type-${acc.code}-${isChecked}`}
                              className={`text-[10px] w-6 h-5 flex items-center justify-center rounded uppercase font-bold shrink-0 shadow-sm border transition-all ${
                                isSynthetic 
                                  ? 'bg-slate-200 text-slate-700 border-slate-300' 
                                  : 'bg-white text-slate-600 border-slate-200'
                              }`}
                            >
                              {isSynthetic ? 'S' : 'A'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </>
          )}
        </CardContent>

        <CardFooter className="bg-slate-50 border-t p-4 shrink-0 flex justify-between items-center">
          <span className="text-sm text-slate-500 font-medium">
            {newToImportCount} novas contas para importar
            {existingCodes.size > 0 && (
              <span className="ml-2 text-slate-400">({existingCodes.size} já existentes)</span>
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleImport} disabled={isSubmitting || isLoading || newToImportCount === 0}>
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
              ) : (
                <>Importar {newToImportCount} Contas <Check className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
