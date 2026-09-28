// ============================================================
// components/studio/storefront/home/useRolagemGuardada.ts
//
// A home e a página da categoria guardam a rolagem ao sair e a devolvem
// quando a cliente volta pelo histórico (regras em rolagemDaVitrine.ts).
//
// Por que um laço de quadros (requestAnimationFrame) e não o
// `onContentSizeChange` com desistência em 1,5 s (27/09): a grade chega
// em pedaços (fotos, cartões medidos), e rolar para 2.000 px num
// conteúdo de 900 px não rola nada. A cada quadro a tela confere se o
// conteúdo já tem altura para a posição; quando tem, rola uma vez. Se a
// cliente rolar antes, a restauração desiste — a mão dela manda.
//
// A decisão ("veio do histórico?") é tomada no primeiro quadro, não na
// montagem: o ouvinte do `popstate` já rodou até lá.
// ============================================================
import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import {
  caminhoAtual, esquecerRolagem, esquecerVolta, guardarRolagem, ouvirAsVoltas, rolagemParaRestaurar,
} from "./rolagemDaVitrine";

/** Quanto a restauração espera o conteúdo crescer antes de rolar o que der. */
const ESPERA_PELO_CONTEUDO_MS = 4000;

/** O nó DOM rolável de um ScrollView do react-native-web (ou null fora da web). */
export function noDeRolagem(r: any): HTMLElement | null {
  if (!r) return null;
  if (typeof r.getScrollableNode === "function") return r.getScrollableNode() || null;
  if (typeof r.getBoundingClientRect === "function") return r;
  return null;
}

/** O nó DOM de uma View do react-native-web (a própria ref), ou null. */
export function noDom(r: any): HTMLElement | null {
  if (!r) return null;
  if (typeof r.getBoundingClientRect === "function") return r;
  if (typeof r.getScrollableNode === "function") return r.getScrollableNode() || null;
  return null;
}

const quadro = (fn: () => void): any =>
  typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);
const cancelarQuadro = (id: any) => {
  if (id == null) return;
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
  else clearTimeout(id);
};

/**
 * Liga a rolagem guardada numa tela. Devolve o `aoRolar(y)` que a tela
 * chama no onScroll. `pular()` (opcional) diz, no primeiro quadro, que
 * esta montagem tem outro destino (o "Todas as peças" da home).
 */
export function useRolagemGuardada(
  chave: string,
  rolagem: RefObject<any>,
  pular?: () => boolean,
): (y: number) => void {
  const yReal = useRef(0);
  const pularRef = useRef(pular);
  pularRef.current = pular;

  useLayoutEffect(() => {
    ouvirAsVoltas();
    yReal.current = 0;
    let vivo = true;
    let id: any = null;
    // Enquanto há restauração pendente, esta montagem não grava a saída:
    // uma montagem que sai antes de restaurar não apaga a posição.
    let pendente = false;
    let alvo: number | null | undefined;
    const inicio = Date.now();
    const passo = () => {
      id = null;
      if (!vivo) return;
      if (alvo === undefined) {
        alvo = pularRef.current?.() ? null : rolagemParaRestaurar(chave, caminhoAtual());
        if (alvo == null) return;
        pendente = true;
      }
      if (alvo == null) return;
      // A cliente rolou antes: a mão dela manda.
      if (yReal.current > 0) { pendente = false; esquecerVolta(); return; }
      const no = noDeRolagem(rolagem.current);
      const maximo = no ? no.scrollHeight - no.clientHeight : Infinity;
      const esgotou = Date.now() - inicio > ESPERA_PELO_CONTEUDO_MS;
      if (maximo >= alvo || esgotou) {
        const y = Math.max(0, Math.min(alvo, maximo));
        rolagem.current?.scrollTo?.({ y, animated: false });
        yReal.current = y;
        pendente = false;
        esquecerRolagem(chave);
        esquecerVolta();
        return;
      }
      id = quadro(passo);
    };
    id = quadro(passo);
    return () => {
      vivo = false;
      cancelarQuadro(id);
      if (pendente) return;
      // O DOM ainda está no lugar aqui (a limpeza do layout roda antes de
      // o nó sair): a posição de verdade vence a do último onScroll.
      const no = noDeRolagem(rolagem.current);
      const y = no && typeof no.scrollTop === "number" ? no.scrollTop : yReal.current;
      guardarRolagem(chave, y);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return useCallback((y: number) => { yReal.current = y; }, []);
}
