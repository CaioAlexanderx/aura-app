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

// ============================================================
// 28/09/2026 — o cenário: um estúdio de produto para caneca e camiseta
//
// O fundo era uma textura 2D em gradiente colada atrás da peça — a
// sombra caía num chão invisível e a peça flutuava num quadro. Agora há
// um ciclorama de verdade (chão que sobe em curva e vira parede), que
// recebe as mesmas luzes e sombras da peça. As cores e as curvas ficam
// aqui, sem three.js, para o Jest conferir que o claro continua claro,
// o escuro continua escuro e a peça sempre se separa do fundo.
// ============================================================

/**
 * O ângulo de chegada para ir de `atual` a `alvo` pelo caminho mais
 * curto (em radianos): os chips Frente/Costas levam a um ângulo
 * absoluto, e a peça não deve dar uma volta inteira quando meia basta.
 * Devolve um valor congruente com `alvo` (mod 2π), a no máximo π de
 * `atual`.
 */
export function giroMaisCurto(atual: number, alvo: number): number {
  const volta = Math.PI * 2;
  const diff = (((alvo - atual) % volta) + volta * 1.5) % volta - Math.PI;
  return atual + diff;
}

/** Luminância relativa (0 = preto, 1 = branco), a mesma conta do tema da vitrine. */
export function luminancia(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const canal = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * canal(rgb[0]) + 0.7152 * canal(rgb[1]) + 0.0722 * canal(rgb[2]);
}

export type CenarioPalette = {
  /** O papel do ciclorama no ponto mais claro (o chão junto da peça). */
  base: string;
  /** A cor que sobra fora do ciclorama (scene.background). */
  fundo: string;
  /** Tema escuro: o halo atrás da peça clareia em vez de a sombra escurecer. */
  escuro: boolean;
  /** Quanto o halo atrás da peça multiplica a base (1 = nada). */
  halo: number;
  /** Quanto as bordas do quadro escurecem (0 = nada, 0.4 = 40% mais escuro). */
  vinheta: number;
  /** Quanto a parede escurece do pé ao topo do quadro. */
  queda: number;
  /** Opacidade da sombra projetada no chão. */
  sombra: number;
};

/**
 * A paleta do ciclorama a partir do fundo da página.
 *
 * O ciclorama NÃO é iluminado pelas luzes da cena: a cor é assada por
 * vértice (brilhoDoCiclorama) e desenhada sem tone mapping, para o papel
 * junto da peça ser exatamente o papel da página — uma luz de verdade
 * passaria pela curva de filme e o papel da vitrine viraria bege escuro.
 * A sombra da peça cai por cima, num receptor separado.
 *
 * Claro (o papel quente da vitrine): o chão junto da peça é o papel da
 * página, e o quadro escurece de leve para as bordas e para o alto, com
 * uma vinheta suave. Escuro: um cinza-azulado um degrau acima do fundo
 * da página (a peça preta precisa de algo atrás que não seja preto), com
 * um halo atrás da peça que faz o trabalho de uma luz de fundo. Cor
 * inválida cai no papel da vitrine.
 */
export function cenarioPalette(backdrop: string): CenarioPalette {
  const base = hexToRgb(backdrop) ? backdrop.trim() : "#FBF8F3";
  if (luminancia(base) < 0.35) {
    return {
      base: mixHex(base, "#8E97BD", 0.16),
      fundo: mixHex(base, "#000000", 0.4),
      escuro: true,
      halo: 2.1,
      vinheta: 0.5,
      queda: 0.45,
      sombra: 0.55,
    };
  }
  return {
    base: mixHex(base, "#B7AC9C", 0.03),
    fundo: mixHex(base, "#B7AC9C", 0.3),
    escuro: false,
    halo: 1.03,
    vinheta: 0.13,
    queda: 0.14,
    sombra: 0.26,
  };
}

/** As medidas do ciclorama, em unidades da cena (a caneca tem altura 2.3). */
export const CICLORAMA = {
  /** Meia-largura em x. */
  meiaLargura: 24,
  /** Onde o chão começa, na frente da câmera (z positivo). */
  frente: 9,
  /** Onde o chão termina e a curva começa (z negativo). */
  fimDoChao: -2.4,
  /** Raio da curva chão→parede. */
  raio: 2.6,
  /** Altura da parede acima da curva. */
  parede: 16,
} as const;

/**
 * O perfil do ciclorama no plano YZ, por um parâmetro t de 0 (borda da
 * frente do chão) a 1 (topo da parede): chão plano, quarto de círculo e
 * parede vertical, com o comprimento de cada trecho proporcional ao seu
 * comprimento real, para a malha ter densidade uniforme.
 */
export function perfilDoCiclorama(t: number): { y: number; z: number } {
  const C = CICLORAMA;
  const chao = C.frente - C.fimDoChao;
  const curva = (Math.PI / 2) * C.raio;
  const total = chao + curva + C.parede;
  const s = Math.max(0, Math.min(1, t)) * total;
  if (s <= chao) return { y: 0, z: C.frente - s };
  if (s <= chao + curva) {
    const a = (s - chao) / C.raio; // 0 = chão, π/2 = parede
    return { y: C.raio - C.raio * Math.cos(a), z: C.fimDoChao - C.raio * Math.sin(a) };
  }
  return { y: C.raio + (s - chao - curva), z: C.fimDoChao - C.raio };
}

/**
 * Quanto cada ponto do ciclorama brilha (multiplica a cor base): uma
 * vinheta que escurece longe do centro do quadro, e um halo atrás da
 * peça — a mancha de uma luz de fundo, sem uma luz de verdade (uma
 * SpotLight apontada para a parede também bateria na peça). No claro o
 * halo é sutil; no escuro é o que descola a peça preta do fundo.
 */
export function brilhoDoCiclorama(x: number, y: number, z: number, p: Pick<CenarioPalette, "halo" | "vinheta" | "queda">): number {
  const C = CICLORAMA;
  const naParede = z <= C.fimDoChao;
  // A parede escurece do pé ao topo (a luz vem de cima e da frente e não
  // alcança o alto do fundo); o chão escurece de leve para a frente da câmera.
  const alturaVisivel = 5.5;
  const queda = naParede ? p.queda * Math.min(1, Math.max(0, y / alturaVisivel)) : p.queda * 0.35 * Math.min(1, (z - C.fimDoChao) / (C.frente - C.fimDoChao));
  // Vinheta lateral: mais escuro longe do centro do quadro.
  const dx = x / 7;
  const vinheta = p.vinheta * Math.min(1, dx * dx);
  // A luz principal vem da direita e de cima (+x): esse lado fica um fio mais claro.
  const lado = 0.025 * Math.max(-1, Math.min(1, x / 6));
  // Halo atrás da peça, centrado na parede na altura da peça.
  const dy = naParede ? (y - 1.0) / 3.6 : (C.fimDoChao - z) / 3.6 + 0.35;
  const dh2 = dx * dx * 1.6 + dy * dy;
  const halo = 1 + (p.halo - 1) * Math.exp(-dh2 * 2.6);
  return Math.max(0, (1 - queda - vinheta + lado) * halo);
}
