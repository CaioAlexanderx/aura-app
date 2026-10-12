// ============================================================
// AURA. — Novo lançamento do crediário: contas puras (12/10/2026)
//
// Redesenho aprovado (docs/mockups/crediario-lancamento-manual.html). O modal
// antigo tinha estas contas espalhadas entre 25 useState e o JSX; aqui ficam
// as que não dependem de React, para o formulário (useLancamentoForm), as três
// telas e os testes usarem a mesma regra:
//   - máscara de moeda e telefone, padrões de data (vieram do modal antigo,
//     sem mudança de comportamento);
//   - periodToPayload: periodicidade → period_unit/period_count do payload;
//   - cronograma: datas de cada parcela a partir do 1º vencimento, só para
//     mostrar (rodapé "11/11 a 11/01" e a tela Pronto). Quem grava as
//     parcelas é o backend;
//   - atalhos do 1º vencimento ("em 30 dias", "dia 10");
//   - recentes do passo 1: quais clientes da carteira aparecem antes de
//     digitar e o chip de cada um ("Em dia" / "Atraso Nd" / "Quitada").
// ============================================================
import { formatIsoToBr } from "@/components/inputs/DateInput";
import { fmtDate } from "@/components/crediario/ficha/fichaHelpers";
import { daysLate, statusDaCarteira } from "@/utils/creditOverdue";
import type { CreditBalanceItem, PeriodUnit } from "@/services/creditApi";

export type PeriodKind = "semanal" | "quinzenal" | "mensal" | "custom";
export type AccountMode = "general" | "existing" | "new";

export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

// ── Máscaras ───────────────────────────────────────────────────────────────
export function fmtCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrencyInput(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

export function fmtPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

export function fmtCur(n: number) {
  return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Delega pro fmtDate da ficha em vez de reimplementar: uma cópia antiga tinha
// o MESMO D-1 do carnê por outro caminho -- sem `timeZone`, o navegador em SP
// converte a meia-noite UTC que o backend manda para 21:00 do dia anterior.
export function fmtDateSafe(input: string | null | undefined): string {
  if (!input) return "—";
  return fmtDate(String(input)) || "—";
}

// ── Datas ──────────────────────────────────────────────────────────────────
/** Hoje em America/Sao_Paulo, YYYY-MM-DD. */
export function hojeIsoSp(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function isoDeUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 1º vencimento padrão: hoje + 1 mês (relógio local, como sempre foi). */
export function defaultDueDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function todayBrSp(): string {
  return formatIsoToBr(hojeIsoSp());
}

/** Atalho "em 30 dias": hoje (SP) + N dias corridos, dd/mm/aaaa. */
export function emDias(dias: number, hojeIso: string = hojeIsoSp()): string {
  const d = new Date(hojeIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return formatIsoToBr(isoDeUtc(d));
}

/** Atalho "dia 10": o próximo dia 10 depois de hoje (hoje dia 10 → mês que vem). */
export function proximoDia(dia: number, hojeIso: string = hojeIsoSp()): string {
  const [y, m, d] = hojeIso.split("-").map((x) => parseInt(x, 10));
  const alvo = d < dia ? new Date(Date.UTC(y, m - 1, dia)) : new Date(Date.UTC(y, m, dia));
  return formatIsoToBr(isoDeUtc(alvo));
}

export function periodToPayload(kind: PeriodKind, customDays: string): { period_unit: PeriodUnit; period_count: number } {
  if (kind === "semanal")   return { period_unit: "week", period_count: 1 };
  if (kind === "quinzenal") return { period_unit: "week", period_count: 2 };
  if (kind === "custom")    return { period_unit: "day", period_count: Math.max(1, parseInt(customDays, 10) || 1) };
  return { period_unit: "month", period_count: 1 };
}

export const PERIODOS: Array<[PeriodKind, string]> = [
  ["mensal", "Mensal"], ["quinzenal", "Quinzenal"], ["semanal", "Semanal"], ["custom", "A cada N dias"],
];

export function rotuloDoPeriodo(kind: PeriodKind, customDays: string): string {
  if (kind === "custom") return `A cada ${Math.max(1, parseInt(customDays, 10) || 1)} dias`;
  return PERIODOS.find(([k]) => k === kind)?.[1] || "Mensal";
}

/**
 * Datas (YYYY-MM-DD) das `n` parcelas a partir do 1º vencimento, no intervalo
 * escolhido. Mês soma no calendário e encosta no último dia (31/01 → 28/02).
 * Só para exibir; vazio quando a data não é válida.
 */
export function cronograma(primeiraIso: string | null, n: number, unit: PeriodUnit, count: number): string[] {
  if (!primeiraIso || !/^\d{4}-\d{2}-\d{2}$/.test(primeiraIso) || n < 1) return [];
  const [y, m, d] = primeiraIso.split("-").map((x) => parseInt(x, 10));
  const out: string[] = [];
  const total = Math.min(n, 1000);
  for (let i = 0; i < total; i++) {
    if (unit === "month") {
      const mes = m - 1 + i * count;
      const ultimo = new Date(Date.UTC(y, mes + 1, 0)).getUTCDate();
      out.push(isoDeUtc(new Date(Date.UTC(y, mes, Math.min(d, ultimo)))));
    } else {
      const passo = unit === "week" ? 7 * count : count;
      out.push(isoDeUtc(new Date(Date.UTC(y, m - 1, d + i * passo))));
    }
  }
  return out;
}

/** "YYYY-MM-DD" → "dd/mm". */
export function diaMes(iso: string | null | undefined): string {
  const br = formatIsoToBr(iso || "");
  return br ? br.slice(0, 5) : "";
}

/** "11/11 a 11/01" (uma parcela: só a data). */
export function faixaDeDatas(datas: string[]): string {
  if (datas.length === 0) return "";
  if (datas.length === 1) return diaMes(datas[0]);
  return `${diaMes(datas[0])} a ${diaMes(datas[datas.length - 1])}`;
}

/** "11/11 · 11/12 · 11/01"; com muitas parcelas vira a faixa. */
export function listaDeDatas(datas: string[], max = 4): string {
  if (datas.length <= max) return datas.map(diaMes).join(" · ");
  return faixaDeDatas(datas);
}

// ── Recentes do passo 1 ────────────────────────────────────────────────────
export type RecenteDoLancamento = Pick<CreditBalanceItem, "id" | "name" | "phone" | "balance"> &
  Partial<Pick<CreditBalanceItem,
    "last_activity_at" | "overdue" | "next_due_date" | "oldest_overdue_date"
    | "open_installments" | "ledger_mismatch">>;

/**
 * Os clientes que o passo 1 mostra antes de digitar: quem tem saldo primeiro,
 * e dentro de cada grupo a atividade mais recente (last_activity_at de
 * /balances). Sem endpoint novo: a lista é a carteira que a tela já carregou.
 */
export function escolherRecentes<T extends RecenteDoLancamento>(lista: T[] | null | undefined, max = 5): T[] {
  if (!lista?.length) return [];
  const comSaldo = (c: T) => ((Number(c.balance) || 0) > 0.009 ? 1 : 0);
  const quando = (c: T) => (c.last_activity_at ? Date.parse(c.last_activity_at) || 0 : 0);
  return [...lista]
    .sort((a, b) => comSaldo(b) - comSaldo(a) || quando(b) - quando(a))
    .slice(0, max);
}

export type ChipDoRecente = { rotulo: string; tom: "ok" | "atraso" | "conferir" | "zero" };

/** Chip da linha: mesma regra de atraso da carteira (utils/creditOverdue). */
export function chipDoRecente(c: RecenteDoLancamento): ChipDoRecente {
  const status = statusDaCarteira(c);
  if (status === "atraso") {
    const dias = daysLate(c.oldest_overdue_date ?? c.next_due_date ?? null);
    return { rotulo: dias > 0 ? `Atraso ${dias}d` : "Atraso", tom: "atraso" };
  }
  if (status === "conferir") return { rotulo: "Conferir", tom: "conferir" };
  if ((Number(c.balance) || 0) <= 0.009) return { rotulo: "Quitada", tom: "zero" };
  return { rotulo: "Em dia", tom: "ok" };
}

/** Iniciais para o avatar ("Maria Souza" → "MS"). */
export function iniciais(nome: string): string {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function primeiroNome(nome: string | null | undefined): string {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}
