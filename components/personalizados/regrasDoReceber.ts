// ============================================================
// AURA. — Personalizados: o que falta receber do pedido de orçamento (p-185)
//
// Decisão do Caio (D6, 25/11/2026): "o saldo é baixado na Produção". O
// backend (Aura-backend#1106) manda, só no pedido que saiu de orçamento e só
// com a trava do financeiro ligada lá (empresa de teste até a virada):
//   orcamento_recebido             soma dos marcos pagos
//   orcamento_falta_receber        total menos o recebido
//   orcamento_pagamentos_pendentes [{id, kind, amount}] — o id vai ao mark-paid
// Sem os campos (pedido do Caixa, loja online, trava desligada) nada muda.
//
// Pedido aprovado antes do #1106 não tem o marco do saldo: quando o que falta
// passa da soma dos pendentes, o app cria o marco `balance` pela diferença
// (POST /studio/orders/:oid/payments) antes de baixar.
//
// Regras sem tela: o cartão da Fila e o detalhe do pedido leem daqui.
// ============================================================
import type { StudioOrder, StudioPaymentKind } from "@/services/studioApi";
import { METODOS } from "@/components/screens/vendas/editarVendaUtils";

export type PendenteDoOrcamento = { id: string; kind: StudioPaymentKind; amount: number };
type ComOrcamento = Pick<StudioOrder, "orcamento_falta_receber" | "orcamento_pagamentos_pendentes">;

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * O que falta receber do pedido de orçamento, ou null quando a tela fica a de
 * hoje: campo ausente/null (não é orçamento, ou a trava está desligada no
 * backend), lista de pendentes ausente, ou nada faltando.
 */
export function faltaReceberDoOrcamento(o: Partial<ComOrcamento> | null | undefined): number | null {
  if (!o) return null;
  const bruto = o.orcamento_falta_receber;
  if (bruto === null || bruto === undefined || !Array.isArray(o.orcamento_pagamentos_pendentes)) return null;
  const falta = round2(Number(bruto));
  return Number.isFinite(falta) && falta > 0.004 ? falta : null;
}

/**
 * O que a baixa faz: os marcos pendentes, na ordem do backend (o sinal antes
 * do saldo), e quanto falta de marco (> 0 só no pedido aprovado antes do
 * #1106, que não tem o marco do saldo).
 */
export function marcosDaBaixa(o: Partial<ComOrcamento>): { pendentes: PendenteDoOrcamento[]; semMarco: number } {
  const pendentes = (Array.isArray(o.orcamento_pagamentos_pendentes) ? o.orcamento_pagamentos_pendentes : [])
    .filter((p) => p && p.id && Number(p.amount) > 0)
    .map((p) => ({ id: String(p.id), kind: p.kind, amount: round2(Number(p.amount)) }));
  const falta = faltaReceberDoOrcamento(o) || 0;
  const soma = round2(pendentes.reduce((a, p) => a + p.amount, 0));
  const semMarco = round2(falta - soma);
  return { pendentes, semMarco: semMarco > 0.004 ? semMarco : 0 };
}

/** O id que o POST /studio/orders/:oid/payments espera (o do digital_orders). */
export function idDoPedidoDosMarcos(o: Pick<StudioOrder, "id" | "digital_order_id">): string {
  return String(o.digital_order_id || o.id);
}

export type FormaDoOrcamento = "pix" | "dinheiro" | "cartao" | "debito";

// As formas saem do METODOS da edição de venda (mesmos nomes do Caixa: Pix,
// Dinheiro, Crédito, Débito), sem o crediário: o que entra aqui é dinheiro,
// não mais saldo devedor. Na ordem do botão: Pix primeiro.
const ORDEM: FormaDoOrcamento[] = ["pix", "dinheiro", "cartao", "debito"];
export const FORMAS_DO_ORCAMENTO: { key: string; label: string; icon: string }[] = ORDEM
  .map((k) => METODOS.find((m) => m.key === k))
  .filter((m): m is (typeof METODOS)[number] => !!m)
  .map((m) => ({ key: m.key as string, label: m.label, icon: m.icon }));

/** O `method` do Studio (migration 140) de cada forma, junto da `forma`. */
export const METHOD_DA_FORMA: Record<FormaDoOrcamento, "pix" | "cash" | "card"> = {
  pix: "pix", dinheiro: "cash", cartao: "card", debito: "card",
};

/** Recusas do mark-paid em que o pedido mudou por fora: a tela recarrega. */
export const CODIGOS_QUE_RECARREGAM = new Set([
  "PEDIDO_FECHADO", "PAGAMENTO_CANCELADO", "PAGAMENTO_JA_LANCADO", "PEDIDO_PAGAMENTO_MAIOR", "PEDIDO_DO_BALCAO",
]);
