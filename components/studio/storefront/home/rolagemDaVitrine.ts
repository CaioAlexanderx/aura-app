// ============================================================
// components/studio/storefront/home/rolagemDaVitrine.ts
//
// Onde a página estava (QA 27/09 e 28/09).
//
// A vitrine rola dentro do próprio ScrollView, não no `window`: o
// navegador não restaura a posição. Voltar da peça caía no topo da home
// ou da categoria, e a cliente perdia o lugar na grade.
//
// 27/09 a regra era: guardar a rolagem junto com o `id` que o roteador
// grava em `history.state` e restaurar só na mesma entrada. No QA de
// 28/09 a rolagem voltava 0 em /c/outras, /c/canecas e na home: a chave
// dependia de o `id` lido na saída bater com o lido na montagem, e de a
// posição ser lida UMA vez — uma montagem que não chegasse a rolar (a
// grade ainda sem altura, uma segunda montagem da tela) gastava a
// posição e a outra ficava sem nada.
//
// A regra agora:
//   - a posição é guardada por CAMINHO (a loja e a tela), com a hora;
//   - quem diz "a cliente voltou" é o próprio `popstate` (voltar ou
//     avançar do navegador, ou o "voltar" da vitrine, que anda no
//     histórico): o ouvinte marca o caminho da volta, e a montagem da
//     tela nesse caminho, logo em seguida, restaura. Toque em link não
//     passa por `popstate` e começa no topo;
//   - a posição só é esquecida quando a rolagem é APLICADA, e a marca da
//     volta vale por uma janela curta — duas montagens seguidas da mesma
//     tela restauram as duas.
//
// E o "Todas as peças" fora da home: a home abre e rola até a grade. O
// pedido não expira em 1,5 s como antes: vale até a grade fazer o layout
// (com um teto largo só para não ficar pendurado).
//
// Puro no que decide (a memória é do módulo; o relógio e o caminho entram
// por parâmetro): é regra, tem teste. O ouvinte do `popstate` é o único
// pedaço de navegador, e é instalado uma vez.
// ============================================================

/** Depois disto, a posição guardada não vale mais (a loja pode ter mudado). */
export const VALIDADE_DA_ROLAGEM_MS = 30 * 60 * 1000;
/** Quanto tempo depois do `popstate` a montagem da tela ainda conta como volta. */
export const JANELA_DA_VOLTA_MS = 3000;
/** Teto do pedido "Todas as peças": não é o que resolve (o layout da grade é). */
export const VALIDADE_DO_PEDIDO_DA_GRADE_MS = 60 * 1000;

export type RolagemGuardada = { y: number; ts: number };

/** A chave da tela: a loja e a tela ("home", "c:canecas"). */
export function chaveDaRolagem(slug: string, tela: string): string {
  return String(slug || "").trim().toLowerCase() + "|" + String(tela || "").trim();
}

/** O caminho sem a barra do fim ("/aura-qa/c/outras/" = "/aura-qa/c/outras"). */
export function normalizarCaminho(caminho: string): string {
  const c = String(caminho || "").split(/[?#]/)[0].trim();
  return c.length > 1 ? c.replace(/\/+$/, "") : c;
}

/** O caminho em que a cliente está (web), ou "". */
export function caminhoAtual(): string {
  try {
    return typeof window !== "undefined" ? normalizarCaminho(window.location?.pathname || "") : "";
  } catch {
    return "";
  }
}

// ── A posição por tela ───────────────────────────────────────

const memoria = new Map<string, RolagemGuardada>();

/** Guarda a posição ao sair da tela. No topo, apaga o que havia. */
export function guardarRolagem(chave: string, y: number, agora: number = Date.now()): void {
  ouvirAsVoltas();
  if (!(y > 0)) { memoria.delete(chave); return; }
  memoria.set(chave, { y: Math.round(y), ts: agora });
}

/** A posição guardada da tela, dentro da validade (não apaga). */
export function rolagemGuardada(chave: string, agora: number = Date.now()): number | null {
  const s = memoria.get(chave);
  if (!s || !(s.y > 0)) return null;
  if (agora - s.ts > VALIDADE_DA_ROLAGEM_MS) { memoria.delete(chave); return null; }
  return s.y;
}

/** A posição foi aplicada: some (o próximo toque em link começa no topo). */
export function esquecerRolagem(chave: string): void {
  memoria.delete(chave);
}

// ── A volta pelo histórico ───────────────────────────────────

export type VoltaDoHistorico = { caminho: string; ts: number };

let volta: VoltaDoHistorico | null = null;

/** O ouvinte do `popstate` chama: a cliente voltou (ou avançou) para `caminho`. */
export function marcarVolta(caminho: string, agora: number = Date.now()): void {
  volta = { caminho: normalizarCaminho(caminho), ts: agora };
}

export function esquecerVolta(): void {
  volta = null;
}

/**
 * A montagem desta tela veio do histórico? Houve `popstate` para este
 * mesmo caminho há pouco. Puro: a volta entra por parâmetro.
 */
export function veioDoHistorico(
  v: VoltaDoHistorico | null | undefined,
  caminho: string,
  agora: number = Date.now(),
): boolean {
  if (!v || !caminho) return false;
  if (v.caminho !== normalizarCaminho(caminho)) return false;
  return agora - v.ts >= 0 && agora - v.ts <= JANELA_DA_VOLTA_MS;
}

/** A posição para restaurar nesta montagem, ou null (não apaga: ver esquecerRolagem). */
export function rolagemParaRestaurar(chave: string, caminho: string, agora: number = Date.now()): number | null {
  if (!veioDoHistorico(volta, caminho, agora)) return null;
  return rolagemGuardada(chave, agora);
}

let ouvindo = false;

/**
 * Instala, uma vez, o ouvinte do `popstate`. Na fase de CAPTURA: roda
 * antes do ouvinte do roteador (que troca a tela), então a marca já
 * existe quando a tela nova monta.
 */
export function ouvirAsVoltas(): void {
  if (ouvindo) return;
  try {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    window.addEventListener("popstate", () => marcarVolta(caminhoAtual()), true);
    ouvindo = true;
  } catch {
    /* sem janela: nada a ouvir */
  }
}

// ── "Todas as peças" de fora da home ─────────────────────────

let pedidoDaGrade: { ts: number } | null = null;

/** A próxima home que montar rola até a grade. */
export function pedirAGradeNaHome(agora: number = Date.now()): void {
  pedidoDaGrade = { ts: agora };
}

/**
 * Há pedido de rolar até a grade? Não gasta o pedido: quem gasta é a
 * home, depois de rolar de fato (concluirPedidoDaGrade).
 */
export function haPedidoDaGrade(agora: number = Date.now()): boolean {
  if (!pedidoDaGrade) return false;
  if (agora - pedidoDaGrade.ts > VALIDADE_DO_PEDIDO_DA_GRADE_MS) { pedidoDaGrade = null; return false; }
  return true;
}

export function concluirPedidoDaGrade(): void {
  pedidoDaGrade = null;
}

/**
 * Onde a rolagem para para o alvo aparecer logo abaixo do cabeçalho
 * preso. `topoNoConteudo` é o topo do alvo em coordenadas do conteúdo
 * rolável (medido no clique, não o do primeiro layout).
 */
export function alvoDaRolagem(topoNoConteudo: number, alturaDoCabecalho: number): number {
  const t = Number(topoNoConteudo), c = Number(alturaDoCabecalho) || 0;
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.round(t - c + 1));
}
