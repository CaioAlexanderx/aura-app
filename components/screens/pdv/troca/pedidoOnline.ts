// ============================================================
// AURA. — PDV · Troca · pedido da loja online como origem (27/10/2026)
//
// O backend (GET /pdv/sales-for-troca e /sales-by-product-barcode) passou a
// devolver, junto com as vendas do Caixa, os pedidos ELEGIVEIS da loja
// online (não cancelados e com baixa de estoque feita), no mesmo formato da
// venda e marcados com origin_kind = "digital_order".
//
// Aqui fica só a lógica pura que o wizard usa:
//   - reconhecer o pedido e rotular o card ("Loja online · pedido #00012"
//     + status do pedido e do pagamento);
//   - avisar pedido possivelmente REPETIDO: a loja online gerou cópias da
//     mesma compra (mesmo telefone, mesmo valor, mesmos itens, criados no
//     mesmo minuto). O wizard não esconde nem junta — mostra o número e o
//     status de cada um e avisa, para a lojista escolher o pedido certo;
//   - montar o payload v2: item de pedido vai com original_digital_order_id
//     + original_digital_order_item_id; item de venda do Caixa, como antes.
// ============================================================
import type { SaleForTroca } from "@/services/trocaApi";

export function isPedidoOnline(row: Pick<SaleForTroca, "origin_kind"> | null | undefined): boolean {
  return row?.origin_kind === "digital_order";
}

export function rotuloDoPedido(row: Pick<SaleForTroca, "order_number">): string {
  return `Loja online · pedido #${row.order_number || "?"}`;
}

const STATUS_PEDIDO: Record<string, string> = {
  confirmed: "Confirmado",
  preparing: "Em preparo",
  ready: "Pronto",
  shipped: "Enviado",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
};

/** Status do pedido + do pagamento, em português, para o selo do card. */
export function statusDoPedido(row: Pick<SaleForTroca, "digital_status" | "payment_status" | "payment_method">): string {
  const pedido = STATUS_PEDIDO[row.digital_status || ""] || "Confirmado";
  let pagamento: string;
  if (row.payment_status === "confirmed") pagamento = "pago";
  else if (row.payment_method === "on_delivery") pagamento = "pagar na entrega";
  else pagamento = "pagamento pendente";
  return `${pedido} · ${pagamento}`;
}

function assinatura(row: SaleForTroca): string {
  const tel = String(row.customer_phone || "").replace(/\D/g, "");
  const itens = (row.items || [])
    .map((i) => `${i.product_id || ""}:${i.variant_id || ""}:${i.quantity}`)
    .sort()
    .join("|");
  return `${tel}#${Number(row.total_amount).toFixed(2)}#${itens}`;
}

/**
 * Ids dos pedidos online que têm um "gêmeo" na lista: mesmo telefone, mesmo
 * valor, mesmos itens e criados com até `janelaMs` de diferença.
 */
export function pedidosRepetidos(rows: SaleForTroca[], janelaMs = 60_000): Set<string> {
  const out = new Set<string>();
  const pedidos = rows.filter(isPedidoOnline);
  for (let i = 0; i < pedidos.length; i++) {
    for (let j = i + 1; j < pedidos.length; j++) {
      const a = pedidos[i];
      const b = pedidos[j];
      const dt = Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      if (dt <= janelaMs && assinatura(a) === assinatura(b)) {
        out.add(a.id);
        out.add(b.id);
      }
    }
  }
  return out;
}

type EntradaDevolvida = {
  saleId: string;
  returnQty: number;
  item: { id: string; product_id: string | null; variant_id?: string | null; product_name?: string; product_name_snapshot?: string; lot_id?: string | null };
};

/**
 * Divide as vendas selecionadas e os itens devolvidos entre venda do Caixa e
 * pedido online, no formato do POST /pdv/troca (v2). `unitPrice` é o mesmo
 * cálculo do TrocaModal (effectiveUnitPrice).
 */
export function montarOrigensDaTroca(
  selectedSales: SaleForTroca[],
  entries: EntradaDevolvida[],
  unitPrice: (e: EntradaDevolvida) => number
) {
  const pedidoIds = new Set(selectedSales.filter(isPedidoOnline).map((s) => s.id));
  const original_sale_ids = selectedSales.filter((s) => !pedidoIds.has(s.id)).map((s) => s.id);
  const original_digital_order_ids = selectedSales.filter((s) => pedidoIds.has(s.id)).map((s) => s.id);
  const returned_items = entries.map((e) => {
    const base = {
      product_id: e.item.product_id,
      variant_id: e.item.variant_id || null,
      quantity: e.returnQty,
      unit_price: unitPrice(e),
      product_name_snapshot: e.item.product_name || e.item.product_name_snapshot,
      lot_id: e.item.lot_id || undefined,
    };
    if (pedidoIds.has(e.saleId)) {
      return { ...base, original_digital_order_id: e.saleId, original_digital_order_item_id: e.item.id };
    }
    return { ...base, original_sale_id: e.saleId, original_sale_item_id: e.item.id };
  });
  return { original_sale_ids, original_digital_order_ids, returned_items };
}
