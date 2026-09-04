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
  if (antigo in LEGACY_TARGETS) return LEGACY_TARGETS[antigo as CustomerColorTarget];
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
