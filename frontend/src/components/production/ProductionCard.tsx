import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { PlayCircle, CheckCircle2, Package, Clock, Hash, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProductionStep {
  id: string;
  name: string;
  order: number;
  status: 'PENDING' | 'DOING' | 'DONE';
  startedAt?: string;
  finishedAt?: string;
}

interface ProductionCardProps {
  order: {
    id: string;
    orderNumber: string;
    productName: string;
    customerName: string;
    status: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    pickingList: any[];
    steps: ProductionStep[];
  };
  onUpdateStep: (opId: string, stepId: string, newStatus: 'DOING' | 'DONE') => Promise<void>;
  onCompleteOP: (opId: string) => Promise<void>;
}

// Componente Interno para o Cronômetro
const StepTimer: React.FC<{ startedAt: string }> = ({ startedAt }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const start = new Date(startedAt);
      const diff = differenceInSeconds(new Date(), start);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <span className="font-mono text-blue-600 font-bold ml-2">{elapsed}</span>;
};

const formatDuration = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const diff = differenceInSeconds(e, s);
  const m = Math.floor(diff / 60);
  const sec = diff % 60;
  return `${m}m ${sec}s`;
};

export const ProductionCard: React.FC<ProductionCardProps> = ({ order, onUpdateStep, onCompleteOP }) => {
  const [pickingChecked, setPickingChecked] = useState<Record<string, boolean>>({});

  const togglePicking = (idx: number) => {
    setPickingChecked(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const allPicked = order.pickingList.every((_, idx) => pickingChecked[idx]);

  return (
    <Card className={cn(
      "border-l-4 transition-all hover:shadow-lg bg-slate-900 border-slate-800",
      order.priority === 'URGENT' ? "border-l-red-600 shadow-red-900/20" : 
      order.priority === 'HIGH' ? "border-l-orange-500" : "border-l-indigo-500"
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-slate-500 flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded">
              <Hash className="h-2.5 w-2.5" /> {order.orderNumber}
            </span>
            {order.priority === 'URGENT' && <Badge variant="destructive" className="animate-pulse h-4 text-[9px]">URGENTE</Badge>}
          </div>
          <CardTitle className="text-sm font-black text-white uppercase tracking-tight">{order.productName}</CardTitle>
          <p className="text-[10px] text-slate-400 font-medium">{order.customerName}</p>
        </div>
        <Badge className={cn(
          "text-[9px] font-black border-none",
          order.status === 'WAITING' ? "bg-amber-500/20 text-amber-500" : 
          order.status === 'IN_PROGRESS' ? "bg-blue-500/20 text-blue-500" : "bg-emerald-500/20 text-emerald-500"
        )}>
          {order.status}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        {/* Picking List Checklist */}
        <div className="bg-slate-950 p-3 rounded-xl space-y-2 border border-slate-800 shadow-inner">
          <h4 className="text-[9px] uppercase font-black tracking-[0.1em] text-slate-500 flex items-center gap-1">
            <Package className="h-3 w-3 text-indigo-500" /> Checklist Insumos
          </h4>
          <div className="space-y-1.5">
            {order.pickingList.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 group">
                <Checkbox 
                  id={`pick-${order.id}-${idx}`}
                  checked={pickingChecked[idx]} 
                  onCheckedChange={() => togglePicking(idx)}
                  className="border-slate-700 data-[state=checked]:bg-indigo-600"
                />
                <label 
                  htmlFor={`pick-${order.id}-${idx}`}
                  className={cn(
                    "text-[11px] font-medium flex-1 truncate transition-all cursor-pointer",
                    pickingChecked[idx] ? "text-slate-600 line-through" : "text-slate-300 group-hover:text-white"
                  )}
                >
                  <span className="font-black text-indigo-400">{item.quantity}{item.unit}</span> - {item.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Steps Progress */}
        <div className="space-y-2">
          <h4 className="text-[9px] uppercase font-black tracking-[0.1em] text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3 text-emerald-500" /> Roteiro de Execução
          </h4>
          <div className="space-y-2">
            {order.steps.map((step) => (
              <div key={step.id} className={cn(
                "p-2.5 rounded-xl flex items-center justify-between text-[11px] border transition-all",
                step.status === 'DONE' ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-400" : 
                step.status === 'DOING' ? "bg-blue-950/20 border-blue-900/50 text-blue-400" : "bg-slate-950 border-slate-800 text-slate-600"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center font-black text-[9px] border-2",
                    step.status === 'DONE' ? "bg-emerald-500 border-emerald-500 text-slate-900" : 
                    step.status === 'DOING' ? "bg-blue-500 border-blue-500 text-slate-900" : "border-slate-800"
                  )}>
                    {step.status === 'DONE' ? <CheckCircle2 className="h-3 w-3" /> : step.order}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold">{step.name}</span>
                    {step.status === 'DOING' && step.startedAt && (
                      <div className="flex items-center gap-1 text-[9px] mt-0.5">
                        <Timer className="h-2.5 w-2.5 animate-pulse" />
                        <StepTimer startedAt={step.startedAt} />
                      </div>
                    )}
                    {step.status === 'DONE' && step.startedAt && step.finishedAt && (
                      <span className="text-[9px] opacity-60 flex items-center gap-1">
                         <Timer className="h-2.5 w-2.5" /> {formatDuration(step.startedAt, step.finishedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {step.status === 'PENDING' && allPicked && (
                   <Button size="sm" variant="ghost" className="h-7 text-[9px] font-black uppercase gap-1 hover:bg-blue-500/20 hover:text-blue-400" onClick={() => onUpdateStep(order.id, step.id, 'DOING')}>
                     <PlayCircle className="h-3 w-3" /> Iniciar
                   </Button>
                )}
                {step.status === 'DOING' && (
                   <Button size="sm" variant="ghost" className="h-7 text-[9px] font-black uppercase gap-1 hover:bg-emerald-500/20 hover:text-emerald-400" onClick={() => onUpdateStep(order.id, step.id, 'DONE')}>
                     <CheckCircle2 className="h-3 w-3" /> Finalizar
                   </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Final Action */}
        {order.status === 'IN_PROGRESS' && order.steps.every(s => s.status === 'DONE') && (
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 font-black uppercase text-xs tracking-tighter" onClick={() => onCompleteOP(order.id)}>
             Liberar Ordem de Produção
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
