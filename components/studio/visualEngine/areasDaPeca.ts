// ============================================================
// components/studio/visualEngine/areasDaPeca.ts
// 27/09/2026 — as áreas de impressão de uma peça 3D, sem React.
//
// Até a camiseta em GLB, o viewer só conhecia "panel" e "wrap" da caneca:
// o lado Frente/Verso do editor caía sempre no painel e o rótulo de
// qualquer outra área era "Volta inteira". Com áreas `front` e `back` de
// verdade, o lado escolhido tem que achar a área certa e o chip tem que
// dizer o que ela é. Regras puras, testadas em __tests__/studioAreasDaPeca.
// ============================================================

export type LadoDaPeca = "front" | "back" | "middle";

type AreaMinima = { id: string; width_cm?: number; height_cm?: number };

// Para cada lado do editor, as áreas que o representam, em ordem de
// preferência. A caneca continua caindo em painel/wrap como sempre; a
// camiseta acha frente/costas.
const AREAS_DO_LADO: Record<LadoDaPeca, string[]> = {
  front: ["front", "panel"],
  back: ["back", "panel"],
  middle: ["wrap", "middle"],
};

/**
 * A área que corresponde ao lado escolhido fora do viewer, ou null quando
 * a spec não tem nenhuma — aí o viewer mantém a área atual, em vez de
 * trocar para uma que não existe.
 */
export function areaParaLado(areas: AreaMinima[] | undefined, side: LadoDaPeca | undefined): string | null {
  if (!side || !areas?.length) return null;
  for (const id of AREAS_DO_LADO[side] || []) {
    if (areas.some((a) => a.id === id)) return id;
  }
  return null;
}

// ── Várias áreas no vídeo do orçamento (29/09/2026) ─────────
//
// O vídeo mostra TODAS as artes da peça girando: frente e verso, ou a
// volta inteira da caneca. A camiseta GLB tem `front` e `back` de
// verdade. A caneca só tem `panel` (a 90° da alça, que fica em u 0,25) e
// `wrap`: o verso é DERIVADO do painel com meia volta (centro em u = 0,
// do outro lado da alça), sem mexer nas specs do banco. A área derivada
// atravessa a emenda da textura (u1 > 1): quem pinta desenha de novo uma
// volta antes. `areaParaLado` continua igual — a vitrine e a aprovação
// seguem com o comportamento de sempre.

type Uv = { u0: number; v0: number; u1: number; v1: number };
type AreaComUv = AreaMinima & { uv?: Uv };

/** O verso da caneca: o painel com meia volta, com o mesmo tamanho. Null sem painel com uv. */
export function versoDoPainel<T extends AreaComUv>(areas: T[] | undefined): T | null {
  const painel = (areas || []).find((a) => a.id === "panel");
  if (!painel || !painel.uv) return null;
  let u0 = painel.uv.u0 + 0.5, u1 = painel.uv.u1 + 0.5;
  if (u0 >= 1) { u0 -= 1; u1 -= 1; }
  return { ...painel, id: "back", uv: { ...painel.uv, u0, u1 } };
}

/**
 * Área por id para pintar ou mostrar: a da spec; na caneca sem `back`,
 * o verso derivado do painel. Null quando não existe (quem chama decide
 * o fallback, como antes).
 */
export function areaParaPintar<T extends AreaComUv>(areas: T[] | undefined, id: string, ehGlb: boolean): T | null {
  const real = (areas || []).find((a) => a.id === id);
  if (real) return real;
  if (id === "back" && !ehGlb) return versoDoPainel(areas);
  return null;
}

/**
 * Onde a área cai na textura W × H: um retângulo, ou dois quando ela
 * atravessa a emenda (u1 > 1) — o segundo é o mesmo uma volta antes, e o
 * clip de cada um corta o que sobra. Áreas das specs (u ≤ 1) dão um só.
 */
export function retangulosNaTextura(uv: Uv, W: number, H: number): Array<{ x: number; y: number; w: number; h: number }> {
  const r = { x: uv.u0 * W, y: (1 - uv.v1) * H, w: (uv.u1 - uv.u0) * W, h: (uv.v1 - uv.v0) * H };
  return uv.u1 > 1 ? [r, { ...r, x: r.x - W }] : [r];
}

/**
 * Em que área o lado da arte é pintado no vídeo. Frente e estendida pelo
 * `areaParaLado` de sempre; o verso pela área `back` (a real, ou a
 * derivada do painel na caneca). Null = o modelo não tem esse lado.
 */
export function areaDoLadoNoModelo(
  spec: { areas?: AreaComUv[]; model?: { kind?: string } | null } | null | undefined,
  lado: LadoDaPeca,
): string | null {
  const areas = spec?.areas;
  if (!areas?.length) return null;
  if (lado === "back") return areaParaPintar(areas, "back", spec?.model?.kind === "glb") ? "back" : null;
  return areaParaLado(areas, lado);
}

// O nome da área de impressão, para quem compra. "Wrap 360°" e "9.7cm"
// são jargão de oficina e ponto decimal de programador: a cliente lê
// "Volta inteira" e "9,7 cm".
export function rotuloDaArea(a: AreaMinima): string {
  const cm = (n?: number) => String(n ?? "").replace(".", ",");
  const medida = a.width_cm && a.height_cm ? " " + cm(a.width_cm) + "×" + cm(a.height_cm) + " cm" : "";
  if (a.id === "panel") return "Painel" + medida;
  if (a.id === "front") return "Frente" + medida;
  if (a.id === "back") return "Costas" + medida;
  return "Volta inteira";
}
