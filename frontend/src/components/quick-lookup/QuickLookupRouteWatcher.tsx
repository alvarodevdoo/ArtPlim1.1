import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuickLookup } from '@/contexts/QuickLookupContext';

/**
 * QuickLookupRouteWatcher
 * -----------------------
 * Fecha o drawer e o popup de consulta sempre que a rota muda.
 *
 * Justificativa:
 *  - Mudança de página é uma transição de contexto explícita do usuário.
 *  - O drawer é uma "ferramenta" da tela atual; ao trocar de tela, ele
 *    deveria desaparecer junto, evitando confusão (resultado pré-filtrado
 *    pelo cliente da tela anterior ficaria estranho na tela nova).
 *  - Atalho Ctrl+K continua disponível na nova rota se o usuário quiser
 *    reabrir.
 *
 * Implementação: monitor do `pathname` via `useLocation`. Ignora a primeira
 * montagem (não fecha o drawer antes do usuário sequer ter aberto).
 */
export const QuickLookupRouteWatcher: React.FC = () => {
  const { pathname } = useLocation();
  const { closeDrawer, closeOrder } = useQuickLookup();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Primeira montagem: só registra o caminho atual, não fecha nada.
    if (previousPathRef.current === null) {
      previousPathRef.current = pathname;
      return;
    }
    if (previousPathRef.current !== pathname) {
      previousPathRef.current = pathname;
      closeOrder();
      closeDrawer();
    }
  }, [pathname, closeDrawer, closeOrder]);

  return null;
};

export default QuickLookupRouteWatcher;
