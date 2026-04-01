import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Loader2, 
  ChevronRight, ChevronDown, Package, Receipt, Plus, Search, X, 
  LayoutList, Pencil, Trash2, AlertCircle, Info, Check
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { AccountInfoTooltip } from '@/components/financeiro/AccountInfoTooltip';

// Vínculos Contábeis de Insumos - Sistema de Classificação Dinâmica

interface MaterialType {
  id: string;
  name: string;
  spedCode: string;
  mappings: any[];
}

export const SpedMappingManager: React.FC = () => {
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [activeTypeId, setActiveTypeId] = useState<string>('');
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Modal & Form State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<MaterialType | null>(null);
  const [typeForm, setTypeForm] = useState({ name: '' });
  
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (shouldKeepActive = false) => {
    try {
      setLoading(true);
      const [chartRes, typesRes] = await Promise.all([
        api.get('/api/finance/v2/chart-of-accounts?flat=true'),
        api.get('/api/finance/v2/material-types')
      ]);

      const types = typesRes.data.data || [];
      const accounts = chartRes.data.data || [];
      
      setChartOfAccounts(accounts);
      setMaterialTypes(types);

      // Pré-expandir todas as contas sintéticas a partir do nível 1 
      // (as filhas do nível 0 vão nascer sempre abertas)
      if (!shouldKeepActive) {
        const preExpanded = new Set<string>();
        accounts.forEach((acc: any) => {
          if (acc.parentId !== null && acc.type !== 'ANALYTIC') {
            preExpanded.add(acc.id);
          }
        });
        setExpandedNodes(preExpanded);
      }

      // Não selecionar automaticamente o primeiro item para permitir que comece vazio
      if (shouldKeepActive && activeTypeId) {
        setActiveTypeId(activeTypeId);
      }
    } catch (error) {
      toast.error('Erro ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  };

  const activeType = useMemo(() => 
    materialTypes.find(t => t.id === activeTypeId),
  [materialTypes, activeTypeId]);

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = { ...typeForm, spedCode: '00' };
      if (editingType) {
        await api.put('/api/finance/v2/material-types', {
          id: editingType.id,
          ...payload
        });
        toast.success('Tipo de insumo atualizado!');
      } else {
        const res = await api.post('/api/finance/v2/material-types', payload);
        setActiveTypeId(res.data.data.id);
        toast.success('Novo tipo de insumo criado!');
      }
      setIsTypeModalOpen(false);
      setEditingType(null);
      loadData(true);
    } catch (error) {
      toast.error('Erro ao salvar classificação.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este tipo? Isso removerá todos os seus vínculos contábeis.')) return;
    try {
      await api.delete(`/api/finance/v2/material-types/${id}`);
      toast.success('Tipo excluído com sucesso!');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir tipo.');
    }
  };

  const handleSelectAccount = (accountId: string) => {
    if (!activeType) return;
    
    setMaterialTypes(prev => prev.map(t => {
      if (t.id === activeTypeId) {
        const isSelected = t.mappings.some(m => m.accountId === accountId);
        if (isSelected) {
          return { ...t, mappings: t.mappings.filter(m => m.accountId !== accountId) };
        } else {
          const account = chartOfAccounts.find(a => a.id === accountId);
          // Lógica correta: usa systemRole da conta
          // Somente contas com systemRole de INVENTORY são estoque
          // Tudo mais (EXPENSE, REVENUE, GENERAL, etc.) é despesa/custo
          const isInventoryAccount = account?.systemRole === 'INVENTORY' || 
            account?.systemRole === 'INVENTORY_ASSET';
          const mappingType: 'INVENTORY' | 'EXPENSE' = isInventoryAccount ? 'INVENTORY' : 'EXPENSE';
          
          return { 
            ...t, 
            mappings: [...t.mappings, { 
              accountId, 
              mappingType, 
              account: { name: account?.name, code: account?.code, systemRole: account?.systemRole } 
            }] 
          };
        }
      }
      return t;
    }));
  };

  const getDescendantAnalyticAccountIds = (nodeId: string, acc: string[] = []) => {
    const children = chartOfAccounts.filter(a => a.parentId === nodeId);
    for (const child of children) {
      if (child.type === 'ANALYTIC') acc.push(child.id);
      else getDescendantAnalyticAccountIds(child.id, acc);
    }
    return acc;
  };

  const handleToggleSynthetic = (nodeId: string, currentStatus: 'checked' | 'partial' | 'unchecked') => {
    if (!activeType) return;
    const descendantIds = getDescendantAnalyticAccountIds(nodeId);
    if (descendantIds.length === 0) return;

    setMaterialTypes(prev => prev.map(t => {
      if (t.id === activeTypeId) {
        if (currentStatus === 'unchecked' || currentStatus === 'partial') {
          // Marcar todos que ainda não estão marcados
          let newMappings = [...t.mappings];
          for (const accId of descendantIds) {
            const isSelected = newMappings.some(m => m.accountId === accId);
            if (!isSelected) {
              const account = chartOfAccounts.find(a => a.id === accId);
              const isInventoryAccount = account?.systemRole === 'INVENTORY' || account?.systemRole === 'INVENTORY_ASSET';
              const mappingType = isInventoryAccount ? 'INVENTORY' : 'EXPENSE';
              newMappings.push({
                accountId: accId,
                mappingType,
                account: { name: account?.name, code: account?.code, systemRole: account?.systemRole }
              });
            }
          }
          return { ...t, mappings: newMappings };
        } else {
          // Desmarcar todos
          return { ...t, mappings: t.mappings.filter(m => !descendantIds.includes(m.accountId)) };
        }
      }
      return t;
    }));
  };

  const handleSaveMappings = async () => {
    if (!activeType) return;
    try {
      setSaving(true);
      await api.post('/api/finance/v2/sped-mappings', {
        materialTypeId: activeType.id,
        spedType: activeType.spedCode,
        mappingType: 'INVENTORY',
        accountIds: activeType.mappings.filter(m => m.mappingType === 'INVENTORY').map(m => m.accountId)
      });
      await api.post('/api/finance/v2/sped-mappings', {
        materialTypeId: activeType.id,
        spedType: activeType.spedCode,
        mappingType: 'EXPENSE',
        accountIds: activeType.mappings.filter(m => m.mappingType === 'EXPENSE').map(m => m.accountId)
      });
      toast.success('Vínculos contábeis salvos!');
    } catch (error) {
      toast.error('Erro ao salvar vínculos.');
    } finally {
      setSaving(false);
    }
  };

  const comboboxOptions = useMemo(() => 
    materialTypes.map(t => ({
      id: t.id,
      label: t.name,
      rightLabel: `${t.mappings.length} vínculos`
    })),
  [materialTypes]);

  const toggleNode = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetNode = chartOfAccounts.find(a => a.id === id);
    if (!targetNode) return;

    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Enforce Accordion: fecha os outros irmãos de mesmo nível
        chartOfAccounts.filter(a => a.parentId === targetNode.parentId && a.id !== id).forEach(sibling => {
           next.delete(sibling.id);
        });
        next.add(id);
      }
      return next;
    });
  };

  const [initialMappingsStr, setInitialMappingsStr] = useState<string>('');
  const [pendingCloseAlert, setPendingCloseAlert] = useState(false);

  const openAccountModal = () => {
    setInitialMappingsStr(JSON.stringify(activeType?.mappings || []));
    setIsAccountModalOpen(true);
  };

  const revertAndClose = () => {
    if (activeType && initialMappingsStr) {
      setMaterialTypes((prev) => prev.map(t => 
        t.id === activeType.id ? { ...t, mappings: JSON.parse(initialMappingsStr) } : t
      ));
    }
    setIsAccountModalOpen(false);
    setSearchQuery('');
    setPendingCloseAlert(false);
  };

  const closeAccountModal = () => {
    if (!activeType) {
       setIsAccountModalOpen(false);
       return;
    }
    const currentMappingsStr = JSON.stringify(activeType.mappings);
    if (currentMappingsStr !== initialMappingsStr) {
       setPendingCloseAlert(true);
       toast.error('Existem alterações não salvas', {
         id: 'close-alert',
         description: 'Pressione ENTER para descartar ou ESC para voltar.',
         duration: 8000,
         action: {
           label: 'Descartar',
           onClick: () => revertAndClose()
         },
         onDismiss: () => setPendingCloseAlert(false),
         onAutoClose: () => setPendingCloseAlert(false)
       });
    } else {
       revertAndClose();
    }
  };

  useEffect(() => {
    if (!pendingCloseAlert) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
         e.preventDefault();
         e.stopPropagation();
         toast.dismiss('close-alert');
         revertAndClose();
      } else if (e.key === 'Escape') {
         e.preventDefault();
         e.stopPropagation();
         toast.dismiss('close-alert');
         setPendingCloseAlert(false);
      }
    };
    
    // capture: true garante que o evento seja pego antes de outros listeners locais da modal
    window.addEventListener('keydown', handleKey, { capture: true });
    return () => window.removeEventListener('keydown', handleKey, { capture: true });
  }, [pendingCloseAlert, activeType, initialMappingsStr]);

  const matchesSearchCache = useMemo(() => {
    if (!searchQuery) return new Set<string>();
    const query = searchQuery.toLowerCase();
    const cache = new Set<string>();
    
    // Bottom-up recursion para encontrar qualquer folha que bata
    const checkMatch = (id: string): boolean => {
       const node = chartOfAccounts.find(a => a.id === id);
       if (!node) return false;
       
       const matches = node.name.toLowerCase().includes(query) || node.code.includes(query);
       
       const children = chartOfAccounts.filter(a => a.parentId === id);
       let hasMatchingChildren = false;
       for (const child of children) {
          if (checkMatch(child.id)) {
             hasMatchingChildren = true;
          }
       }
       
       if (matches || hasMatchingChildren) {
          cache.add(id);
          return true;
       }
       return false;
    };
    
    chartOfAccounts.filter(a => a.parentId === null).forEach(a => checkMatch(a.id));
    return cache;
  }, [searchQuery, chartOfAccounts]);

  const renderAccountTree = (parentId: string | null = null, level = 0) => {
    const nodes = chartOfAccounts
      .filter(a => a.parentId === parentId)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    return (
      <div className="space-y-1">
        {nodes.map(node => {
          if (searchQuery && !matchesSearchCache.has(node.id)) return null;

          const hasChildren = chartOfAccounts.some(a => a.parentId === node.id);
          const isExpanded = !!searchQuery || expandedNodes.has(node.id);
          const isAnalytic = node.type === 'ANALYTIC';
          const isSelected = activeType?.mappings.some(m => m.accountId === node.id);

          return (
            <div key={node.id}>
              <div 
                className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors group/row ${
                  isAnalytic ? 'hover:bg-primary/5' : 'cursor-pointer hover:bg-slate-100'
                } ${isSelected ? 'bg-primary/5 border-l-2 border-primary shadow-sm' : ''}`}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={() => !isAnalytic && toggleNode(node.id)}
              >
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Espaço fixo do Chevron (Oculto em contas analíticas) */}
                  <div className="w-4 h-4 flex items-center justify-center text-slate-400">
                    {!isAnalytic && (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                  </div>
                  
                  {/* Espaço fixo do Checkbox */}
                  {!isAnalytic ? (() => {
                     const descendantIds = getDescendantAnalyticAccountIds(node.id);
                     const isCheckboxVisible = descendantIds.length > 0;
                     const selectedCount = descendantIds.filter(id => activeType?.mappings.some(m => m.accountId === id)).length;
                     const status: 'checked' | 'partial' | 'unchecked' = 
                        selectedCount === 0 ? 'unchecked' : 
                        selectedCount === descendantIds.length ? 'checked' : 'partial';

                     return isCheckboxVisible ? (
                       <input 
                         type="checkbox" 
                         className="rounded border-slate-300 text-primary h-3.5 w-3.5 cursor-pointer flex-shrink-0"
                         checked={status === 'checked'}
                         name={`synth-${node.id}`}
                         ref={el => { if (el) el.indeterminate = status === 'partial'; }}
                         onChange={() => handleToggleSynthetic(node.id, status)}
                         onClick={(e) => e.stopPropagation()}
                       />
                     ) : <div className="w-3.5 h-3.5 flex-shrink-0" />;
                  })() : (
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-primary h-3.5 w-3.5 cursor-pointer flex-shrink-0"
                      checked={isSelected}
                      name={`an-${node.id}`}
                      onChange={() => handleSelectAccount(node.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
                <span className={`text-[10px] font-mono w-14 flex-shrink-0 ${!isAnalytic ? 'font-bold text-slate-400' : 'text-primary'}`}>{node.code}</span>
                <span className={`text-xs flex-1 min-w-0 truncate ${!isAnalytic ? 'font-bold text-slate-700' : 'text-slate-600'}`}>{node.name}</span>

                {/* Badge de Classificação do Plano de Contas */}
                {isAnalytic && (() => {
                  let badge = { label: 'Conta', color: 'bg-slate-100 text-slate-600' };
                  
                  if (node.code.startsWith('1')) badge = { label: 'Ativo', color: 'bg-emerald-50 text-emerald-700' };
                  else if (node.code.startsWith('2')) badge = { label: 'Passivo', color: 'bg-rose-50 text-rose-700' };
                  else if (node.code.startsWith('3')) badge = { label: 'Receita', color: 'bg-sky-50 text-sky-700' };
                  else if (node.code.startsWith('4')) badge = { label: 'Custo', color: 'bg-indigo-50 text-indigo-700' };
                  else if (node.code.startsWith('5')) badge = { label: 'Despesa', color: 'bg-orange-50 text-orange-700' };
                  else if (node.code.startsWith('6')) badge = { label: 'Apuração', color: 'bg-slate-200 text-slate-700' };
                  
                  return (
                    <span className={`flex-shrink-0 text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${badge.color}`}>
                      {badge.label}
                    </span>
                  );
                })()}

                {/* Popover de info da conta - componente global padronizado */}
                <AccountInfoTooltip account={node} side="left" />


              </div>
              {hasChildren && isExpanded && <div>{renderAccountTree(node.id, level + 1)}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading && materialTypes.length === 0) return <div className="p-12 text-center animate-pulse"><Loader2 className="animate-spin mx-auto text-primary mb-2" /><p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Sincronizando Categorias...</p></div>;

  return (
    <div className="animate-in fade-in duration-500">
      <Card className="shadow-sm border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="p-6 border-b border-slate-50">
          <div className="flex flex-col min-[1470px]:flex-row justify-between items-start min-[1470px]:items-center gap-6">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Vínculos de Custos e Insumos</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">Configure a apropriação contábil para materiais, serviços e mão de obra.</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto pr-4">
              <div className="w-full sm:w-80">
                <Combobox 
                  value={activeTypeId}
                  onChange={setActiveTypeId}
                  options={comboboxOptions}
                  placeholder="Selecione uma categoria..."
                  className="w-full h-10 border-slate-200 rounded-lg"
                  allowClear={true}
                />
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-1">
                {/* 1. ADICIONAR (+) */}
                <Button 
                   onClick={() => { setEditingType(null); setTypeForm({ name: '' }); setIsTypeModalOpen(true); }}
                   className="h-9 w-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm active:scale-95 transition-all p-0 flex items-center justify-center"
                   title="Adicionar Tipo"
                >
                   <Plus size={18} />
                </Button>

                <div className="w-px h-5 bg-slate-100 mx-1" />

                {/* 2. EDITAR (✏️) */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  disabled={!activeType}
                  onClick={() => { if (activeType) { setEditingType(activeType); setTypeForm({ name: activeType.name }); setIsTypeModalOpen(true); } }}
                  className="h-9 w-9 p-0 text-slate-500 hover:text-primary hover:bg-slate-50 rounded-lg transition-all disabled:opacity-30"
                  title="Editar nome"
                >
                  <Pencil size={15} />
                </Button>

                {/* 3. EXCLUIR (🗑️) */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  disabled={!activeType}
                  onClick={() => { if (activeType) handleDeleteType(activeType.id); }}
                  className="h-9 w-9 p-0 text-slate-500 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-all disabled:opacity-30"
                  title="Excluir"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          {activeType ? (
            <div className="space-y-6">

          {/* Card de Vínculos Contábeis */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                 <LayoutList size={16} className="text-primary" />
                 <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Apropriação Contábil</h4>
              </div>
              <div className="flex gap-2">
                <Button onClick={openAccountModal} variant="outline" className="h-9 border-primary/20 text-primary text-xs font-bold px-4 rounded-xl hover:bg-primary/5">
                   <Plus size={14} className="mr-2" /> Gerenciar Vínculos
                </Button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Estoque */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Package size={14} /></div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque (Ativo)</h4>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="text-slate-300 hover:text-emerald-500 transition-colors">
                            <Info size={12} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 text-xs p-4 rounded-2xl shadow-xl border-slate-100" side="right">
                          <p className="font-black text-slate-700 mb-1">📦 Conta de Entrada de Estoque</p>
                          <p className="text-slate-500 leading-relaxed">Quando uma <strong>nota fiscal de compra</strong> é lançada para este tipo de insumo, o valor dá entrada <strong>a débito</strong> nesta conta.
                          </p>
                          <p className="text-slate-400 mt-2 text-[10px]">Ex: “Estoque de Matéria-Prima”, “Estoque de Materiais”</p>
                          <p className="text-slate-400 mt-1 text-[10px] italic">Selecione apenas contas com systemRole = INVENTORY no seu Plano de Contas.</p>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {activeType.mappings.filter(m => m.mappingType === 'INVENTORY').length === 0 ? (
                      <div className="py-10 text-center border-2 border-dashed border-slate-50 rounded-2xl">
                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Nenhuma conta de estoque</p>
                      </div>
                    ) : (
                      activeType.mappings.filter(m => m.mappingType === 'INVENTORY').map(m => (
                        <div key={m.accountId} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between group shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-emerald-600/60 uppercase tracking-wider">{m.account.code}</span>
                            <span className="text-[11px] font-bold text-slate-700">{m.account.name}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-200 hover:text-red-500 rounded-xl" onClick={() => handleSelectAccount(m.accountId)}>
                            <X size={14} />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Despesa */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Receipt size={14} /></div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Despesa (Resultado)</h4>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="text-slate-300 hover:text-blue-500 transition-colors">
                            <Info size={12} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 text-xs p-4 rounded-2xl shadow-xl border-slate-100" side="right">
                          <p className="font-black text-slate-700 mb-1">🧳 Conta de Consumo / Despesa</p>
                          <p className="text-slate-500 leading-relaxed">Quando o insumo é <strong>consumido na produção</strong> ou lançado como custo, o valor sai do estoque e entra <strong>a débito</strong> nesta conta de resultado.</p>
                          <p className="text-slate-400 mt-2 text-[10px]">Ex: “Custo de Materiais Consumidos”, “Despesa com Insumos”</p>
                          <p className="text-slate-400 mt-1 text-[10px] italic">Selecione apenas contas do grupo de Custos ou Despesas operacionais.</p>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {activeType.mappings.filter(m => m.mappingType === 'EXPENSE').length === 0 ? (
                      <div className="py-10 text-center border-2 border-dashed border-slate-50 rounded-2xl">
                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Nenhuma conta de despesa</p>
                      </div>
                    ) : (
                      activeType.mappings.filter(m => m.mappingType === 'EXPENSE').map(m => (
                        <div key={m.accountId} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between group shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-blue-600/60 uppercase tracking-wider">{m.account.code}</span>
                            <span className="text-[11px] font-bold text-slate-700">{m.account.name}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-200 hover:text-red-500 rounded-xl" onClick={() => handleSelectAccount(m.accountId)}>
                            <X size={14} />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-16 text-center border-2 border-dashed border-slate-100 rounded-xl animate-in fade-in zoom-in duration-300">
           <Package className="mx-auto text-slate-100 mb-4" size={48} />
           {materialTypes.length > 0 ? (
             <>
               <h3 className="text-lg font-bold text-slate-700">Nenhuma classificação selecionada</h3>
               <p className="text-sm text-slate-400 max-w-xs mx-auto mb-6">Escolha uma categoria no menu acima para começar a mapear as contas.</p>
             </>
           ) : (
             <>
               <h3 className="text-lg font-bold text-slate-700">Nenhuma configuração encontrada</h3>
               <p className="text-sm text-slate-400 max-w-xs mx-auto mb-6">Comece adicionando uma categoria de insumo para os vínculos contábeis.</p>
               <Button 
                 onClick={() => { setEditingType(null); setTypeForm({ name: '' }); setIsTypeModalOpen(true); }}
                 className="bg-white border-slate-200 text-slate-600 font-bold px-8 h-10 rounded-lg shadow-sm border hover:bg-slate-50 transition-all text-sm"
               >
                 Adicionar Agora
               </Button>
             </>
           )}
        </div>
      )}
    </div>
  </Card>

      {/* Modal - Novo/Editar Tipo */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-none rounded-xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <CardHeader className="p-8 pb-4">
               <CardTitle className="text-2xl font-bold text-slate-800">{editingType ? 'Editar Classificação' : 'Nova Classificação'}</CardTitle>
               <CardDescription className="text-sm font-medium">Defina como você quer chamar este grupo de insumos.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
               <form onSubmit={handleSaveType} className="space-y-6">
                 <div className="space-y-4">
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nome para o Usuário</label>
                      <Input 
                        placeholder="Ex: Tintas Solvente, Chapas de Alumínio..." 
                        className="h-12 border-slate-200 bg-slate-50 rounded-lg focus:ring-blue-600 text-sm font-medium"
                        value={typeForm.name}
                        onChange={e => setTypeForm(prev => ({...prev, name: e.target.value}))}
                        required
                      />
                   </div>
                 </div>
                 <div className="flex gap-3 pt-4">
                   <Button type="button" variant="ghost" onClick={() => setIsTypeModalOpen(false)} className="flex-1 h-11 rounded-md font-medium">Cancelar</Button>
                   <Button type="submit" disabled={saving} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-colors text-[14px]">
                     {saving ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Tipo'}
                   </Button>
                 </div>
               </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal - Árvore do Plano de Contas */}
      {isAccountModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 outline-none" 
          tabIndex={-1} 
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
               if (searchQuery) {
                   setSearchQuery('');
                   e.stopPropagation();
               } else {
                   closeAccountModal();
               }
            }
          }}
        >
          <Card className="w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl border-none rounded-xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <CardHeader className="p-6 border-b bg-white">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Vincular Contas</h3>
                  <p className="text-sm font-medium text-slate-500">Selecionando para: <span className="text-primary font-bold">{activeType?.name}</span></p>
                </div>
                <Button variant="ghost" size="icon" onClick={closeAccountModal} className="rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></Button>
              </div>
              <div className="relative group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Busque por nome da conta ou código estrutural..." 
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
              {renderAccountTree()}
            </CardContent>
            <div className="p-4 border-t bg-white flex justify-end items-center px-6">
              <Button 
                onClick={async () => {
                   await handleSaveMappings();
                   setIsAccountModalOpen(false);
                }} 
                disabled={saving}
                className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 rounded-md shadow-sm transition-colors text-[14px]"
              >
                {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                Vincular {activeType?.mappings.length || 0} {activeType?.mappings.length === 1 ? 'Conta' : 'Contas'} {!saving && <Check className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
