import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  XCircle, 
  FileText,
  User,
  Calendar,
  AlertTriangle,
  Pencil
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import styles from './InventoryAdjustment.module.scss';

interface Props {
  materialId: string;
  unit: string;
  conversionFactor?: number;
  limit?: number;
  refreshTrigger?: number;
  onRefresh?: () => void;
  onEdit?: (movement: any) => void;
}

export const MovementHistory: React.FC<Props> = ({ 
  materialId, 
  unit, 
  conversionFactor = 1,
  limit = 50,
  refreshTrigger = 0,
  onRefresh,
  onEdit
}) => {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await api.get(`/api/wms/movements/stock?materialId=${materialId}&limit=${limit}`);
      setMovements(resp.data.data || []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  }, [materialId, limit]);

  useEffect(() => {
    if (materialId) loadHistory();
  }, [materialId, loadHistory, refreshTrigger]);

  const handleCancel = async (id: string) => {
    const justification = window.prompt('Por que você deseja cancelar este ajuste?');
    if (!justification) return;

    try {
      await api.post(`/api/wms/movements/${id}/cancel`, { justification });
      toast.success('Movimentação cancelada com sucesso!');
      loadHistory();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao cancelar');
    }
  };

  return (
    <section className={styles.historySection}>
      <div className={styles.header}>
        <div className="flex items-center gap-2">
          <History size={14} className="text-muted-foreground" />
          <h3 className="text-xs font-black uppercase">Histórico de Movimentações</h3>
        </div>
        <button onClick={loadHistory} className="text-primary hover:underline text-[10px] font-black uppercase">Atualizar</button>
      </div>

      <div className={styles.historyList}>
        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground animate-pulse font-bold uppercase tracking-widest">Carregando...</div>
        ) : movements.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground italic">Nenhuma movimentação registrada.</div>
        ) : (
          movements.map(m => (
            <div key={m.id} className={cn(styles.historyItem, m.isCancelled && styles.cancelled)}>
              <div className={styles.left}>
                <div className="flex items-center gap-2">
                  <span className={cn(styles.type, styles[m.type as keyof typeof styles])}>
                    {m.type === 'ENTRY' ? 'Entrada' : m.type === 'INTERNAL_CONSUMPTION' ? 'Consumo' : 'Ajuste'}
                  </span>
                  {m.isCancelled && (
                    <span className="bg-red-100 text-red-600 text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                      <AlertTriangle size={8} /> Estornado
                    </span>
                  )}
                </div>
                <span className={styles.date}>
                  <Calendar size={10} className="inline mr-1 opacity-50" />
                  {new Date(m.createdAt).toLocaleString()}
                </span>
                <span className={styles.number}>#{m.movementNumber || m.id.slice(0, 8)}</span>
                {m.user && (
                  <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <User size={10} className="opacity-50" /> {m.user.name}
                  </span>
                )}
                {m.justification && (
                  <p className="text-[9px] text-muted-foreground italic mt-1 leading-tight border-l-2 border-muted-foreground/20 pl-2">
                    "{m.justification}"
                  </p>
                )}
              </div>
              <div className={styles.right}>
                <div className={styles.values}>
                  <span className={cn(styles.qty, m.type === 'ENTRY' ? 'text-green-600' : 'text-red-600')}>
                    {m.type === 'ENTRY' ? '+' : '-'}{parseFloat(m.quantity).toLocaleString(undefined, { minimumFractionDigits: 3 })} {unit}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-primary">
                      Total: R$ {(parseFloat(m.quantity) * parseFloat(m.unitCost)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className="flex gap-2 items-center">
                      <span className="text-[8px] text-primary uppercase font-black bg-primary/5 px-1 rounded">
                        R$ {parseFloat(m.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / {unit}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.actions}>
                  {!m.isCancelled && (
                    <>
                      {onEdit && (
                        <button 
                          onClick={() => onEdit(m)}
                          className="p-2 text-muted-foreground hover:text-primary transition-colors"
                          title="Corrigir / Editar"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleCancel(m.id)}
                        className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Cancelar / Estornar"
                      >
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                  {m.documentUrl && (
                    <a 
                      href={m.documentUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <FileText size={16} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
