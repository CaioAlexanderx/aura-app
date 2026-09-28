// ============================================================
// components/studio/storefront/historicoDaVitrine.ts
//
// O voltar do navegador dentro de uma tela (QA 27/09).
//
// `/<slug>/finalizar` não mudava entre as três etapas do checkout: voltar
// na etapa 2 ou 3 saía do checkout (caía na peça), e avançar ou F5
// voltavam à etapa 1. O zoom da foto e o guia de medidas da peça, idem:
// voltar fechava a PEÇA, não a camada.
//
// A regra: cada etapa e cada camada aberta entram no histórico com o
// MESMO endereço (a URL não muda, e o `?v2=` da aba fica onde está) e uma
// marca no `history.state`, ao lado do `id` que o roteador grava lá. No
// voltar, o roteador acha a mesma entrada e não troca de tela; quem lê a
// marca é a própria tela: a etapa volta uma, a camada fecha.
//
// O F5 apaga a marca da entrada atual (o roteador regrava o state na
// carga), então a etapa do F5 vem do rascunho guardado na aba
// (dadosLembrados.ts) — e a marca é regravada.
//
// QA 28/09: voltar e avançar só funcionavam na primeira passada. A cada
// `popstate` o roteador regrava a entrada com `replaceState({ id })` e a
// marca da etapa some; na segunda passada pela mesma entrada não havia
// mais etapa para ler (caía na 1). Duas defesas:
//   - depois do `popstate`, a tela REGRAVA a marca na entrada (em mais de
//     um momento: o roteador regrava logo depois, às vezes só no quadro
//     seguinte) — remarcarEtapaDepoisDoRoteador;
//   - a etapa de cada entrada também fica num mapa do módulo, pela chave
//     da entrada. O `id` do roteador não serve de chave: as três etapas
//     são a MESMA entrada para ele (o mesmo `id` copiado a cada
//     pushState). A chave é a do Navigation API (`navigation.currentEntry
//     .key`, que sobrevive ao replaceState); onde ele não existe, vale a
//     marca regravada.
//
// Puro no que decide (estado entra e sai por parâmetro); os ganchos de
// tela ficam no fim.
// ============================================================
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

export type EtapaNoHistorico = 1 | 2 | 3;

/** A marca da etapa do checkout no `history.state`. */
export const MARCA_DA_ETAPA = "auraEtapaDoCheckout";
/** A marca da camada aberta (zoom, guia de medidas) no `history.state`. */
export const MARCA_DA_CAMADA = "auraCamadaAberta";

function objeto(estado: unknown): Record<string, unknown> {
  return estado && typeof estado === "object" ? { ...(estado as Record<string, unknown>) } : {};
}

/** A etapa marcada nesta entrada do histórico, ou null (a entrada da etapa 1 não tem marca). */
export function etapaDoEstado(estado: unknown): EtapaNoHistorico | null {
  const v = Number((objeto(estado) as any)[MARCA_DA_ETAPA]);
  return v === 2 || v === 3 ? v : v === 1 ? 1 : null;
}

/**
 * A etapa desta entrada: a marca do state; sem ela (o roteador apagou), a
 * que o mapa lembra pela chave da entrada; senão null (etapa 1).
 */
export function etapaDaEntrada(p: {
  estado: unknown;
  chave: string | null | undefined;
  mapa: ReadonlyMap<string, EtapaNoHistorico>;
}): EtapaNoHistorico | null {
  const marcada = etapaDoEstado(p.estado);
  if (marcada) return marcada;
  if (p.chave && p.mapa.has(p.chave)) return p.mapa.get(p.chave) as EtapaNoHistorico;
  return null;
}

/** O state da entrada nova: o que o roteador pôs lá (o `id`) mais a etapa. */
export function estadoComEtapa(estado: unknown, etapa: EtapaNoHistorico): Record<string, unknown> {
  return { ...objeto(estado), [MARCA_DA_ETAPA]: etapa };
}

/** A camada marcada nesta entrada, ou null. */
export function camadaDoEstado(estado: unknown): string | null {
  const v = (objeto(estado) as any)[MARCA_DA_CAMADA];
  return typeof v === "string" && v ? v : null;
}

export function estadoComCamada(estado: unknown, camada: string): Record<string, unknown> {
  return { ...objeto(estado), [MARCA_DA_CAMADA]: camada };
}

/**
 * A etapa em que o checkout abre.
 *
 * - A entrada do histórico manda (voltar e avançar do navegador).
 * - Sem marca: no F5 desta página, a etapa do rascunho da aba; senão 1.
 * - Nunca pula dado que falta: etapa 2+ sem os dados volta à 1; etapa 3
 *   sem a entrega completa volta à 2.
 */
export function etapaAoAbrir(p: {
  doHistorico: EtapaNoHistorico | null;
  doRascunho?: EtapaNoHistorico | null;
  recarregou: boolean;
  faltaNosDados: boolean;
  faltaNaEntrega: boolean;
}): EtapaNoHistorico {
  const pedida = p.doHistorico ?? (p.recarregou ? p.doRascunho ?? null : null) ?? 1;
  return etapaPossivel(pedida, p.faltaNosDados, p.faltaNaEntrega);
}

/** A etapa pedida, recuada até a primeira com dado faltando. */
export function etapaPossivel(pedida: EtapaNoHistorico, faltaNosDados: boolean, faltaNaEntrega: boolean): EtapaNoHistorico {
  if (pedida >= 2 && faltaNosDados) return 1;
  if (pedida === 3 && faltaNaEntrega) return 2;
  return pedida;
}

// ── O ambiente do navegador ──────────────────────────────────

const naWeb = () => Platform.OS === "web" && typeof window !== "undefined" && !!window.history;

/** O caminho em que a página CARREGOU (antes de qualquer navegação da vitrine). */
const caminhoDaCarga = (() => {
  try { return typeof window !== "undefined" ? String(window.location?.pathname || "") : ""; } catch { return ""; }
})();
let checkoutJaAbriu = false;

/**
 * Esta montagem do checkout é o F5 dele? A primeira da carga, numa carga
 * que foi recarregar e que começou no `/finalizar`.
 */
export function checkoutRecarregado(): boolean {
  const primeira = !checkoutJaAbriu;
  checkoutJaAbriu = true;
  if (!primeira || !naWeb() || !/\/finalizar\/?$/.test(caminhoDaCarga)) return false;
  try {
    const nav = (window.performance?.getEntriesByType?.("navigation") || [])[0] as any;
    return nav?.type === "reload";
  } catch {
    return false;
  }
}

export function lerEstadoDoHistorico(): unknown {
  try { return naWeb() ? window.history.state : null; } catch { return null; }
}

/** Empilha uma entrada com o mesmo endereço. */
export function empilharNoHistorico(estado: Record<string, unknown>): boolean {
  if (!naWeb()) return false;
  try { window.history.pushState(estado, ""); return true; } catch { return false; }
}

/** Regrava a entrada atual (o F5 apagou a marca). */
export function regravarNoHistorico(estado: Record<string, unknown>): void {
  if (!naWeb()) return;
  try { window.history.replaceState(estado, ""); } catch { /* ok */ }
}

/** Anda `n` entradas (negativo volta). */
export function andarNoHistorico(n: number): boolean {
  if (!naWeb() || !n) return false;
  try { window.history.go(n); return true; } catch { return false; }
}

// ── A etapa por entrada (QA 28/09) ───────────────────────────

const etapasDasEntradas = new Map<string, EtapaNoHistorico>();

/** O mapa da etapa por entrada (leitura, para etapaDaEntrada). */
export function mapaDasEtapas(): ReadonlyMap<string, EtapaNoHistorico> {
  return etapasDasEntradas;
}

/**
 * A chave da entrada atual no Navigation API (Chrome, Edge; o Safari e o
 * Firefox antigos não têm): única por entrada e mantida no replaceState.
 */
export function chaveDaEntrada(): string | null {
  try {
    if (!naWeb()) return null;
    const k = (window as any).navigation?.currentEntry?.key;
    return typeof k === "string" && k ? k : null;
  } catch {
    return null;
  }
}

/** Lembra a etapa da entrada atual (depois de empilhar ou regravar). */
export function lembrarEtapaDaEntrada(etapa: EtapaNoHistorico): void {
  const k = chaveDaEntrada();
  if (k) etapasDasEntradas.set(k, etapa);
}

// Cada navegação (popstate ou empilhar) passa as regravações antigas para
// trás: uma regravação atrasada nunca marca a entrada errada.
let geracaoDaNavegacao = 0;

/** A cliente navegou (popstate ou etapa empilhada): regravações pendentes caducam. */
export function novaNavegacao(): number {
  geracaoDaNavegacao += 1;
  return geracaoDaNavegacao;
}

/**
 * Depois de um `popstate`, regrava a marca da etapa na entrada atual se
 * o roteador a tiver apagado. Roda num microtask e de novo em 0, 50 e
 * 250 ms: o roteador regrava o state no mesmo evento ou só depois do
 * render. Só age enquanto nenhuma navegação nova aconteceu. Devolve quem
 * cancela (a tela desmontou).
 */
export function remarcarEtapaDepoisDoRoteador(etapa: EtapaNoHistorico): () => void {
  if (!naWeb() || etapa < 2) return () => {};
  const minha = geracaoDaNavegacao;
  let vivo = true;
  const remarcar = () => {
    if (!vivo || minha !== geracaoDaNavegacao) return;
    const atual = lerEstadoDoHistorico();
    if (etapaDoEstado(atual) === etapa) return;
    regravarNoHistorico(estadoComEtapa(atual, etapa));
  };
  const relogios = [0, 50, 250].map((ms) => setTimeout(remarcar, ms));
  try { Promise.resolve().then(remarcar); } catch { /* sem microtask: os relógios bastam */ }
  return () => { vivo = false; relogios.forEach(clearTimeout); };
}

/** Ouve o voltar/avançar do navegador. */
export function ouvirOHistorico(fn: (estado: unknown) => void): () => void {
  if (!naWeb()) return () => {};
  const ouvinte = (e: PopStateEvent) => fn(e.state);
  window.addEventListener("popstate", ouvinte);
  return () => window.removeEventListener("popstate", ouvinte);
}

/**
 * Uma camada por cima da tela (zoom da foto, guia de medidas) com
 * entrada própria no histórico: abrir empilha, o voltar do navegador só
 * fecha a camada, e fechar pelo botão (ou Esc) tira a entrada.
 */
export function useCamadaNoHistorico(nome: string, aberta: boolean, fechar: () => void) {
  const empilhou = useRef(false);
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  useEffect(() => {
    if (!aberta || !naWeb()) return;
    empilhou.current = empilharNoHistorico(estadoComCamada(lerEstadoDoHistorico(), nome));
    const parar = ouvirOHistorico((estado) => {
      if (camadaDoEstado(estado) === nome) return;
      // O voltar do navegador já tirou a entrada: só fecha.
      empilhou.current = false;
      fecharRef.current();
    });
    return () => {
      parar();
      // Fechou pelo botão, pelo Esc ou pelo fundo: a entrada da camada sai.
      if (empilhou.current && camadaDoEstado(lerEstadoDoHistorico()) === nome) andarNoHistorico(-1);
      empilhou.current = false;
    };
  }, [aberta, nome]);
}
