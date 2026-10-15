// ============================================================================
// AURA. — Etiquetas: "Minha medida" (medida livre em mm) — 15/10/2026
//
// Mockup aprovado pelo Caio: docs/mockups/etiqueta-self-service.html. O
// lojista informa largura e altura da etiqueta em mm, quantas etiquetas lado
// a lado, o espaço entre elas e ganha um ajuste horizontal e vertical da
// impressão. Vale para todos os planos (é do Estoque, sem gate novo).
//
// Este módulo é puro: o spec, os limites, a sanitização e a conversão do
// spec num preset equivalente aos fixos de LABEL_SIZE_PRESETS. A etiqueta
// sai pelo MESMO buildLabelHtml (mesmo .bc-box, mesmo SVG, mesmo
// BARCODE_OPTS, LOCKED). Os modelos fixos não passam por aqui: o HTML deles
// é cobrado byte a byte por __tests__/etiquetasDouradas.test.ts.
//
// Desenho do conteúdo (escolha documentada, pedido do brief): a medida livre
// usa o desenho "editorial" (o do 105x21 e do 40x25) — nome inteiro em até 2
// linhas, selo de tamanho/cor ao lado do preço e o código de barras no
// rodapé, com o script de ajuste automático que encolhe nome e selo quando
// não cabem. Por proporção:
//   - etiqueta com 35 mm ou mais de largura e 25 mm ou mais de altura usa o
//     "compacto" (mais respiro em volta do texto, o do 40x25);
//   - menor que isso, o editorial justo (o do 33x21);
//   - etiqueta maior que 33x21 ganha texto proporcionalmente maior
//     (escalaTexto, até 1,8x), limitado pela altura que sobra para o código
//     de barras não ser espremido. O código de barras NUNCA escala: segue o
//     BARCODE_OPTS (LOCKED), lido pela pistola.
// ============================================================================
import type { LabelPreset } from "@/components/screens/estoque/labels/buildLabelHtml";

export type CustomLabelSpec = {
  id: string;
  larguraMm: number;
  alturaMm: number;
  /** Etiquetas lado a lado no rolo (1 a 3). */
  colunas: number;
  /** Faixa de papel entre duas etiquetas lado a lado. Só vale com 2 ou 3 colunas. */
  espacoLadoMm: number;
  /** Faixa de papel entre uma linha de etiquetas e a próxima. */
  espacoLinhaMm: number;
  /** Ajuste da impressão: + para a direita, − para a esquerda. */
  ajusteXMm: number;
  /** Ajuste da impressão: + para baixo, − para cima. */
  ajusteYMm: number;
  /** 15/10/2026: nome opcional na lista ("40x25 balcão"), até 40 caracteres.
   *  Serve para a loja com duas impressoras que erram diferente ter duas
   *  medidas do mesmo tamanho. Não entra na etiqueta impressa. */
  nome?: string;
};

export const NOME_MEDIDA_MAX = 40;

export const MEDIDA_LIMITES = {
  larguraMm: [15, 110] as const,
  alturaMm: [10, 80] as const,
  colunas: [1, 3] as const,
  espacoMm: [0, 10] as const,
  ajusteMm: 8,
};

/** Valores de partida (mockup): 50x30, 1 por linha, 3 mm lado a lado e
 *  2 mm de cima para baixo ("Não sei, usar o padrão"), sem ajuste. */
export const MEDIDA_PADRAO = {
  larguraMm: 50, alturaMm: 30, colunas: 1, espacoLadoMm: 3, espacoLinhaMm: 2, ajusteXMm: 0, ajusteYMm: 0,
};

/** Abaixo desta largura o código de barras (LOCKED, ~28 mm) é encolhido
 *  para caber e a pistola pode não ler. */
export const LARGURA_MIN_CODIGO_MM = 25;

function round1(n: number): number {
  var r = Math.round(n * 10) / 10;
  return r === 0 ? 0 : r; // sem -0
}
function round2(n: number): number { return Math.round(n * 100) / 100; }

function numero(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v.trim().replace(",", "."));
  return NaN;
}

/** Valor dentro da faixa, em décimos; fora da faixa volta ao limite; lixo
 *  vira o padrão. */
export function naFaixa(v: any, lo: number, hi: number, padrao: number): number {
  var n = numero(v);
  if (!Number.isFinite(n)) return padrao;
  return round1(Math.min(hi, Math.max(lo, n)));
}

/** Normaliza um spec vindo do navegador ou da tela. Devolve null para lixo
 *  (não é objeto, sem id, largura ou altura que não são número). */
export function sanitizarMedida(raw: any): CustomLabelSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  var id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id || id.length > 64) return null;
  if (!Number.isFinite(numero(raw.larguraMm)) || !Number.isFinite(numero(raw.alturaMm))) return null;
  var L = MEDIDA_LIMITES;
  var cols = numero(raw.colunas);
  var nome = typeof raw.nome === "string" ? raw.nome.trim().slice(0, NOME_MEDIDA_MAX).trim() : "";
  var spec: CustomLabelSpec = {
    id: id,
    larguraMm: naFaixa(raw.larguraMm, L.larguraMm[0], L.larguraMm[1], MEDIDA_PADRAO.larguraMm),
    alturaMm: naFaixa(raw.alturaMm, L.alturaMm[0], L.alturaMm[1], MEDIDA_PADRAO.alturaMm),
    colunas: Number.isFinite(cols) ? Math.min(L.colunas[1], Math.max(L.colunas[0], Math.round(cols))) : MEDIDA_PADRAO.colunas,
    espacoLadoMm: naFaixa(raw.espacoLadoMm, L.espacoMm[0], L.espacoMm[1], MEDIDA_PADRAO.espacoLadoMm),
    espacoLinhaMm: naFaixa(raw.espacoLinhaMm, L.espacoMm[0], L.espacoMm[1], MEDIDA_PADRAO.espacoLinhaMm),
    ajusteXMm: naFaixa(raw.ajusteXMm, -L.ajusteMm, L.ajusteMm, 0),
    ajusteYMm: naFaixa(raw.ajusteYMm, -L.ajusteMm, L.ajusteMm, 0),
  };
  // Só com nome de verdade: sem nome o spec fica idêntico ao de antes.
  if (nome) spec.nome = nome;
  return spec;
}

/** Id novo para uma medida (só precisa ser único neste navegador). */
export function novoIdMedida(): string {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** "50", "50,5" — mm em décimos com vírgula, sem ",0". */
export function mmTxt(n: number): string {
  var r = round1(n);
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

/** Nome no seletor de modelo: "Minha etiqueta 50 x 30 mm". */
export function nomeDaMedida(spec: Pick<CustomLabelSpec, "larguraMm" | "alturaMm">): string {
  return "Minha etiqueta " + mmTxt(spec.larguraMm) + " x " + mmTxt(spec.alturaMm) + " mm";
}

/** Nome na lista de modelos: o nome que a loja deu ("40x25 balcão") ou,
 *  sem nome, "Minha etiqueta 50 x 30 mm". */
export function rotuloDaMedida(spec: Pick<CustomLabelSpec, "larguraMm" | "alturaMm" | "nome">): string {
  var nome = typeof spec.nome === "string" ? spec.nome.trim() : "";
  return nome || nomeDaMedida(spec);
}

/** Aviso (não bloqueia): com menos de 25 mm de largura o código de barras
 *  não cabe no tamanho em que a pistola lê. */
export function etiquetaPequenaDemais(spec: Pick<CustomLabelSpec, "larguraMm">): boolean {
  return Number(spec.larguraMm) < LARGURA_MIN_CODIGO_MM;
}

/** Escala do texto em relação ao desenho base de 33x21 mm: nunca menor que 1
 *  (etiqueta pequena conta com o ajuste automático que encolhe), no máximo
 *  1,8, e limitada pela altura — o bloco de texto cresce ~9,9 mm por 1x e o
 *  código de barras com os números precisa de ~11 mm com as margens. */
export function escalaTexto(spec: Pick<CustomLabelSpec, "larguraMm" | "alturaMm">): number {
  var k = Math.min(spec.larguraMm / 33, (spec.alturaMm - 11) / 9.9);
  k = Math.min(1.8, Math.max(1, k));
  return Math.round(k * 20) / 20;
}

export type CustomLabelPreset = LabelPreset & {
  ajusteXMm: number;
  ajusteYMm: number;
  escalaTexto: number;
};

/** O spec vira um preset equivalente aos fixos: página = colunas × largura +
 *  espaços entre colunas; linha (passo) = altura + espaço entre linhas; uma
 *  linha por página (como os rolos de etiqueta com vão: 99x21, 105x21,
 *  30x25). Spec inválido cai no padrão. */
export function customLabelPreset(spec: CustomLabelSpec): CustomLabelPreset {
  var s = sanitizarMedida(spec) || (sanitizarMedida({ ...MEDIDA_PADRAO, id: "padrao" }) as CustomLabelSpec);
  var w = s.larguraMm, h = s.alturaMm, cols = s.colunas;
  var gapX = cols > 1 ? s.espacoLadoMm : 0;
  var preset: CustomLabelPreset = {
    pageWidthMm: round2(cols * w + (cols - 1) * gapX),
    pageHeightMm: round2(h + s.espacoLinhaMm),
    cols: cols,
    cellWidthMm: w,
    cellHeightMm: h,
    design: "editorial",
    uiLabel: nomeDaMedida(s),
    ajusteXMm: s.ajusteXMm,
    ajusteYMm: s.ajusteYMm,
    escalaTexto: escalaTexto(s),
  };
  if (gapX > 0) preset.colGapMm = gapX;
  if (s.espacoLinhaMm > 0) preset.rowGapMm = s.espacoLinhaMm;
  if (w >= 35 && h >= 25) preset.edCompact = true;
  return preset;
}
