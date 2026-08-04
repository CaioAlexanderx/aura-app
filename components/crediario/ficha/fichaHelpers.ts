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
// ── D-1 do carnê (03/08/2026) ───────────────────────────────────────────
// O carnê inteiro exibia o vencimento um dia antes do gravado.
//
// Cadeia: o pool do `pg` (backend, src/config/database.js) sobrescreve o
// type parser de NUMERIC mas NÃO o de DATE (oid 1082). Sem isso o driver
// devolve coluna `date` como objeto Date na meia-noite do fuso do processo
// — e o backend não define TZ, então herda UTC do container. Ou seja,
// `due_date = 2026-08-03` chega na API como "2026-08-03T00:00:00.000Z".
// Converter isso para America/Sao_Paulo dá 21:00 do dia 02 → "02/08".
//
// A correção aqui: data pura é DIA DE CALENDÁRIO. Não tem hora, logo não
// existe conversão de fuso a fazer — formata os componentes direto. Só
// timestamp de verdade (occurred_at, created_at) vai para o fuso de SP.
//
// O casamento exige meia-noite EXATA em UTC. Timestamps reais nascem de
// now() com microssegundos (".326931" em produção), então não caem aqui
// por acidente. O caso patológico seria um evento gravado exatamente em
// 00:00:00.000Z — 21:00 de SP — que apareceria como o dia seguinte.
//
// Isto é o remendo do lado que sangra. A causa raiz é o type parser no
// backend, que afeta ~90 colunas `date` (financeiro, anuidades,
// birth_date) e está separada de propósito: mudar o parser altera o
// formato do JSON no app inteiro e pede auditoria própria.
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/;

export function fmtDate(iso: string) {
  if (!iso) return "";
  const cal = String(iso).match(CALENDAR_DATE);
  if (cal) return `${cal[3]}/${cal[2]}/${cal[1].slice(2)}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
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
