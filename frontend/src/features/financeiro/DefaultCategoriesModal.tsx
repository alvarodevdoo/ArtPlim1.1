import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { X, Check } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface DefaultCategoriesModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

import { Info, Loader2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import defaultCategories from './default_categories.json';

interface CategoryTemplate {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  color: string;
  accountCode?: string;
  expectedAccountName?: string;
  description?: string;
}

const DEFAULT_CATEGORIES = defaultCategories as CategoryTemplate[];

interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
}

type ValidationStatus = 'OK' | 'MISMATCH' | 'MISSING' | 'NONE';

export const DefaultCategoriesModal: React.FC<DefaultCategoriesModalProps> = ({ onClose, onSuccess }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await api.get('/api/finance/v2/chart-of-accounts?flat=true');
        setChartOfAccounts(response.data.data || []);
      } catch (error) {
        console.error('Erro ao carregar plano de contas:', error);
      } finally {
        setLoadingAccounts(false);
      }
    };
    fetchAccounts();
  }, []);

  const getValidationStatus = (cat: CategoryTemplate): { status: ValidationStatus, actualName?: string } => {
    if (!cat.accountCode) return { status: 'NONE' };
    
    const account = chartOfAccounts.find(a => a.code === cat.accountCode);
    if (!account) return { status: 'MISSING' };
    
    // Normalização para comparação (remover espaços, case insensitive e remover acentos)
    const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    
    const normalizedExpected = cat.expectedAccountName ? normalizeStr(cat.expectedAccountName) : undefined;
    const normalizedActual = normalizeStr(account.name);
    
    if (normalizedExpected && normalizedExpected !== normalizedActual) {
      return { status: 'MISMATCH', actualName: account.name };
    }
    
    return { status: 'OK' };
  };

  const toggleCategory = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAll = (type?: 'INCOME' | 'EXPENSE') => {
    const categoriesToSelect = type 
      ? DEFAULT_CATEGORIES.filter(c => c.type === type)
      : DEFAULT_CATEGORIES;
    
    const newIds = categoriesToSelect.map(c => c.id);
    setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])));
  };

  const deselectAll = (type?: 'INCOME' | 'EXPENSE') => {
    if (!type) {
      setSelectedIds([]);
      return;
    }
    const idsToRemove = DEFAULT_CATEGORIES.filter(c => c.type === type).map(c => c.id);
    setSelectedIds(prev => prev.filter(id => !idsToRemove.includes(id)));
  };

  const handleImport = async () => {
    if (selectedIds.length === 0) {
      toast.error('Selecione pelo menos uma categoria.');
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let missingLinksCount = 0;
    const categoriesToImport = DEFAULT_CATEGORIES.filter(c => selectedIds.includes(c.id));

    try {
      for (const cat of categoriesToImport) {
        let chartOfAccountId = undefined;
        if (cat.accountCode) {
          const matchedAccount = chartOfAccounts.find(a => a.code === cat.accountCode);
          if (matchedAccount) {
            chartOfAccountId = matchedAccount.id;
          } else {
            missingLinksCount++;
          }
        }

        await api.post('/api/finance/categories', {
          name: cat.name,
          type: cat.type,
          color: cat.color,
          chartOfAccountId
        });
        successCount++;
      }
      
      if (missingLinksCount > 0) {
        toast.warning(`${successCount} categorias importadas, mas ${missingLinksCount} ficaram sem vínculo contábil por conta(s) não encontrada(s).`);
      } else {
        toast.success(`${successCount} categorias importadas com sucesso!`);
      }
      
      onSuccess();
    } catch (error: any) {
      toast.error(`Erro ao importar categorias: ${error.message || 'Falha na comunicação'}`);
      if (successCount > 0) onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCategoryCard = (cat: CategoryTemplate) => {
    const isSelected = selectedIds.includes(cat.id);
    const { status } = getValidationStatus(cat);
    
    return (
      <div 
        key={cat.id} 
        className={`group relative flex items-center justify-between border rounded-2xl p-4 cursor-pointer transition-all duration-200 ${
          isSelected 
            ? 'bg-primary/5 border-primary shadow-sm shadow-primary/10' 
            : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'
        }`}
        onClick={() => toggleCategory(cat.id)}
      >
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center">
            <input 
              type="checkbox"
              checked={isSelected} 
              onChange={() => toggleCategory(cat.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 rounded-md border-slate-300 text-primary focus:ring-primary cursor-pointer transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div 
              className="w-3 h-3 rounded-full shadow-sm" 
              style={{ backgroundColor: cat.color }} 
            />
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold tracking-tight transition-colors ${isSelected ? 'text-primary' : 'text-slate-700'}`}>
                {cat.name}
              </span>
              
              {/* Avisos de Validação */}
              {!loadingAccounts && status === 'MISSING' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button onClick={(e) => e.stopPropagation()} className="text-rose-500 hover:scale-110 transition-transform">
                      <AlertCircle size={14} className="animate-pulse" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 rounded-xl bg-rose-50 border-rose-100 text-rose-700 text-[11px] font-bold leading-tight z-[99999]" side="top" sideOffset={10}>
                    ⚠️ Categoria sem conta definida.
                  </PopoverContent>
                </Popover>
              )}
              
              {!loadingAccounts && status === 'MISMATCH' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button onClick={(e) => e.stopPropagation()} className="text-amber-500 hover:scale-110 transition-transform">
                      <AlertTriangle size={14} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 rounded-xl bg-amber-50 border-amber-100 text-amber-700 text-[11px] font-bold leading-tight z-[99999]" side="top" sideOffset={10}>
                    📝 Nome divergente da conta contábil atual.
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </div>

        {cat.description && (
          <Popover>
            <PopoverTrigger asChild>
              <button 
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:text-primary hover:bg-white transition-all shadow-none hover:shadow-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Info size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-[340px] p-5 rounded-3xl shadow-2xl border-slate-200 bg-white z-[9999]"
              side="top"
              align="end"
              sideOffset={10}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <span className="font-black text-slate-900 text-base leading-tight break-words">{cat.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tipo</p>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${cat.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {cat.type === 'INCOME' ? 'Receita' : 'Despesa'}
                    </span>
                  </div>
                  
                  {status !== 'NONE' && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Status Vínculo</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        status === 'OK' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                        status === 'MISMATCH' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                        'bg-rose-50 border-rose-100 text-rose-700'
                      }`}>
                        {status === 'OK' ? 'Sincronizado' : status === 'MISMATCH' ? 'Nome Divergente' : 'Conta Inexistente'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descrição</p>
                  <p className="text-[13px] text-slate-700 leading-relaxed font-medium">
                    {cat.description}
                  </p>
                </div>

                <div className="bg-primary/5 text-primary p-3 rounded-xl border border-primary/10 flex items-start gap-2 mt-2">
                  <span className="text-base leading-none mt-0.5">💡</span>
                  <p className="text-[11px] font-bold leading-tight">
                    {status === 'MISSING' 
                      ? `A conta vinculada não foi encontrada no plano atual. O item será importado sem vínculo.`
                      : `Esta categoria automatiza o lançamento contábil no grupo selecionado.`
                    }
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  };


  const incomes = DEFAULT_CATEGORIES.filter(c => c.type === 'INCOME');
  const expenses = DEFAULT_CATEGORIES.filter(c => c.type === 'EXPENSE');

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <Card className="max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border-none rounded-[32px] overflow-hidden bg-white/95">
        <CardHeader className="bg-white px-8 py-8 border-b border-slate-50 shrink-0 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-2xl font-black text-slate-800 tracking-tight">Categorias Padrão</CardTitle>
            <CardDescription className="mt-2 text-sm font-medium text-slate-500 leading-relaxed max-w-lg">
              Catálogo de categorias otimizado para o segmento de <span className="text-primary font-bold">Gráfica e Papelaria</span>.
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            disabled={isSubmitting}
            className="rounded-2xl hover:bg-slate-100/50 text-slate-400 transition-all"
          >
            <X className="w-6 h-6" />
          </Button>
        </CardHeader>
        
        <CardContent className="overflow-y-auto px-8 py-8 space-y-10 custom-scrollbar">
          {/* Receitas */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50/50 px-4 py-2 rounded-2xl">
              <h3 className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em]">Receitas</h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold text-slate-400 hover:text-primary rounded-lg" onClick={() => selectAll('INCOME')}>Todas</Button>
                <div className="w-px h-3 bg-slate-200 self-center mx-1" />
                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold text-slate-400 hover:text-rose-500 rounded-lg" onClick={() => deselectAll('INCOME')}>Nenhuma</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incomes.map(renderCategoryCard)}
            </div>
          </div>

          {/* Despesas */}
          <div className="space-y-4 pt-4 border-t border-slate-50">
            <div className="flex justify-between items-center bg-slate-50/50 px-4 py-2 rounded-2xl">
              <h3 className="text-xs font-black text-rose-600 uppercase tracking-[0.2em]">Despesas</h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold text-slate-400 hover:text-primary rounded-lg" onClick={() => selectAll('EXPENSE')}>Todas</Button>
                <div className="w-px h-3 bg-slate-200 self-center mx-1" />
                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold text-slate-400 hover:text-rose-500 rounded-lg" onClick={() => deselectAll('EXPENSE')}>Nenhuma</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {expenses.map(renderCategoryCard)}
            </div>
          </div>
        </CardContent>

        <CardFooter className="bg-white border-t border-slate-50 p-8 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="bg-primary/10 text-primary px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest">
               {selectedIds.length} selecionadas
             </div>
             {(loadingAccounts || isSubmitting) && (
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase animate-pulse">
                 <Loader2 size={12} className="animate-spin" />
                 {isSubmitting ? 'Importando...' : 'Sincronizando...'}
               </div>
             )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="flex-1 sm:flex-none h-12 px-8 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all">Cancelar</Button>
            <Button 
              onClick={handleImport} 
              disabled={isSubmitting || selectedIds.length === 0 || loadingAccounts}
              className="flex-1 sm:flex-none h-12 px-10 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Importando...' : 'Importar Selecionadas'}
              {!isSubmitting && <Check className="w-5 h-5 ml-2" />}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
