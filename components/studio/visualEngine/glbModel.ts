// ============================================================
// components/studio/visualEngine/glbModel.ts
// 27/09/2026 — a peça em GLB: o que é aritmética pura, sem three.js.
//
// POR QUE ESTE ARQUIVO EXISTE: o viewer 3D só sabia montar a caneca
// procedural (mugGeometry.ts). A camiseta — e qualquer peça que não seja
// um corpo torneado — chega como GLB, com `model.kind = "glb"` e uma
// `url`, como o comentário da spec previa desde o F4. O que dá para
// testar com Jest fica aqui: a leitura da spec (com defaults e limites),
// a escala que normaliza a peça para o tamanho da cena, a distância da
// câmera pela caixa do modelo, o retângulo da textura de uma área UV e a
// escolha do mesh que recebe a arte. O three.js (CDN, só web) fica em
// compose3dMug.ts e é conferido olhando.
//
// CONVENÇÃO DE UV: `areas[].uv` tem v crescendo PARA CIMA, como na caneca
// (e como o editor de UV do Blender mostra). O glTF guarda v crescendo
// para baixo; o viewer compensa desligando `flipY` na textura da peça
// GLB — é o que o GLTFLoader faz com as texturas do próprio arquivo — e
// o mesmo retângulo pintado cai no mesmo lugar do tecido.
// ============================================================
import { MUG_GEOMETRY_PADRAO } from "./mugGeometry";
import { CAMERA_DISTANCIA_PADRAO, CAMERA_FOV_GRAUS } from "./mugScene";

export type GlbCamera = {
  /** Distância fixa da câmera; null = calculada pela caixa do modelo. */
  distance: number | null;
  /** Altura da câmera como fração da distância (0.2 = o enquadramento da caneca). */
  height: number;
  /** Campo de visão vertical, em graus. */
  fov: number;
};

export type GlbFabric = {
  roughness: number;
  /** Intensidade da trama (mapa de normais gerado em canvas). 0 desliga. */
  normalScale: number;
};

export type GlbModel = {
  url: string;
  /** Multiplicador sobre a normalização de altura (1 = a peça fica com a altura da caneca). */
  scale: number;
  /** Giro inicial em Y, em graus. */
  rotationY: number;
  camera: GlbCamera;
  /** Nome do mesh (ou do material) que recebe a textura da arte; null = o maior mesh. */
  printMesh: string | null;
  /**
   * Nomes de mesh/material onde a cor escolhida pelo cliente incide.
   * null = não declarado, vale o mesh de impressão. Lista vazia = cor fixa.
   */
  customerColorTargets: string[] | null;
  fabric: GlbFabric;
  texture: { w: number; h: number };
};

/**
 * A altura que toda peça GLB ganha na cena: a da caneca padrão. Luzes,
 * câmera da sombra, chão e mancha de contato foram afinados para uma peça
 * desse tamanho, e um GLB pode vir em metros, centímetros ou polegadas.
 * Normalizar a peça é mais barato do que reescalar a cena inteira.
 */
export const ALTURA_ALVO_DO_MODELO = MUG_GEOMETRY_PADRAO.body.height;

// A fração da tela que a caneca padrão ocupa (ver mugScene.ts): a mesma
// para a altura. Na largura deixamos a peça chegar mais perto da borda —
// uma camiseta de mangas abertas é mais larga que alta, e com a mesma
// fração ela ficaria pequena demais no centro.
const OCUPACAO_VERTICAL = ALTURA_ALVO_DO_MODELO / (2 * CAMERA_DISTANCIA_PADRAO * Math.tan((CAMERA_FOV_GRAUS / 2) * Math.PI / 180));
const OCUPACAO_HORIZONTAL = 0.82;

const PADRAO_CAMERA: GlbCamera = { distance: null, height: 0.2, fov: CAMERA_FOV_GRAUS };
const PADRAO_TECIDO: GlbFabric = { roughness: 0.85, normalScale: 0.35 };

function num(v: any, padrao: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n) || n < min || n > max) return padrao;
  return n;
}

function nome(v: any): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** A spec pede um GLB: `model.kind = "glb"` com uma url http(s). */
export function isGlbSpec(spec: any): boolean {
  return readGlbModel(spec) !== null;
}

/**
 * Lê `spec.model` de uma peça GLB. Devolve null quando a spec não é de
 * GLB — ou quando é, mas sem url utilizável: a vitrine roda em outro
 * domínio (loja.getaura.com.br) e carrega o app de app.getaura.com.br,
 * então um caminho relativo apontaria para o host errado. Só url absoluta.
 */
export function readGlbModel(spec: any): GlbModel | null {
  const m = spec?.model;
  if (!m || typeof m !== "object" || m.kind !== "glb") return null;
  const url = nome(m.url);
  if (!url || !/^https?:\/\//i.test(url)) return null;

  const cam = m.camera && typeof m.camera === "object" ? m.camera : {};
  const mats = m.materials && typeof m.materials === "object" ? m.materials : {};
  const fab = mats.fabric && typeof mats.fabric === "object" ? mats.fabric : {};

  let targets: string[] | null = null;
  if (Array.isArray(mats.customer_color_targets)) {
    const vistos = new Set<string>();
    for (const t of mats.customer_color_targets) {
      const n = nome(t);
      if (n) vistos.add(n);
    }
    targets = Array.from(vistos);
  }

  return {
    url,
    scale: num(m.scale, 1, 0.01, 100),
    rotationY: num(m.rotation_y, 0, -360, 360),
    camera: {
      distance: cam.distance == null ? null : num(cam.distance, 0, 0.5, 100) || null,
      height: num(cam.height, PADRAO_CAMERA.height, -1, 2),
      fov: num(cam.fov, PADRAO_CAMERA.fov, 10, 90),
    },
    printMesh: nome(m.print_mesh),
    customerColorTargets: targets,
    fabric: {
      roughness: num(fab.roughness, PADRAO_TECIDO.roughness, 0, 1),
      normalScale: num(fab.normal_scale, PADRAO_TECIDO.normalScale, 0, 3),
    },
    texture: {
      w: num(m.texture?.w, 2048, 64, 8192),
      h: num(m.texture?.h, 1024, 64, 8192),
    },
  };
}

export type Caixa = { width: number; height: number; depth: number };

/**
 * Escala que leva a caixa do modelo à altura alvo, vezes o ajuste da
 * spec. Caixa degenerada (altura zero) não divide por zero: fica só o
 * ajuste, e a peça aparece do tamanho que veio.
 */
export function escalaDoModelo(caixa: Caixa, ajuste = 1): number {
  const k = Number.isFinite(ajuste) && ajuste > 0 ? ajuste : 1;
  if (!(caixa.height > 0)) return k;
  return (ALTURA_ALVO_DO_MODELO / caixa.height) * k;
}

/**
 * Distância da câmera para a caixa JÁ ESCALADA caber: nunca mais perto
 * que a da caneca (a leitura da arte aprovada não muda), mais longe
 * quando a altura ou a largura pedem. A largura depende da proporção do
 * canvas — por isso é calculada no resize, não uma vez só.
 */
export function cameraDistanceParaCaixa(caixa: Pick<Caixa, "width" | "height">, aspect: number, fov = CAMERA_FOV_GRAUS): number {
  const visivelPorUnidade = 2 * Math.tan((fov / 2) * Math.PI / 180);
  const asp = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const porAltura = caixa.height / (visivelPorUnidade * OCUPACAO_VERTICAL);
  const porLargura = caixa.width / (visivelPorUnidade * asp * OCUPACAO_HORIZONTAL);
  const ideal = Math.max(porAltura, porLargura);
  return Math.max(CAMERA_DISTANCIA_PADRAO, Math.round(ideal * 100) / 100);
}

/** O chão da peça centrada na origem: a base da caixa. */
export function floorLevelParaCaixa(caixa: Pick<Caixa, "height">): number {
  return -caixa.height / 2;
}

/** A mancha de contato cobre a base da peça com folga — mas não as mangas abertas inteiras. */
export function contactShadowRadiusParaCaixa(caixa: Caixa): number {
  return Math.max(caixa.width, caixa.depth) * 0.42;
}

export type RetanguloDaTextura = { x: number; y: number; w: number; h: number };

/**
 * O retângulo, em pixels da textura, de uma área declarada por UV.
 * v cresce para cima na UV e y cresce para baixo no canvas — a mesma
 * conta que a caneca sempre fez, agora num lugar só.
 */
export function uvParaRetangulo(
  uv: { u0: number; v0: number; u1: number; v1: number },
  W: number,
  H: number,
): RetanguloDaTextura {
  return {
    x: uv.u0 * W,
    y: (1 - uv.v1) * H,
    w: (uv.u1 - uv.u0) * W,
    h: (uv.v1 - uv.v0) * H,
  };
}

export type MeshResumo = { name: string; materialName: string; vertices: number };

/**
 * Qual mesh recebe a arte: o de nome (ou material) declarado em
 * `print_mesh`; sem declaração ou sem correspondência, o de mais
 * vértices — numa camiseta é o tecido, e uma etiqueta ou botão nunca é.
 * Devolve o índice na lista, ou -1 sem meshes.
 */
export function escolherMeshDeImpressao(meshes: MeshResumo[], printMesh: string | null): number {
  if (!meshes.length) return -1;
  if (printMesh) {
    const alvo = printMesh.toLowerCase();
    const i = meshes.findIndex((m) => m.name.toLowerCase() === alvo || m.materialName.toLowerCase() === alvo);
    if (i >= 0) return i;
  }
  let melhor = 0;
  for (let i = 1; i < meshes.length; i++) {
    if (meshes[i].vertices > meshes[melhor].vertices) melhor = i;
  }
  return melhor;
}

/**
 * A cor do cliente incide neste mesh? Sem lista declarada, só o mesh de
 * impressão muda de cor (uma camiseta lisa é toda da cor escolhida).
 * Com lista, vale o nome do mesh ou do material, sem distinguir caixa.
 */
export function recebeCorDoCliente(
  mesh: Pick<MeshResumo, "name" | "materialName">,
  ehMeshDeImpressao: boolean,
  targets: string[] | null,
): boolean {
  if (targets === null) return ehMeshDeImpressao;
  const n = mesh.name.toLowerCase(), m = mesh.materialName.toLowerCase();
  return targets.some((t) => { const a = t.toLowerCase(); return a === n || a === m; });
}
