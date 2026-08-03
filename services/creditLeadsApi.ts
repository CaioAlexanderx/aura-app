// ============================================================
// AURA. — Crédito Livre (leads de crediário quitado)
//
// Cliente da rota GET /companies/:id/credit/leads (Aura-backend#455).
// Arquivo próprio em vez de entrar no creditApi.ts: espelha a
// decomposição que o backend já começou (creditBalances.js /
// creditLeads.js) e mantém o slice isolado.
// ============================================================
import { request } from "@/services/api";

export type CreditLead = {
  id: string;
  name: string;
  phone: string | null;
  cpf_cnpj: string | null;
  balance: number;
  total_debited: number;
  total_paid: number;
  /** Último movimento da conta — NÃO é a data da última parcela paga.
   *  Em contas regularizadas na mão as duas divergem; o backend expõe
   *  este campo justamente pra não mentir com "quitou em". */
  zeroed_since: string | null;
  days_since_activity: number;
  last_credit_purchase_at: string | null;
  credit_score: number | null;
  total_paid_count: number;
  total_paid_on_time: number;
  avg_days_late: number | null;
  profile_status: string | null;
  last_contact_at: string | null;
  owes_elsewhere: boolean;
  /** 0-100, calculado no backend: volume + pontualidade + recência. */
  score: number;
};

export type CreditLeadsResponse = {
  leads: CreditLead[];
  total: number;
  window_months: number | null;
  segment: "pending" | "done" | "all";
  /** Contagem dos dois segmentos na janela atual — permite mostrar os
   *  dois números sem uma segunda chamada. null quando a tabela de
   *  contatos ainda não existe (deploy parcial). */
  pending_count: number | null;
  contacted_count: number | null;
  without_phone: number;
};

export type LeadWindow = "3" | "6" | "12" | "all";
/** "pending" = fila útil (ainda não contatados) · "done" = já contatados */
export type LeadSegment = "pending" | "done";

export const creditLeadsApi = {
  list(
    companyId: string,
    opts?: { months?: LeadWindow; segment?: LeadSegment; q?: string; limit?: number }
  ) {
    const qs = new URLSearchParams();
    if (opts?.months) qs.set("months", opts.months);
    // O corte por contato é feito no banco, não aqui: se viesse misturado,
    // os contatados consumiriam o LIMIT e encurtariam a fila real.
    if (opts?.segment) qs.set("contacted", opts.segment === "done" ? "1" : "0");
    if (opts?.q) qs.set("q", opts.q);
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const tail = qs.toString() ? `?${qs}` : "";
    return request<CreditLeadsResponse>(`/companies/${companyId}/credit/leads${tail}`);
  },
};

// ── Helpers de leitura ────────────────────────────────────
// O "porquê" da posição na lista mora aqui e não na tela: é regra de
// leitura do dado, e a tela só renderiza a frase pronta.

/** Frase curta explicando por que o cliente está naquela posição.
 *  Sem isso a ordenação vira caixa-preta e o lojista não confia nela. */
export function leadReason(l: CreditLead): { text: string; tone: "good" | "warn" | "neutral" } {
  const parts: string[] = [];
  let tone: "good" | "warn" | "neutral" = "neutral";

  if (l.total_paid_count > 0 && l.total_paid_on_time === l.total_paid_count) {
    parts.push("sempre em dia");
    tone = "good";
  } else if (l.avg_days_late != null && l.avg_days_late > 0) {
    parts.push(`pagou com atraso (${Math.round(l.avg_days_late)}d em média)`);
    tone = "warn";
  }

  if (l.total_paid_count > 0) {
    parts.push(`${l.total_paid_count} parcela${l.total_paid_count !== 1 ? "s" : ""} paga${l.total_paid_count !== 1 ? "s" : ""}`);
  }

  if (l.days_since_activity <= 15) parts.push("zerou faz pouco tempo");

  // Cliente sem perfil de crédito não é penalizado — só não temos o que dizer.
  if (!parts.length) return { text: "histórico de crediário na loja", tone: "neutral" };
  return { text: parts.join(" · "), tone };
}

/** "há 12 dias" / "ontem" / "hoje" — o lojista lê recência melhor que data seca. */
export function relativeDays(days: number): string {
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.round(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `há ${years} ano${years !== 1 ? "s" : ""}`;
}
