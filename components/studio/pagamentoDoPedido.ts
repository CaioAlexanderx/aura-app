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
  // 28/09/2026 (LJ-32/LJ-34 do QA pós-deploy): CPF/CNPJ da nota, entrega/
  // retirada, frete, desconto do Pix e o motivo do Pix vencido não
  // cancelado — services/pagamentoDoPedidoStudio.js (aura-backend),
  // camposDeEntregaENota. Tudo opcional: backend antigo, ou a consulta da
  // loja falhando no servidor, não derruba o detalhe — a linha só some.
  customer_cpf_cnpj?: string | null;
  request_nfce?: boolean;
  delivery_type?: "pickup" | "delivery" | "courier" | null;
  delivery_address?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  /** Endereço da LOJA (retirada), não da cliente. */
  retirada_endereco?: string | null;
  courier_name?: string | null;
  courier_plate?: string | null;
  courier_a_informar?: boolean;
  shipping_fee?: number | null;
  pix_discount?: number | null;
  pix_cancelamento?: { vencido: boolean; motivo: string | null } | null;
  // QA final 28/09/2026 (LJ-33, P2): quem cancelou e o motivo escrito
  // pela lojista. Ausente em backend antigo — o texto cai no genérico.
  cancelamento?: { tipo: string; motivo: string | null } | null;
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
    const tipo = p.cancelamento?.tipo;
    if (tipo === "pix_expirado" || (!tipo && p.payment_status === "expired")) {
      return {
        chave: "vencido", rotulo: "Vencido", tom: "neutro", precisaAgir: false,
        detalhe: "O Pix não foi pago no prazo e o pedido foi cancelado automaticamente.",
      };
    }
    // LJ-33 (P2): o bloco dizia só "Pedido cancelado." — sem quem nem por quê.
    const motivo = (p.cancelamento?.motivo || "").trim();
    const comMotivo = (base: string) => (motivo ? `${base} Motivo: "${motivo}".` : base);
    if (tipo === "pagamento_recusado") {
      return {
        chave: "cancelado", rotulo: "Cancelado", tom: "neutro", precisaAgir: false,
        detalhe: comMotivo("Você recusou o pagamento e o pedido foi cancelado."),
      };
    }
    if (tipo === "cancelado_pela_loja") {
      return {
        chave: "cancelado", rotulo: "Cancelado", tom: "neutro", precisaAgir: false,
        detalhe: comMotivo("Você cancelou este pedido."),
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
    // Coordenação (27/09/2026): o texto dizia o cancelamento automático sem
    // dizer as exceções que o job (lojaPixExpiradoJob) já respeita — a
    // lojista lia "72h e cancela" e achava que precisava correr mesmo
    // quando um dos quatro escapes já valia.
    detalhe: "A cliente ainda não avisou que pagou. Se o Pix já caiu na sua conta, confirme abaixo. "
      + "Sem pagamento, o pedido é cancelado sozinho 72 h depois de feito. Não cancela se a cliente "
      + "mandou comprovante ou tocou em \"Já paguei\", se você registrou o sinal ou se a produção já começou.",
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
 * O número que a cliente vê ("Pedido 00001"), nunca o id interno (uuid).
 *
 * QA do detalhe do pedido (26/09/2026, achado 2h): a mesma encomenda
 * aparecia com TRÊS identificadores diferentes — "00001" cru no título
 * (é `display_name`: a view `studio_orders` já devolve o `order_number`
 * puro pra pedidos digitais, ou o prefixo `PDV-`/`ML-`/`SHOP-`/`MKT-`
 * pros outros canais), e o uuid fatiado (`#baa22b9d`) na trilha e nos
 * cartões. Uma função só, usada em todo canto que hoje monta esse texto
 * na unha.
 */
export function numeroDoPedido(
  order: { display_name?: string | null; order_number?: string | number | null; id?: string | null } | null | undefined,
): string {
  const numero = order?.order_number ?? order?.display_name;
  if (numero != null && String(numero).trim() !== "") return "Pedido " + String(numero).trim();
  if (order?.id) return "Pedido " + String(order.id).slice(0, 8).toUpperCase();
  return "Pedido";
}

/**
 * A situação do Pix pro CARTÃO da fila de Produção (achado 4b do QA,
 * 26/09/2026) — mesma fonte de dados que `seloDoPagamentoNaFila` (Hub),
 * com dois acréscimos que o Hub não precisa: o caso "pago" (o Hub some o
 * selo quando não há mais o que agir; o cartão da fila quer confirmar
 * que o Pix já caiu) e a cor âmbar fixa pro pendente.
 */
export function situacaoDoPixNoCartao(item: {
  status?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  has_payment_proof?: boolean | null;
}): { rotulo: string; tom: TomDoPagamento } | null {
  if (item.payment_method === "card" || item.payment_method === "on_delivery") return null;
  const status = item.status ?? "";
  if (PAGO.includes(item.payment_status || "") || ANDOU.includes(status)) {
    return { rotulo: "Pix recebido", tom: "sucesso" };
  }
  if (status === "awaiting_approval") {
    return { rotulo: "Pagamento a conferir", tom: "atencao" };
  }
  if (status === "pending_payment") {
    return { rotulo: item.has_payment_proof ? "Pagamento a conferir" : "Aguardando Pix", tom: "atencao" };
  }
  return null;
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

// ── Pagamento e entrega (LJ-32, 28/09/2026) ──────────────────────────────
// O bloco novo do detalhe: CPF/CNPJ da nota, entrega/retirada, frete e o
// desconto do Pix. Tudo opcional — sem o campo (backend antigo, ou a
// consulta da loja tendo falhado no servidor), a linha correspondente
// simplesmente não entra.

/** "529.982.247-25" (CPF, 11 dígitos) ou "12.345.678/0001-90" (CNPJ, 14). Sem máscara reconhecível, devolve como veio. */
export function cpfCnpjFormatado(v?: string | null): string | null {
  const s = (v || "").replace(/\D/g, "");
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return texto(v);
}

function texto(v?: string | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s || null;
}

/**
 * "Retirada na loja · <endereço>" / "Receber em casa · <endereço>" /
 * "Retirada por app · <nome> · <placa>" / "Retirada por app · a cliente
 * informa quem busca". `null` quando o pedido não tem `delivery_type`
 * (backend antigo, ou pedido de outro canal).
 */
export function linhaDeEntrega(p: PagamentoDoPedido): string | null {
  const tipo = p.delivery_type;
  if (!tipo) return null;

  if (tipo === "courier") {
    if (p.courier_a_informar || !texto(p.courier_name)) {
      return "Retirada por app · a cliente informa quem busca";
    }
    const nome = texto(p.courier_name);
    const placa = texto(p.courier_plate);
    return placa ? `Retirada por app · ${nome} · ${placa}` : `Retirada por app · ${nome}`;
  }

  if (tipo === "delivery") {
    const endereco = texto(p.delivery_address)
      || [texto(p.address_neighborhood), texto(p.address_city)].filter(Boolean).join(", ")
      || null;
    return endereco ? `Receber em casa · ${endereco}` : "Receber em casa";
  }

  // pickup
  const endereco = texto(p.retirada_endereco);
  return endereco ? `Retirada na loja · ${endereco}` : "Retirada na loja";
}

export interface LinhaPagamentoEEntrega { rotulo: string; valor: string }

/**
 * As linhas do bloco "Pagamento e entrega": CPF/CNPJ (só quando a cliente
 * pediu a nota), entrega, frete (só > 0) e desconto do Pix (só > 0). Vazio
 * quando não há nada a mostrar — a tela então não desenha o bloco.
 */
export function linhasDePagamentoEEntrega(p: PagamentoDoPedido): LinhaPagamentoEEntrega[] {
  const linhas: LinhaPagamentoEEntrega[] = [];

  if (p.request_nfce) {
    const cpf = cpfCnpjFormatado(p.customer_cpf_cnpj);
    if (cpf) linhas.push({ rotulo: "CPF/CNPJ na nota", valor: cpf });
  }

  const entrega = linhaDeEntrega(p);
  if (entrega) linhas.push({ rotulo: "Entrega", valor: entrega });

  const frete = Number(p.shipping_fee);
  if (Number.isFinite(frete) && frete > 0) linhas.push({ rotulo: "Frete", valor: reais(frete) });

  const desconto = Number(p.pix_discount);
  if (Number.isFinite(desconto) && desconto > 0) linhas.push({ rotulo: "Desconto do Pix", valor: "− " + reais(desconto) });

  return linhas;
}

/**
 * Por que um Pix vencido não cancelou sozinho (achado LJ-34). `null`
 * quando não está vencido, ou vencido sem motivo reconhecido — nesses
 * casos o texto de hoje (situacaoDoPagamento) não muda.
 */
export function motivoDoPixVencido(p: Pick<PagamentoDoPedido, "pix_cancelamento"> | null | undefined): string | null {
  if (!p?.pix_cancelamento?.vencido) return null;
  switch (p.pix_cancelamento.motivo) {
    case "producao":    return "Este pedido não cancela sozinho porque a produção já começou.";
    case "comprovante": return "Este pedido não cancela sozinho porque a cliente mandou comprovante.";
    case "ja_paguei":   return "Este pedido não cancela sozinho porque a cliente disse que pagou.";
    case "sinal":       return "Este pedido não cancela sozinho porque você registrou o sinal.";
    default:            return null;
  }
}

/**
 * "Cancelar pedido" no detalhe do pedido da vitrine (QA final 28/09/2026,
 * LJ-33 P2). A recusa do pagamento responde 409 com "use 'Cancelar
 * pedido'" quando o Pix já entrou — e o detalhe não tinha esse botão.
 *
 * Aparece quando o pedido é da vitrine, não foi entregue nem cancelado e
 * o pagamento NÃO está esperando conferência: nesse caso o caminho é
 * "Recusar pagamento", no bloco do pagamento (um botão de cancelar a mais
 * ao lado dele só confundiria).
 */
export function podeCancelarOPedido(p: PagamentoDoPedido | null | undefined): boolean {
  if (!p || !temBlocoDePagamento(p)) return false;
  const status = p.status || "";
  if (!status || status === "cancelled" || status === "delivered") return false;
  return !acoesDoPagamento(p).podeAgir;
}

/** O que o cancelamento faz, dito antes de confirmar. */
export function avisoDoCancelamento(p: PagamentoDoPedido): string {
  const pago = PAGO.includes(p.payment_status || "") || ANDOU.includes(p.status || "");
  return pago
    ? "O pedido sai da produção e a cliente vê que a loja cancelou, com o motivo abaixo. O valor que já entrou não volta sozinho: combine a devolução com ela."
    : "O pedido sai da produção e a cliente vê que a loja cancelou, com o motivo abaixo.";
}

/** Linha curta para o cartão da Produção: por que o Pix vencido não cancelou. */
export function motivoCurtoDoPixVencido(p: Pick<PagamentoDoPedido, "pix_cancelamento"> | null | undefined): string | null {
  if (!p?.pix_cancelamento?.vencido) return null;
  switch (p.pix_cancelamento.motivo) {
    case "producao":    return "Não cancela sozinho: a produção já andou";
    case "comprovante": return "Não cancela sozinho: há comprovante";
    case "ja_paguei":   return "Não cancela sozinho: a cliente disse que pagou";
    case "sinal":       return "Não cancela sozinho: sinal registrado";
    default:            return null;
  }
}
