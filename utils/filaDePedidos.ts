// ============================================================
// AURA. — Regras da fila de pedidos da loja online (painel)
// Criado: 10/09/2026
//
// Funções puras, fora do componente de propósito: `Toast` importa `Icon`, e
// `Icon` quebra no Jest (react-native-svg). Tudo que precisa de teste mora
// aqui e a TabPedidos só desenha.
//
// O que mudou em relação à tela antiga:
//   - status em TOM, não em cor fixa. As cores eram claras e fixas
//     (#fef3c7...), pensadas para o tema claro; no escuro viravam pílulas
//     creme brilhantes. O componente traduz o tom nos tokens do tema.
//   - "Expirado": Pix vencido que o backend cancelou sozinho.
//   - cancelar e excluir decididos num lugar só, para o card e o detalhe
//     concordarem.
// ============================================================

export type Tom = "ambar" | "vermelho" | "violeta" | "verde" | "neutro";

export interface PedidoDaFila {
  id: string;
  order_number: string | number;
  status: string;
  payment_status?: string | null;
  payment_method?: string | null;
  delivery_type?: string | null;
  customer_name?: string | null;
  total?: number | string | null;
  created_at: string;
  transaction_id?: string | null;
  stock_deducted?: boolean | null;
  confirmed_at?: string | null;
  nfce_id?: string | null;
  item_count?: number | null;
  first_item_name?: string | null;
  first_item_image?: string | null;
  payment_proof_url?: string | null;
  // tq-44/tq-47 (29/10/2026): pagar na entrega com aceite e fila do pedido.
  pay_on_delivery_method?: "cash" | "card" | "pix" | string | null;
  change_for?: number | string | null;
  accepted_at?: string | null;
  prep_minutes?: number | null;
  out_for_delivery_at?: string | null;
  refund_marked_at?: string | null;
  cancel_kind?: string | null;
  cancel_reason?: string | null;
  /** Pix/cartão pago que nasceu numa loja com a fila de aceite (tq-47). */
  aceite_na_fila?: boolean | null;
  /** Frase pronta do backend: "Dinheiro. Paga com R$ 100,00: levar R$ 22,00 de troco." */
  pagamento_na_entrega?: string | null;
  troco_a_levar?: number | null;
}

export type ChipKey = "all" | "precisa-agir" | "em-curso" | "concluidos" | "cancelados";

export const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all",          label: "Todos" },
  { key: "precisa-agir", label: "Precisa agir" },
  { key: "em-curso",     label: "Em curso" },
  { key: "concluidos",   label: "Concluídos" },
  { key: "cancelados",   label: "Cancelados" },
];

const STATUS_DO_GRUPO: Record<Exclude<ChipKey, "all">, string[]> = {
  "precisa-agir": ["pending_payment", "awaiting_approval", "aguardando_aceite"],
  "em-curso":     ["confirmed", "preparing", "ready", "out_for_delivery"],
  "concluidos":   ["delivered"],
  "cancelados":   ["cancelled"],
};

export const PROXIMO_STATUS: Record<string, string> = {
  confirmed: "preparing",
  preparing: "ready",
  ready:     "delivered",
  out_for_delivery: "delivered",
};

export function ehExpirado(o: Pick<PedidoDaFila, "status" | "payment_status">): boolean {
  return o.status === "cancelled" && o.payment_status === "expired";
}

/** Rótulo e tom do pedido. `precisaAgir` = a lojista tem algo a fazer agora. */
export function situacaoDoPedido(o: PedidoDaFila): { rotulo: string; tom: Tom; precisaAgir: boolean } {
  switch (o.status) {
    case "pending_payment":
      if (o.payment_method === "card") return { rotulo: "Aguardando cartão", tom: "neutro", precisaAgir: false };
      return { rotulo: "Aguardando Pix", tom: "ambar", precisaAgir: true };
    case "awaiting_approval":
      return { rotulo: "Comprovante enviado", tom: "vermelho", precisaAgir: true };
    // tq-44: pagar na entrega espera a lojista aceitar ou recusar.
    case "aguardando_aceite":
      return { rotulo: "Aguardando aceite", tom: "ambar", precisaAgir: true };
    case "out_for_delivery":
      return { rotulo: "Saiu para entrega", tom: "verde", precisaAgir: false };
    case "confirmed":
      return { rotulo: "Confirmado", tom: "violeta", precisaAgir: false };
    case "preparing":
      return { rotulo: "Em preparo", tom: "violeta", precisaAgir: false };
    case "ready":
      return { rotulo: "Pronto", tom: "verde", precisaAgir: false };
    case "delivered":
      return { rotulo: "Entregue", tom: "neutro", precisaAgir: false };
    case "cancelled":
      return {
        rotulo: ehExpirado(o) ? "Expirado" : (o.cancel_kind === "recusado_pela_loja" ? "Recusado" : "Cancelado"),
        tom: "neutro", precisaAgir: false,
      };
    default:
      return { rotulo: o.status || "—", tom: "neutro", precisaAgir: false };
  }
}

export function rotuloDoStatus(status: string): string {
  return situacaoDoPedido({ id: "", order_number: "", status, created_at: "" }).rotulo;
}

/**
 * Confirmação manual de pagamento: Pix pendente ou com comprovante. Cartão
 * nunca — o Mercado Pago confirma pelo webhook, e um botão manual criaria
 * divergência com o que a lojista de fato recebeu.
 */
export function podeConfirmarPagamento(o: PedidoDaFila | null | undefined): boolean {
  if (!o) return false;
  if (o.payment_method === "card") return false;
  return o.status === "awaiting_approval" || o.status === "pending_payment";
}

export function podeCancelar(o: PedidoDaFila | null | undefined): boolean {
  if (!o) return false;
  return !["delivered", "cancelled"].includes(o.status);
}

/**
 * Excluir de vez só o que nunca movimentou nada: sem lançamento, sem baixa
 * de estoque, sem nota e nunca confirmado. O backend revalida.
 */
export function podeExcluir(o: PedidoDaFila | null | undefined): boolean {
  if (!o) return false;
  if (!["cancelled", "pending_payment"].includes(o.status)) return false;
  return !o.transaction_id && !o.stock_deducted && !o.confirmed_at && !o.nfce_id;
}

export function filtrarPorGrupo<T extends PedidoDaFila>(pedidos: T[], chip: ChipKey): T[] {
  if (chip === "all") return pedidos;
  const permitidos = STATUS_DO_GRUPO[chip];
  return pedidos.filter((p) => permitidos.includes(p.status));
}

/** Contagens dos cartões de cima, a partir do `counts` do backend (banco inteiro). */
export function contagemDosGrupos(counts: Record<string, number | undefined> | null | undefined) {
  const c = counts || {};
  const n = (k: string) => Number(c[k] || 0);
  return {
    precisaAgir: n("pending_payment") + n("awaiting_approval") + n("aguardando_aceite"),
    emCurso: n("confirmed") + n("preparing") + n("ready") + n("out_for_delivery"),
    expirados: n("expired"),
  };
}

/** "Conjunto luka (Cor: Ferrugem / Tamanho: G) +2" */
export function resumoDosItens(o: PedidoDaFila): string {
  const nome = (o.first_item_name || "").trim();
  const total = Number(o.item_count || 0);
  if (!nome) return total > 0 ? `${total} ${total === 1 ? "item" : "itens"}` : "";
  return total > 1 ? `${nome} +${total - 1}` : nome;
}

const FORMA_NA_ENTREGA: Record<string, string> = { cash: "dinheiro", card: "cartão", pix: "Pix na hora" };

export function rotuloDoPagamento(metodo?: string | null, formaNaEntrega?: string | null): string {
  if (metodo === "card") return "Cartão";
  if (metodo === "on_delivery") {
    const f = formaNaEntrega ? FORMA_NA_ENTREGA[formaNaEntrega] : null;
    return f ? `Na entrega, ${f}` : "Na entrega";
  }
  return "Pix";
}

export function rotuloDaEntrega(tipo?: string | null): string {
  if (tipo === "delivery") return "Entrega";
  if (tipo === "courier") return "Retirada por app";
  return "Retirada";
}

export function tempoDesde(iso: string, agora: number = Date.now()): string {
  const min = Math.floor((agora - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(min) || min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 dia" : `${d} dias`;
}

export function formatarReais(v: number | string | null | undefined): string {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return "R$ —";
  return "R$ " + n.toFixed(2).replace(".", ",");
}
