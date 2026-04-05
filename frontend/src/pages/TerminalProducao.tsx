import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { 
  CheckCircle2, PlayCircle, Clock, Package, AlertCircle, 
  Search, ListChecks, Hash
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProductionOrder {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  priority: number;
  pickingList: any[];
  steps: any[];
  notes?: string;
  orderItem: {
    order: { orderNumber: string, customer: { name: string } };
    product: { name: string };
  };
  createdAt: string;
}

export const TerminalProducao: React.FC = () => {
  const [ops, setOps] = useState<ProductionOrder[]>([]);
  const [selectedOP, setSelectedOP] = useState<ProductionOrder | null>(null);
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

  const updateStatus = async (id: string, status: string) => {
    try {
      const response = await api.patch(`/api/production/orders/${id}/status`, { status });
      toast({
        title: 'Status Atualizado',
        description: `Ordem de Produção agora está como ${status}`,
      });
      loadOPs();
      if (selectedOP?.id === id) {
        setSelectedOP(response.data.data);
      }
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível mudar o status da OP.',
        variant: 'destructive',
      });
    }
  };

  const filteredOps = ops.filter(op => 
    op.orderItem.order.orderNumber.includes(search) || 
    op.orderItem.product.name.toLowerCase().includes(search.toLowerCase()) ||
    op.orderItem.order.customer.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sidebar - Lista de OPs */}
      <div className="w-96 border-r border-slate-800 flex flex-col h-full bg-slate-950">
        <div className="p-4 border-b border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
              <Package className="h-5 w-5" /> Terminal OP
            </h1>
            <Badge className="bg-emerald-500/20 text-emerald-400">Online</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Buscar Pedido ou Produto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {loading ? (
            <div className="flex justify-center p-8"><Clock className="animate-spin h-6 w-6 text-slate-600" /></div>
          ) : filteredOps.length === 0 ? (
            <div className="text-center p-8 text-slate-600">Nenhuma OP pendente.</div>
          ) : filteredOps.map(op => (
            <div 
              key={op.id}
              onClick={() => setSelectedOP(op)}
              className={`p-4 rounded-lg cursor-pointer transition-all border ${
                selectedOP?.id === op.id 
                  ? "bg-indigo-600/20 border-indigo-500" 
                  : "bg-slate-900 border-slate-800 hover:border-slate-600"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <Hash className="h-3 w-3" /> {op.orderItem.order.orderNumber}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  op.status === 'PENDING' ? "bg-amber-500/10 text-amber-500" :
                  op.status === 'IN_PROGRESS' ? "bg-blue-500/10 text-blue-500" :
                  "bg-emerald-500/10 text-emerald-500"
                }`}>
                  {op.status === 'PENDING' ? 'Aguardando' : op.status === 'IN_PROGRESS' ? 'Em Produção' : 'Concluído'}
                </span>
              </div>
              <div className="font-bold text-sm truncate">{op.orderItem.product.name}</div>
              <div className="text-xs text-slate-500 mt-1">{op.orderItem.order.customer.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Panel - Detalhes da OP */}
      <div className="flex-1 flex flex-col bg-slate-900">
        {selectedOP ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header Detalhes */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">#{selectedOP.orderItem.order.orderNumber} - {selectedOP.orderItem.product.name}</h2>
                  {selectedOP.priority > 1 && <Badge variant="destructive">Urgente</Badge>}
                </div>
                <p className="text-slate-400 mt-1">Cliente: {selectedOP.orderItem.order.customer.name}</p>
              </div>
              <div className="flex gap-3">
                {selectedOP.status === 'PENDING' && (
                  <Button onClick={() => updateStatus(selectedOP.id, 'IN_PROGRESS')} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                    <PlayCircle className="h-4 w-4" /> Iniciar Produção
                  </Button>
                )}
                {selectedOP.status === 'IN_PROGRESS' && (
                  <Button onClick={() => updateStatus(selectedOP.id, 'COMPLETED')} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Finalizar OP
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Picking List (Almoxarifado) */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <ListChecks className="h-5 w-5 text-indigo-400" />
                  <h3 className="font-bold text-lg text-slate-300">Picking List (Materiais)</h3>
                </div>
                <div className="grid gap-3">
                  {selectedOP.pickingList && (selectedOP.pickingList as any[]).map((mat, idx) => (
                    <div key={idx} className="bg-slate-800/50 p-4 rounded-lg flex justify-between items-center border border-slate-700 transition-colors hover:bg-slate-800">
                      <div>
                        <div className="font-bold text-white">{mat.name}</div>
                        {mat.optionLabel && <div className="text-xs text-indigo-400 mt-1">Var: {mat.optionLabel}</div>}
                        <div className="text-xs text-slate-500">Source: {mat.source}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-mono text-indigo-400">{mat.quantity}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{mat.unit}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roteiro de Processos */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <PlayCircle className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-bold text-lg text-slate-300">Roteiro de Produção</h3>
                </div>
                <div className="relative space-y-4">
                  {(selectedOP.steps as any[]).map((step, idx) => (
                    <div key={idx} className={`p-5 rounded-xl border flex items-center gap-4 ${
                      step.status === 'COMPLETED' 
                        ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-400" 
                        : "bg-slate-800/20 border-slate-700 text-slate-400"
                    }`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold border-2 ${
                        step.status === 'COMPLETED' ? "border-emerald-500 bg-emerald-500 text-slate-900" : "border-slate-700"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className={`font-bold ${step.status === 'COMPLETED' ? "text-emerald-300" : "text-slate-300"}`}>{step.name}</div>
                        <div className="text-xs opacity-60">Status: {step.status === 'COMPLETED' ? 'Finalizado' : 'Pendente'}</div>
                      </div>
                      {step.status !== 'COMPLETED' && selectedOP.status === 'IN_PROGRESS' && (
                        <Button variant="ghost" size="sm" className="hover:bg-slate-700 text-xs">Marcar Pronto</Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Observações */}
                {selectedOP.notes && (
                  <div className="bg-amber-950/20 border border-amber-900/30 p-4 rounded-lg flex gap-3 text-amber-400">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <div className="text-sm">
                      <div className="font-bold mb-1 uppercase text-xs tracking-wider">Instruções Importantes:</div>
                      {selectedOP.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4">
            <Package className="h-16 w-16 opacity-20" />
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-500">Nenhuma OP Selecionada</h2>
              <p>Selecione um item na lista lateral para ver a lista de separação e as etapas.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalProducao;
