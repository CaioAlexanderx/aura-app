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
// 27/09 a correção segurava só o mouseup do clique que DAVA o foco. QA de
// 28/09: com o campo JÁ focado, a pessoa digita, olha o preço e clica de
// novo para corrigir — o clique punha o cursor no meio e "25" depois de
// 50 virava 520 (na sacola, 10 + "2" virou 120 peças gravadas).
//
// Regra de agora: TODO clique sem arraste (mousedown e mouseup a menos de
// 4 px um do outro) seleciona o número inteiro, com o campo focado ou
// não. Arrastar continua selecionando só o trecho, como em qualquer
// campo. No celular nativo, `selectTextOnFocus` continua valendo sozinho.
// ============================================================
import { useCallback, useRef } from "react";
import { Platform } from "react-native";

type CampoDaWeb = Pick<HTMLInputElement, "select" | "addEventListener" | "removeEventListener">;

/** Até aqui (px, em cada eixo somado) o gesto é clique; além, é arraste. */
export const LIMITE_DO_ARRASTE_PX = 4;

export type PontoDoMouse = { x: number; y: number };

/** O mouseup caiu perto do mousedown (clique, não arraste)? */
export function cliqueSemArraste(apertou: PontoDoMouse | null | undefined, soltou: PontoDoMouse | null | undefined): boolean {
  if (!apertou || !soltou) return false;
  const dx = Number(soltou.x) - Number(apertou.x);
  const dy = Number(soltou.y) - Number(apertou.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
  return Math.hypot(dx, dy) < LIMITE_DO_ARRASTE_PX;
}

const pontoDe = (e: Event): PontoDoMouse | null => {
  const m = e as MouseEvent;
  return typeof m.clientX === "number" && typeof m.clientY === "number" ? { x: m.clientX, y: m.clientY } : null;
};

/**
 * Liga a seleção no foco e no clique num `<input>` da web. Devolve quem
 * desliga.
 */
export function ligarSelecaoAoFocar(el: CampoDaWeb): () => void {
  let apertou: PontoDoMouse | null = null;
  const selecionar = () => { try { el.select(); } catch { /* campo saiu da tela */ } };
  const aoApertar = (e: Event) => { apertou = pontoDe(e); };
  const aoSoltar = (e: Event) => {
    const clique = cliqueSemArraste(apertou, pontoDe(e));
    apertou = null;
    if (!clique) return; // arraste: a seleção parcial é da pessoa
    e.preventDefault();
    selecionar();
  };
  const aoSair = () => { apertou = null; };
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
