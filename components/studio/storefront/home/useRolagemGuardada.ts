// ============================================================
// components/studio/storefront/home/useRolagemGuardada.ts
//
// A home e a página da categoria guardam a rolagem ao sair e a devolvem
// quando a cliente volta pelo histórico (regras em rolagemDaVitrine.ts).
//
// A restauração confere se o conteúdo já tem altura para a posição;
// quando tem, rola uma vez. A grade chega em pedaços (fotos, cartões
// medidos), e rolar para 2.000 px num conteúdo de 900 px não rola nada.
// Se a cliente rolar antes, a restauração desiste — a mão dela manda.
//
// QA 28/09 (rodada 3): SEM requestAnimationFrame. O laço de quadros de
// antes só andava quando o navegador pintava; com a janela do Chrome
// coberta por outra (ou a aba sem pintar), o `requestAnimationFrame` fica
// parado com a página "visível", a restauração passava da janela de 3 s
// da volta e a categoria abria no topo. A primeira tentativa é na própria
// montagem (useLayoutEffect, antes da pintura: o `popstate` que trouxe a
// cliente já rodou), e as seguintes vão por setTimeout, que não depende
// de pintura. Medir (scrollHeight) força o layout na hora.
// ============================================================
import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import {
  caminhoAtual, esquecerRolagem, esquecerVolta, guardarRolagem, ouvirAsVoltas, rolagemGuardada, rolagemParaRestaurar,
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

/** Quanto a montagem espera a marca do `popstate` (que chega depois dela). */
export const ESPERA_PELA_MARCA_DA_VOLTA_MS = 300;

/** Entre uma conferência e outra, enquanto o conteúdo cresce. */
export const PASSO_DA_ESPERA_MS = 32;

/**
 * Liga a rolagem guardada numa tela. Devolve o `aoRolar(y)` que a tela
 * chama no onScroll. `pular()` (opcional) diz, na montagem, que esta
 * montagem tem outro destino (o "Todas as peças" da home).
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
        if (pularRef.current?.()) { alvo = null; return; }
        const y = rolagemParaRestaurar(chave, caminhoAtual());
        if (y == null) {
          // QA 28/09 (rodada 3, CL-13): a tela MONTA antes de o nosso
          // ouvinte do `popstate` rodar — o roteador ouve o mesmo evento,
          // e o React aplica a troca de tela no microtask logo depois do
          // ouvinte dele (medido: montagem ~20 ms antes da marca). Havendo
          // posição guardada, a decisão espera a marca por uma janela
          // curta; toque em link não tem `popstate` e fica no topo.
          const guardada = rolagemGuardada(chave) != null;
          if (guardada && Date.now() - inicio < ESPERA_PELA_MARCA_DA_VOLTA_MS && yReal.current <= 0) {
            pendente = true;
            id = setTimeout(passo, PASSO_DA_ESPERA_MS);
            return;
          }
          pendente = false;
          alvo = null;
          return;
        }
        alvo = y;
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
        // A marca da volta NÃO é gasta aqui: se a tela montar de novo
        // logo em seguida (segunda montagem da rota), a nova também
        // restaura — a saída desta grava a posição de novo. A marca vence
        // sozinha (JANELA_DA_VOLTA_MS).
        esquecerRolagem(chave);
        return;
      }
      id = setTimeout(passo, PASSO_DA_ESPERA_MS);
    };
    passo();
    return () => {
      vivo = false;
      if (id != null) clearTimeout(id);
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
