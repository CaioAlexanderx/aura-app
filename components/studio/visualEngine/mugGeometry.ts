// ============================================================
// components/studio/visualEngine/mugGeometry.ts
// S3 (19/08/2026) — a forma da caneca sai do código e vai para o `spec`.
//
// POR QUE: a `DEC-10` decidiu um template 3D POR MODELO. Isso não é
// semear 9 linhas em studio_visual_templates — a geometria estava fixa
// em compose3dMug.ts (`CylinderGeometry(1, 0.94, 2.3)` e alça
// `TorusGeometry(0.52, 0.11)`), e o `spec` só carregava áreas UV e
// tamanho de textura. Um template não conseguia representar um modelo:
// Chopp (maior e mais cônica), Alça Coração e Com Colher renderizavam
// como a mesma caneca reta genérica — apagando justamente o que se
// vende nas duas últimas.
//
// COMPATIBILIDADE: todos os campos são opcionais e os defaults são
// EXATAMENTE os números que estavam no código. Um `spec` sem bloco de
// geometria — como o `caneca-classica` publicado hoje — renderiza igual
// ao de antes, byte por byte de parâmetro.
//
// As unidades são as do mundo da cena, não centímetros: o corpo padrão
// tem altura 2.3 e raio ~1. Converter para centímetros seria uma segunda
// escala para manter em sincronia com `areas[].width_cm`, sem ganho.
// ============================================================

/**
 * ring = anel redondo; heart = coração; square = "D" de cantos
 * arredondados (a alça da caneca de chopp); none = sem alça.
 */
export type HandleShape = "ring" | "heart" | "square" | "none";

export type MugGeometry = {
  body: {
    topRadius: number; bottomRadius: number; height: number;
    /**
     * Raio do arredondamento da base (0 = cilindro reto, como sempre foi).
     * A Imperial e a Vintage têm a base arredondada na foto; um cilindro
     * de quina viva não passa por nenhuma das duas.
     */
    bottomRound: number;
  };
  rim: { radius: number; tube: number };
  inner: { topRadius: number; bottomRadius: number; height: number };
  handle: {
    shape: HandleShape; radius: number; tube: number; offsetX: number; offsetY: number;
    /**
     * Alça PREENCHIDA (orelha maciça, sem furo) ou VAZADA (anel/coração
     * de tubo, com furo). É diferencial de produto: um coração cheio e
     * um coração de tubo são canecas diferentes na vitrine.
     */
    filled: boolean;
    /**
     * Inclinação da alça em graus, no plano da alça (em torno de Z).
     * A alça de coração das fotos não fica com o bico reto para baixo:
     * o bico entra no corpo embaixo e o vão entre os lóbulos aponta para
     * fora e para cima. Negativo = bico gira para o lado do corpo.
     */
    tilt: number;
  };
};

/** Os números que estavam no código antes do S3 (os campos novos com o valor neutro). */
export const MUG_GEOMETRY_PADRAO: MugGeometry = {
  body:   { topRadius: 1, bottomRadius: 0.94, height: 2.3, bottomRound: 0 },
  rim:    { radius: 0.975, tube: 0.028 },
  inner:  { topRadius: 0.96, bottomRadius: 0.9, height: 2.24 },
  handle: { shape: "ring", radius: 0.52, tube: 0.11, offsetX: 1.02, offsetY: 0, filled: false, tilt: 0 },
};

const HANDLE_SHAPES: HandleShape[] = ["ring", "heart", "square", "none"];

function num(v: any, padrao: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n)) return padrao;
  // Fora de faixa vira o padrão em vez de deformar a cena: um template
  // com raio 0 ou 500 renderizaria algo irreconhecível, e o cliente não
  // tem como saber que o errado é o cadastro.
  if (n < min || n > max) return padrao;
  return n;
}

/**
 * Lê `spec.model.geometry` com os defaults do código.
 *
 * Nunca lança e nunca devolve valor inutilizável: template mal cadastrado
 * cai na caneca padrão, que é sempre melhor do que uma cena quebrada numa
 * loja publicada.
 */
export function readMugGeometry(spec: any): MugGeometry {
  const g = spec?.model?.geometry;
  if (!g || typeof g !== "object") return MUG_GEOMETRY_PADRAO;

  const P = MUG_GEOMETRY_PADRAO;
  const body = g.body || {};
  const rim = g.rim || {};
  const inner = g.inner || {};
  const handle = g.handle || {};

  const forma: HandleShape = HANDLE_SHAPES.includes(handle.shape)
    ? handle.shape
    : P.handle.shape;

  const corpo = {
    topRadius:    num(body.topRadius,    P.body.topRadius,    0.2, 4),
    bottomRadius: num(body.bottomRadius, P.body.bottomRadius, 0.2, 4),
    height:       num(body.height,       P.body.height,       0.5, 8),
    bottomRound:  0,
  };
  // O arredondamento não pode passar do raio da base nem da metade da
  // altura — passaria a ser outra forma, não uma base arredondada.
  corpo.bottomRound = num(
    body.bottomRound, 0, 0, Math.min(corpo.bottomRadius * 0.6, corpo.height * 0.4),
  );

  return {
    body: corpo,
    rim: {
      // A borda acompanha o corpo quando não é declarada: template que
      // muda só o raio do corpo não pode deixar um anel flutuando.
      radius: num(rim.radius, corpo.topRadius - 0.025, 0.2, 4.2),
      tube:   num(rim.tube,   P.rim.tube, 0.005, 0.4),
    },
    inner: {
      topRadius:    num(inner.topRadius,    corpo.topRadius - 0.04,    0.1, 4),
      bottomRadius: num(inner.bottomRadius, corpo.bottomRadius - 0.04, 0.1, 4),
      height:       num(inner.height,       corpo.height - 0.06,       0.4, 8),
    },
    handle: {
      shape:   forma,
      radius:  num(handle.radius,  P.handle.radius,  0.05, 2),
      tube:    num(handle.tube,    P.handle.tube,    0.01, 0.6),
      // A alça encosta no corpo por padrão, qualquer que seja o raio.
      offsetX: num(handle.offsetX, corpo.topRadius + 0.02, 0, 5),
      offsetY: num(handle.offsetY, P.handle.offsetY, -4, 4),
      filled:  handle.filled === true,
      tilt:    num(handle.tilt, P.handle.tilt, -90, 90),
    },
  };
}

/**
 * Perfil do corpo para um LatheGeometry, da base ao topo, com os pontos
 * igualmente espaçados em altura. O espaçamento uniforme importa: o
 * LatheGeometry distribui a coordenada V da textura por índice de ponto,
 * então só assim V continua sendo "fração da altura" — a mesma leitura
 * que o CylinderGeometry fazia, e que as áreas de impressão (uv) assumem.
 *
 * `bottomRound` arredonda a quina da base com um quarto de círculo. Com
 * zero, o perfil é a reta do cilindro de antes.
 */
export function latheProfile(
  body: { topRadius: number; bottomRadius: number; height: number; bottomRound: number },
  steps = 64,
): Array<{ x: number; y: number }> {
  const n = Math.max(2, Math.floor(steps));
  const meia = body.height / 2;
  const pontos: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y = -meia + body.height * t;
    let raio = body.bottomRadius + (body.topRadius - body.bottomRadius) * t;
    if (body.bottomRound > 0) {
      const subida = y + meia; // distância acima da base
      if (subida < body.bottomRound) {
        const k = 1 - subida / body.bottomRound; // 1 na base, 0 no fim da curva
        raio -= body.bottomRound * (1 - Math.sqrt(Math.max(0, 1 - k * k)));
      }
    }
    pontos.push({ x: raio, y });
  }
  return pontos;
}

/**
 * Curva de coração para a alça, em coordenadas de `THREE.Shape`.
 *
 * Devolve os comandos como dado puro para poder ser testado sem three.js
 * — o carregamento é por CDN e só existe no web (threeLoader.ts).
 */
export function heartPath(r: number): Array<
  | { op: "moveTo"; x: number; y: number }
  | { op: "bezierCurveTo"; c1x: number; c1y: number; c2x: number; c2y: number; x: number; y: number }
> {
  const s = r;
  return [
    { op: "moveTo", x: 0, y: -s },
    { op: "bezierCurveTo", c1x: -s * 1.3, c1y: -s * 0.35, c2x: -s * 1.05, c2y: s * 0.85, x: 0, y: s * 0.45 },
    { op: "bezierCurveTo", c1x: s * 1.05, c1y: s * 0.85, c2x: s * 1.3, c2y: -s * 0.35, x: 0, y: -s },
  ];
}

/**
 * Contorno da alça em "D" (caneca de chopp): retângulo de cantos
 * arredondados, mais alto que largo, centrado na origem. Devolve pontos
 * no sentido anti-horário, fechado (o último repete o primeiro), para
 * virar um tubo por CatmullRom ou uma forma extrudada.
 *
 * `r` é a meia-altura; a largura é 70% da altura, como na foto da Chopp.
 */
export function squarePath(r: number, cantos = 6): Array<{ x: number; y: number }> {
  const meiaAltura = r;
  const meiaLargura = r * 0.7;
  const raioCanto = r * 0.32;
  const centros: Array<[number, number, number]> = [
    [meiaLargura - raioCanto, meiaAltura - raioCanto, 0],          // canto superior direito
    [-meiaLargura + raioCanto, meiaAltura - raioCanto, Math.PI / 2], // superior esquerdo
    [-meiaLargura + raioCanto, -meiaAltura + raioCanto, Math.PI],   // inferior esquerdo
    [meiaLargura - raioCanto, -meiaAltura + raioCanto, Math.PI * 1.5], // inferior direito
  ];
  const pontos: Array<{ x: number; y: number }> = [];
  for (const [cx, cy, inicio] of centros) {
    for (let i = 0; i <= cantos; i++) {
      const a = inicio + (Math.PI / 2) * (i / cantos);
      pontos.push({ x: cx + Math.cos(a) * raioCanto, y: cy + Math.sin(a) * raioCanto });
    }
  }
  pontos.push({ ...pontos[0] });
  return pontos;
}

// ============================================================
// S11 — cor e material do MODELO, não da escolha do cliente
//
// Até aqui o `spec` só carregava forma. A cor vinha toda de
// `garmentColor`, que é a escolha do CLIENTE, e pintava corpo, alça,
// borda e fundo de uma vez. Isso apaga o produto:
//
//   - a ALÇA COLORIDA é branca com alça e interior coloridos — só a
//     alça e o interior seguem a escolha, o corpo é sempre branco;
//   - a CHOPP é vidro jateado translúcido, não louça opaca;
//   - a IMPERIAL tem borda e alça douradas metálicas;
//   - a VINTAGE é fosca, sem brilho nenhum.
//
// Então o material passa a ser característica do modelo, e a escolha do
// cliente incide sobre UMA parte declarada — `customer_color_target`.
// ============================================================

export type MugMaterial = {
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  /**
   * Faixa esmaltada no topo do corpo, em fracao da altura (0–0.6).
   * A CANECA VINTAGE FOSCA e branca com uma faixa ocre em cima: sem isso
   * ela renderiza igual a CANECA BRANCA, e o cliente nao ve o que compra.
   * So o corpo tem faixa — alca e interior sao pecas inteiras.
   */
  topBand?: { color: string; height: number } | null;
};

// ── 04/09/2026 — a cor incide PEÇA A PEÇA ────────────────────
// O `accent` amarrava alça, borda, fundo e interior num bloco só, e o
// alvo da cor era um de tres valores. Isso não representa o que a Sheid
// vende: tem caneca de cor só por dentro, só na alça, por dentro e na
// alça, ou por fora. Cada peça passa a ter material próprio e o alvo
// vira uma LISTA de peças. O campo antigo continua aceito e vira a lista
// equivalente, para os templates publicados renderizarem igual.
export type MugPart = "body" | "handle" | "rim" | "bottom" | "interior";

/** O campo antigo, de antes da cor peça a peça. */
export type CustomerColorTarget = "accent" | "body" | "none";

export type MugMaterials = {
  /** Corpo: e o fundo sobre o qual a arte e pintada. */
  body: MugMaterial;
  /** Alça (a colher e o pires acompanham a alça). */
  handle: MugMaterial;
  /** Borda superior. */
  rim: MugMaterial;
  /** Fundo externo (a base). */
  bottom: MugMaterial;
  /** Parede interna. */
  interior: MugMaterial;
  /** Peças onde a cor escolhida pelo cliente incide. Vazio = cor fixa do modelo. */
  customerColorTargets: MugPart[];
};

export const MUG_PARTS: MugPart[] = ["body", "handle", "rim", "bottom", "interior"];

/** O que cada valor do campo antigo significava, em peças. */
export const LEGACY_TARGETS: Record<CustomerColorTarget, MugPart[]> = {
  accent: ["handle", "rim", "bottom", "interior"],
  body: ["body"],
  none: [],
};

// Os valores de antes do S11: louca clara, brilho medio, sem metal.
const LOUCA: MugMaterial = { color: "#F5F2EA", roughness: 0.3, metalness: 0, opacity: 1, topBand: null };
export const MUG_MATERIALS_PADRAO: MugMaterials = {
  body:     { ...LOUCA },
  handle:   { ...LOUCA },
  rim:      { ...LOUCA },
  bottom:   { ...LOUCA },
  interior: { color: "#8A8578", roughness: 0.6, metalness: 0, opacity: 1, topBand: null },
  customerColorTargets: LEGACY_TARGETS.accent,
};

function cor(v: any, padrao: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : padrao;
}

function fator(v: any, padrao: number): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) return padrao;
  return n;
}

function lerFaixa(raw: any): { color: string; height: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const c = typeof raw.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(raw.color.trim())
    ? raw.color.trim() : null;
  const h = typeof raw.height === "number" ? raw.height : parseFloat(raw.height);
  if (!c || !Number.isFinite(h) || h <= 0 || h > 0.6) return null;
  return { color: c, height: h };
}

function lerMaterial(raw: any, padrao: MugMaterial): MugMaterial {
  if (!raw || typeof raw !== "object") return padrao;
  return {
    color: cor(raw.color, padrao.color),
    roughness: fator(raw.roughness, padrao.roughness),
    metalness: fator(raw.metalness, padrao.metalness),
    opacity: fator(raw.opacity, padrao.opacity),
    topBand: raw.top_band !== undefined ? lerFaixa(raw.top_band) : (padrao.topBand ?? null),
  };
}

/**
 * Lê a lista de peças onde a cor do cliente incide.
 *
 * `customer_color_targets` (lista) manda quando existe; senão o campo
 * antigo `customer_color_target` vira a lista equivalente; sem nenhum
 * dos dois vale o padrão de antes (alça, borda, fundo e interior).
 * Peça desconhecida na lista é ignorada — não derruba as outras.
 */
export function readCustomerColorTargets(m: any): MugPart[] {
  if (Array.isArray(m?.customer_color_targets)) {
    const vistos = new Set<MugPart>();
    for (const p of m.customer_color_targets) {
      if (MUG_PARTS.includes(p)) vistos.add(p);
    }
    return Array.from(vistos);
  }
  const antigo = m?.customer_color_target;
  if (typeof antigo === "string" && Object.prototype.hasOwnProperty.call(LEGACY_TARGETS, antigo)) {
    return LEGACY_TARGETS[antigo as CustomerColorTarget];
  }
  return MUG_MATERIALS_PADRAO.customerColorTargets;
}

/**
 * Le `spec.model.materials`. Nunca lanca: template mal cadastrado cai na
 * louca padrao, que e sempre melhor que uma cena quebrada em loja no ar.
 *
 * Herança: alça, borda e fundo herdam de `accent` (o bloco antigo), que
 * herda de `body`. Caneca de uma cor so e o caso comum, e repetir a cor
 * em cinco lugares convida a divergirem; e as specs publicadas com
 * `accent` continuam valendo sem retoque.
 */
export function readMugMaterials(spec: any): MugMaterials {
  const m = spec?.model?.materials;
  if (!m || typeof m !== "object") return MUG_MATERIALS_PADRAO;

  const body = lerMaterial(m.body, MUG_MATERIALS_PADRAO.body);
  const accent = lerMaterial(m.accent, body);
  return {
    body,
    handle: lerMaterial(m.handle, accent),
    rim: lerMaterial(m.rim, accent),
    bottom: lerMaterial(m.bottom, accent),
    interior: lerMaterial(m.interior, MUG_MATERIALS_PADRAO.interior),
    customerColorTargets: readCustomerColorTargets(m),
  };
}

/**
 * Aplica a cor escolhida pelo cliente em cada peça que o modelo declara.
 * Sem escolha, ou com lista vazia, o modelo fica como cadastrado.
 */
export function applyCustomerColor(
  materials: MugMaterials,
  escolha: string | null | undefined
): MugMaterials {
  const c = typeof escolha === "string" && /^#[0-9a-fA-F]{3,8}$/.test(escolha.trim())
    ? escolha.trim()
    : null;
  if (!c || !materials.customerColorTargets.length) return materials;

  const out: MugMaterials = { ...materials };
  for (const parte of materials.customerColorTargets) {
    out[parte] = { ...materials[parte], color: c };
  }
  return out;
}

// ── Acessorios do modelo ─────────────────────────────────────
export type MugAccessories = { spoon: boolean; saucer: boolean };

export function readMugAccessories(spec: any): MugAccessories {
  const a = spec?.model?.accessories;
  return {
    spoon: a?.spoon === true,
    saucer: a?.saucer === true,
  };
}

// ============================================================
// 28/09/2026 — realismo da caneca: lábio, interior e junções da alça
//
// A caneca era um cilindro com um toro fino no topo e uma parede interna
// solta: sem espessura, sem lábio, sem fundo. Aqui fica a aritmética dos
// perfis novos (testável sem three.js); o compose3dMug.ts só transforma
// os pontos em LatheGeometry.
// ============================================================

/**
 * Largura do lábio (a espessura da louça vista de cima): a parede
 * declarada pelo template, ou o dobro do tubo da borda antiga, ou o
 * mínimo de uma louça crível — o que for maior. Sem o mínimo a caneca
 * padrão (parede 0.04) teria um fio de borda, como antes.
 */
export function larguraDoLabio(g: MugGeometry): number {
  return Math.max(g.body.topRadius - g.inner.topRadius, g.rim.tube * 2, 0.06);
}

/**
 * Perfil do lábio para o LatheGeometry: meio círculo da face externa
 * (x = raio do topo) por cima até a face interna, no topo do corpo. Os
 * pontos vão de fora para dentro; com essa ordem as normais saem para
 * fora, para cima e para dentro em sequência, contínuas com o corpo e
 * com o interior.
 */
export function perfilDoLabio(g: MugGeometry, passos = 10): Array<{ x: number; y: number }> {
  const lab = larguraDoLabio(g);
  const cx = g.body.topRadius - lab / 2;
  const r = lab / 2;
  const topo = g.body.height / 2;
  const pontos: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= passos; i++) {
    const a = (Math.PI * i) / passos; // 0 = fora, π = dentro
    pontos.push({ x: cx + r * Math.cos(a), y: topo + r * Math.sin(a) });
  }
  return pontos;
}

export type PontoDoInterior = {
  x: number;
  y: number;
  /** 0 no topo, 1 no fundo — alimenta a oclusão por vértice. */
  profundidade: number;
};

/**
 * Perfil do interior, do lábio ao centro do fundo: parede interna
 * (paralela à externa), filete arredondado no encontro com o fundo e o
 * fundo até o eixo. Ordenado de cima para baixo, de propósito: é a ordem
 * que deixa as normais do LatheGeometry apontando para DENTRO da caneca,
 * que é de onde se vê o interior.
 *
 * A parede interna começa onde o lábio termina — não onde o template
 * declarou `inner.topRadius`, que pode ser mais fino que o lábio mínimo.
 */
export function perfilDoInterior(g: MugGeometry, passosParede = 24, passosFilete = 8): PontoDoInterior[] {
  const lab = larguraDoLabio(g);
  const topo = g.body.height / 2;
  const raioTopo = Math.min(g.inner.topRadius, g.body.topRadius - lab);
  const conic = g.body.topRadius - g.body.bottomRadius;
  const raioFundo = Math.max(0.1, Math.min(g.inner.bottomRadius, raioTopo - conic));
  const fundoY = topo - g.inner.height;
  const filete = Math.min(0.14, raioFundo * 0.45, g.inner.height * 0.3);
  const pontos: PontoDoInterior[] = [];
  const alturaParede = g.inner.height - filete;
  for (let i = 0; i <= passosParede; i++) {
    const t = i / passosParede;
    const y = topo - alturaParede * t;
    const x = raioTopo + (raioFundo - raioTopo) * ((alturaParede * t) / g.inner.height);
    pontos.push({ x, y, profundidade: (topo - y) / g.inner.height });
  }
  const cx = raioFundo - filete;
  const cy = fundoY + filete;
  for (let i = 1; i <= passosFilete; i++) {
    const a = (Math.PI / 2) * (i / passosFilete); // 0 = parede, π/2 = fundo
    const x = cx + filete * Math.cos(a);
    const y = cy - filete * Math.sin(a);
    pontos.push({ x, y, profundidade: Math.min(1, (topo - y) / g.inner.height) });
  }
  pontos.push({ x: 0, y: fundoY, profundidade: 1 });
  return pontos;
}

/**
 * Onde a alça encontra o corpo: os cruzamentos da curva da alça (já no
 * plano XY, com a inclinação aplicada e deslocada para a posição dela)
 * com a parede externa. É onde a louça ganha um filete de junção, em vez
 * de um tubo atravessando um cilindro. `paredeEm(y)` é o raio da parede
 * naquela altura. Devolve os pontos interpolados no cruzamento com a
 * tangente da curva ali, orientada para FORA do corpo (x crescente);
 * sem cruzamento (alça solta), lista vazia.
 */
export type JuncaoDaAlca = { x: number; y: number; tx: number; ty: number };

export function juncoesDaAlca(
  curva: Array<{ x: number; y: number }>,
  paredeEm: (y: number) => number,
): JuncaoDaAlca[] {
  const fora: JuncaoDaAlca[] = [];
  if (curva.length < 2) return fora;
  const n = curva.length;
  const sinal = (p: { x: number; y: number }) => p.x - paredeEm(p.y);
  for (let i = 0; i < n; i++) {
    const a = curva[i], b = curva[(i + 1) % n];
    const sa = sinal(a), sb = sinal(b);
    if ((sa <= 0 && sb > 0) || (sa > 0 && sb <= 0)) {
      const t = sa / (sa - sb);
      let tx = b.x - a.x, ty = b.y - a.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len; ty /= len;
      // a tangente aponta para o lado da curva que está fora da parede
      if (sb <= 0) { tx = -tx; ty = -ty; }
      fora.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tx, ty });
    }
  }
  return fora;
}

/**
 * A curva do centro da alça em coordenadas do corpo (deslocada para
 * `offsetX/offsetY` e girada por `tilt`), amostrada: é o que alimenta
 * `juncoesDaAlca`. Anel = círculo; coração = bézier do `heartPath`;
 * "D" = `squarePath`. Sem alça, vazia.
 */
export function curvaDaAlca(g: MugGeometry, amostras = 64): Array<{ x: number; y: number }> {
  const h = g.handle;
  if (h.shape === "none") return [];
  let local: Array<{ x: number; y: number }> = [];
  if (h.shape === "ring") {
    for (let i = 0; i < amostras; i++) {
      const a = (Math.PI * 2 * i) / amostras;
      local.push({ x: Math.cos(a) * h.radius, y: Math.sin(a) * h.radius });
    }
  } else if (h.shape === "heart") {
    let atual = { x: 0, y: 0 };
    for (const c of heartPath(h.radius)) {
      if (c.op === "moveTo") { atual = { x: c.x, y: c.y }; continue; }
      const p0 = atual;
      const passos = Math.max(4, Math.floor(amostras / 2));
      for (let i = 1; i <= passos; i++) {
        const t = i / passos, u = 1 - t;
        local.push({
          x: u * u * u * p0.x + 3 * u * u * t * c.c1x + 3 * u * t * t * c.c2x + t * t * t * c.x,
          y: u * u * u * p0.y + 3 * u * u * t * c.c1y + 3 * u * t * t * c.c2y + t * t * t * c.y,
        });
      }
      atual = { x: c.x, y: c.y };
    }
  } else {
    // Cantos densos: a curva vira a linha de centro do tubo varrido
    // (malhaDaAlca), e 6 pontos por canto facetavam o "D".
    local = squarePath(h.radius, 16).slice(0, -1);
  }
  const rad = (h.tilt * Math.PI) / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  return local.map((p) => ({ x: h.offsetX + p.x * c - p.y * s, y: h.offsetY + p.x * s + p.y * c }));
}

// ============================================================
// 28/09/2026 (2ª rodada) — a alça como um tubo só, varrido do corpo
// ao corpo
//
// A primeira rodada pôs "raízes" (um colar torneado) onde a curva da
// alça cruzava a parede, por cima de um toro/tubo que continuava
// atravessando a caneca inteira. O colar seguia a tangente no cruzamento
// e o tubo curvava logo depois: a boca do colar ficava desalinhada e
// aparecia como um anel cortado saindo do corpo, com uma "orelha" em
// cima e embaixo (QA das capturas do app#995).
//
// Agora a alça é UMA malha: o arco da curva que fica fora da parede,
// varrido por círculos cujo raio alarga junto da parede (filete de um
// quarto de círculo, como louça que escorre), com a seção da raiz
// cisalhada para cair exatamente no plano da parede (uma alça inclinada
// encontra o corpo numa elipse, não num círculo), um afundamento que
// segue a curvatura do corpo (o alargamento abraça a parede em vez de
// ficar no ar), e a ponta enterrada na espessura da louça e tampada —
// nunca atravessando para o interior. Tudo aqui é aritmética, testada
// em __tests__/studioMugGeometry; o compose3dMug só põe num
// BufferGeometry.
// ============================================================

/** A parede externa por altura, sem o filete da base (linear entre os raios). */
export function raioExternoEm(g: MugGeometry, y: number): number {
  const t = Math.max(0, Math.min(1, (y + g.body.height / 2) / g.body.height));
  return g.body.bottomRadius + (g.body.topRadius - g.body.bottomRadius) * t;
}

/**
 * O raio da parede INTERNA numa altura, pelo mesmo perfil que o viewer
 * torneia (perfilDoInterior). Acima do topo ou abaixo do fundo da
 * cavidade não há cavidade: 0.
 */
export function raioInternoEm(g: MugGeometry, y: number): number {
  const p = perfilDoInterior(g);
  if (y > p[0].y || y < p[p.length - 1].y) return 0;
  for (let i = 1; i < p.length; i++) {
    if (y >= p[i].y) {
      const a = p[i - 1], b = p[i];
      const t = a.y === b.y ? 0 : (a.y - y) / (a.y - b.y);
      return a.x + (b.x - a.x) * t;
    }
  }
  return 0;
}

export type ArcoExterno = { pontos: Array<{ x: number; y: number }> };

/**
 * O trecho da curva fechada da alça que fica FORA da parede, do ponto em
 * que sai do corpo ao ponto em que entra de novo (os dois cruzamentos
 * interpolados, incluídos como primeiro e último pontos). Com mais de um
 * trecho fora (forma estranha), o maior. Sem cruzamento — alça inteira
 * fora (solta) ou inteira dentro — null.
 */
export function arcoExternoDaAlca(
  curva: Array<{ x: number; y: number }>,
  paredeEm: (y: number) => number,
): ArcoExterno | null {
  const n = curva.length;
  if (n < 3) return null;
  const fora = curva.map((p) => p.x - paredeEm(p.y) > 0);
  if (fora.every((f) => f) || !fora.some((f) => f)) return null;
  const cruza = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const sa = a.x - paredeEm(a.y), sb = b.x - paredeEm(b.y);
    const t = sa / (sa - sb);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  let melhor: ArcoExterno | null = null;
  let melhorComprimento = -1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (fora[i] || !fora[j]) continue; // só entradas dentro→fora
    const pontos = [cruza(curva[i], curva[j])];
    let k = j;
    while (fora[k]) { pontos.push(curva[k]); k = (k + 1) % n; }
    pontos.push(cruza(curva[(k - 1 + n) % n], curva[k]));
    let comprimento = 0;
    for (let m = 1; m < pontos.length; m++) comprimento += Math.hypot(pontos[m].x - pontos[m - 1].x, pontos[m].y - pontos[m - 1].y);
    if (comprimento > melhorComprimento) { melhorComprimento = comprimento; melhor = { pontos }; }
  }
  return melhor;
}

export type MalhaDaAlca = {
  /** xyz por vértice, em coordenadas do corpo (a alça já deslocada e inclinada). */
  positions: number[];
  indices: number[];
  /** Por estação: distância à parede mais próxima ao longo do tubo (≤ 0 = enterrada) e o raio da seção. */
  estacoes: Array<{ e: number; raio: number }>;
  segmentos: number;
};

/**
 * A malha da alça vazada: tubo varrido pelo arco externo da curva.
 *
 *   - raio da seção: o tubo, mais um filete de quarto de círculo (raio
 *     `filete` × tubo) junto de cada parede — a raiz é mais grossa e
 *     afina até o tubo com derivada contínua;
 *   - a seção junto da parede é cisalhada ao longo da tangente até cair
 *     no plano da parede (elipse, se a alça chega inclinada), e a
 *     estação da parede é a "e = 0"; as estações com e < 0 estão dentro
 *     da louça, até metade da espessura, e a última é tampada;
 *   - os vértices junto da parede afundam em x pelo que a parede
 *     redonda se afasta do plano tangente (sag), para o filete abraçar o
 *     corpo em vez de ficar suspenso nos lados.
 *
 * null quando a alça não é um tubo (preenchida, nenhuma) ou não cruza a
 * parede (aí o viewer usa a geometria fechada de antes).
 */
export function malhaDaAlca(
  g: MugGeometry,
  opcoes: { segmentos?: number; filete?: number } = {},
): MalhaDaAlca | null {
  const h = g.handle;
  if (h.shape === "none" || h.filled) return null;
  const segmentos = Math.max(6, Math.floor(opcoes.segmentos ?? 18));
  const paredeEm = (y: number) => raioExternoEm(g, y);
  const arco = arcoExternoDaAlca(curvaDaAlca(g, 256), paredeEm);
  if (!arco || arco.pontos.length < 3) return null;
  const P = arco.pontos;

  // Comprimento acumulado do arco e um leitor (posição, direção) por ℓ.
  const acc = [0];
  for (let i = 1; i < P.length; i++) acc.push(acc[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y));
  const L = acc[acc.length - 1];
  if (!(L > 0)) return null;
  const unit = (x: number, y: number) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
  const A = P[0], B = P[P.length - 1];
  const dA = unit(P[1].x - A.x, P[1].y - A.y);                       // direção da curva ao sair da parede
  const dB = unit(B.x - P[P.length - 2].x, B.y - P[P.length - 2].y);  // direção da curva ao entrar de novo
  const tA = dA, tB = { x: -dB.x, y: -dB.y };                        // tangentes apontando para FORA do corpo
  const em = (l: number): { x: number; y: number; dx: number; dy: number } => {
    if (l <= 0) return { x: A.x + dA.x * l, y: A.y + dA.y * l, dx: dA.x, dy: dA.y };
    if (l >= L) return { x: B.x + dB.x * (l - L), y: B.y + dB.y * (l - L), dx: dB.x, dy: dB.y };
    let i = 1;
    while (i < acc.length - 1 && acc[i] < l) i++;
    const a = P[i - 1], b = P[i];
    const t = (l - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    const d = unit(b.x - a.x, b.y - a.y);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: d.x, dy: d.y };
  };

  const tubo = h.tube;
  const F = Math.min((opcoes.filete ?? 0.55) * tubo, L / 4);
  // Profundidade enterrada: metade da espessura da louça ali, medida ao
  // longo da normal da parede; a tangente pode entrar de viés, então
  // a distância ao longo do tubo é maior (divide pelo cosseno, limitado).
  const espessuraEm = (y: number) => Math.max(0.01, paredeEm(y) - raioInternoEm(g, y));
  const profundidade = (ponto: { x: number; y: number }, t: { x: number; y: number }) => {
    const desejada = Math.max(0.004, Math.min(0.5 * espessuraEm(ponto.y), 0.5 * tubo));
    return desejada / Math.max(0.35, t.x);
  };
  const profA = profundidade(A, tA), profB = profundidade(B, tB);
  // A borda do filete afunda alguns milímetros na louça em vez de assentar
  // exatamente sobre a superfície: sobre a superfície ela virava uma linha
  // escura (z-fighting e sombra rasante) e, na alça inclinada, o aro do
  // lado de trás aparecia por cima do tubo. Afundada, a raiz emerge da
  // parede como uma louça só.
  const afundamento = (y: number) => Math.min(0.004, 0.25 * espessuraEm(y));

  // Estações: enterradas, filete (denso junto da parede), meio, filete, enterradas.
  const ls: number[] = [-profA, -profA / 2];
  for (let k = 0; k <= 8; k++) ls.push(F * Math.pow(k / 8, 1.5));
  const nMeio = Math.max(8, Math.round((L - 2 * F) / (L / 56)));
  for (let k = 1; k < nMeio; k++) ls.push(F + (L - 2 * F) * (k / nMeio));
  for (let k = 8; k >= 0; k--) ls.push(L - F * Math.pow(k / 8, 1.5));
  ls.push(L + profB / 2, L + profB);

  // Perfil do filete: côncavo, tangente ao tubo em e = F e chegando à
  // parede em ângulo (não tangente). Um quarto de círculo tangente à
  // parede virava uma aba fina deitada sobre a louça — de perto lia como
  // uma trombeta, e a luz rasante escurecia a borda. Em ângulo, o encontro
  // é um vinco, como o esmalte que se acumula onde a alça foi colada.
  const filete = (e: number) => (e < 0 ? F : e < F ? F * (1 - e / F) * (1 - e / F) : 0);
  const peso = (e: number) => (e <= 0 ? 1 : e < F ? (1 - e / F) * (1 - e / F) : 0);

  const positions: number[] = [];
  const indices: number[] = [];
  const estacoes: MalhaDaAlca["estacoes"] = [];
  for (const l of ls) {
    const c = em(l);
    const eA = l, eB = L - l;
    const raio = tubo + filete(eA) + filete(eB);
    const wA = peso(eA), wB = peso(eB);
    estacoes.push({ e: Math.min(eA, eB), raio });
    // Base da seção: N1 no plano da alça, perpendicular à direção; N2 = z.
    const n1x = -c.dy, n1y = c.dx;
    for (let k = 0; k < segmentos; k++) {
      const th = (Math.PI * 2 * k) / segmentos;
      const cx = Math.cos(th), sz = Math.sin(th);
      let x = c.x + raio * cx * n1x;
      let y = c.y + raio * cx * n1y;
      const z = raio * sz;
      // Cisalhamento: (P − J)·W = 0 no plano da parede, com W = +x.
      const cW = cx * n1x; // C·W
      if (wA > 0) { const s = (-raio * cW) / Math.max(0.35, tA.x) * wA; x += s * tA.x; y += s * tA.y; }
      if (wB > 0) { const s = (-raio * cW) / Math.max(0.35, tB.x) * wB; x += s * tB.x; y += s * tB.y; }
      // Afundamento: a parede recua do plano x = J.x conforme |z| cresce
      // (corpo redondo) e conforme y muda (corpo cônico, a xícara). A
      // referência é a parede NO CRUZAMENTO, não na altura do vértice —
      // senão a seção de uma alça num cone entrava na cavidade.
      const w = Math.max(wA, wB);
      if (w > 0) {
        const J = wA >= wB ? A : B;
        const RJ = paredeEm(J.y);
        const R = paredeEm(y);
        x += (Math.sqrt(Math.max(0, R * R - z * z)) - RJ) * w - afundamento(J.y) * w;
      }
      positions.push(x, y, z);
    }
  }
  const nEst = ls.length;
  const idx = (i: number, k: number) => i * segmentos + (k % segmentos);
  for (let i = 0; i < nEst - 1; i++) {
    for (let k = 0; k < segmentos; k++) {
      const a = idx(i, k), b = idx(i, k + 1), c = idx(i + 1, k + 1), d = idx(i + 1, k);
      indices.push(a, b, c, a, c, d); // normais para fora
    }
  }
  // Tampas (dentro da louça): leque para o centro de cada ponta.
  const centro = (i: number) => {
    let sx = 0, sy = 0, sz = 0;
    for (let k = 0; k < segmentos; k++) { const j = idx(i, k) * 3; sx += positions[j]; sy += positions[j + 1]; sz += positions[j + 2]; }
    positions.push(sx / segmentos, sy / segmentos, sz / segmentos);
    return positions.length / 3 - 1;
  };
  const o0 = centro(0);
  for (let k = 0; k < segmentos; k++) indices.push(o0, idx(0, k + 1), idx(0, k));
  const o1 = centro(nEst - 1);
  for (let k = 0; k < segmentos; k++) indices.push(o1, idx(nEst - 1, k), idx(nEst - 1, k + 1));

  return { positions, indices, estacoes, segmentos };
}
