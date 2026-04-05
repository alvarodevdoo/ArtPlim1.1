import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { 
  Package, Search, Clock, ListChecks, Hash, 
  Settings, RefreshCw, BarChart4
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProductionCard } from '@/components/production/ProductionCard';

export const TerminalProducao: React.FC = () => {
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const loadOPs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/production/orders');
      setOps(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar OPs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOPs();
  }, []);

  const handleUpdateStep = async (opId: string, stepId: string, newStatus: string) => {
    try {
      // Registrar movimento de etapa
      await api.patch(`/api/production/orders/${opId}/status`, { 
        status: 'IN_PROGRESS', 
        stepId, 
        stepStatus: newStatus 
      });
      loadOPs();
      toast({ title: 'Etapa atualizada', description: `Roteiro em evolução.` });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar a etapa.', variant: 'destructive' });
    }
  };

  const handleCompleteOP = async (opId: string) => {
    try {
      await api.patch(`/api/production/orders/${opId}/status`, { status: 'FINISHED' });
      loadOPs();
      toast({ title: 'OP Concluída!', description: 'Ordem de produção finalizada com sucesso.' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao finalizar ordem.', variant: 'destructive' });
    }
  };

  const filteredOps = ops.filter(op => 
    op.orderItem.order.orderNumber.includes(search) || 
    op.orderItem.product.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar - Terminal de Gestão */}
      <div className="w-80 border-r border-slate-800 flex flex-col h-full bg-slate-950">
        <div className="p-6 border-b border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black italic tracking-tighter flex items-center gap-2 text-indigo-400">
              <Settings className="h-5 w-5 animate-spin-slow" /> MOTOR OP
            </h1>
            <Badge className="bg-indigo-500/20 text-indigo-400 border-none font-bold uppercase text-[10px]">v2.1</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
            <Input 
              placeholder="Filtro de Produção..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500 rounded-xl"
            />
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">
           <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Fluxo Atual</h3>
              <div className="grid gap-2">
                 <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                    <div className="flex items-center gap-3">
                       <Clock className="h-4 w-4 text-amber-500" />
                       <span className="text-xs font-bold">Aguardando</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500">{ops.filter(o => o.status === 'WAITING').length}</span>
                 </div>
                 <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                    <div className="flex items-center gap-3">
                       <RefreshCw className="h-4 w-4 text-blue-500" />
                       <span className="text-xs font-bold">Processando</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500">{ops.filter(o => o.status === 'IN_PROGRESS').length}</span>
                 </div>
              </div>
           </div>

           <div className="pt-4 border-t border-slate-800/50">
              <Button onClick={loadOPs} variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-slate-900">
                 <RefreshCw className="h-4 w-4" /> Atualizar Motor
              </Button>
           </div>
        </div>
      </div>

      {/* Grid de Produção - Alta Performance */}
      <div className="flex-1 p-8 overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-950">
        <div className="max-w-6xl mx-auto space-y-8">
           <div className="flex justify-between items-end border-b border-slate-800 pb-6">
              <div>
                 <h2 className="text-4xl font-black text-white flex items-center gap-3">
                    <BarChart4 className="h-8 w-8 text-indigo-500" /> FILA DE EXECUÇÃO
                 </h2>
                 <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Visão do Operador - Baixa Complexidade Cognitiva</p>
              </div>
              <div className="flex gap-4">
                 <div className="text-right">
                    <div className="text-2xl font-black text-indigo-400">{filteredOps.length}</div>
                    <div className="text-[10px] text-slate-600 font-black uppercase">Tarefas Ativas</div>
                 </div>
              </div>
           </div>

           {loading ? (
             <div className="flex flex-col items-center justify-center p-20 gap-4">
                 <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin" />
                 <span className="font-bold text-slate-600 animate-pulse tracking-widest text-xs uppercase">Conectando ao Motor de Produção...</span>
             </div>
           ) : filteredOps.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-32 text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl gap-4">
                 <Package className="h-16 w-16 opacity-10" />
                 <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-500">Sem Demandas Pendentes</h3>
                    <p className="text-sm text-slate-700">A fábrica está em dia. Novas OPs aparecerão após aprovação comercial.</p>
                 </div>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filteredOps.map(op => (
                 <ProductionCard 
                    key={op.id}
                    order={{
                      id: op.id,
                      orderNumber: op.orderItem.order.orderNumber,
                      productName: op.orderItem.product.name,
                      customerName: op.orderItem.order.customer.name,
                      status: op.status,
                      priority: op.priority,
                      pickingList: op.pickingList,
                      steps: op.steps
                    }}
                    onUpdateStep={handleUpdateStep}
                    onCompleteOP={handleCompleteOP}
                 />
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default TerminalProducao;
