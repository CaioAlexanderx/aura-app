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
  "precisa-agir": ["pending_payment", "awaiting_approval"],
  "em-curso":     ["confirmed", "preparing", "ready"],
  "concluidos":   ["delivered"],
  "cancelados":   ["cancelled"],
};

export const PROXIMO_STATUS: Record<string, string> = {
  confirmed: "preparing",
  preparing: "ready",
  ready:     "delivered",
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
    case "confirmed":
      return { rotulo: "Confirmado", tom: "violeta", precisaAgir: false };
    case "preparing":
      return { rotulo: "Em preparo", tom: "violeta", precisaAgir: false };
    case "ready":
      return { rotulo: "Pronto", tom: "verde", precisaAgir: false };
    case "delivered":
      return { rotulo: "Entregue", tom: "neutro", precisaAgir: false };
    case "cancelled":
      return { rotulo: ehExpirado(o) ? "Expirado" : "Cancelado", tom: "neutro", precisaAgir: false };
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
    precisaAgir: n("pending_payment") + n("awaiting_approval"),
    emCurso: n("confirmed") + n("preparing") + n("ready"),
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

export function rotuloDoPagamento(metodo?: string | null): string {
  if (metodo === "card") return "Cartão";
  if (metodo === "on_delivery") return "Na entrega";
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
