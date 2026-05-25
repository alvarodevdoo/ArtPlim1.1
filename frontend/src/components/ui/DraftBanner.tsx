import React from 'react';
import { History, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraftBannerProps {
  /** Timestamp ms epoch do rascunho salvo. */
  savedAt: number | null;
  /** Quando true, exibe o banner. */
  visible: boolean;
  /** Aplica o rascunho ao form. */
  onRestore: () => void;
  /** Descarta o rascunho e começa do zero. */
  onDiscard: () => void;
  /** Rótulo opcional do form ("Novo Insumo"). Exibido sutilmente. */
  label?: string;
  className?: string;
}

/**
 * Banner discreto exibido no topo de um formulário quando há um rascunho
 * salvo localmente para aquele contexto. Oferece duas ações claras:
 * recuperar o que estava escrito ou começar do zero.
 *
 * Critérios de UX:
 *  - Visual neutro (azul claro), não alarmista. Não é um erro.
 *  - Idade do rascunho mostrada em linguagem humana.
 *  - Botões nivelados; nenhum é destrutivo por engano (descartar requer 1 clique
 *    intencional, mas não exige confirmação porque o estado atual ainda está
 *    vazio — o usuário não perde nada no momento da escolha).
 */
export const DraftBanner: React.FC<DraftBannerProps> = ({
  savedAt,
  visible,
  onRestore,
  onDiscard,
  label,
  className,
}) => {
  if (!visible || !savedAt) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 shadow-sm',
        className
      )}
    >
      <div className="mt-0.5 rounded-lg bg-blue-100 p-1.5 text-blue-700">
        <History className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-wider text-blue-700">
          Rascunho recuperado
        </p>
        <p className="mt-0.5 text-[11px] text-blue-900/80 leading-snug">
          {label ? <span className="font-semibold">{label} · </span> : null}
          Encontramos um cadastro não finalizado de {formatRelative(savedAt)}.
          Deseja continuar de onde parou?
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <RotateCcw className="h-3 w-3" />
          Continuar
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 transition-colors hover:bg-blue-50"
        >
          <X className="h-3 w-3" />
          Começar do zero
        </button>
      </div>
    </div>
  );
};

/** Formata diferença em "há Xmin/Xh". Mantido local para não criar dep extra. */
function formatRelative(savedAt: number): string {
  const diff = Date.now() - savedAt;
  const minutes = Math.max(0, Math.floor(diff / 60_000));
  if (minutes < 1) return 'há menos de 1 min';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return remMin ? `há ${hours}h ${remMin}min` : `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? 's' : ''}`;
}

export default DraftBanner;
