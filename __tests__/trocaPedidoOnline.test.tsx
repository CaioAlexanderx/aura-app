// 27/10/2026 — troca do Caixa com pedido da loja online como origem.
//
//   1. O card do pedido diz "Loja online · pedido #00012" e o status do
//      pedido/pagamento (não "Pago" fixo).
//   2. Pedidos repetidos (cópias da mesma compra no mesmo minuto) aparecem
//      todos, cada um com o seu número, e com o aviso de possível repetição.
//   3. O payload v2 leva o pedido em original_digital_order_ids e o item com
//      original_digital_order_id + original_digital_order_item_id; venda do
//      Caixa segue com original_sale_id/original_sale_item_id.
// Mocks do padrão do repo (Icon, toast); testID + deep:false.
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, invalidate: jest.fn() }) }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/trocaApi", () => ({
  trocaApi: {
    searchSalesForTroca: jest.fn(),
    searchSalesByProductBarcode: jest.fn(),
    create: jest.fn(),
    createV2: jest.fn(),
  },
}));

import { Step1Search } from "@/components/screens/pdv/troca/Step1Search";
import { Step2Returns } from "@/components/screens/pdv/troca/Step2Returns";
import { trocaApi } from "@/services/trocaApi";
import {
  isPedidoOnline, rotuloDoPedido, statusDoPedido, pedidosRepetidos, montarOrigensDaTroca,
} from "@/components/screens/pdv/troca/pedidoOnline";

const mockBusca = trocaApi.searchSalesForTroca as jest.Mock;

const pedido = (extra: any = {}) => ({
  id: "d0000000-0000-0000-0000-000000000012",
  origin_kind: "digital_order",
  order_number: "00012",
  digital_status: "delivered",
  payment_status: "pending",
  payment_method: "on_delivery",
  total_amount: 100,
  status: "delivered",
  created_at: "2026-10-24T15:33:07.455Z",
  company_id: "loja-1",
  company_name: "Loja Teste",
  customer_id: null,
  customer_name: "Cliente Teste",
  customer_phone: "(11) 90000-0000",
  cpf_cnpj: null,
  seller_id: null,
  seller_name: null,
  is_cross_filial: false,
  has_nfce: false,
  item_count: 1,
  items: [{
    product_id: "p1", variant_id: "v1", product_name_snapshot: "Vestido · M / Azul",
    quantity: 1, unit_price: 100, total_price: 100, original_digital_order_item_id: "63",
  }],
  ...extra,
});
const venda = (extra: any = {}) => ({
  id: "3f2a9c1e-7b44-4d0a-9e5f-0a1b2c3d4e5f",
  total_amount: 50, payment_method: "pix", status: "completed",
  created_at: "2026-10-20T10:00:00Z", company_id: "loja-1", company_name: "Loja Teste",
  customer_id: null, customer_name: null, cpf_cnpj: null, seller_id: null, seller_name: "Vendedora",
  is_cross_filial: false, has_nfce: false, item_count: 1,
  items: [{ product_id: "p2", variant_id: null, product_name_snapshot: "Blusa", quantity: 1, unit_price: 50, original_sale_item_id: "si-1" }],
  ...extra,
});

function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join("");
  return textoDe(node.children);
}
const achar = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });

describe("pedidoOnline — lógica pura", () => {
  it("reconhece e rotula o pedido", () => {
    expect(isPedidoOnline(pedido() as any)).toBe(true);
    expect(isPedidoOnline(venda() as any)).toBe(false);
    expect(rotuloDoPedido(pedido() as any)).toBe("Loja online · pedido #00012");
  });

  it("status do pedido e do pagamento em português", () => {
    expect(statusDoPedido(pedido() as any)).toBe("Entregue · pagar na entrega");
    expect(statusDoPedido(pedido({ digital_status: "confirmed", payment_status: "confirmed", payment_method: "pix" }) as any)).toBe("Confirmado · pago");
    expect(statusDoPedido(pedido({ digital_status: "preparing", payment_status: "pending", payment_method: "pix" }) as any)).toBe("Em preparo · pagamento pendente");
  });

  it("marca como repetidos só os pedidos iguais criados no mesmo minuto", () => {
    const a = pedido({ id: "a", order_number: "00013" });
    const b = pedido({ id: "b", order_number: "00014", created_at: "2026-10-24T15:33:07.836Z" });
    const outroValor = pedido({ id: "c", order_number: "00015", created_at: "2026-10-24T15:33:08.4Z", total_amount: 30 });
    const outroDia = pedido({ id: "d", order_number: "00020", created_at: "2026-10-25T15:33:07Z" });
    const r = pedidosRepetidos([a, b, outroValor, outroDia, venda()] as any);
    expect([...r].sort()).toEqual(["a", "b"]);
  });

  it("monta o payload v2: pedido em original_digital_order_ids, venda como antes", () => {
    const p = pedido();
    const v = venda();
    const out = montarOrigensDaTroca([v, p] as any, [
      { saleId: v.id, returnQty: 1, item: { id: "si-1", product_id: "p2", variant_id: null, product_name_snapshot: "Blusa" } },
      { saleId: p.id, returnQty: 1, item: { id: "63", product_id: "p1", variant_id: "v1", product_name: "Vestido · M / Azul" } },
    ], () => 42);
    expect(out.original_sale_ids).toEqual([v.id]);
    expect(out.original_digital_order_ids).toEqual([p.id]);
    expect(out.returned_items[0]).toEqual(expect.objectContaining({ original_sale_id: v.id, original_sale_item_id: "si-1", unit_price: 42 }));
    expect(out.returned_items[0]).not.toHaveProperty("original_digital_order_id");
    expect(out.returned_items[1]).toEqual(expect.objectContaining({
      original_digital_order_id: p.id, original_digital_order_item_id: "63",
      product_id: "p1", variant_id: "v1", quantity: 1, product_name_snapshot: "Vestido · M / Azul",
    }));
    expect(out.returned_items[1]).not.toHaveProperty("original_sale_id");
  });
});

describe("Step 1 — card do pedido da loja online", () => {
  async function montarBusca(rows: any[]) {
    mockBusca.mockReset();
    mockBusca.mockResolvedValue(rows);
    let t!: renderer.ReactTestRenderer;
    await act(async () => {
      t = renderer.create(<Step1Search companyId="loja-1" selectedSales={[]} onChangeSelected={() => {}} />);
    });
    await act(async () => {});
    return t;
  }

  it("mostra número e status do pedido no lugar do id da venda e do 'Pago'", async () => {
    const t = await montarBusca([pedido(), venda()]);
    const badge = achar(t, "pedido-online-00012");
    expect(badge).toHaveLength(1);
    expect(textoDe(badge[0].children)).toContain("Loja online · pedido #00012");
    const txt = textoDe(t.toJSON());
    expect(txt).toContain("Entregue · pagar na entrega");
    expect(txt).toContain("#3F2A9C1E"); // a venda do Caixa segue igual
    expect(txt).toContain("Pago");
    expect(achar(t, "pedido-repetido-00012")).toHaveLength(0);
  });

  it("pedidos repetidos aparecem todos, cada um com seu número e o aviso", async () => {
    const t = await montarBusca([
      pedido({ id: "a", order_number: "00013" }),
      pedido({ id: "b", order_number: "00014", created_at: "2026-10-24T15:33:07.836Z", digital_status: "confirmed" }),
    ]);
    expect(achar(t, "pedido-online-00013")).toHaveLength(1);
    expect(achar(t, "pedido-online-00014")).toHaveLength(1);
    expect(achar(t, "pedido-repetido-00013")).toHaveLength(1);
    expect(achar(t, "pedido-repetido-00014")).toHaveLength(1);
    const txt = textoDe(t.toJSON());
    expect(txt).toContain("Entregue · pagar na entrega");
    expect(txt).toContain("Confirmado · pagar na entrega");
    expect(txt).toContain("Possível pedido repetido");
  });
});

describe("Step 2 — item do pedido usa o id do item do pedido", () => {
  it("devolver tudo grava o original_digital_order_item_id e o cabeçalho diz o pedido", async () => {
    const onChange = jest.fn();
    const p = pedido();
    let t!: renderer.ReactTestRenderer;
    await act(async () => {
      t = renderer.create(<Step2Returns selectedSales={[p] as any} returnEntries={[]} onChangeEntries={onChange} />);
    });
    expect(textoDe(t.toJSON())).toContain("Pedido #00012 da loja online");
    const botao = t.root.findAll((n) => typeof n.props?.onPress === "function" && textoDe(n.children) === "Devolver tudo", { deep: true }).pop()!;
    await act(async () => { botao.props.onPress({ stopPropagation: () => {} }); });
    const entries = onChange.mock.calls[0][0];
    expect(entries).toHaveLength(1);
    expect(entries[0].saleId).toBe(p.id);
    expect(entries[0].item.id).toBe("63");
    expect(entries[0].returnQty).toBe(1);
  });
});
