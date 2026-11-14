// ============================================================
// AURA. — A paleta única de cores (CP3 da revisão de cores, 14/11/2026)
//
// Os dados moram em constants/paletaDeCores.json — o MESMO arquivo do
// backend (src/data/paletaDeCores.json), travado por sha256 nos dois
// repositórios (__tests__/paletaDeCores.test.ts aqui). Gêmea de
// src/services/paletaDeCores.js.
//
// Para que serve: o editor de cor (nome + amostra), as sugestões de nome,
// a busca e ler um NOME de cor ("Caqui", "Preta", "Off white") como amostra.
// Para que NÃO serve: dar nome a cor sem nome na tela ou na etiqueta — essa
// reserva continua sendo hexToName (utils/colorNames.ts, 26 tons), congelada
// para a etiqueta sair igual.
//
// Funções puras: o Studio usa do mesmo jeito quando vier para o Negócio.
// ============================================================
import dados from "@/constants/paletaDeCores.json";

export type CorDaPaleta = { nome: string; hex: string; familia: string; apelidos: string[] };

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** "Verde-água " → "verde agua": sem acento, minúsculo, hífen vira espaço. */
export function chaveDoNome(s: string | null | undefined): string {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

export const PALETA: ReadonlyArray<CorDaPaleta> = (dados.cores as CorDaPaleta[]).map((c) => ({
  nome: c.nome, hex: c.hex.toUpperCase(), familia: c.familia, apelidos: [...(c.apelidos || [])],
}));
export const FAMILIAS: ReadonlyArray<string> = [...dados.familias];

const INDICE: Map<string, CorDaPaleta> = (() => {
  const m = new Map<string, CorDaPaleta>();
  for (const c of PALETA) {
    for (const n of [c.nome, ...c.apelidos]) {
      const k = chaveDoNome(n);
      if (k && !m.has(k)) m.set(k, c);
    }
  }
  return m;
})();

/** A cor da paleta com esse nome ou apelido ("preta", "Verde agua", "khaki"), ou null. */
export function corPeloNome(nome: string | null | undefined): CorDaPaleta | null {
  const k = chaveDoNome(nome);
  return (k && INDICE.get(k)) || null;
}

/** Hex da cor com esse nome ou apelido, ou null. */
export function hexPeloNome(nome: string | null | undefined): string | null {
  const c = corPeloNome(nome);
  return c ? c.hex : null;
}

/** A cor da paleta mais perto de um hex (peso perceptual da vitrine). */
export function maisPerto(hex: string | null | undefined): CorDaPaleta | null {
  if (!hex || !HEX.test(hex)) return null;
  const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r, g, b] = rgb(hex);
  let melhor: CorDaPaleta | null = null;
  let menor = Infinity;
  for (const c of PALETA) {
    const [cr, cg, cb] = rgb(c.hex);
    const d = Math.sqrt(2 * (r - cr) ** 2 + 4 * (g - cg) ** 2 + 3 * (b - cb) ** 2);
    if (d < menor) { menor = d; melhor = c; }
  }
  return melhor;
}

/** As cores agrupadas, na ordem das famílias. */
export function porFamilia(): Array<{ familia: string; cores: CorDaPaleta[] }> {
  return FAMILIAS.map((f) => ({ familia: f, cores: PALETA.filter((c) => c.familia === f) }));
}
