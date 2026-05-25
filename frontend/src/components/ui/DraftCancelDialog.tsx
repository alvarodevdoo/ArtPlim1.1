import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Clock, ArrowLeft, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * DraftCancelDialog
 * -----------------
 * Modal de confirmação ao clicar em "Cancelar" num formulário que tem
 * rascunho salvo. Substitui o `window.confirm` nativo (OK/Cancel) por
 * 3 ações claras e nomeadas:
 *
 *  - Descartar rascunho       → apaga o rascunho e fecha o form
 *  - Continuar mais tarde     → mantém o rascunho e fecha o form
 *  - Voltar ao preenchimento  → não fecha; o usuário continua editando agora
 *
 * z-index muito alto (10001) — o `MaterialDrawer` usa 9999, então qualquer
 * confirmação precisa ficar acima disso ou seu conteúdo fica encoberto.
 */
interface DraftCancelDialogProps {
  open: boolean;
  /** Rótulo do formulário, ex: "Novo Insumo". */
  label?: string;
  onDiscard: () => void;
  onKeepForLater: () => void;
  onResume: () => void;
}

export const DraftCancelDialog: React.FC<DraftCancelDialogProps> = ({
  open,
  label,
  onDiscard,
  onKeepForLater,
  onResume,
}) => {
  // ESC equivale a "Voltar ao preenchimento" — opção menos destrutiva.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onResume();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onResume]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop — clique = voltar (não-destrutivo). */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
        onClick={onResume}
      />

      <div
        className={cn(
          'relative w-full max-w-md bg-card rounded-2xl shadow-2xl border',
          'animate-in zoom-in-95 fade-in duration-150'
        )}
      >
        {/* Cabeçalho */}
        <div className="flex items-start gap-3 p-5 border-b">
          <div className="rounded-lg bg-amber-50 p-2 text-amber-700 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold">Você tem um rascunho salvo</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {label
                ? <>Há alterações não salvas em <span className="font-semibold">{label}</span>. O que deseja fazer?</>
                : 'Há alterações não salvas neste cadastro. O que deseja fazer?'}
            </p>
          </div>
        </div>

        {/* Ações: lista vertical, cada uma com ícone e descrição. */}
        <div className="p-2 flex flex-col">
          <button
            type="button"
            onClick={onKeepForLater}
            className="flex items-start gap-3 text-left p-3 rounded-xl hover:bg-accent transition-colors"
          >
            <div className="rounded-lg bg-blue-50 p-2 text-blue-700 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Continuar mais tarde</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Fecha agora e mantém o rascunho salvo para você recuperar depois (até 2h).
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onResume}
            className="flex items-start gap-3 text-left p-3 rounded-xl hover:bg-accent transition-colors"
          >
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Voltar ao preenchimento</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Não fecha — você continua editando agora.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onDiscard}
            className="flex items-start gap-3 text-left p-3 rounded-xl hover:bg-red-50 transition-colors"
          >
            <div className="rounded-lg bg-red-50 p-2 text-red-600 shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-700">Descartar rascunho</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Apaga o que foi preenchido e fecha. Não dá pra desfazer.
              </p>
            </div>
          </button>
        </div>

        <div className="px-5 py-3 border-t bg-muted/20 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-background border text-[9px] font-mono">Esc</kbd>{' '}
            volta ao preenchimento
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DraftCancelDialog;
