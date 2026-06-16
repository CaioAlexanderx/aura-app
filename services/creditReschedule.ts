// ============================================================
// AURA. — Crediário · Renegociação de parcelas (Item 2, 16/06/2026)
//
// Cliente isolado do motor de renegociação. Mantido FORA do creditApi.ts
// gigante de propósito (menos superfície de merge). Mesma convenção dos
// demais: request() de @/services/api, Idempotency-Key nos POST de dinheiro.
//
// reschedulePreview é READ-ONLY (dry-run, sem efeitos). applyReschedule aplica.
// Mesmo shape (ReschedulePlan) nos dois — garantia preview === aplicação.
//
// accountId === null | undefined | "general" → carnê Conta Geral (account_id IS NULL).
// total omitido → mantém o total atual (renegociação que só muda nº/valor das
// parcelas). total informado → total editável (desconto ou acréscimo no saldo).
// ============================================================
import { request } from "@/services/api";

export type RescheduleScheduleLine = {
  number: number;
  amount_due: number;
  due_date: string;
};

export type ReschedulePlan = {
  /** Saldo em aberto do escopo ANTES da renegociação (soma do restante das parcelas abertas). */
  open_remaining: number;
  /** Total alvo do novo cronograma (escolha do lojista; default = open_remaining). */
  target_total: number;
  /** target_total − open_remaining. <0 = desconto, >0 = acréscimo, 0 = só reorganizou. */
  delta: number;
  /** Nº de parcelas do novo cronograma (clampado 1..36 no backend). */
  installments_count: number;
  /** Cronograma resultante. */
  schedule: RescheduleScheduleLine[];
  /** Só no preview: quantas parcelas abertas existem no escopo (0 ⇒ nada a renegociar). */
  open_installments_count?: number;
  /** Só no apply: ids das parcelas antigas canceladas. */
  replaced_installment_ids?: string[];
  /** Só no apply: ids das novas parcelas criadas. */
  applied_installment_ids?: string[];
  /** Só no apply: ajuste lançado no saldo quando o total mudou. */
  adjustment?: { type: "discount" | "surcharge"; amount: number } | null;
  /** Só no apply: saldo novo do cliente após a renegociação. */
  new_balance?: number;
};

export type RescheduleOpts = {
  /** Total alvo (reais). Omitir = manter o saldo aberto atual. */
  total?: number | null;
  installments: number;
  first_due_date?: string;
  period_unit?: "day" | "week" | "month";
  period_count?: number;
};

const base = (companyId: string) => `/companies/${companyId}/credit`;
const acc = (accountId: string | null | undefined) => accountId || "general";

export const rescheduleApi = {
  /** Preview read-only do cronograma renegociado (sem efeitos). */
  preview(
    companyId: string,
    customerId: string,
    accountId: string | null | undefined,
    opts: RescheduleOpts,
  ): Promise<ReschedulePlan> {
    const qs = new URLSearchParams();
    qs.set("installments", String(opts.installments));
    if (opts.total != null) qs.set("total", String(opts.total));
    if (opts.first_due_date) qs.set("first_due_date", opts.first_due_date);
    if (opts.period_unit) qs.set("period_unit", opts.period_unit);
    if (opts.period_count) qs.set("period_count", String(opts.period_count));
    return request<ReschedulePlan>(
      `${base(companyId)}/customers/${customerId}/accounts/${acc(accountId)}/reschedule/preview?${qs}`,
    );
  },

  /** Aplica a renegociação: cancela o cronograma antigo, grava o novo, ajusta o saldo. */
  apply(
    companyId: string,
    customerId: string,
    accountId: string | null | undefined,
    opts: RescheduleOpts,
  ): Promise<ReschedulePlan> {
    const idempKey = "resched-" + companyId + "-" + customerId + "-" + acc(accountId) + "-" + Date.now();
    return request<ReschedulePlan>(
      `${base(companyId)}/customers/${customerId}/accounts/${acc(accountId)}/reschedule`,
      { method: "POST", body: opts, headers: { "Idempotency-Key": idempKey } },
    );
  },
};
