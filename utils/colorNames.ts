// ============================================================
// AURA. -- Mapeamento hex <-> nome de cor pt-BR (nearest RGB)
// Usado pela ProductCard (PDV), MergeDuplicatesModal (Estoque) e
// QuickBatchProductsModal (lote de produtos)
// ============================================================

const NAMED_COLORS: Array<{ name: string; r: number; g: number; b: number }> = [
  { name: "Preto",      r: 0,   g: 0,   b: 0   },
  { name: "Branco",     r: 255, g: 255, b: 255 },
  { name: "Cinza",      r: 128, g: 128, b: 128 },
  { name: "Cinza claro",r: 200, g: 200, b: 200 },
  { name: "Cinza escuro",r: 64, g: 64,  b: 64  },
  { name: "Vermelho",   r: 239, g: 68,  b: 68  },
  { name: "Vinho",      r: 128, g: 0,   b: 32  },
  { name: "Rosa",       r: 236, g: 72,  b: 153 },
  { name: "Rosa claro", r: 255, g: 182, b: 193 },
  { name: "Laranja",    r: 249, g: 115, b: 22  },
  { name: "Amarelo",    r: 234, g: 179, b: 8   },
  { name: "Marrom",     r: 139, g: 69,  b: 19  },
  { name: "Caramelo",   r: 189, g: 113, b: 0   },
  { name: "Bege",       r: 245, g: 222, b: 179 },
  { name: "Nude",       r: 240, g: 235, b: 223 },
  { name: "Verde",      r: 34,  g: 197, b: 94  },
  { name: "Verde escuro",r: 0,  g: 100, b: 0   },
  { name: "Verde agua", r: 139, g: 232, b: 179 },
  { name: "Azul",       r: 59,  g: 130, b: 246 },
  { name: "Azul escuro",r: 0,   g: 0,   b: 139 },
  { name: "Azul claro", r: 173, g: 216, b: 230 },
  { name: "Azul marinho",r: 0,  g: 0,   b: 80  },
  { name: "Roxo",       r: 139, g: 92,  b: 246 },
  { name: "Violeta",    r: 109, g: 40,  b: 217 },
  { name: "Dourado",    r: 218, g: 165, b: 32  },
  { name: "Prata",      r: 192, g: 192, b: 192 },
];

// Versao normalizada (lowercase, sem acentos) -> hex
// Construida uma vez em modulo load; O(1) lookup depois.
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function norm(s: string): string {
  return stripAccents(String(s || "").toLowerCase().trim());
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(b);
}

const NAME_TO_HEX_INDEX: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const c of NAMED_COLORS) {
    out[norm(c.name)] = rgbToHex(c.r, c.g, c.b);
  }
  // Aliases comuns em pt-BR
  out["escuro"]    = out["preto"];
  out["black"]     = out["preto"];
  out["white"]     = out["branco"];
  out["red"]       = out["vermelho"];
  out["blue"]      = out["azul"];
  out["green"]     = out["verde"];
  out["yellow"]    = out["amarelo"];
  out["pink"]      = out["rosa"];
  out["orange"]    = out["laranja"];
  out["purple"]    = out["roxo"];
  out["brown"]     = out["marrom"];
  out["gray"]      = out["cinza"];
  out["grey"]      = out["cinza"];
  out["gold"]      = out["dourado"];
  out["silver"]    = out["prata"];
  return out;
})();

export function hexToName(hex: string | null | undefined): string {
  if (!hex || typeof hex !== "string") return "";
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;

  let bestDist = Infinity;
  let bestName = "";
  for (const c of NAMED_COLORS) {
    const dr = r - c.r, dg = g - c.g, db = b - c.b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) { bestDist = d; bestName = c.name; }
  }
  return bestName || hex;
}

// nameToHex: converte nome (pt-BR ou ingles) OU hex direto em hex.
// - "azul"     -> "#3B82F6"
// - "AZUL"     -> "#3B82F6"
// - "#ff0000"  -> "#ff0000" (passthrough se ja for hex valido)
// - "xyz"      -> null (nao reconhecido)
// - ""/null    -> null
export function nameToHex(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Ja e hex valido?
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return "#" + trimmed;

  // Busca pelo nome normalizado
  const key = norm(trimmed);
  return NAME_TO_HEX_INDEX[key] || null;
}
