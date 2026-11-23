// ============================================================
// AURA. — formas de pagamento do fechamento de caixa
//
// 23/11/2026 (pedido do Caio): a lista "forma de pagamento → valor" sai de
// um lugar só, para a prévia do fechamento (totais_ao_vivo do status), o
// relatório (snapshot do /fechar) e a reimpressão (histórico) mostrarem as
// mesmas formas, com os mesmos rótulos e na mesma ordem.
//
// Os números vêm da mesma conta no backend (calcularTotais em
// services/caixaService.js): o status usa a janela até agora; o /fechar,
// até a hora do fechamento.
// ============================================================
import type { CashClosePaymentRow } from "@/utils/cashClosePdf";

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v));
  return isFinite(n) ? n : 0;
}

type Valor = number | string | null | undefined;

/** As formas como o backend devolve no status (totais_ao_vivo). */
export type TotaisPorForma = {
  pix?: Valor;
  cartao_credito?: Valor;
  cartao_debito?: Valor;
  dinheiro?: Valor;
  fiado?: Valor;
  outros?: Valor;
};

/** As mesmas formas com o prefixo total_ (snapshot do fechamento e histórico). */
export type TotaisDoFechamento = {
  total_pix?: Valor;
  total_cartao_credito?: Valor;
  total_cartao_debito?: Valor;
  total_dinheiro?: Valor;
  total_fiado?: Valor;
  total_outros?: Valor;
};

/**
 * As formas usadas no período (só as com valor > 0), na ordem e com os
 * rótulos do relatório de fechamento. "Outros" junta o que não é Pix,
 * cartão, dinheiro nem fiado (crédito da cliente, vale, lançamento manual
 * de receita no Financeiro).
 */
export function formasDePagamento(t: TotaisPorForma | null | undefined): CashClosePaymentRow[] {
  const x = t || {};
  return [
    { label: "Pix", amount: toNum(x.pix) },
    { label: "Crédito", amount: toNum(x.cartao_credito) },
    { label: "Débito", amount: toNum(x.cartao_debito) },
    { label: "Dinheiro", amount: toNum(x.dinheiro) },
    { label: "Fiado", amount: toNum(x.fiado) },
    { label: "Outros", amount: toNum(x.outros) },
  ].filter((p) => p.amount > 0);
}

/** formasDePagamento a partir das colunas total_* do fechamento. */
export function formasDoFechamento(f: TotaisDoFechamento | null | undefined): CashClosePaymentRow[] {
  const x = f || {};
  return formasDePagamento({
    pix: x.total_pix,
    cartao_credito: x.total_cartao_credito,
    cartao_debito: x.total_cartao_debito,
    dinheiro: x.total_dinheiro,
    fiado: x.total_fiado,
    outros: x.total_outros,
  });
}

/** A ordem em que o relatório desenha as barras: do maior para o menor
 *  (mesma conta de buildCashClosePdfHtml). */
export function ordemDoRelatorio(rows: CashClosePaymentRow[]): CashClosePaymentRow[] {
  return [...rows].sort((a, b) => b.amount - a.amount);
}
