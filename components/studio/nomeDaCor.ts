// ============================================================
// components/studio/nomeDaCor.ts
//
// QA do painel Studio (26/09/2026): o detalhe do pedido mostrava
// "Cor: #000000" — o hex cru não diz nada pra quem confere a peça antes
// de produzir. Aqui é a bolinha + o nome em português.
//
// Prioridade: o rótulo que a lojista cadastrou pro swatch (quando o
// campo tem `config.choices` com esse hex) vence sempre — é o nome que
// ELA usa na prensa. Sem rótulo cadastrado, cai no nome comum mais
// próximo pela matiz/luz da cor (função pura, sem hook/context — testável
// isolada).
// ============================================================

/** Hexes conhecidos (presets do app + tons comuns) já com nome certo. */
const NOMES_EXATOS: Record<string, string> = {
  "000000": "preto", "1a1a1a": "preto", "0f172a": "preto",
  "ffffff": "branco", "fefefe": "branco", "f8f8f8": "branco",
  "ff0000": "vermelho", "e53935": "vermelho", "dc2626": "vermelho",
  "b91c1c": "vermelho", "ef4444": "vermelho", "f87171": "vermelho",
  "ffc0cb": "rosa", "ec4899": "rosa", "f472b6": "rosa",
  "be185d": "rosa", "db2777": "rosa",
  "800080": "roxo", "7c3aed": "roxo", "9333ea": "roxo",
  "6d28d9": "roxo", "a855f7": "roxo",
  "0000ff": "azul", "1d4ed8": "azul", "2563eb": "azul",
  "1e3a8a": "azul", "3b82f6": "azul", "1e40af": "azul",
  "ffa500": "laranja", "f97316": "laranja", "ea580c": "laranja",
  "fb923c": "laranja", "d97706": "laranja",
  "008000": "verde", "22c55e": "verde", "16a34a": "verde",
  "059669": "verde", "10b981": "verde", "15803d": "verde",
  "ffff00": "amarelo", "facc15": "amarelo", "eab308": "amarelo",
  "fde047": "amarelo",
  "8b4513": "marrom", "a0522d": "marrom", "78350f": "marrom",
  "92400e": "marrom",
  "808080": "cinza", "6b7280": "cinza", "9ca3af": "cinza",
  "71717a": "cinza", "4b5563": "cinza",
  "ffd700": "dourado", "d4af37": "dourado", "b8860b": "dourado",
  "c9a227": "dourado",
  "c0c0c0": "prata", "d3d3d3": "prata", "a9a9a9": "prata",
  "bdc3c7": "prata",
};

function hexParaRgb(hex: string): [number, number, number] | null {
  const limpo = String(hex || "").trim().replace(/^#/, "");
  const full = limpo.length === 3 ? limpo.split("").map((c) => c + c).join("") : limpo;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbParaHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

/** Nome por matiz/luz — só cores cromáticas comuns (dourado/prata são acabamento, não matiz: só por hex exato). */
function nomePorHsl(h: number, s: number, l: number): string {
  if (s < 0.12) {
    if (l > 0.92) return "branco";
    if (l < 0.14) return "preto";
    return "cinza";
  }
  if (l < 0.18) return "preto";
  if (l > 0.94) return "branco";
  // Marrom: laranja/vermelho escurecido e pouco saturado.
  if (h >= 15 && h < 45 && l < 0.45 && s < 0.75) return "marrom";
  if (h < 15 || h >= 345) return "vermelho";
  if (h < 45) return "laranja";
  if (h < 65) return "amarelo";
  if (h < 170) return "verde";
  if (h < 255) return "azul";
  if (h < 290) return "roxo";
  return "rosa";
}

/**
 * Nome em português de uma cor hex.
 *
 * `rotuloCadastrado` é o `label` que a lojista deu a esse swatch (achado
 * em `config.choices` do campo de cor) — quando existe e é diferente do
 * próprio hex, vence sempre.
 */
export function nomeDaCor(hex: string, rotuloCadastrado?: string | null): string {
  const rotulo = String(rotuloCadastrado || "").trim();
  if (rotulo && rotulo.toLowerCase() !== String(hex || "").toLowerCase().trim()) return rotulo;

  const limpo = String(hex || "").trim().replace(/^#/, "").toLowerCase();
  if (NOMES_EXATOS[limpo]) return NOMES_EXATOS[limpo];

  const rgb = hexParaRgb(hex);
  if (!rgb) return String(hex || "—");
  const { h, s, l } = rgbParaHsl(rgb[0], rgb[1], rgb[2]);
  return nomePorHsl(h, s, l);
}

export default nomeDaCor;
