// ============================================================
// AURA. — Crediário · Juntar carnês (10/10/2026, Aura-backend#803)
//
// Cliente isolado, no molde de services/creditReschedule.ts: fora do
// creditApi.ts gigante, request() de @/services/api, Idempotency-Key no POST.
//
// preview é READ-ONLY (sem efeitos); apply junta de verdade. O apply devolve
// o mesmo plano do preview mais o carnê novo — o que a lojista viu em "Como
// fica" é o que foi gravado.
//
// account_ids: ids dos carnês; "general" = o grupo sem carnê ("Compras
// anteriores"). total omitido = soma do que falta; informado = desconto ou
// acréscimo no saldo, como na renegociação.
//
// Backend anterior ao #803 não tem a rota: responde 404 sem `code`. Quem
// chama trata com utils/crediarioCarne.mensagemErroJuncao.
// ============================================================
import { request } from "@/services/api";

export type MergeOpts = {
  account_ids: string[];
  installments: number;
  /** AAAA-MM-DD */
  first_due_date: string;
  period_unit?: "day" | "week" | "month";
  period_count?: number;
  /** Total alvo (reais). Omitir = soma do que falta nos carnês marcados. */
  total?: number | null;
  name?: string;
};

export type MergeOrigin = {
  account_id: string | null;
  name: string;
  open_remaining: number;
  unscheduled: number;
  remaining: number;
};

export type MergePlan = {
  /** Nome que o carnê novo vai ter. */
  name: string;
  origins: MergeOrigin[];
  open_remaining: number;
  target_total: number;
  /** target_total − o que falta. <0 = desconto, >0 = acréscimo. */
  delta: number;
  installments_count: number;
  schedule: Array<{ number: number; amount_due: number; due_date: string }>;
  /** Só no apply: o carnê criado. */
  account?: { id: string; name: string };
  /** Só no apply: ajuste lançado no saldo quando o total mudou. */
  adjustment?: { type: "discount" | "surcharge"; amount: number } | null;
  /** Só no apply. */
  new_balance?: number;
  /** Só no apply: o backend devolveu uma junção já aplicada (replay). */
  replayed?: boolean;
};

const base = (companyId: string, customerId: string) =>
  `/companies/${companyId}/credit/customers/${customerId}/accounts/merge`;

/** Query do preview. Exportada para o teste conferir o que vai na URL. */
export function mergePreviewQuery(opts: MergeOpts): string {
  const qs = new URLSearchParams();
  // Vírgula literal na lista (o contrato é account_ids=<id>,<id>,general).
  const ids = opts.account_ids.map(encodeURIComponent).join(",");
  qs.set("installments", String(opts.installments));
  qs.set("first_due_date", opts.first_due_date);
  if (opts.period_unit) qs.set("period_unit", opts.period_unit);
  if (opts.period_count) qs.set("period_count", String(opts.period_count));
  if (opts.total != null) qs.set("total", String(opts.total));
  if (opts.name) qs.set("name", opts.name);
  return `account_ids=${ids}&${qs}`;
}

export const mergeApi = {
  /** Como fica o carnê juntado (sem gravar nada). */
  preview(companyId: string, customerId: string, opts: MergeOpts): Promise<MergePlan> {
    // retry 0: o painel refaz o pedido a cada mudança; repetir sozinho um
    // 404 de rota inexistente só atrasa o aviso de "indisponível".
    return request<MergePlan>(`${base(companyId, customerId)}/preview?${mergePreviewQuery(opts)}`, { retry: 0 });
  },

  /**
   * Junta os carnês. `idempotencyKey` DEVE ser estável entre as tentativas do
   * MESMO pedido — quem chama guarda num ref e só descarta no sucesso ou
   * quando o plano muda (mesmo padrão da renegociação; ver a história da
   * Valen em services/creditReschedule.ts).
   */
  apply(companyId: string, customerId: string, opts: MergeOpts, idempotencyKey?: string): Promise<MergePlan> {
    const body: Record<string, unknown> = {
      account_ids: opts.account_ids,
      installments: opts.installments,
      first_due_date: opts.first_due_date,
      period_unit: opts.period_unit,
      period_count: opts.period_count,
    };
    if (opts.total != null) body.total = opts.total;
    if (opts.name) body.name = opts.name;
    return request<MergePlan>(base(companyId, customerId), {
      method: "POST",
      body,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    });
  },
};
