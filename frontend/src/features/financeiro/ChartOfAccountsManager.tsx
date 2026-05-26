import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Plus, Pencil, Trash, RefreshCw, Info, Target, AlertCircle, Activity, TrendingUp, TrendingDown
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { AccountEntryForm } from '@/components/chartOfAccounts/AccountEntryForm';
import { DefaultChartOfAccountsModal } from '@/features/financeiro/DefaultChartOfAccountsModal';
import { ModalPortal } from '@/components/ui/ModalPortal';

const accountNatureConfig: Record<string, { label: string; colors: string }> = {
  ASSET: { label: 'Ativo', colors: 'bg-blue-100 text-blue-700' },
  LIABILITY: { label: 'Passivo', colors: 'bg-orange-100 text-orange-700' },
  EQUITY: { label: 'Patrimônio', colors: 'bg-purple-100 text-purple-700' },
  REVENUE: { label: 'Receita', colors: 'bg-green-100 text-green-700' },
  REVENUE_DEDUCTION: { label: 'Dedução', colors: 'bg-red-100 text-red-700' },
  COST: { label: 'Custo', colors: 'bg-amber-100 text-amber-700' },
  EXPENSE: { label: 'Despesa', colors: 'bg-rose-100 text-rose-700' },
  RESULT_CALCULATION: { label: 'Apuração', colors: 'bg-indigo-100 text-indigo-700' },
  CONTROL: { label: 'Controle', colors: 'bg-slate-100 text-slate-700' },
};

const SYSTEM_ROLE_LABELS: Record<string, { label: string; color: string }> = {
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

interface ChartOfAccountsManagerProps {
  embedded?: boolean;
}

export const ChartOfAccountsManager: React.FC<ChartOfAccountsManagerProps> = ({ embedded = false }) => {
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [showAddChartAccount, setShowAddChartAccount] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<any>(null);
  const [parentAccountForNew, setParentAccountForNew] = useState<any>(null);
  const [showChartInfo, setShowChartInfo] = useState(false);
  const [showDefaultChartModal, setShowDefaultChartModal] = useState(false);
  const [accountToDeleteWithDependencies, setAccountToDeleteWithDependencies] = useState<any>(null);
  const [deletionDependencies, setDeletionDependencies] = useState<any[]>([]);
  const [replacementAccountId, setReplacementAccountId] = useState<string>('');

  const loadAccounts = async () => {
    try {
      const response = await api.get(`/api/finance/v2/chart-of-accounts?flat=true${showInactive ? '&includeInactive=true' : ''}`);
      setChartOfAccounts(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar o Plano de Contas.');
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [showInactive]);

  const handleDeleteChartAccount = async (id: string, replaceId?: string) => {
    if (!replaceId && !confirm('Tem certeza que deseja remover esta conta contábil?')) return;
    try {
      const query = replaceId ? `?replacementAccountId=${replaceId}` : '';
      await api.delete(`/api/finance/v2/chart-of-accounts/${id}${query}`);
      toast.success(replaceId ? 'Conta remanejada e desativada (soft delete) com sucesso!' : 'Conta contábil removida (soft delete)!');

      if (replaceId) {
        setAccountToDeleteWithDependencies(null);
        setDeletionDependencies([]);
        setReplacementAccountId('');
      }
      loadAccounts();
    } catch (error: any) {
      if (error.response?.data?.code === 'HAS_DEPENDENCIES') {
        const accountInfo = chartOfAccounts.find(c => c.id === id);
        setAccountToDeleteWithDependencies(accountInfo);
        setDeletionDependencies(error.response.data.dependencies?.materials || []);
      } else {
        toast.error(error.response?.data?.message || 'Não é possível remover a conta contábil.');
      }
    }
  };

  const handleEditChartAccount = (account: any) => {
    setAccountToEdit(account);
    setParentAccountForNew(null);
    setShowAddChartAccount(true);
  };

  const handleAddChildChartAccount = (parentAccount: any) => {
    setAccountToEdit(null);
    setParentAccountForNew(parentAccount);
    setShowAddChartAccount(true);
  };

  const handleRestoreChartAccount = async (id: string) => {
    try {
      await api.patch(`/api/finance/v2/chart-of-accounts/${id}/restore`);
      toast.success('Conta contábil recuperada com sucesso!');
      loadAccounts();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao recuperar conta.');
    }
  };

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-4 p-6'}>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Plano de Contas
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-slate-400 hover:text-primary transition-colors" onClick={() => setShowChartInfo(true)}>
              <Info className="w-4 h-4" />
            </Button>
          </h2>
          <p className="text-sm text-muted-foreground">Hierarquia oficial de contas para relatórios contábeis e DRE</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors bg-slate-100 px-3 py-2 rounded-lg border border-slate-200 mr-2">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
            />
            <span className="font-medium">Exibir apagados (Lixeira)</span>
          </label>

          <Button variant="outline" onClick={() => setShowDefaultChartModal(true)} className="border-primary text-primary hover:bg-primary/5">
            <RefreshCw className="w-4 h-4 mr-2" />
            Plano de Contas Padrão
          </Button>

          <Button onClick={() => {
            setAccountToEdit(null);
            setParentAccountForNew(null);
            setShowAddChartAccount(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Conta Contábil
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-x border-b rounded-b-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200">
                  <th className="text-left p-3 font-bold text-slate-600 w-32">Código</th>
                  <th className="text-left p-3 font-bold text-slate-600">Nome da Conta</th>
                  <th className="text-left p-3 font-bold text-slate-600 w-40">Natureza / Tipo</th>
                  <th className="text-left p-3 font-bold text-slate-600 w-44">Finalidade</th>
                  <th className="text-right p-3 font-bold text-slate-600 w-32">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {chartOfAccounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground italic">
                      <Target className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      Nenhuma conta cadastrada no plano de contas.
                    </td>
                  </tr>
                )}
                {chartOfAccounts
                  .sort((a, b) => {
                    const codeA = a.code || '';
                    const codeB = b.code || '';
                    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
                  })
                  .map(account => (
                    <tr key={account.id} className={`hover:bg-slate-50 transition-colors ${account.active === false ? 'bg-slate-50/50' : ''}`}>
                      <td className={`p-3 font-mono text-xs font-bold ${account.active === false ? 'text-slate-400' : 'text-primary'}`}>
                        {account.code || '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {account.code?.split('.').length > 1 && (
                            <div className="flex gap-1 opacity-50">
                              {Array.from({ length: account.code.split('.').length - 1 }).map((_, i) => (
                                <div key={i} className="w-4 border-l border-slate-200 h-4" />
                              ))}
                            </div>
                          )}
                          <span className={`${account.type === 'SYNTHETIC' ? 'font-bold text-slate-900' : 'text-slate-700'} ${account.active === false ? 'line-through text-slate-400' : ''}`}>
                            {account.name}
                          </span>
                          {account.active === false && (
                            <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase font-bold ml-1">
                              Excluída
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const conf = accountNatureConfig[account.nature] || { label: account.nature, colors: 'bg-gray-100 text-gray-700' };
                            return (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${account.active === false ? 'bg-slate-100 text-slate-400 grayscale' : conf.colors}`}>
                                {conf.label}
                              </span>
                            );
                          })()}
                          <span title={account.type === 'SYNTHETIC' ? 'Sintética' : 'Analítica'} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${account.active === false ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                            {account.type === 'SYNTHETIC' ? '[S]' : '[A]'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {account.type === 'ANALYTIC' && account.systemRole && SYSTEM_ROLE_LABELS[account.systemRole] && (
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase whitespace-nowrap transition-all ${SYSTEM_ROLE_LABELS[account.systemRole].color}`}>
                            {SYSTEM_ROLE_LABELS[account.systemRole].label}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {account.active === false ? (
                          <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8" onClick={() => handleRestoreChartAccount(account.id)}>
                            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Restaurar
                          </Button>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Adicionar Subconta" onClick={() => handleAddChildChartAccount(account)} className="h-8 w-8">
                              <Plus className="w-4 h-4 text-slate-400 hover:text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Editar Conta" onClick={() => handleEditChartAccount(account)} className="h-8 w-8">
                              <Pencil className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="group h-8 w-8" onClick={() => handleDeleteChartAccount(account.id)} title="Excluir">
                              <Trash className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Account Modal */}
      {showAddChartAccount && (
        <ModalPortal>
          <Card className="modal-content-card max-w-md w-full relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              onClick={() => setShowAddChartAccount(false)}
            >
              <Plus className="w-4 h-4 rotate-45" />
            </Button>
            <CardContent className="pt-6">
              <AccountEntryForm
                isCreationMode={!accountToEdit}
                accountToEdit={accountToEdit || (parentAccountForNew ? { parentId: parentAccountForNew.id, nature: parentAccountForNew.nature } : null)}
                onSuccess={() => {
                  setShowAddChartAccount(false);
                  setAccountToEdit(null);
                  setParentAccountForNew(null);
                  loadAccounts();
                  toast.success('Plano de Contas atualizado!');
                }}
              />
              <div className="flex justify-end mt-2">
                <Button type="button" variant="ghost" onClick={() => setShowAddChartAccount(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </ModalPortal>
      )}

      {/* Dependency Migration Modal */}
      {accountToDeleteWithDependencies && (
        <ModalPortal className="z-[9999]">
          <Card className="modal-content-card max-w-lg w-full">
            <div className="bg-red-50 border-b border-red-100 rounded-t-xl pb-4 p-6">
              <h3 className="text-red-800 flex items-center gap-2 font-semibold">
                <AlertCircle className="w-5 h-5" />
                Migração Obrigatória
              </h3>
              <p className="text-red-700 mt-1 text-sm">
                A conta <strong>{accountToDeleteWithDependencies.code} - {accountToDeleteWithDependencies.name}</strong> não pode ser excluída diretamente. Ela possui materiais e históricos vitais atrelados a ela.
              </p>
            </div>
            <CardContent className="pt-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 max-h-40 overflow-y-auto font-mono">
                <p className="font-bold mb-2 text-slate-700">Recursos Mapeados ({deletionDependencies.length}):</p>
                <ul className="list-disc pl-5 space-y-1">
                  {deletionDependencies.map((dep, idx) => (
                    <li key={idx}>{dep.name || dep.id} (Material)</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 mt-4">
                <label className="text-sm font-bold text-slate-800">
                  Para onde migrar os recursos? (Nova Conta)
                </label>
                <select
                  className="w-full h-10 px-3 border border-slate-300 rounded focus:border-primary shadow-sm"
                  value={replacementAccountId}
                  onChange={e => setReplacementAccountId(e.target.value)}
                >
                  <option value="">Selecione a conta de destino...</option>
                  {chartOfAccounts
                    .filter(c => c.id !== accountToDeleteWithDependencies.id && c.type === 'ANALYTIC')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">Ao migrar, os históricos antigos permanecerão inalterados (Soft Delete) e os materiais receberão o novo código imediatamente.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setAccountToDeleteWithDependencies(null);
                    setDeletionDependencies([]);
                    setReplacementAccountId('');
                  }}
                >
                  Cancelar, manter conta
                </Button>
                <Button
                  disabled={!replacementAccountId}
                  onClick={() => handleDeleteChartAccount(accountToDeleteWithDependencies.id, replacementAccountId)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Substituir e Migrar Tudo
                </Button>
              </div>
            </CardContent>
          </Card>
        </ModalPortal>
      )}

      {/* Info Modal */}
      {showChartInfo && (
        <div className="modal-overlay overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-xl sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 leading-none mb-1">O que é o Plano de Contas?</h2>
                  <p className="text-sm text-slate-500">Entenda como organizar sua estrutura financeira</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowChartInfo(false)} className="rounded-full">
                <Plus className="w-5 h-5 rotate-45 text-slate-400" />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-6">
                <section>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Conceito Fundamental</h3>
                  <p className="text-slate-600 leading-relaxed">
                    O Plano de Contas é o "mapa" financeiro da sua empresa. Ele define como cada centavo que entra ou sai será classificado. Sem uma boa estrutura, é impossível saber se você está tendo lucro real ou onde estão os maiores gastos.
                  </p>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <h4 className="font-bold text-emerald-800 flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4" /> Receitas (Nível 4)
                    </h4>
                    <p className="text-sm text-emerald-700 mb-3">Tudo o que gera entrada de dinheiro.</p>
                    <ul className="text-xs space-y-1 text-emerald-900 font-mono bg-white/50 p-2 rounded">
                      <li>4.1 Vendas de Produtos</li>
                      <li>4.2 Prestação de Serviços</li>
                      <li>4.3 Receitas Financeiras</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg">
                    <h4 className="font-bold text-rose-800 flex items-center gap-2 mb-2">
                      <TrendingDown className="w-4 h-4" /> Custos e Despesas
                    </h4>
                    <p className="text-sm text-rose-700 mb-3">Saída de recursos para operação.</p>
                    <ul className="text-xs space-y-1 text-rose-900 font-mono bg-white/50 p-2 rounded">
                      <li className="font-bold">3 CUSTOS VARIÁVEIS</li>
                      <li className="ml-3">3.1 Insumos e Materiais</li>
                      <li className="font-bold mt-1">5 DESPESAS FIXAS</li>
                      <li className="ml-3">5.1 Aluguel e Energia</li>
                      <li className="ml-3">5.2 Folha de Pagamento</li>
                    </ul>
                  </div>
                </div>

                <section className="bg-slate-50 p-4 rounded-lg border">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Como a Hierarquia Funciona (Níveis)
                  </h3>
                  <div className="space-y-2 font-mono text-sm border-l-2 border-primary/20 ml-2 pl-4">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-bold">1</span>
                      <span className="text-slate-500">- ATIVO (Seu Patrimônio)</span>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-primary font-bold text-xs">1.1</span>
                      <span className="text-slate-500 text-xs">- ATIVO CIRCULANTE (Dinheiro rápido)</span>
                    </div>
                    <div className="flex items-center gap-2 ml-8">
                      <span className="text-primary font-bold text-[10px]">1.1.01</span>
                      <span className="text-slate-500 text-[10px]">- CAIXA E BANCOS (Saldo atual)</span>
                    </div>
                  </div>
                </section>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800 italic">
                    <strong>Dica de Ouro:</strong> Vincule seus produtos às categorias corretas no cadastro de produtos. Assim, o sistema alimentará este plano de contas automaticamente a cada pedido!
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 rounded-b-xl flex justify-end sticky bottom-0 z-10">
              <Button onClick={() => setShowChartInfo(false)} className="px-8 bg-primary hover:bg-primary/90 text-white">
                Entendi!
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Default Chart of Accounts Modal */}
      {showDefaultChartModal && (
        <DefaultChartOfAccountsModal
          onClose={() => setShowDefaultChartModal(false)}
          onSuccess={() => {
            setShowDefaultChartModal(false);
            loadAccounts();
          }}
        />
      )}
    </div>
  );
};
