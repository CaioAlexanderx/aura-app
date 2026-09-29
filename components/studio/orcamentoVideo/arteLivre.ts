// ============================================================
// components/studio/orcamentoVideo/arteLivre.ts
//
// A arte LIVRE na peça do orçamento (29/09/2026). O PO: "Temos que dar
// liberdade total para encaixar a arte na camisa, sem delimitar cm ou
// posição da arte. Para realmente ser funcional."
//
// Vale só no orçamento, onde a lojista monta a prova. A vitrine continua
// presa à área de impressão.
//
// Na posição livre, a arte de um lado não fica mais na área de impressão
// com margem: ela vai para qualquer lugar do PAINEL inteiro daquele lado
// (visualEngine/painelDaPeca: frente ou costas inteiras da camiseta, a
// volta toda da caneca), de muito pequena até cobrir o painel. O limite é
// só a borda do painel: o que passa dela não aparece.
//
// Onde mora: `customization.orcamento_ajustes[lado]`, ao lado do ajuste
// antigo do #1013 ({ escala, dx, dy }), que continua valendo:
//   { livre: true, u, v, escala, rotacao? }
//   - u, v: o centro da arte em fração do painel (0 a 1; v cresce para
//     baixo, como a tela);
//   - escala: a largura da arte em fração da largura do painel;
//   - rotacao: graus no sentido horário (0 = reta; ausente = 0).
// Nada de centímetros: a prova é a prévia.
//
// Módulo puro, testado em __tests__/studio/orcamentoArteLivre.test.ts.
// ============================================================
import type { Ajuste, CaixaAlvo } from "@/components/studio/visualEngine/layoutDaArte";
import type { UvDoPainel } from "@/components/studio/visualEngine/painelDaPeca";
import { caixasDasImagens, ajusteValido, type AjusteDaArte } from "./tamanhoDaArte";

export type AjusteLivre = {
  livre: true;
  u: number;
  v: number;
  escala: number;
  rotacao?: number;
};

/** A menor arte: 3% da largura do painel (um escudo pequeno no peito da camiseta). */
export const ESCALA_LIVRE_MIN = 0.03;
/** Teto de segurança; na tela, o teto é o que cobre o painel (escalaMaxima). */
export const ESCALA_LIVRE_MAX = 3;
/** Passo dos botões de rotação. */
export const PASSO_DA_ROTACAO = 15;

function limitar(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
function numero(v: unknown, padrao: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : padrao;
}
function arred(v: number, casas = 4): number {
  const f = Math.pow(10, casas);
  return Math.round(v * f) / f;
}

/** O ajuste guardado é o da posição livre? */
export function ehLivre(a: unknown): a is AjusteLivre {
  return !!a && typeof a === "object" && (a as any).livre === true;
}

/** Graus em (-180, 180], arredondados a 0,1°. */
export function rotacaoValida(g: unknown): number {
  let r = numero(g, 0) % 360;
  if (r > 180) r -= 360;
  if (r <= -180) r += 360;
  r = Math.round(r * 10) / 10;
  return r === 0 ? 0 : r; // sem -0
}

/** Um ajuste livre válido: centro dentro do painel, escala nos limites. */
export function ajusteLivreValido(a: Partial<AjusteLivre> | null | undefined): AjusteLivre {
  const out: AjusteLivre = {
    livre: true,
    u: arred(limitar(numero(a?.u, 0.5), 0, 1)),
    v: arred(limitar(numero(a?.v, 0.5), 0, 1)),
    escala: arred(limitar(numero(a?.escala, 0.5), ESCALA_LIVRE_MIN, ESCALA_LIVRE_MAX)),
  };
  const r = rotacaoValida(a?.rotacao);
  if (r) out.rotacao = r;
  return out;
}

/**
 * Altura da arte em fração da altura do painel, para a largura `escala`.
 * `aspArte` = altura ÷ largura da imagem; `aspPainel` = altura ÷ largura
 * do painel na peça.
 */
export function alturaNoPainel(escala: number, aspArte: number, aspPainel: number): number {
  return (escala * (aspArte > 0 ? aspArte : 1)) / (aspPainel > 0 ? aspPainel : 1);
}

/** A escala em que a arte cobre o painel inteiro (e o teto do botão "maior"). */
export function escalaMaxima(aspArte: number, aspPainel: number): number {
  const a = aspArte > 0 ? aspArte : 1, p = aspPainel > 0 ? aspPainel : 1;
  return arred(limitar(Math.max(1, p / a), ESCALA_LIVRE_MIN, ESCALA_LIVRE_MAX));
}

/** "Encaixar no painel": a arte inteira no painel, o maior possível, no centro e reta. */
export function encaixarNoPainel(aspArte: number, aspPainel: number): AjusteLivre {
  const a = aspArte > 0 ? aspArte : 1, p = aspPainel > 0 ? aspPainel : 1;
  return ajusteLivreValido({ u: 0.5, v: 0.5, escala: Math.min(1, p / a) });
}

/** "Centralizar": o mesmo tamanho, no meio do painel. */
export function centralizar(a: AjusteLivre): AjusteLivre {
  return ajusteLivreValido({ ...a, u: 0.5, v: 0.5 });
}

export function moverLivre(a: AjusteLivre, du: number, dv: number): AjusteLivre {
  return ajusteLivreValido({ ...a, u: a.u + du, v: a.v + dv });
}

/** Muda o tamanho em torno do centro; `teto` = escalaMaxima da arte. */
export function escalarLivre(a: AjusteLivre, fator: number, teto = ESCALA_LIVRE_MAX): AjusteLivre {
  const f = fator > 0 && Number.isFinite(fator) ? fator : 1;
  return ajusteLivreValido({ ...a, escala: Math.min(a.escala * f, Math.max(teto, ESCALA_LIVRE_MIN)) });
}

export function girarLivre(a: AjusteLivre, graus: number): AjusteLivre {
  return ajusteLivreValido({ ...a, rotacao: (a.rotacao || 0) + graus });
}

/**
 * O ajuste livre no formato do layout (layoutDaArte.Ajuste), que o pintor
 * já sabe desenhar: centro e largura em fração da área — aqui, do painel.
 */
export function ajusteDoLayout(a: AjusteLivre): Ajuste {
  return { v: 1, cx: a.u, cy: a.v, larg: a.escala, rot: (a.rotacao || 0) as Ajuste["rot"], encaixe: "livre" };
}

/** A caixa da arte (sem girar) em frações do painel. */
export function caixaDaArteLivre(a: AjusteLivre, aspArte: number, aspPainel: number): CaixaAlvo {
  const h = alturaNoPainel(a.escala, aspArte, aspPainel);
  return { x: a.u - a.escala / 2, y: a.v - h / 2, w: a.escala, h };
}

/**
 * O que o toque (pu, pv: fração do painel) pega da arte: um canto (muda o
 * tamanho), o miolo (move) ou nada. `folga` em fração da LARGURA do
 * painel. Com a arte girada, o ponto é desgirado em volta do centro, na
 * medida da peça (a altura do painel vale `aspPainel` larguras).
 */
export function alvoDoToque(
  a: AjusteLivre,
  aspArte: number,
  aspPainel: number,
  pu: number,
  pv: number,
  folga: number,
): "canto" | "miolo" | null {
  const p = aspPainel > 0 ? aspPainel : 1;
  const w = a.escala, h = alturaNoPainel(a.escala, aspArte, p) * p; // em larguras do painel
  const dx0 = pu - a.u, dy0 = (pv - a.v) * p;
  const r = (-(a.rotacao || 0) * Math.PI) / 180;
  const dx = dx0 * Math.cos(r) - dy0 * Math.sin(r);
  const dy = dx0 * Math.sin(r) + dy0 * Math.cos(r);
  const f = Math.max(0, folga);
  // Canto primeiro, fora do miolo: numa arte pequena na tela a folga
  // cobriria a arte inteira e todo toque viraria alça (o mesmo cuidado do
  // EditorDaArte da vitrine).
  const noMiolo = Math.abs(dx) < w / 4 && Math.abs(dy) < h / 4;
  if (!noMiolo) {
    for (const [cx, cy] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) {
      if (Math.hypot(dx - cx, dy - cy) <= f) return "canto";
    }
  }
  if (Math.abs(dx) <= w / 2 + f * 0.4 && Math.abs(dy) <= h / 2 + f * 0.4) return "miolo";
  return null;
}

/** Distância (em larguras do painel) do ponto ao centro da arte: a base da alça e da pinça. */
export function distanciaAoCentro(a: AjusteLivre, aspPainel: number, pu: number, pv: number): number {
  const p = aspPainel > 0 ? aspPainel : 1;
  return Math.hypot(pu - a.u, (pv - a.v) * p);
}

/**
 * Da área de impressão para a posição livre: a arte começa exatamente onde
 * o encaixe da área a punha (com o ajuste antigo, se houver), agora medida
 * no painel. `area` e `painel` em UV (v para cima); o painel da caneca pode
 * passar de u = 1.
 */
export function livreDaArea(
  antigo: Partial<AjusteDaArte> | null | undefined,
  area: UvDoPainel,
  painel: UvDoPainel,
  aspArte: number,
  aspPainel: number,
  areaCm: { w: number; h: number } | null = null,
): AjusteLivre {
  const pw = painel.u1 - painel.u0, ph = painel.v1 - painel.v0;
  if (!(pw > 0) || !(ph > 0)) return encaixarNoPainel(aspArte, aspPainel);
  let u0 = area.u0;
  if (u0 < painel.u0) u0 += 1; // caneca: a área do outro lado da emenda
  const ax = (u0 - painel.u0) / pw, aw = (area.u1 - area.u0) / pw;
  const ay = (painel.v1 - area.v1) / ph, ah = (area.v1 - area.v0) / ph;
  const c = caixasDasImagens(1, false, areaCm, ajusteValido(antigo))[0];
  const caixa = { x: ax + c.x * aw, y: ay + c.y * ah, w: c.w * aw, h: c.h * ah };
  const a = aspArte > 0 ? aspArte : 1, p = aspPainel > 0 ? aspPainel : 1;
  // Inteira na caixa: a largura que cabe pela altura (em frações do painel).
  const escala = Math.min(caixa.w, (caixa.h * p) / a);
  return ajusteLivreValido({ u: caixa.x + caixa.w / 2, v: caixa.y + caixa.h / 2, escala });
}
