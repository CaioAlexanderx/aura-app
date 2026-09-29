// ============================================================
// components/studio/orcamentoVideo/tamanhoDaArte.ts
//
// O tamanho da arte na peça do vídeo do orçamento (29/09/2026).
//
// O vídeo usava a regra ANTIGA do motor 3D (imagem inteira a 90% da
// largura e 55–85% da altura da área do MODELO, sem olhar a medida do
// produto): imagem muito larga, muito alta ou com borda transparente
// ficava pequena na peça. Agora o orçamento passa pela regra única
// (layoutDaArte/pintarArte, a mesma da vitrine) com um encaixe próprio:
//
//   - só imagem: a imagem inteira na área, dentro da margem de segurança
//     (Ajustar, sem cortar nada);
//   - imagem e texto: a imagem na faixa de cima (a mesma divisão 62/38 do
//     layout padrão) e o texto na de baixo;
//   - borda transparente (e, na sublimação, branca): a caixa do conteúdo
//     manda, não o canvas (`aparar`, em pintarArte).
//
// Módulo PURO: só transforma a ArteDoLado; quem mede a imagem é o layout,
// na hora de pintar. A lojista ainda pode mexer no tamanho e na posição
// (AjusteDaArte), por ajustarTamanhoDaArte — a tela liga o controle.
// ============================================================
import {
  MARGEM_CM,
  type ArteDoLado, type CaixaAlvo,
} from "@/components/studio/visualEngine/layoutDaArte";

/**
 * O ajuste da lojista sobre o encaixe automático.
 *  - escala: 1 = o automático; a imagem cresce/encolhe em torno do centro;
 *  - dx, dy: deslocamento em fração da área de impressão (+ = direita/baixo).
 */
export type AjusteDaArte = { escala: number; dx: number; dy: number };

export const AJUSTE_PADRAO: AjusteDaArte = { escala: 1, dx: 0, dy: 0 };

export const ESCALA_MIN = 0.3;
export const ESCALA_MAX = 1.5;
export const DESLOCAMENTO_MAX = 0.5;

/** Onde termina a faixa da imagem quando há texto: os 62% do layout padrão (layoutDaArte.resolverArte). */
export const FAIXA_DA_IMAGEM_COM_TEXTO = 0.62;
/** Respiro entre a imagem e o texto (fração da altura da área). */
const RESPIRO = 0.01;
/** Respiro entre imagens lado a lado (fração da largura). */
const ENTRE_IMAGENS = 0.03;
/** Sem medida em cm, a margem de segurança é esta fração de cada lado. */
const MARGEM_SEM_MEDIDA = 0.03;

function limitar(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function numero(v: unknown, padrao: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : padrao;
}

/** Um ajuste válido: números finitos, dentro dos limites. */
export function ajusteValido(a: Partial<AjusteDaArte> | null | undefined): AjusteDaArte {
  return {
    escala: limitar(numero(a?.escala, 1), ESCALA_MIN, ESCALA_MAX),
    dx: limitar(numero(a?.dx, 0), -DESLOCAMENTO_MAX, DESLOCAMENTO_MAX),
    dy: limitar(numero(a?.dy, 0), -DESLOCAMENTO_MAX, DESLOCAMENTO_MAX),
  };
}

/** O ajuste está no padrão (nada mexido)? */
export function ajusteEhPadrao(a: Partial<AjusteDaArte> | null | undefined): boolean {
  const v = ajusteValido(a);
  return v.escala === 1 && v.dx === 0 && v.dy === 0;
}

/** Margem de segurança em fração da largura e da altura da área. */
export function margensDaArea(areaCm: { w: number; h: number } | null): { mx: number; my: number } {
  if (areaCm && areaCm.w > 0 && areaCm.h > 0) {
    // Mesma regra de margemDaArea(): MARGEM_CM, e não passa de 1/4 do lado.
    return { mx: Math.min(MARGEM_CM / areaCm.w, 0.25), my: Math.min(MARGEM_CM / areaCm.h, 0.25) };
  }
  return { mx: MARGEM_SEM_MEDIDA, my: MARGEM_SEM_MEDIDA };
}

/**
 * As caixas onde as `n` imagens entram: uma coluna cada, dentro da
 * margem de segurança. Com texto, só a faixa de cima.
 */
export function caixasDasImagens(
  n: number,
  comTexto: boolean,
  areaCm: { w: number; h: number } | null,
  ajuste?: Partial<AjusteDaArte> | null,
): CaixaAlvo[] {
  if (n <= 0) return [];
  const { mx, my } = margensDaArea(areaCm);
  const aj = ajusteValido(ajuste);
  const y0 = my;
  const y1 = comTexto ? FAIXA_DA_IMAGEM_COM_TEXTO - RESPIRO : 1 - my;
  const larguraUtil = 1 - 2 * mx;
  const colW = (larguraUtil - ENTRE_IMAGENS * (n - 1)) / n;
  const out: CaixaAlvo[] = [];
  for (let i = 0; i < n; i++) {
    const w = colW, h = y1 - y0;
    const cx = mx + colW / 2 + i * (colW + ENTRE_IMAGENS) + aj.dx;
    const cy = (y0 + y1) / 2 + aj.dy;
    const ew = w * aj.escala, eh = h * aj.escala;
    out.push({ x: cx - ew / 2, y: cy - eh / 2, w: ew, h: eh });
  }
  return out;
}

/**
 * A arte do vídeo do orçamento: a mesma ArteDoLado da vitrine, com as
 * imagens encaixadas na caixa-alvo e recortadas pela caixa do conteúdo.
 * Sem imagem, devolve a arte como veio (o texto já usa a área toda).
 */
export function arteNoTamanhoDoOrcamento(arte: ArteDoLado, ajuste?: Partial<AjusteDaArte> | null): ArteDoLado {
  const n = arte.imagens.length;
  if (!n) return arte;
  const comTexto = arte.textos.some((t) => String(t.texto || "").trim());
  const caixas = caixasDasImagens(n, comTexto, arte.areaCm, ajuste);
  const mexeu = !ajusteEhPadrao(ajuste);
  return {
    ...arte,
    imagens: arte.imagens.map((im, i) => {
      // Ajuste que a cliente já fez na vitrine (com largura) manda: é o
      // que ela aprovou. Só a lojista mexendo aqui o troca.
      if (im.ajuste && im.ajuste.larg && !mexeu) return im;
      return { ...im, ajuste: im.ajuste && im.ajuste.larg ? null : im.ajuste, caixa: caixas[i], aparar: true };
    }),
  };
}
