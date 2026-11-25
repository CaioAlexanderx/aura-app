// ============================================================================
// AURA. — Situação do crediário: UMA regra para a cor da parcela e do cliente
// (25/11/2026, mockup docs/mockups/crediario-cores-e-movimento.html, aprovado
// pelo Caio).
//
//   atrasado   → vermelho. Regra única de atraso (utils/creditOverdue):
//                venceu há mais de 3 dias (carência) e falta mais de R$ 2.
//   a_conferir → violeta. Parcela vencida antes de o carnê ser cadastrado
//                (retroativa) ou parcela aberta sem dívida no razão.
//   a_vencer   → âmbar. Aberta, não atrasada, que vence hoje, nos próximos
//                DIAS_A_VENCER dias, ou já venceu dentro da carência.
//   em_dia     → verde (ou neutro onde o desenho pede). O resto.
//
// Quem usa: a lista de clientes (e a consolidada, multi-CNPJ, que é a mesma
// lista), a lista ao lado da ficha, a ficha (fato "O que vem agora" e linha
// da parcela) e a mensagem de cobrança (utils/crediarioMensagem). Pura, sem
// React; "hoje" sempre pode ser passado (testes).
// ============================================================================
import {
  DEFAULT_GRACE_DAYS, RESIDUE_TOLERANCE, daysBetween, isCustomerOverdue, parcelaAConferirEm,
  parcelaEmAtrasoEm, statusDaCarteira, todaySP,
  type CustomerRowLike, type InstallmentLike,
} from "./creditOverdue";
import { diaEmSaoPaulo } from "./crediarioMovimentacao";

/** Quantos dias à frente uma parcela já conta como "a vencer". */
export const DIAS_A_VENCER = 7;

export type SituacaoDoCrediario = "em_dia" | "a_vencer" | "atrasado" | "a_conferir";

export type EntradaDaSituacao = {
  /** Já classificada como atraso pela regra única (backend ou fallback). */
  atrasado: boolean;
  /** Retroativa ou sem dívida no razão. */
  aConferir?: boolean;
  /** Restante dentro do resíduo (≤ R$ 2): conta como paga. */
  quitada?: boolean;
  /** Vencimento da parcela (ou o mais antigo em aberto do cliente). */
  vencimento?: string | null;
  /** YYYY-MM-DD em São Paulo; padrão: hoje. */
  hoje?: string;
  carencia?: number;
};

/** O dia do vencimento em São Paulo (o mesmo que a ficha mostra). */
function dia(v: string | null | undefined): string | null {
  return diaEmSaoPaulo(v) || null;
}

/** Dias até o vencimento (negativo = já venceu). null sem data. */
export function diasParaVencer(vencimento: string | null | undefined, hoje: string = todaySP()): number | null {
  const d = dia(vencimento);
  return d ? daysBetween(hoje, d) : null;
}

/** A regra, com os fatos já apurados. */
export function situacaoDoCrediario(e: EntradaDaSituacao): SituacaoDoCrediario {
  if (e.atrasado) return "atrasado";
  if (e.aConferir) return "a_conferir";
  if (e.quitada) return "em_dia";
  const dias = diasParaVencer(e.vencimento, e.hoje ?? todaySP());
  if (dias == null || dias > DIAS_A_VENCER) return "em_dia";
  // Venceu há mais que a carência e a regra única não chamou de atraso
  // (resíduo, retroativa já tratada acima): nada a destacar.
  if (dias < -(e.carencia ?? DEFAULT_GRACE_DAYS)) return "em_dia";
  return "a_vencer";
}

/** Situação de uma parcela em aberto (prefere is_overdue/needs_review do backend). */
export function situacaoDaParcelaAberta(
  ins: InstallmentLike, hoje: string = todaySP(), carencia: number = DEFAULT_GRACE_DAYS,
): SituacaoDoCrediario {
  const atrasado = parcelaEmAtrasoEm(ins, hoje, carencia);
  const temResto = ins?.remaining != null || ins?.amount_due != null;
  const resto = ins?.remaining ?? ((ins?.amount_due ?? 0) - (ins?.covered_amount ?? 0));
  return situacaoDoCrediario({
    atrasado,
    aConferir: !atrasado && parcelaAConferirEm(ins, hoje),
    quitada: temResto && resto <= RESIDUE_TOLERANCE,
    vencimento: ins?.due_date ?? null,
    hoje,
    carencia,
  });
}

/**
 * Situação do cliente numa linha da carteira (/credit/balances). A data é a
 * do vencimento mais antigo em aberto (next_due_date do backend).
 */
export function situacaoDoCliente(cust: CustomerRowLike, hoje: string = todaySP()): SituacaoDoCrediario {
  const atrasado = isCustomerOverdue(cust);
  const aConferir = !atrasado && (statusDaCarteira(cust) === "conferir" || (Number(cust?.to_review_count) || 0) > 0);
  return situacaoDoCrediario({ atrasado, aConferir, vencimento: cust?.next_due_date ?? null, hoje });
}

/** "vence hoje" / "vence amanhã" (únicos textos novos da parcela); null no resto. */
export function avisoDoVencimento(vencimento: string | null | undefined, hoje: string = todaySP()): string | null {
  const dias = diasParaVencer(vencimento, hoje);
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return null;
}

function ddmm(v: string | null | undefined): string {
  const d = dia(v);
  return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "";
}

/**
 * Subtítulo da linha da carteira, sem cor própria (o selo já diz a
 * situação). Só textos que já existiam no app, mais "maior atraso N dias",
 * "vence hoje" e "vence amanhã" do mockup.
 */
export function detalheDoCliente(
  situacao: SituacaoDoCrediario,
  c: { diasDeAtraso?: number; conferirSaldo?: boolean; aConferir?: number; vencimento?: string | null },
  hoje: string = todaySP(),
): string {
  if (situacao === "atrasado") {
    const n = Math.max(0, Math.round(Number(c.diasDeAtraso) || 0));
    return n > 0 ? `maior atraso ${n} ${n === 1 ? "dia" : "dias"}` : "";
  }
  if (situacao === "a_conferir") {
    if (c.conferirSaldo) return "Conferir saldo";
    return (c.aConferir ?? 0) > 0 ? `${c.aConferir} a conferir` : "";
  }
  const data = ddmm(c.vencimento);
  if (!data) return "";
  if (situacao === "a_vencer") {
    const dias = diasParaVencer(c.vencimento, hoje) ?? 0;
    return avisoDoVencimento(c.vencimento, hoje) ?? (dias < 0 ? `venceu ${data}` : `vence ${data}`);
  }
  // Data passada sem atraso (resíduo de centavos): "próx." seria mentira.
  return (diasParaVencer(c.vencimento, hoje) ?? -1) >= 0 ? `próx. ${data}` : "";
}

/** Os quatro selos. */
export const ROTULO_DA_SITUACAO: Record<SituacaoDoCrediario, string> = {
  em_dia: "Em dia",
  a_vencer: "A vencer",
  atrasado: "Atrasado",
  a_conferir: "A conferir",
};
