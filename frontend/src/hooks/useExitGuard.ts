import { useEffect, useRef } from 'react';

/**
 * useExitGuard
 * ------------
 * Intercepta tentativas de sair da rota atual e delega a decisão ao caller.
 *
 * Cobre três caminhos típicos de saída:
 *  1. **Link interno** (`<a href="/algum/path">` ou `<Link>` do react-router):
 *     escuta cliques em modo capture, prevent-default, e dispara `onAttempt`.
 *  2. **Botão de voltar do navegador** (popstate): empurra um estado fantasma
 *     na montagem para "absorver" o primeiro back e dispara `onAttempt`.
 *  3. **Fechar aba / refresh** (beforeunload): aciona o aviso nativo do
 *     navegador. Não é possível customizar a mensagem em browsers modernos,
 *     mas o usuário recebe um "Deseja sair?" do próprio Chrome/Firefox.
 *
 * Não cobre:
 *  - Digitação direta de URL na barra (browser não permite interceptar).
 *  - Cliques com Ctrl/Meta/Shift (usuário quer abrir em nova aba).
 *  - Anchors com `target="_blank"` (externos).
 *  - Anchors sem `href` ou com hrefs absolutos não-SPA.
 *
 * Contrato com o caller:
 *  - Enquanto `active=true`, qualquer tentativa de saída interna é prevenida
 *    e `onAttempt(intent)` é chamado.
 *  - O caller mostra UI (modal) e, na escolha do usuário, chama `proceed(intent)`
 *    ou simplesmente não faz nada (o usuário continua na tela).
 */

export type ExitIntent =
  | { type: 'link'; path: string }
  | { type: 'back' };

interface UseExitGuardOptions {
  /** Liga/desliga o guard inteiro. Quando `false`, navegação é livre. */
  active: boolean;
  /**
   * Disparado quando o usuário tenta sair (link interno ou back).
   * O caller decide: mostrar modal, autorizar via `proceed`, etc.
   * Esta função deve apenas registrar a intenção — NÃO chamar `proceed`
   * direto (vira loop).
   */
  onAttempt: (intent: ExitIntent) => void;
}

interface UseExitGuardReturn {
  /**
   * Desliga o guard temporariamente para o caller executar a navegação
   * pretendida com `navigate()` do react-router (SPA) sem ser re-interceptado.
   * Uso típico no callback de confirmação:
   *
   *   bypass(() => {
   *     if (intent.type === 'link') navigate(intent.path);
   *     else if (intent.type === 'back') window.history.go(-1);
   *   });
   */
  bypass: (fn: () => void) => void;
}

export function useExitGuard({ active, onAttempt }: UseExitGuardOptions): UseExitGuardReturn {
  // Refs evitam closures velhas dentro dos event listeners.
  const activeRef = useRef(active);
  activeRef.current = active;
  const onAttemptRef = useRef(onAttempt);
  onAttemptRef.current = onAttempt;

  // Flag de "bypass" temporário: quando `proceed` é chamado, ligamos o bypass
  // pelo tempo da navegação para que o próprio guard não intercepte de volta.
  const bypassRef = useRef(false);

  // ── 1. beforeunload (fechar aba / refresh) ───────────────────────────────
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (bypassRef.current) return;
      // Especificação atual exige `preventDefault` + `returnValue`.
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);

  // ── 2. popstate (botão de voltar do navegador) ───────────────────────────
  // Estratégia: empurramos um estado fantasma na montagem. Quando o usuário
  // clica em "voltar", o popstate dispara mas o pathname não muda (porque
  // estávamos no estado fantasma, voltamos pro real). Detectamos isso e
  // empurramos OUTRO estado fantasma para o usuário continuar "preso" enquanto
  // mostramos o modal.
  useEffect(() => {
    if (!active) return;
    // Marca o início do guard com um estado fantasma.
    window.history.pushState({ __exitGuard: true }, '');

    const handler = () => {
      if (bypassRef.current) return;
      if (!activeRef.current) return;
      // Reempurra estado para "absorver" o segundo back até o usuário decidir.
      window.history.pushState({ __exitGuard: true }, '');
      onAttemptRef.current({ type: 'back' });
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [active]);

  // ── 3. Cliques em links internos ─────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (bypassRef.current) return;
      if (!activeRef.current) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Sobe na árvore até achar um <a>.
      let el = e.target as HTMLElement | null;
      while (el && el !== document.body && el.tagName !== 'A') {
        el = el.parentElement;
      }
      if (!el || el.tagName !== 'A') return;
      const anchor = el as HTMLAnchorElement;

      const target = anchor.getAttribute('target');
      if (target && target !== '_self') return; // _blank / _parent → não bloquear

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Considera apenas SPA-internal: começa com `/` mas não `//` (protocol-relative).
      if (!href.startsWith('/') || href.startsWith('//')) return;

      // Mesmo path? Não é navegação, deixa passar (ex: âncoras `#`).
      if (href === window.location.pathname + window.location.search) return;

      e.preventDefault();
      e.stopPropagation();
      onAttemptRef.current({ type: 'link', path: href });
    };
    // Captura para pegar antes do react-router intercepta o clique.
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [active]);

  // ── API: bypass temporário para o caller navegar via SPA ─────────────────
  const bypass = (fn: () => void) => {
    bypassRef.current = true;
    try {
      fn();
    } finally {
      // Reativa após o tick atual + uma folga para que listeners assíncronos
      // (popstate, click bubble) não voltem a interceptar a navegação.
      setTimeout(() => { bypassRef.current = false; }, 100);
    }
  };

  return { bypass };
}
