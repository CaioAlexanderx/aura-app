// ============================================================================
// AURA. — Regra ÚNICA de atraso do Crediário (espelho do backend).
//
// Espelha src/services/credit/overdue.js do Aura-backend. O backend já manda
// `is_overdue` / `needs_review` prontos: estes helpers existem só como
// FALLBACK para respostas de versões anteriores da API (app instalado velho
// falando com backend novo, ou vice-versa).
//
// Regra de ouro: NUNCA derive atraso de `installment.status`. Esse campo só é
// sincronizado quando alguém abre o dashboard ou a lista de parcelas, e fica
// congelado no meio tempo — foi exatamente isso que fez a ficha da cliente
// "livia aline" (Valen, 18/08/2026) mostrar "Em atraso" no topo enquanto os
// dois carnês mostravam "Em dia": 23 parcelas com vencimento em 2027 ainda
// carregavam status='overdue' de semanas antes.
// ============================================================================

/** Carência padrão em dias (mesma do motor de encargos). */
export const DEFAULT_GRACE_DAYS = 3;

/** Resíduo (R$) que ainda conta como parcela quitada. */
export const RESIDUE_TOLERANCE = 2;

/** Hoje em America/Sao_Paulo no formato YYYY-MM-DD (tz-safe). */
export function todaySP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Dias corridos entre duas datas YYYY-MM-DD (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

/** Dias de atraso a partir de uma data de vencimento (0 se em dia / sem data). */
export function daysLate(due?: string | null): number {
  if (!due) return 0;
  const d = due.slice(0, 10);
  const today = todaySP();
  if (d >= today) return 0;
  return Math.max(0, daysBetween(d, today));
}

type InstallmentLike = {
  is_overdue?: boolean;
  needs_review?: boolean;
  status?: string;
  due_date?: string | null;
  created_at?: string | null;
  amount_due?: number;
  covered_amount?: number;
  remaining?: number;
};

/**
 * Esta parcela está em atraso?
 * Prefere o campo do backend; só calcula localmente se ele não vier.
 */
export function isInstallmentOverdue(ins: InstallmentLike, graceDays = DEFAULT_GRACE_DAYS): boolean {
  if (typeof ins?.is_overdue === "boolean") return ins.is_overdue;
  if (ins?.status !== "pending" && ins?.status !== "overdue") return false;
  const rem = ins.remaining ?? ((ins.amount_due ?? 0) - (ins.covered_amount ?? 0));
  if (rem <= RESIDUE_TOLERANCE) return false;
  const due = ins.due_date ? String(ins.due_date).slice(0, 10) : null;
  if (!due) return false;
  const late = daysLate(due);
  if (late <= 0) return false;
  // Retroativa (cadastrada depois do próprio vencimento) = a conferir, não atraso.
  const created = ins.created_at ? String(ins.created_at).slice(0, 10) : null;
  if (created && due < created) return false;
  return late > graceDays;
}

/** Parcela retroativa vencida: carnê histórico digitalizado, a conferir. */
export function needsReview(ins: InstallmentLike): boolean {
  if (typeof ins?.needs_review === "boolean") return ins.needs_review;
  if (ins?.status !== "pending" && ins?.status !== "overdue") return false;
  const rem = ins.remaining ?? ((ins.amount_due ?? 0) - (ins.covered_amount ?? 0));
  if (rem <= RESIDUE_TOLERANCE) return false;
  const due = ins.due_date ? String(ins.due_date).slice(0, 10) : null;
  const created = ins.created_at ? String(ins.created_at).slice(0, 10) : null;
  if (!due || !created) return false;
  return due < todaySP() && due < created;
}
