import React, { useState, useEffect } from 'react';
import { 
  Workflow, Plus, Trash2, Clock, 
  DollarSign, Settings, Info, GitMerge,
  PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ProductDraft } from '../types';

interface ProductionTabProps {
  productId: string;
  draft: ProductDraft;
}

interface Operation {
  id: string;
  name: string;
  costPerMinute: number;
  setupTime: number;
}

export const ProductionTab: React.FC<ProductionTabProps> = ({ productId, draft }) => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingDefault, setIsUsingDefault] = useState(false);

  useEffect(() => {
    if (productId) loadOperations();
    else setLoading(false);
  }, [productId]);

  const loadOperations = async () => {
    try {
      // Buscar operações do produto
      const resp = await api.get(`/api/catalog/products/${productId}/components`); // Usando endpoint genérico por enquanto
      // Em uma implementação real, buscaria de /operations
      // Simulando fallbacks conforme o plano
      if (resp.data.data.length === 0 && draft.categoryId) {
        loadCategoryDefaults();
      } else {
        setOperations(resp.data.data.map((op: any) => ({
          ...op,
          costPerMinute: Number(op.costPerMinute || 0),
          setupTime: Number(op.setupTime || 0)
        })));
      }
    } catch (err) {
      toast.error('Erro ao carregar roteiro');
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryDefaults = async () => {
    try {
      const resp = await api.get(`/api/categories/${draft.categoryId}`);
      const category = resp.data.data;
      if (category.defaultProductionSteps) {
        setIsUsingDefault(true);
        setOperations(category.defaultProductionSteps);
      }
    } catch (err) {
      console.error('Erro ao carregar padrões da categoria');
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando Roteiro...</div>;

  // State de bloqueio para novos produtos
  if (!productId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-20 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-slate-200">
          <Workflow className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">Aguardando Cadastro Inicial</h3>
        <p className="text-xs font-bold text-slate-400 mt-2 max-w-xs uppercase leading-relaxed">
          Salve as informações gerais do produto na aba de <span className="text-primary underline">Cadastro</span> para liberar o roteiro de produção (PCP).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-300 h-full flex flex-col">
      
      {/* Header da Aba */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
              <Workflow className="w-5 h-5" />
           </div>
           <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Roteiro de Produção (PCP)</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Etapas e tempos de fabricação</p>
           </div>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" className="rounded-xl font-bold border-2 border-purple-200 text-purple-700 hover:bg-purple-50">
              <PlayCircle className="w-4 h-4 mr-2" /> Gerar OP Teste
           </Button>
           <Button className="bg-purple-600 hover:bg-purple-700 rounded-xl font-bold shadow-md shadow-purple-200">
              <Plus className="w-4 h-4 mr-2" /> Nova Etapa
           </Button>
        </div>
      </div>

      {/* Banner de Herança */}
      {isUsingDefault && (
        <div className="bg-indigo-50 border-2 border-indigo-100 p-4 rounded-2xl flex items-center gap-4 animate-in fade-in">
           <div className="bg-white p-2 rounded-xl shadow-sm text-indigo-600">
              <GitMerge className="w-4 h-4" />
           </div>
           <div>
              <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Herdado da Categoria</p>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">Este produto está utilizando as operações padrão da categoria. Salve uma operação manual para criar um roteiro customizado.</p>
           </div>
        </div>
      )}

      {/* Lista de Operações */}
      <div className="flex-1 space-y-4 overflow-y-auto pr-2 pb-8">
        {operations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-20 opacity-30 border-4 border-dashed rounded-3xl">
             <Workflow className="w-16 h-16 mb-4" />
             <p className="font-black uppercase tracking-widest text-lg">Sem roteiro definido</p>
             <p className="text-xs font-bold mt-1">O PCP não conseguirá calcular tempos de produção.</p>
          </div>
        ) : (
          operations.map((op, idx) => (
            <OperationCard key={op.id || idx} op={op} idx={idx} />
          ))
        )}
      </div>

      {/* Info Box */}
      <div className="bg-slate-50 p-4 rounded-2xl flex gap-3 border border-slate-200 shrink-0">
         <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
         <div className="space-y-1">
           <p className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase tracking-tighter">
              Os tempos de SETUP e PRODUÇÃO são fundamentais para o agendamento no Kanban GERAL.
           </p>
           <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
             O custo por minuto é somado ao custo de materiais na aba de precificação caso a "Produção" esteja ativa no cálculo de margem.
           </p>
         </div>
      </div>
    </div>
  );
};

// Subcomponente de Card de Operação
const OperationCard = ({ op, idx }: { op: Operation, idx: number }) => (
  <div className="p-5 bg-white border-2 border-slate-100 rounded-3xl hover:border-purple-200 transition-all flex items-center justify-between group shadow-sm hover:shadow-xl hover:shadow-purple-100/30">
     <div className="flex items-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 border flex items-center justify-center font-black text-slate-300 text-lg group-hover:bg-purple-600 group-hover:text-white transition-all">
           {idx + 1}
        </div>
        <div>
           <h5 className="text-sm font-black text-slate-800 flex items-center gap-2">
             {op.name}
             <span className="px-2 py-0.5 bg-slate-100 text-[9px] text-slate-400 rounded uppercase tracking-widest">Efetiva</span>
           </h5>
           <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-slate-400">
                 <Clock className="w-3.5 h-3.5" />
                 <span className="text-[10px] font-black uppercase">{op.setupTime}min Setup</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                 <DollarSign className="w-3.5 h-3.5" />
                 <span className="text-[10px] font-black uppercase">R$ {op.costPerMinute.toFixed(2)}/min</span>
              </div>
           </div>
        </div>
     </div>

     <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-slate-300 hover:text-slate-600">
           <Settings className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-slate-200 hover:text-red-500 hover:bg-red-50">
           <Trash2 className="w-4 h-4" />
        </Button>
     </div>
  </div>
);
