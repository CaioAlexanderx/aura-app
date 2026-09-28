// ============================================================
// components/studio/storefront/home/rolagemDaVitrine.ts
//
// Onde a página estava (QA 27/09).
//
// A vitrine rola dentro do próprio ScrollView, não no `window`: o
// navegador não restaura a posição. Voltar da peça caía no topo da home
// ou da categoria, e a cliente perdia o lugar na grade.
//
// A regra: a home e a página da categoria guardam a rolagem ao sair,
// junto com a ENTRADA do histórico em que estavam (o `id` que o roteador
// grava em `history.state`). Ao montar de novo, só restauram se a
// entrada atual é a mesma — o voltar do navegador. Tela aberta de novo
// por um toque (barra, "Início", link) é entrada nova e começa no topo.
//
// E o "Todas as peças" fora da home: a home abre e rola até a grade.
//
// Puro de propósito (a memória é um Map do módulo, o relógio e o id
// entram por parâmetro): é regra, tem teste.
// ============================================================

/** Depois disto, a posição guardada não vale mais (a loja pode ter mudado). */
export const VALIDADE_DA_ROLAGEM_MS = 30 * 60 * 1000;

export type RolagemGuardada = { y: number; entrada: string; ts: number };

/** A chave da tela: a loja e a tela ("home", "c:canecas"). */
export function chaveDaRolagem(slug: string, tela: string): string {
  return String(slug || "").trim().toLowerCase() + "|" + String(tela || "").trim();
}

/** O id da entrada do histórico em que a cliente está (web), ou "". */
export function entradaDoHistorico(): string {
  try {
    if (typeof window === "undefined") return "";
    const id = (window.history?.state as any)?.id;
    return typeof id === "string" || typeof id === "number" ? String(id) : "";
  } catch {
    return "";
  }
}

/**
 * Restaura? Só com posição guardada, na MESMA entrada do histórico (o
 * voltar), dentro da validade e com algo para rolar.
 */
export function deveRestaurar(
  salva: RolagemGuardada | null | undefined,
  entradaAtual: string,
  agora: number = Date.now(),
): boolean {
  if (!salva || !(salva.y > 0)) return false;
  if (!entradaAtual || salva.entrada !== entradaAtual) return false;
  return agora - salva.ts <= VALIDADE_DA_ROLAGEM_MS;
}

const memoria = new Map<string, RolagemGuardada>();

/** Guarda a posição ao sair. Sem entrada conhecida, não há como voltar a ela. */
export function guardarRolagem(chave: string, y: number, entrada: string, agora: number = Date.now()): void {
  if (!entrada) return;
  if (!(y > 0)) { memoria.delete(chave); return; }
  memoria.set(chave, { y: Math.round(y), entrada, ts: agora });
}

/** A posição para restaurar agora, ou null. Lida uma vez: depois, some. */
export function rolagemParaRestaurar(chave: string, entradaAtual: string, agora: number = Date.now()): number | null {
  const salva = memoria.get(chave);
  if (!salva) return null;
  memoria.delete(chave);
  return deveRestaurar(salva, entradaAtual, agora) ? salva.y : null;
}

// ── "Todas as peças" de fora da home ─────────────────────────

let gradePedida = false;

/** A próxima home que montar rola até a grade. */
export function pedirAGradeNaHome(): void {
  gradePedida = true;
}

/** A home pergunta uma vez: pediram a grade? */
export function consumirPedidoDaGrade(): boolean {
  const v = gradePedida;
  gradePedida = false;
  return v;
}
