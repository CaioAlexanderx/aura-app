// ============================================================
// AURA. — Leitura de número digitado no formato brasileiro
//
// 29/10/2026: a lojista digitou "11,52" na taxa da maquininha e
// gravou 100%. O campo fazia replace(/[^\d.]/g, ""), que joga a
// vírgula fora: "11,52" virava "1152" e o clamp cortava em 100.
// Aqui vírgula e ponto valem como separador decimal.
//
// Regras:
//  - tem vírgula   -> a vírgula é o decimal e os pontos são milhar
//                     ("1.234,5" -> 1234.5; mais de uma vírgula = lixo)
//  - só pontos     -> 1 ponto é decimal ("11.52" -> 11.52); vários
//                     pontos são milhar ("1.234.567" -> 1234567)
//  - aceita "%" e espaços em volta/no meio ("2%", " 2 ")
//  - qualquer outra letra, sinal ou símbolo = inválido (null), pra
//    "abc", "-5" ou "1a2" nunca virarem número por acidente
// ============================================================

/** Lê um decimal pt-BR. Devolve null quando vazio ou inválido. */
export function parseDecimalBR(raw: unknown): number | null {
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[\s%]/g, "");
  if (!s) return null;
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  if (s.includes(",")) {
    if (s.split(",").length > 2) return null;
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(".")) {
    const partes = s.split(".");
    if (partes.length > 2) s = partes.join("");
  }
  if (s.startsWith(".")) s = "0" + s;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** Percentual digitado: trava entre 0 e max, até 2 casas. Vazio ou inválido = 0. */
export function parsePercent(raw: unknown, max: number = 100): number {
  const n = parseDecimalBR(raw);
  if (n == null) return 0;
  const travado = Math.max(0, Math.min(max, n));
  return Math.round(travado * 100) / 100;
}

/** Mostra o número no formato brasileiro, sem zeros sobrando: 11.52 -> "11,52", 2 -> "2". */
export function formatDecimalBR(n: unknown): string {
  if (n == null || n === "") return "";
  const v = Number(n);
  if (!isFinite(v)) return "";
  return String(Math.round(v * 100) / 100).replace(".", ",");
}

export const formatPercent = formatDecimalBR;
