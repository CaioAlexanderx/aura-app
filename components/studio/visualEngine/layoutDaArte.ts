// ============================================================
// AURA STUDIO · visualEngine/layoutDaArte — onde cada coisa cai na área
// de impressão (28/09/2026)
//
// Módulo PURO (sem React, sem DOM). É a regra única de diagramação que
// os três desenhos da arte leem — o canvas 2D (compose2d), a textura 3D
// (compose3dMug) e o SVG da ficha (PersonalizationPreview). Antes cada um
// tinha a sua cópia do "imagem em cima, texto embaixo", com números
// diferentes, e nenhum deixava a cliente mexer em nada.
//
// A UNIDADE é a da área: centímetros quando a área tem medida (quase
// sempre — `print_area` do produto), e os pixels do retângulo quando não
// tem. Quem desenha só escala do retângulo da área para o destino.
//
// O AJUSTE da cliente é guardado no pedido em frações da área (chave
// lateral `<campo>_ajuste`, como a `<campo>_cor`): o desenho sobrevive a
// qualquer resolução. O retrato em cm (`cm`), os pixels do arquivo e o
// DPI entram no fechamento, para a ficha de produção.
//
// Sem ajuste, vale o LAYOUT PADRÃO: imagens em cima (inteiras, lado a
// lado), textos embaixo, um por linha. É o desenho de sempre do 2D,
// agora com TODOS os textos e imagens do lado — antes o segundo texto
// ("Data") ia para o pedido e sumia da prévia.
//
// Contrato espelhado no backend: src/services/ajusteDaArte.js (limites).
// Diagnóstico: docs/studio/formatacao-da-arte-diagnostico.md
// ============================================================

export type Rotacao = 0 | 90 | 180 | 270;
export type Encaixe = "ajustar" | "preencher" | "livre";
export type Tamanho = "P" | "M" | "G";
export type Tecnica = "sublimacao" | "dtf" | "outra";

/** O que vai no pedido, por campo: `<campo>_ajuste`. */
export type Ajuste = {
  v: 1;
  /** Centro, em fração da área (0..1; fora disso a arte passa da borda). */
  cx: number;
  cy: number;
  /** Imagem: largura em fração da largura da área. */
  larg?: number;
  /** Texto: tamanho da letra em fração da altura da área. */
  alt?: number;
  rot?: Rotacao;
  encaixe?: Encaixe;
  /** Retrato em cm, para a ficha: caixa já girada, a partir do canto sup. esq. da área. */
  cm?: { x: number; y: number; w: number; h: number };
  /** Pixels do arquivo, medidos no navegador. */
  arquivo?: { w: number; h: number };
  dpi?: number;
};

/** Retângulo em frações da área (0..1): x, y = canto superior esquerdo. */
export type CaixaAlvo = { x: number; y: number; w: number; h: number };

/** A arte de UM lado, pronta para qualquer motor desenhar. */
export type ArteDoLado = {
  v: 1;
  lado: "front" | "back" | "middle";
  /** A área em cm (do cadastro do produto). null = sem medida: vale o retângulo do motor. */
  areaCm: { w: number; h: number } | null;
  tecnica: Tecnica;
  imagens: Array<{
    campo: string; url: string; ajuste: Ajuste | null; arquivo: { w: number; h: number } | null;
    /**
     * Caixa-alvo (frações da área) onde a imagem entra INTEIRA e
     * centralizada, no lugar da faixa padrão. Só vale sem ajuste. Quem
     * usa: o vídeo do orçamento (29/09/2026); a vitrine não preenche, e
     * sem ela o layout é o de sempre, byte a byte.
     */
    caixa?: CaixaAlvo;
    /** Recortar a imagem pela caixa do conteúdo (borda transparente ou, na sublimação, branca) antes de desenhar. */
    aparar?: boolean;
  }>;
  textos: Array<{
    campo: string; texto: string; cor: string;
    /** Pilha CSS da fonte. */
    fonte: string;
    nomeDaFonte: string | null;
    tam: Tamanho | null;
    contorno: boolean;
    ajuste: Ajuste | null;
  }>;
  /** Desenhar a área e a margem de segurança (a cliente está ajustando, ou ligou "Área de impressão"). */
  guias?: boolean;
  /** A cliente está ajustando: o que passa da área aparece apagado, e a margem de segurança aparece. */
  editando?: boolean;
  /** Campo com a caixa de seleção (edição). */
  selecionado?: string | null;
};

export type ItemImagem = {
  tipo: "imagem"; campo: string; url: string;
  cx: number; cy: number; w: number; h: number; rot: Rotacao; bw: number; bh: number;
  encaixe: Encaixe; arquivo: { w: number; h: number } | null;
};
export type ItemTexto = {
  tipo: "texto"; campo: string; texto: string; cor: string; fonte: string; contorno: boolean;
  /** Tamanho da fonte, na unidade da área. */
  px: number;
  cx: number; cy: number; w: number; h: number; rot: Rotacao; bw: number; bh: number;
};
export type ItemDaArte = ItemImagem | ItemTexto;

export type Medidor = {
  /** Altura ÷ largura da imagem; null = ainda não se sabe (vale 1). */
  aspecto: (url: string) => number | null;
  /** Largura do texto com a fonte (pilha CSS) no tamanho `px`. */
  largura: (texto: string, fonte: string, px: number) => number;
};

// ── Constantes ───────────────────────────────────────────────

/** Margem de segurança: o que fica a menos disso da borda pode ser cortado. */
export const MARGEM_CM = 0.3;
/** Sem medida em cm, a margem é esta fração do menor lado. */
export const MARGEM_SEM_CM = 0.02;
export const DPI_BOM = 150;
export const DPI_ACEITAVEL = 100;
/** Peso da letra da arte (o mesmo de sempre do 2D e do 3D). */
export const PESO_DO_TEXTO = "600";
/** Altura da linha de texto em relação ao tamanho da fonte. */
export const ALTURA_DA_LINHA = 1.2;
/** Largura da imagem: limites do ajuste (espelho do backend). */
export const LARG_MIN = 0.02;
export const LARG_MAX = 3;
export const ALT_MIN = 0.02;
export const ALT_MAX = 2;

/** P/M/G: fração da altura da área, com teto em cm (área alta de camiseta não pede letra de 8 cm). */
const TAMANHOS: Record<Tamanho, { frac: number; tetoCm: number }> = {
  P: { frac: 0.1, tetoCm: 2.2 },
  M: { frac: 0.15, tetoCm: 3.2 },
  G: { frac: 0.22, tetoCm: 4.4 },
};

// ── Leitura defensiva ────────────────────────────────────────

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function limitar(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
function arred(v: number, casas = 4): number {
  const f = Math.pow(10, casas);
  return Math.round(v * f) / f;
}

export function rotacaoValida(v: unknown): Rotacao {
  const n = num(v);
  return n === 90 || n === 180 || n === 270 ? n : 0;
}

/** Lê um ajuste vindo do pedido (ou da tela). Malformado = null (vale o padrão). */
export function lerAjuste(v: unknown): Ajuste | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  const cx = num(a.cx), cy = num(a.cy);
  if (num(a.v) !== 1 || cx == null || cy == null) return null;
  const out: Ajuste = { v: 1, cx: limitar(cx, -0.5, 1.5), cy: limitar(cy, -0.5, 1.5) };
  const larg = num(a.larg);
  if (larg != null && larg > 0) out.larg = limitar(larg, LARG_MIN, LARG_MAX);
  const alt = num(a.alt);
  if (alt != null && alt > 0) out.alt = limitar(alt, ALT_MIN, ALT_MAX);
  out.rot = rotacaoValida(a.rot);
  if (a.encaixe === "ajustar" || a.encaixe === "preencher" || a.encaixe === "livre") out.encaixe = a.encaixe;
  const arq = a.arquivo as any;
  if (arq && Number.isInteger(arq.w) && Number.isInteger(arq.h) && arq.w > 0 && arq.h > 0) out.arquivo = { w: arq.w, h: arq.h };
  return out;
}

export function tamanhoValido(v: unknown): Tamanho | null {
  return v === "P" || v === "M" || v === "G" ? v : null;
}

/**
 * A técnica de impressão do produto. Sem escolha da lojista, o padrão da
 * peça (decisão do PO, 28/09): caneca → sublimação, camiseta → DTF. Peça
 * desconhecida → "outra", que mantém a mistura de sempre do motor.
 */
export function tecnicaDoProduto(
  cfg: { tecnica?: unknown } | null | undefined,
  peca?: "caneca" | "camiseta" | string | null,
): Tecnica {
  const t = cfg?.tecnica;
  if (t === "sublimacao" || t === "dtf" || t === "outra") return t;
  if (peca === "caneca") return "sublimacao";
  if (peca === "camiseta") return "dtf";
  return "outra";
}

/**
 * Como a arte se mistura à peça. Sublimação é tinta DENTRO do material:
 * o branco da arte vira a cor da peça (multiply). DTF/transfer é película
 * opaca por cima: o branco é impresso. "outra" = null, o motor decide
 * pela luz da peça como sempre decidiu.
 */
export function misturaDaTecnica(t: Tecnica | null | undefined): "multiply" | "normal" | null {
  if (t === "sublimacao") return "multiply";
  if (t === "dtf") return "normal";
  return null;
}

/** Tamanho da letra (fração da altura da área) para P/M/G. */
export function altDoTamanho(tam: Tamanho, areaHcm: number | null): number {
  const t = TAMANHOS[tam];
  if (!areaHcm || !(areaHcm > 0)) return t.frac;
  return Math.min(t.frac, t.tetoCm / areaHcm);
}

/** A unidade da área: cm quando há medida, senão o retângulo do motor. */
export function unidadeDaArea(arte: Pick<ArteDoLado, "areaCm">, rect: { w: number; h: number }): { W: number; H: number; emCm: boolean } {
  const a = arte.areaCm;
  if (a && a.w > 0 && a.h > 0) return { W: a.w, H: a.h, emCm: true };
  return { W: Math.max(1, rect.w), H: Math.max(1, rect.h), emCm: false };
}

export function margemDaArea(W: number, H: number, emCm: boolean): number {
  return emCm ? MARGEM_CM : Math.min(W, H) * MARGEM_SEM_CM;
}

function caixaGirada(w: number, h: number, rot: Rotacao): { bw: number; bh: number } {
  return rot === 90 || rot === 270 ? { bw: h, bh: w } : { bw: w, bh: h };
}

// ── Resolver: ajuste → itens na unidade da área ─────────────

/**
 * Onde cada imagem e cada texto cai, na unidade da área (W × H). Item com
 * ajuste segue o ajuste; o resto entra no layout padrão.
 */
export function resolverArte(arte: ArteDoLado, W: number, H: number, medir: Medidor): ItemDaArte[] {
  const imagens = arte.imagens || [];
  const textos = (arte.textos || []).filter((t) => String(t.texto || "").trim());
  const areaHcm = arte.areaCm && arte.areaCm.h > 0 ? arte.areaCm.h : null;
  const out: ItemDaArte[] = [];

  // Faixas do padrão — os números do 2D de sempre (compose2d,
  // desenharArteNoRetangulo), para pedido sem ajuste sair igual: a
  // imagem nos 62% de cima quando há texto, em 90% da altura quando não
  // há; o texto centrado na faixa de baixo, ou no meio sem imagem (#998).
  const temTexto = textos.length > 0;
  const temImagem = imagens.length > 0;
  const faixaImg = temTexto ? H * 0.62 : H * 0.9;
  const nImg = Math.max(1, imagens.length);

  imagens.forEach((im, i) => {
    const a = medir.aspecto(im.url) || (im.arquivo ? im.arquivo.h / im.arquivo.w : null) || 1;
    const aj = im.ajuste;
    let w: number, cx: number, cy: number, rot: Rotacao, encaixe: Encaixe;
    if (aj && aj.larg) {
      w = aj.larg * W; cx = aj.cx * W; cy = aj.cy * H; rot = aj.rot || 0; encaixe = aj.encaixe || "livre";
    } else if (im.caixa && !aj) {
      // Caixa-alvo (orçamento em vídeo): inteira dentro da caixa, centrada.
      const c = im.caixa;
      w = Math.max(0.01, Math.min(c.w * W, (c.h * H) / a));
      cx = (c.x + c.w / 2) * W;
      cy = (c.y + c.h / 2) * H;
      rot = 0;
      encaixe = "ajustar";
    } else {
      // Padrão: inteira numa coluna da faixa de cima (lado a lado quando
      // há mais de uma).
      const colW = W / nImg;
      const boxW = colW * (nImg > 1 ? 0.94 : 1);
      w = Math.min(boxW, faixaImg / a);
      cx = colW * (i + 0.5);
      cy = faixaImg / 2;
      rot = aj ? aj.rot || 0 : 0;
      encaixe = "ajustar";
      if (aj) { cx = aj.cx * W; cy = aj.cy * H; }
    }
    const h = w * a;
    const { bw, bh } = caixaGirada(w, h, rot);
    out.push({ tipo: "imagem", campo: im.campo, url: im.url, cx, cy, w, h, rot, bw, bh, encaixe, arquivo: im.arquivo || (aj && aj.arquivo) || null });
  });

  const topo = temImagem ? faixaImg : 0;
  const faixaTxt = H - topo;
  const linha = faixaTxt / Math.max(1, textos.length);
  textos.forEach((t, i) => {
    const aj = t.ajuste;
    let px: number;
    const rot: Rotacao = aj ? aj.rot || 0 : 0;
    if (aj && aj.alt) {
      px = aj.alt * H;
    } else {
      const base = t.tam
        ? altDoTamanho(t.tam, areaHcm) * H
        : Math.min(temImagem ? linha * (0.22 / 0.38) : linha * 0.3, W * 0.6);
      // Cabe na largura: encolhe até 94% da área, como sempre.
      const larg = medir.largura(t.texto, t.fonte, base);
      px = larg > W * 0.94 ? base * (W * 0.94) / larg : base;
    }
    const w = Math.max(px * 0.3, medir.largura(t.texto, t.fonte, px));
    const h = px * ALTURA_DA_LINHA;
    const cx = aj ? aj.cx * W : W / 2;
    const cy = aj ? aj.cy * H : topo + linha * (i + 0.5);
    const { bw, bh } = caixaGirada(w, h, rot);
    out.push({ tipo: "texto", campo: t.campo, texto: t.texto, cor: t.cor, fonte: t.fonte, contorno: !!t.contorno, px, cx, cy, w, h, rot, bw, bh });
  });

  return out;
}

// ── Item → ajuste (o que vai para o pedido) ─────────────────

export function caixaDoItem(it: { cx: number; cy: number; bw: number; bh: number }) {
  return { x: it.cx - it.bw / 2, y: it.cy - it.bh / 2, w: it.bw, h: it.bh };
}

/** DPI efetivo: pixels do arquivo ÷ polegadas que a imagem ocupa. */
export function dpiEfetivo(pixelsDeLargura: number, larguraCm: number): number | null {
  if (!(pixelsDeLargura > 0) || !(larguraCm > 0)) return null;
  return pixelsDeLargura / (larguraCm / 2.54);
}

export type Nitidez = "boa" | "aceitavel" | "ruim";
export function faixaDeNitidez(dpi: number | null): Nitidez | null {
  if (dpi == null) return null;
  return dpi >= DPI_BOM ? "boa" : dpi >= DPI_ACEITAVEL ? "aceitavel" : "ruim";
}

/** Maior largura (cm) em que a imagem sai com DPI_BOM. */
export function larguraNitidaCm(pixelsDeLargura: number): number {
  return (pixelsDeLargura / DPI_BOM) * 2.54;
}

/** O ajuste completo de um item, na unidade da área. */
export function ajusteDoItem(it: ItemDaArte, W: number, H: number, emCm: boolean): Ajuste {
  const a: Ajuste = { v: 1, cx: arred(it.cx / W), cy: arred(it.cy / H), rot: it.rot };
  if (it.tipo === "imagem") {
    a.larg = arred(limitar(it.w / W, LARG_MIN, LARG_MAX));
    a.encaixe = it.encaixe;
    if (it.arquivo) a.arquivo = { w: it.arquivo.w, h: it.arquivo.h };
    if (emCm && it.arquivo) {
      const d = dpiEfetivo(it.arquivo.w, it.w);
      if (d != null) a.dpi = Math.round(d);
    }
  } else {
    a.alt = arred(limitar(it.px / H, ALT_MIN, ALT_MAX));
  }
  if (emCm) {
    const c = caixaDoItem(it);
    a.cm = { x: arred(c.x, 2), y: arred(c.y, 2), w: arred(c.w, 2), h: arred(c.h, 2) };
  }
  return a;
}

// ── Operações do editor (sobre o ajuste, em frações) ────────

/** Largura (fração) que encaixa a imagem: inteira dentro da margem, ou cobrindo a área. */
export function larguraDoEncaixe(
  modo: "ajustar" | "preencher",
  aspecto: number,
  rot: Rotacao,
  W: number,
  H: number,
  margem: number,
): number {
  const a = aspecto > 0 ? aspecto : 1;
  const deitada = rot === 90 || rot === 270;
  if (modo === "preencher") {
    const w = deitada ? Math.max(W / a, H) : Math.max(W, H / a);
    return w / W;
  }
  const aw = Math.max(0.1, W - 2 * margem), ah = Math.max(0.1, H - 2 * margem);
  const w = deitada ? Math.min(aw / a, ah) : Math.min(aw, ah / a);
  return w / W;
}

export function moverAjuste(a: Ajuste, dx: number, dy: number, W: number, H: number): Ajuste {
  return { ...a, cx: arred(limitar(a.cx + dx / W, -0.5, 1.5)), cy: arred(limitar(a.cy + dy / H, -0.5, 1.5)), encaixe: a.larg != null ? "livre" : a.encaixe };
}

export function escalarAjuste(a: Ajuste, fator: number): Ajuste {
  const f = fator > 0 ? fator : 1;
  if (a.larg != null) return { ...a, larg: arred(limitar(a.larg * f, LARG_MIN, LARG_MAX)), encaixe: "livre" };
  if (a.alt != null) return { ...a, alt: arred(limitar(a.alt * f, ALT_MIN, ALT_MAX)) };
  return a;
}

export function girarAjuste(a: Ajuste): Ajuste {
  return { ...a, rot: (((a.rot || 0) + 90) % 360) as Rotacao };
}

/** Centro que gruda nas guias do meio da área (tolerância na unidade da área). */
export function grudarNoCentro(cx: number, cy: number, W: number, H: number, tol: number): { cx: number; cy: number; guiaV: boolean; guiaH: boolean } {
  const guiaV = Math.abs(cx - W / 2) <= tol;
  const guiaH = Math.abs(cy - H / 2) <= tol;
  return { cx: guiaV ? W / 2 : cx, cy: guiaH ? H / 2 : cy, guiaV, guiaH };
}

/** O item sob o ponto (unidade da área). Texto ganha de imagem (fica por cima). */
export function itemNoPonto(itens: ItemDaArte[], x: number, y: number, folga = 0): ItemDaArte | null {
  for (let i = itens.length - 1; i >= 0; i--) {
    const c = caixaDoItem(itens[i]);
    if (x >= c.x - folga && x <= c.x + c.w + folga && y >= c.y - folga && y <= c.y + c.h + folga) return itens[i];
  }
  return null;
}

// ── Avisos ───────────────────────────────────────────────────

export type AvisoDaArte =
  | { tipo: "cortada"; campo: string }
  | { tipo: "margem"; campo: string }
  | { tipo: "nitidez"; campo: string; dpi: number; faixa: Nitidez; nitidaAteCm: number }
  /** DTF com arte de fundo branco chapado (medido no navegador, fora deste módulo). */
  | { tipo: "fundo"; campo: string };

/**
 * O que a cliente precisa saber antes de comprar:
 * - parte da arte fora da área (não é impressa) — exceto no Preencher,
 *   que corta de propósito;
 * - arte encostada na borda (menos que a margem de segurança);
 * - imagem que, no tamanho escolhido, fica abaixo de 100 dpi (só aviso:
 *   DEC-11, a triagem é da loja).
 */
export function avisosDaArte(itens: ItemDaArte[], W: number, H: number, emCm: boolean): AvisoDaArte[] {
  const out: AvisoDaArte[] = [];
  const tol = Math.min(W, H) * 0.005;
  const m = margemDaArea(W, H, emCm);
  for (const it of itens) {
    const c = caixaDoItem(it);
    const preenche = it.tipo === "imagem" && it.encaixe === "preencher";
    const fora = c.x < -tol || c.y < -tol || c.x + c.w > W + tol || c.y + c.h > H + tol;
    if (fora && !preenche) out.push({ tipo: "cortada", campo: it.campo });
    else if (!fora && !preenche && (c.x < m - tol || c.y < m - tol || W - c.x - c.w < m - tol || H - c.y - c.h < m - tol)) {
      out.push({ tipo: "margem", campo: it.campo });
    }
    if (it.tipo === "imagem" && it.arquivo && emCm) {
      const d = dpiEfetivo(it.arquivo.w, it.w);
      const f = faixaDeNitidez(d);
      if (d != null && f === "ruim") out.push({ tipo: "nitidez", campo: it.campo, dpi: Math.round(d), faixa: f, nitidaAteCm: larguraNitidaCm(it.arquivo.w) });
    }
  }
  return out;
}

/** "8,4 × 6,3 cm" */
export function textoDasMedidas(w: number, h: number): string {
  const f = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
  return `${f(w)} × ${f(h)} cm`;
}

// ── A área do produto dentro da área do motor ────────────────

export type Ret = { x: number; y: number; w: number; h: number };

/**
 * Onde a área do PRODUTO (cm do cadastro) cai dentro do retângulo da área
 * do MOTOR (painel da caneca, frente da camiseta, quad da foto). Com as
 * duas em cm, em escala física, centralizada (um cadastro de 8 × 8 cm no
 * painel de 20 × 9 cm da caneca ocupa 8/20 da largura); sem cm no motor,
 * a proporção do produto encaixada no retângulo. Sem isso a arte seria
 * esticada até o retângulo do motor.
 */
export function subAreaNoRetangulo(
  rect: Ret,
  areaCm: { w: number; h: number } | null,
  areaCmDoMotor: { w: number; h: number } | null,
  /**
   * false = a área do produto pode passar do retângulo do motor. É o caso
   * do 3D: a textura continua em volta (uma área de 20 cm na caneca cujo
   * painel do modelo tem 9 cm dá a volta, como na peça de verdade). No 2D
   * o retângulo é o que a foto mostra, então a área encolhe para caber.
   */
  encolher = true,
  /**
   * Quanto um pixel da textura vale na horizontal em relação à vertical,
   * na peça de verdade (caneca: a textura dá a volta no cilindro e sobe a
   * altura dele, então o pixel não é quadrado). Com ele, a escala vem da
   * ALTURA do motor e a largura segue a peça — a arte redonda sai redonda
   * mesmo quando o cm do modelo não bate com a geometria.
   */
  pixel?: number | null,
): Ret {
  if (!areaCm || !(areaCm.w > 0) || !(areaCm.h > 0) || !(rect.w > 0) || !(rect.h > 0)) return rect;
  let sw: number, sh: number;
  if (pixel && pixel > 0 && areaCmDoMotor && areaCmDoMotor.h > 0) {
    const porCmY = rect.h / areaCmDoMotor.h;
    sw = areaCm.w * porCmY * pixel;
    sh = areaCm.h * porCmY;
    if (encolher) {
      const k = Math.min(1, rect.w / sw, rect.h / sh);
      sw *= k; sh *= k;
    }
  } else if (areaCmDoMotor && areaCmDoMotor.w > 0 && areaCmDoMotor.h > 0) {
    // Escala UNIFORME (px por cm igual nos dois eixos): quando o retângulo
    // da vista não tem a proporção dos cm do modelo (a camiseta vetorial
    // de 28 × 35 cm desenhada em 290 × 330 px), a escala por eixo
    // esticava a arte — a foto redonda saía oval.
    const porCm = Math.min(rect.w / areaCmDoMotor.w, rect.h / areaCmDoMotor.h);
    sw = areaCm.w * porCm;
    sh = areaCm.h * porCm;
    const k = encolher ? Math.min(1, rect.w / sw, rect.h / sh) : 1;
    sw *= k; sh *= k;
  } else {
    const k = Math.min(rect.w / areaCm.w, rect.h / areaCm.h);
    sw = areaCm.w * k; sh = areaCm.h * k;
  }
  return { x: rect.x + (rect.w - sw) / 2, y: rect.y + (rect.h - sh) / 2, w: sw, h: sh };
}

/** A arte com a medida do motor quando o produto não tem a sua. */
export function comAreaDoMotor(arte: ArteDoLado, a: { w: number; h: number } | null | undefined): ArteDoLado {
  if (arte.areaCm || !a || !(a.w > 0) || !(a.h > 0)) return arte;
  return { ...arte, areaCm: { w: a.w, h: a.h } };
}

/**
 * O ponteiro (fração da área do motor: u na largura, v na altura) na
 * unidade da área da arte — o mesmo caminho que o pintor faz, ao contrário.
 * `aspecto` = altura ÷ largura do retângulo do motor (em px).
 */
export function pontoNaAreaDaArte(
  u: number,
  v: number,
  arte: Pick<ArteDoLado, "areaCm">,
  areaCmDoMotor: { w: number; h: number } | null,
  aspecto: number,
  encolher = true,
  pixel?: number | null,
): { x: number; y: number; W: number; H: number; emCm: boolean; porU: number } {
  const rect = { x: 0, y: 0, w: 1, h: aspecto > 0 ? aspecto : 1 };
  const base = arte.areaCm ? arte.areaCm : areaCmDoMotor && areaCmDoMotor.w > 0 && areaCmDoMotor.h > 0 ? areaCmDoMotor : null;
  const sub = base ? subAreaNoRetangulo(rect, base, areaCmDoMotor, encolher, pixel) : rect;
  const { W, H, emCm } = base ? { W: base.w, H: base.h, emCm: true } : { W: rect.w, H: rect.h, emCm: false };
  // porU: quanto a unidade da área anda para 1,0 de u (para medir a folga
  // do toque em pixels de tela).
  return { x: ((u * rect.w - sub.x) / sub.w) * W, y: ((v * rect.h - sub.y) / sub.h) * H, W, H, emCm, porU: W / sub.w };
}
