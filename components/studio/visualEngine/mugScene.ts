// ============================================================
// components/studio/visualEngine/mugScene.ts
// 04/09/2026 — os números da cena "foto de estúdio", sem three.js.
//
// POR QUE ESTE ARQUIVO EXISTE: o mockup 3D era um cilindro sobre um
// fundo chapado, sem chão, sem sombra e sem reflexo. Para parecer foto
// de produto a cena ganhou fundo em gradiente, chão com sombra de
// contato, luz de três pontos e um mapa de ambiente. Tudo o que é
// aritmética pura — paleta do fundo, altura do chão, distância da
// câmera, raio da sombra — fica aqui, onde dá para testar com Jest.
// O three.js só existe no web (CDN, ver threeLoader.ts), então o que
// depende dele fica em compose3dMug.ts e é conferido olhando.
// ============================================================
import type { MugAccessories, MugGeometry } from "./mugGeometry";

// A câmera do viewer: campo de visão vertical fixo desde o F4. Mudar o
// FOV muda a perspectiva da arte na caneca, então a distância é que
// se ajusta ao modelo, nunca o ângulo.
export const CAMERA_FOV_GRAUS = 32;

/** A distância que a câmera sempre teve; canecas do tamanho padrão continuam nela. */
export const CAMERA_DISTANCIA_PADRAO = 6.6;

// Fração da altura visível que o modelo ocupa quando a câmera precisa
// se afastar. É a mesma fração que a caneca padrão (altura 2.3) ocupa
// a 6.6 de distância, para a Chopp não parecer menor que a Branca só
// porque a câmera recuou.
const OCUPACAO_VERTICAL = 2.3 / (2 * CAMERA_DISTANCIA_PADRAO * Math.tan((CAMERA_FOV_GRAUS / 2) * Math.PI / 180));

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}

/** Mistura `a` com `b` na proporção `t` (0 = só a, 1 = só b). Cor inválida devolve `a`. */
export function mixHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return a;
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex(
    ra[0] + (rb[0] - ra[0]) * k,
    ra[1] + (rb[1] - ra[1]) * k,
    ra[2] + (rb[2] - ra[2]) * k,
  );
}

/**
 * Cor CSS com alfa, para o fundo da textura das canecas de vidro: o
 * corpo fica translúcido mas a arte (adesivo) continua opaca. Antes a
 * opacidade era do material inteiro e apagava a arte junto com o vidro.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
  if (!rgb) return hex;
  return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
}

export type BackdropPalette = { top: string; bottom: string; glow: string };

/**
 * Gradiente do fundo a partir de uma cor base: papel claro em cima,
 * escurecendo suavemente para baixo (como o ciclorama de um estúdio),
 * com um halo claro atrás da caneca. A base padrão combina com a
 * vitrine (#FBF8F3) para o mockup não parecer um quadro colado.
 */
export function backdropPalette(backdrop: string): BackdropPalette {
  const base = hexToRgb(backdrop) ? backdrop.trim() : "#FBF8F3";
  return {
    top: mixHex(base, "#FFFFFF", 0.4),
    bottom: mixHex(base, "#B7AC9C", 0.24),
    glow: "#FFFFFF",
  };
}

/** Altura total do que está em cena, do chão ao ponto mais alto. */
export function alturaDaCena(g: MugGeometry, a: MugAccessories): number {
  // O pires fica abaixo da base; a colher aponta acima da borda.
  const abaixo = a.saucer ? g.body.height * 0.13 : 0;
  const acima = a.spoon ? g.body.height * 0.3 : 0;
  return g.body.height + abaixo + acima;
}

/**
 * Distância da câmera: a de sempre para a caneca padrão, mais longe só
 * quando o modelo é alto demais para caber (Chopp). Nunca mais perto —
 * aproximar mudaria a leitura da arte que a lojista já aprovou.
 */
export function cameraDistance(g: MugGeometry, a: MugAccessories): number {
  const visivelPorUnidade = 2 * Math.tan((CAMERA_FOV_GRAUS / 2) * Math.PI / 180);
  const ideal = alturaDaCena(g, a) / (visivelPorUnidade * OCUPACAO_VERTICAL);
  return Math.max(CAMERA_DISTANCIA_PADRAO, Math.round(ideal * 100) / 100);
}

/** O y do chão: a base da caneca, ou a do pires quando existe. */
export function floorLevel(g: MugGeometry, a: MugAccessories): number {
  const base = -g.body.height / 2;
  return a.saucer ? base - g.body.height * 0.13 : base;
}

/**
 * Raio da sombra de contato — a mancha macia sob a peça. Um pouco
 * maior que a base, porque a luz vem de cima e de lado e a alça também
 * projeta. Com pires, a mancha segue o pires.
 */
export function contactShadowRadius(g: MugGeometry, a: MugAccessories): number {
  if (a.saucer) return g.body.topRadius * 1.95 * 1.15;
  return Math.max(g.body.bottomRadius, g.body.topRadius) * 1.35;
}
