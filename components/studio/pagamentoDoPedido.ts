// ============================================================
// AURA Studio · Pagamento do pedido da vitrine no painel (26/09/2026)
//
// Achado A1 do QA da lojista (P0). O pedido da vitrine Studio mora em
// digital_orders; pago pela chave Pix, ele fica em "pending_payment" até
// a lojista confirmar. O botão só existia na fila do Canal Digital, de
// onde a conta Studio é redirecionada, e o detalhe /studio/pedidos/:id
// não mostrava nada do pagamento. O job de 72 h (backend
// lojaPixExpiradoJob) cancelava sozinho o pedido que já estava pago.
//
// Regras puras, fora do componente (mesmo motivo de utils/filaDePedidos:
// Toast importa Icon, e Icon quebra no Jest). O bloco "Pagamento" do
// detalhe e o selo da fila só desenham o que sai daqui.
//
// A baixa reusa a rota do Canal (approve-payment / reject-payment), então
// quem pode confirmar é a mesma régua do Canal: podeConfirmarPagamento.
// ============================================================
import { podeConfirmarPagamento } from "@/utils/filaDePedidos";

export type TomDoPagamento = "atencao" | "sucesso" | "neutro";

/** O que o detalhe do pedido Studio recebe do backend (todos opcionais: backend antigo não manda). */
export interface PagamentoDoPedido {
  id?: string;
  company_id?: string | null;
  source?: string | null;
  status?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_proof_url?: string | null;
  total?: number | string | null;
  total_amount?: number | string | null;
  order_number?: string | number | null;
  customer_name?: string | null;
}

export type ChaveDaSituacao =
  | "aguardando" | "aguardando_cartao" | "cliente_disse_que_pagou" | "comprovante_enviado"
  | "pago" | "na_entrega" | "vencido" | "cancelado";

export interface SituacaoDoPagamento {
  chave: ChaveDaSituacao;
  rotulo: string;
  detalhe: string;
  tom: TomDoPagamento;
  /** A lojista tem algo a fazer agora (bloco em âmbar, no topo). */
  precisaAgir: boolean;
}

const PAGO = ["confirmed", "paid", "received"];
const ANDOU = ["confirmed", "preparing", "ready", "delivered"];

/** "R$ 1.234,56" — nunca "1234.56". */
export function reais(v: number | string | null | undefined): string {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return "R$ —";
  const [inteiro, centavos] = Math.abs(n).toFixed(2).split(".");
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}R$ ${milhar},${centavos}`;
}

export function formaDoPagamento(metodo?: string | null): string {
  if (metodo === "card") return "Cartão";
  if (metodo === "on_delivery") return "Na retirada/entrega";
  return "Pix";
}

export function totalDoPedido(p: PagamentoDoPedido): number | string | null | undefined {
  return p.total ?? p.total_amount;
}

/** Pedido da vitrine com os campos de pagamento. Sem eles (backend antigo, PDV), o bloco some. */
export function temBlocoDePagamento(p: PagamentoDoPedido | null | undefined): boolean {
  if (!p) return false;
  if (p.source && p.source !== "digital") return false;
  return !!p.payment_method;
}

export function situacaoDoPagamento(p: PagamentoDoPedido): SituacaoDoPagamento {
  const status = p.status || "";
  const metodo = p.payment_method || "pix";

  if (status === "cancelled") {
    if (p.payment_status === "expired") {
      return {
        chave: "vencido", rotulo: "Vencido", tom: "neutro", precisaAgir: false,
        detalhe: "O Pix não foi pago no prazo e o pedido foi cancelado automaticamente.",
      };
    }
    return { chave: "cancelado", rotulo: "Cancelado", tom: "neutro", precisaAgir: false, detalhe: "Pedido cancelado." };
  }

  if (PAGO.includes(p.payment_status || "")) {
    return {
      chave: "pago", rotulo: "Pago", tom: "sucesso", precisaAgir: false,
      detalhe: metodo === "card" ? "Pagamento confirmado pelo cartão." : "Pagamento confirmado.",
    };
  }

  if (metodo === "on_delivery") {
    if (status === "delivered") {
      return { chave: "pago", rotulo: "Pago", tom: "sucesso", precisaAgir: false, detalhe: "Pago na retirada/entrega." };
    }
    return {
      chave: "na_entrega", rotulo: "A receber na retirada/entrega", tom: "neutro", precisaAgir: false,
      detalhe: "A cliente paga quando receber ou retirar o pedido.",
    };
  }

  if (ANDOU.includes(status)) {
    return { chave: "pago", rotulo: "Pago", tom: "sucesso", precisaAgir: false, detalhe: "Pagamento confirmado." };
  }

  if (metodo === "card") {
    return {
      chave: "aguardando_cartao", rotulo: "Aguardando pagamento", tom: "neutro", precisaAgir: false,
      detalhe: "A cliente foi para o pagamento com cartão. A confirmação entra sozinha quando for aprovado.",
    };
  }

  if (p.payment_proof_url) {
    return {
      chave: "comprovante_enviado", rotulo: "Comprovante enviado", tom: "atencao", precisaAgir: true,
      detalhe: "Confira o comprovante e o extrato do banco antes de aprovar.",
    };
  }

  if (status === "awaiting_approval") {
    return {
      chave: "cliente_disse_que_pagou", rotulo: "Cliente disse que pagou", tom: "atencao", precisaAgir: true,
      detalhe: "Confira no extrato do banco se o Pix caiu antes de aprovar.",
    };
  }

  return {
    chave: "aguardando", rotulo: "Aguardando pagamento", tom: "atencao", precisaAgir: true,
    detalhe: "A cliente ainda não avisou que pagou. Se o Pix já caiu na sua conta, confirme abaixo. "
      + "Sem pagamento, o pedido é cancelado sozinho 72 h depois de feito.",
  };
}

/**
 * As ações do bloco. Mesma régua da fila do Canal (Pix pendente ou com
 * aviso de pago; cartão nunca — quem confirma é o Mercado Pago).
 */
export function acoesDoPagamento(p: PagamentoDoPedido): { podeAgir: boolean; rotuloConfirmar: string } {
  const podeAgir = podeConfirmarPagamento({
    id: p.id || "", order_number: p.order_number ?? "", created_at: "",
    status: p.status || "", payment_method: p.payment_method,
  });
  return {
    podeAgir,
    rotuloConfirmar: p.status === "awaiting_approval" ? "Aprovar pagamento" : "Confirmar pagamento recebido",
  };
}

/** Comprovante em PDF abre fora; imagem vira miniatura. A URL do R2 traz "?v=". */
export function comprovanteEhPdf(url?: string | null): boolean {
  return !!url && /\.pdf(\?|#|$)/i.test(url);
}

/**
 * Selo discreto da fila de pedidos. `status` do item da fila do Studio é a
 * etapa de PRODUÇÃO; a situação do pedido vem em `order_status` (hub) ou em
 * `status` (lista /studio/orders, que já é o status de digital_orders).
 */
export function seloDoPagamentoNaFila(item: {
  order_status?: string | null;
  status?: string | null;
  payment_method?: string | null;
  has_payment_proof?: boolean | null;
}): { rotulo: string; tom: TomDoPagamento } | null {
  const status = item.order_status ?? item.status ?? "";
  if (item.payment_method === "card" || item.payment_method === "on_delivery") return null;
  if (status === "awaiting_approval") return { rotulo: "Pagamento a conferir", tom: "atencao" };
  if (status === "pending_payment") {
    return item.has_payment_proof
      ? { rotulo: "Pagamento a conferir", tom: "atencao" }
      : { rotulo: item.payment_method === "pix" ? "Aguardando Pix" : "Aguardando pagamento", tom: "neutro" };
  }
  return null;
}
