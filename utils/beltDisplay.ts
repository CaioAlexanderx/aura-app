// ============================================================
// Rótulo de faixa para exibição.
// belt_name já traz o grau da preta (ex.: "Preta 1°"). Para faixa preta,
// acrescenta " Dan" → "Preta 1° Dan". Demais faixas: nome como está.
// ============================================================
import { resolveBeltKey, KarateBelts } from "@/constants/karateTheme";

export function formatBeltLabel(beltLevel?: string | null, beltName?: string | null): string {
  const name = (beltName || "").trim();
  const lvl = (beltLevel || "").trim();
  const base = name || lvl;
  if (!base) return "—";
  const isBlack = lvl.toLowerCase() === "preta" || /preta/i.test(base) || /\bdan\b/i.test(base);
  if (isBlack && !/dan/i.test(base)) return base + " Dan";
  return base;
}

export function beltColorHex(beltLevel?: string | null, beltName?: string | null): string {
  const key = resolveBeltKey(beltName || beltLevel || "");
  return key && KarateBelts[key] ? KarateBelts[key].color : "#999999";
}
