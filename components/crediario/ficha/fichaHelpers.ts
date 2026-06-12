import { Colors } from "@/constants/colors";
import type { CreditAccount } from "@/services/creditApi";
import { formatIsoToBr } from "@/components/inputs/DateInput";

export const PAYMENT_METHODS = [
  { key: "dinheiro", label: "Dinheiro" },
  { key: "pix", label: "Pix" },
  { key: "cartao", label: "Cartão" },
];

export type ReceiveMode = "fifo" | "distribute";
export type Tab = "parcelas" | "historico" | "conta" | "termos" | "bloqueio";

export function fmt(n: number) {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtDate(iso: string) {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return "";
  try { return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" }); }
  catch { return ""; }
}
export function todayBrSp(): string {
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return formatIsoToBr(iso);
}
// A5-FE: parser robusto de moeda BR. Antes removia TODOS os pontos -> "10.50"
// (ponto decimal) virava 1050. Agora:
//  - tem vírgula  -> vírgula é decimal, pontos são milhar  ("1.234,56" -> 1234.56)
//  - só ponto(s)  -> 1 ponto com 1–2 casas finais = decimal ("10.50" -> 10.50);
//                    múltiplos pontos OU 1 ponto com 3 casas finais = milhar
//                    ("1.234" -> 1234, "1.234.567" -> 1234567)
//  - só dígitos   -> inteiro ("1234" -> 1234)
export function parseAmount(raw: string): number {
  if (!raw) return 0;
  let s = String(raw).replace(/[^\d.,]/g, "");
  if (!s) return 0;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(".")) {
    const parts = s.split(".");
    const last = parts[parts.length - 1];
    if (parts.length > 2 || last.length === 3) {
      // milhar: 1.234 / 1.234.567
      s = parts.join("");
    }
    // senão: ponto decimal (10.5 / 10.50) — mantém s como está
  }
  const n = parseFloat(s);
  return isFinite(n) && n >= 0 ? n : 0;
}
export function productsFromNotes(notes?: string | null): string {
  if (!notes) return "";
  const mt = notes.match(/\(([^)]+)\)/);
  return mt ? mt[1] : "";
}
export function periodLabel(acc: CreditAccount): string {
  const { period_unit, period_count } = acc;
  if (!period_unit || period_count == null) return "";
  if (period_unit === "month" && period_count === 1) return "Mensal";
  if (period_unit === "week" && period_count === 1) return "Semanal";
  if (period_unit === "week" && period_count === 2) return "Quinzenal";
  if (period_unit === "day") return `A cada ${period_count}d`;
  return `${period_count}${period_unit === "week" ? "sem" : period_unit === "month" ? "mês" : "d"}`;
}

// Score label human-readable
export function scoreColor(label?: string | null): string {
  if (!label) return Colors.ink3;
  if (label === "premium" || label === "bom") return Colors.green;
  if (label === "regular") return Colors.amber;
  return Colors.red;
}
export function scoreLabelPt(label?: string | null): string {
  const map: Record<string, string> = {
    premium: "Premium", bom: "Bom", regular: "Regular",
    restrito: "Restrito", bloqueado: "Bloqueado",
  };
  return label ? (map[label] ?? label) : "";
}
