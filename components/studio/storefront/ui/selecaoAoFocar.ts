// ============================================================
// components/studio/storefront/ui/selecaoAoFocar.ts
//
// Campo de quantidade: o clique seleciona o número inteiro (QA 27/09).
//
// `selectTextOnFocus` do react-native-web seleciona no foco, dentro de um
// setTimeout. No Chrome do computador o clique simples é mousedown →
// foco → (seleção) → mouseup, e o mouseup põe o cursor onde o mouse
// soltou, desfazendo a seleção: com 1 no campo, digitar "50" virava "501"
// e o maxLength jogava o resto fora; com 50, "25" virava "250". Dois
// cliques e Tab funcionavam.
//
// A correção é a de sempre na web: selecionar no foco e, SÓ no mouseup do
// clique que deu o foco, impedir o padrão (e selecionar de novo). O
// segundo clique, com o campo já focado, posiciona o cursor normalmente.
// No celular nativo, `selectTextOnFocus` continua valendo sozinho.
// ============================================================
import { useCallback, useRef } from "react";
import { Platform } from "react-native";

type CampoDaWeb = Pick<HTMLInputElement, "select" | "addEventListener" | "removeEventListener"> & {
  ownerDocument?: Document | null;
};

/**
 * Liga a seleção no foco num `<input>` da web. Devolve quem desliga.
 *
 * Regra: o mouseup só é segurado quando o mousedown aconteceu com o campo
 * AINDA SEM foco — é o clique que está dando o foco.
 */
export function ligarSelecaoAoFocar(el: CampoDaWeb): () => void {
  let segurarOSoltar = false;
  const selecionar = () => { try { el.select(); } catch { /* campo saiu da tela */ } };
  const aoApertar = () => { segurarOSoltar = el.ownerDocument?.activeElement !== (el as any); };
  const aoSoltar = (e: Event) => {
    if (!segurarOSoltar) return;
    segurarOSoltar = false;
    e.preventDefault();
    selecionar();
  };
  const aoSair = () => { segurarOSoltar = false; };
  el.addEventListener("mousedown", aoApertar);
  el.addEventListener("focus", selecionar);
  el.addEventListener("mouseup", aoSoltar);
  el.addEventListener("blur", aoSair);
  return () => {
    el.removeEventListener("mousedown", aoApertar);
    el.removeEventListener("focus", selecionar);
    el.removeEventListener("mouseup", aoSoltar);
    el.removeEventListener("blur", aoSair);
  };
}

/**
 * A `ref` para o TextInput: na web, o nó é o `<input>` (react-native-web
 * repassa a ref ao elemento). Fora da web, não faz nada.
 */
export function useSelecionarAoFocar(): (no: unknown) => void {
  const desligar = useRef<(() => void) | null>(null);
  return useCallback((no: unknown) => {
    desligar.current?.();
    desligar.current = null;
    if (Platform.OS !== "web" || !no) return;
    const el = no as CampoDaWeb;
    if (typeof el.addEventListener !== "function" || typeof el.select !== "function") return;
    desligar.current = ligarSelecaoAoFocar(el);
  }, []);
}
