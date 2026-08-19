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

export type HandleShape = "ring" | "heart" | "none";

export type MugGeometry = {
  body: { topRadius: number; bottomRadius: number; height: number };
  rim: { radius: number; tube: number };
  inner: { topRadius: number; bottomRadius: number; height: number };
  handle: { shape: HandleShape; radius: number; tube: number; offsetX: number; offsetY: number };
};

/** Os números que estavam no código antes do S3. */
export const MUG_GEOMETRY_PADRAO: MugGeometry = {
  body:   { topRadius: 1, bottomRadius: 0.94, height: 2.3 },
  rim:    { radius: 0.975, tube: 0.028 },
  inner:  { topRadius: 0.96, bottomRadius: 0.9, height: 2.24 },
  handle: { shape: "ring", radius: 0.52, tube: 0.11, offsetX: 1.02, offsetY: 0 },
};

const HANDLE_SHAPES: HandleShape[] = ["ring", "heart", "none"];

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
  };

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
    },
  };
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
