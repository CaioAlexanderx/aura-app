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
