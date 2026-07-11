// ============================================================
// CampaignWizard — tipos e helpers compartilhados (Fase F3)
//
// Wizard multi-passo pra disparar a campanha anual de anuidades (dojôs e/ou
// praticantes faixa-preta). Segue o DNA estrutural do TrocaModal (PDV):
// overlay próprio (NÃO <Modal> do RN — evita o bug "Modal dentro de Modal
// no RN Web renderiza atrás"), stepbar numerado, footer fixo com
// voltar/continuar, e um passo final de RESULTADO com números reais da API
// (nunca otimista). Ver CampaignWizard.tsx pro shell.
// ============================================================
import type {
  AnnuityCampaignPreviewDojo,
  AnnuityCampaignPreviewPractitioner,
  AnnuityCampaignPreviewResponse,
  AnnuityCampaignScope,
} from "@/services/karateApi";

export type CampaignStep = 1 | 2 | 3 | 4;

export function fmtMoney(v: number): string {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-05-31" → "31 de mai/2026". Sem `new Date(iso)` direto (timezone) —
 *  parse manual dos componentes, mesmo cuidado do resto do hub de anuidades. */
export function fmtDueDateLong(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "—";
  const day = parseInt(m[3], 10);
  const month = MONTH_ABBR[parseInt(m[2], 10) - 1] ?? "—";
  return `${day} de ${month}/${m[1]}`;
}

/** Conta de elegíveis por opção de escopo, a partir do MESMO preview
 *  (scope='both') buscado uma única vez na abertura do wizard — evita
 *  refazer a chamada só porque o usuário está trocando de aba no passo 1. */
export function countForScope(preview: AnnuityCampaignPreviewResponse | null, scope: AnnuityCampaignScope): number {
  if (!preview) return 0;
  if (scope === "dojos") return preview.totals.dojos_count;
  if (scope === "practitioners") return preview.totals.practitioners_count;
  return preview.totals.dojos_count + preview.totals.practitioners_count;
}

export function amountSum(rows: { amount: number }[]): number {
  return Math.round(rows.reduce((s, r) => s + Number(r.amount || 0), 0) * 100) / 100;
}

/** Vencimento "de referência" a mostrar no passo 2 — prioriza dojô (mesma
 *  vigência costuma valer pros dois grupos); cai pra praticante quando não
 *  há dojô elegível no preview atual. */
export function referenceDueDate(preview: AnnuityCampaignPreviewResponse | null): { due_date: string | null; due_date_ajustada: boolean } {
  if (!preview) return { due_date: null, due_date_ajustada: false };
  const d = preview.dojos[0];
  if (d) return { due_date: d.due_date, due_date_ajustada: d.due_date_ajustada };
  const p = preview.practitioners[0];
  if (p) return { due_date: p.due_date, due_date_ajustada: p.due_date_ajustada };
  return { due_date: null, due_date_ajustada: false };
}

export type ScopedRows = {
  dojos: AnnuityCampaignPreviewDojo[];
  practitioners: AnnuityCampaignPreviewPractitioner[];
};

/** Filtra o preview (sempre scope='both' internamente) pelas linhas
 *  relevantes ao escopo escolhido no passo 1. */
export function rowsForScope(preview: AnnuityCampaignPreviewResponse | null, scope: AnnuityCampaignScope | null): ScopedRows {
  if (!preview || !scope) return { dojos: [], practitioners: [] };
  return {
    dojos: scope === "practitioners" ? [] : preview.dojos,
    practitioners: scope === "dojos" ? [] : preview.practitioners,
  };
}
