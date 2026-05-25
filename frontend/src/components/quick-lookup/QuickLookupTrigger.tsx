import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuickLookup } from '@/contexts/QuickLookupContext';
import { cn } from '@/lib/utils';

/**
 * QuickLookupTrigger
 * ------------------
 * Aba vertical discreta ancorada na borda direita da tela.
 *
 * Quando o drawer está fechado:
 *   - Aba fica colada na borda direita (right: 0)
 *   - Seta ◀ indica "puxar pra abrir"
 *
 * Quando o drawer está aberto:
 *   - Aba se move para a borda esquerda do drawer (right: 380px)
 *   - Seta ▶ indica "empurrar pra fechar"
 *   - Permanece visível como handle de fechamento
 *
 * O atalho Ctrl+K continua funcionando globalmente.
 *
 * Largura do drawer está sincronizada via classe Tailwind `right-[380px]`
 * (380px é a `w-[380px]` definida no `QuickLookupDrawer`).
 */
const DRAWER_WIDTH_PX = 380;

export const QuickLookupTrigger: React.FC = () => {
  const { isDrawerOpen, toggleDrawer } = useQuickLookup();

  // Atalho global Ctrl+K (ou Cmd+K em Mac).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isToggle = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
      if (!isToggle) return;
      e.preventDefault();
      toggleDrawer();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleDrawer]);

  return (
    <button
      type="button"
      onClick={toggleDrawer}
      title={isDrawerOpen ? 'Fechar pesquisa rápida' : 'Abrir pesquisa rápida (Ctrl+K)'}
      aria-label={isDrawerOpen ? 'Fechar pesquisa rápida' : 'Abrir pesquisa rápida'}
      aria-expanded={isDrawerOpen}
      style={{
        // Mantém a aba ancorada ao drawer: quando aberto, fica à esquerda dele;
        // quando fechado, na borda direita da tela. Transição suave acompanha
        // o slide-in/out do drawer.
        right: isDrawerOpen ? `${DRAWER_WIDTH_PX}px` : '0px',
      }}
      className={cn(
        'fixed top-1/2 -translate-y-1/2 z-50',
        'flex flex-col items-center gap-2.5',
        'py-5 px-2.5',
        'bg-card border border-r-0 rounded-l-xl shadow-md',
        'text-muted-foreground hover:text-foreground hover:bg-accent',
        'transition-[right,background-color,color] duration-200 ease-out',
        // Sutil destaque quando aberto, para evidenciar estado.
        isDrawerOpen && 'text-primary border-primary/40 bg-primary/5'
      )}
    >
      {isDrawerOpen ? (
        <ChevronRight className="w-4 h-4" />
      ) : (
        <ChevronLeft className="w-4 h-4" />
      )}
      {/*
        Texto vertical: a abordagem `writing-mode: vertical-rl` mais
        `rotate(180deg)` é a forma mais previsível de obter texto fluindo
        de baixo para cima preservando kerning. Tamanho subido para 13px
        e tracking aumentado para evitar a "compressão visual" das letras
        que torna o texto difícil de ler em telas grandes.
      */}
      <span
        className="text-[13px] font-semibold select-none whitespace-nowrap leading-none"
        style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          letterSpacing: '0.04em',
        }}
      >
        Pesquisa Rápida
      </span>
      <span
        className="text-[10px] font-mono text-muted-foreground/80 select-none whitespace-nowrap leading-none"
        style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          letterSpacing: '0.05em',
        }}
      >
        Ctrl + K
      </span>
    </button>
  );
};

export default QuickLookupTrigger;
