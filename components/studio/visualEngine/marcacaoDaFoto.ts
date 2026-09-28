// ============================================================
// AURA STUDIO · visualEngine/marcacaoDaFoto — regras da ferramenta
// "Mockup na foto" do painel (aba Personalização)
//
// Tudo o que a tela decide sem precisar de tela: quais fotos o produto
// oferece, onde nasce o quadrilátero, como uma alça se move, quando a
// marcação pode ser salva e o que exatamente vai para
// `customization_config.mockup_foto`. A tela só desenha e repassa gesto.
//
// O quad aqui é NORMALIZADO (0..1 da largura e da altura da foto), o
// mesmo formato gravado — ver MockupFotoLado em studioVisualApi.ts.
//
// 28/09/2026
// ============================================================
import type { CustomizationConfig } from "@/services/studioApi";
import type { MockupFoto, MockupFotoLado, VisualPoint, VisualQuad } from "@/services/studioVisualApi";
import { areaDoQuad, quadValido } from "./compose2d";
import { FORCA_PADRAO_DO_SOMBREADO, type LadoDaPeca } from "./specDaFotoDoProduto";

/** Casas decimais do quad gravado: 0,0001 da foto é menos de 1 px até 10 mil px. */
const CASAS = 4;
/** Menor área marcável (fração da foto): abaixo disso a arte vira um borrão. */
export const AREA_MINIMA_DO_QUAD = 0.0004;
/** Passo das setas do teclado, em fração da foto; com Shift, o grande. */
export const PASSO_DO_TECLADO = 0.005;
export const PASSO_GRANDE_DO_TECLADO = 0.025;

export type RascunhoDoLado = {
  photo_url: string | null;
  quad: VisualQuad | null;   // normalizado
  forca: number;             // 0..1
  w: number | null;          // tamanho natural da foto
  h: number | null;
};

/**
 * As fotos que a lojista pode marcar: a capa (`image_url`) e a galeria
 * (`gallery_urls`, até 5 no R2), sem repetir — o backend espelha a capa
 * no índice 0 da galeria, então quase sempre ela vem duas vezes.
 */
export function fotosDoProduto(
  imageUrl: string | null | undefined,
  galleryUrls: ReadonlyArray<string | null | undefined> | null | undefined
): string[] {
  const out: string[] = [];
  for (const u of [imageUrl, ...(galleryUrls || [])]) {
    const s = typeof u === "string" ? u.trim() : "";
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function arred(n: number): number {
  const f = 10 ** CASAS;
  return Math.round(n * f) / f;
}

function limitar(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Onde o quadrilátero nasce: um retângulo no peito com a proporção da
 * área de impressão cadastrada (em cm), levando em conta que a foto não
 * é quadrada — 28×32 cm tem de parecer 28×32 na foto, não na tela.
 */
export function quadInicial(
  lado: LadoDaPeca,
  foto: { w: number; h: number },
  areaCm: { width_cm: number; height_cm: number }
): VisualQuad {
  const aspecto = foto.h > 0 && foto.w > 0 ? foto.h / foto.w : 1;
  const razao = areaCm.width_cm > 0 && areaCm.height_cm > 0 ? areaCm.height_cm / areaCm.width_cm : 1;
  let w = 0.34;
  let h = (w * razao) / aspecto;
  if (h > 0.6) { w = w * (0.6 / h); h = 0.6; }
  const x = (1 - w) / 2;
  const y = Math.min(lado === "front" ? 0.29 : 0.25, 0.95 - h);
  return [
    { x: arred(x), y: arred(y) },
    { x: arred(x + w), y: arred(y) },
    { x: arred(x + w), y: arred(y + h) },
    { x: arred(x), y: arred(y + h) },
  ];
}

/** Move um canto, sem deixá-lo sair da foto. Devolve um quad novo. */
export function moverCanto(q: VisualQuad, i: number, dx: number, dy: number): VisualQuad {
  const out = q.map((p) => ({ ...p })) as VisualQuad;
  out[i] = { x: limitar(q[i].x + dx), y: limitar(q[i].y + dy) };
  return out;
}

/** O canto numa posição absoluta (arraste: posição do início + deslocamento). */
export function cantoEm(q: VisualQuad, i: number, p: VisualPoint): VisualQuad {
  const out = q.map((c) => ({ ...c })) as VisualQuad;
  out[i] = { x: limitar(p.x), y: limitar(p.y) };
  return out;
}

/** Passo das setas: Shift acelera. */
export function passoDaTecla(tecla: string, shift: boolean): { dx: number; dy: number } | null {
  const p = shift ? PASSO_GRANDE_DO_TECLADO : PASSO_DO_TECLADO;
  switch (tecla) {
    case "ArrowLeft": return { dx: -p, dy: 0 };
    case "ArrowRight": return { dx: p, dy: 0 };
    case "ArrowUp": return { dx: 0, dy: -p };
    case "ArrowDown": return { dx: 0, dy: p };
    default: return null;
  }
}

/**
 * Pode salvar? Convexo, sem cantos cruzados, dentro da foto e com área
 * de verdade. A convexidade não muda ao escalar, então dá para medir no
 * espaço normalizado (×1000 só para o limiar de área do motor valer).
 */
export function quadDaFotoValido(q: unknown): q is VisualQuad {
  if (!Array.isArray(q) || q.length !== 4) return false;
  if (!q.every((p: any) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) {
    return false;
  }
  const escalado = (q as VisualQuad).map((p) => ({ x: p.x * 1000, y: p.y * 1000 })) as VisualQuad;
  if (!quadValido(escalado)) return false;
  return Math.abs(areaDoQuad(q as VisualQuad)) >= AREA_MINIMA_DO_QUAD;
}

/** O rascunho de um lado a partir do que está gravado. */
export function rascunhoDoGravado(e: MockupFotoLado | null | undefined): RascunhoDoLado {
  if (!e || typeof e !== "object" || typeof e.photo_url !== "string" || !e.photo_url) {
    return { photo_url: null, quad: null, forca: FORCA_PADRAO_DO_SOMBREADO, w: null, h: null };
  }
  const f = Number(e.shading);
  return {
    photo_url: e.photo_url,
    quad: Array.isArray(e.quad) && e.quad.length === 4 ? (e.quad.map((p) => ({ x: Number(p.x), y: Number(p.y) })) as VisualQuad) : null,
    forca: e.shading === undefined || e.shading === null || !Number.isFinite(f) ? FORCA_PADRAO_DO_SOMBREADO : limitar(f),
    w: Number(e.w) > 0 ? Number(e.w) : null,
    h: Number(e.h) > 0 ? Number(e.h) : null,
  };
}

/** O que vai para o banco de um lado, ou null se ainda não dá para salvar. */
export function ladoParaGravar(r: RascunhoDoLado): MockupFotoLado | null {
  if (!r.photo_url || !quadDaFotoValido(r.quad)) return null;
  const out: MockupFotoLado = {
    photo_url: r.photo_url,
    quad: r.quad.map((p) => ({ x: arred(p.x), y: arred(p.y) })) as VisualQuad,
    shading: arred(limitar(r.forca)),
  };
  if (r.w && r.h) { out.w = Math.round(r.w); out.h = Math.round(r.h); }
  return out;
}

/**
 * A config com o lado novo dentro de `mockup_foto`, preservando os
 * outros lados como estavam gravados. Só o lado salvo muda: a lojista
 * salva um lado de cada vez.
 */
export function configComLado(
  cfg: CustomizationConfig,
  lado: LadoDaPeca,
  gravado: MockupFotoLado
): CustomizationConfig {
  const atual: MockupFoto = ((cfg as any).mockup_foto && typeof (cfg as any).mockup_foto === "object")
    ? (cfg as any).mockup_foto
    : {};
  return { ...cfg, mockup_foto: { ...atual, [lado]: gravado } } as CustomizationConfig;
}

/** Os dois lados são a mesma marcação (para saber se há o que salvar)? */
export function mesmaMarcacao(a: MockupFotoLado | null | undefined, b: MockupFotoLado | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return JSON.stringify([a.photo_url, a.quad, a.shading ?? null]) ===
    JSON.stringify([b.photo_url, b.quad, b.shading ?? null]);
}
