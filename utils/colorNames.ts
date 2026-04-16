// ============================================================
// AURA. -- Mapeamento hex -> nome de cor pt-BR (nearest RGB)
// Usado pela ProductCard (PDV) e MergeDuplicatesModal (Estoque)
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
