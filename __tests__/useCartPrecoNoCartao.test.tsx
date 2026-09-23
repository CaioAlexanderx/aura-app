// ============================================================
// Preço no cartão — o carrinho do Caixa (hooks/useCart.ts).
// Mockup aprovado: docs/mockups/preco-no-cartao.html (telas 3 e 4).
//
//   1. NÃO VAZA: opção desligada = item sem preço no cartão, chip de
//      crédito cobra o preço de sempre e o payload é o de antes;
//   2. ligada: o chip escolhe o preço; trocar de chip não apaga o cupom e
//      o cupom em % vale sobre o preço do método;
//   3. lápis leva o outro preço na mesma proporção;
//   4. dividido PIX R$ 400 + cartão: R$ 666,00, total R$ 1.066,00, e as
//      linhas do POST somam exatamente os pagamentos.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, isDemo: false }),
}));
jest.mock("@/services/api", () => ({ pdvApi: { createSale: jest.fn() } }));

const mockBodies: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => { mockBodies.push(body); cb?.onSuccess?.({ sale: { id: "venda-1", sale_number: 7 } }); },
  }),
}));

import { useCart } from "@/hooks/useCart";
import { totalComoNoServidor, type ConfigDoCartao } from "@/utils/precoNoCartao";

let api: ReturnType<typeof useCart>;
function Harness({ cfg }: { cfg?: ConfigDoCartao }) {
  api = useCart(cfg);
  return null;
}
function montar(cfg?: ConfigDoCartao) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness cfg={cfg} />); });
  return tree;
}
const LIGADO: ConfigDoCartao = { enabled: true, pct: 11 };

beforeEach(() => { mockBodies.length = 0; });

describe("opção desligada — o carrinho de sempre", () => {
  test("item sem preço no cartão; crédito cobra o preço normal; payload de antes", () => {
    const tree = montar();
    act(() => { api.addToCart({ id: "p1", name: "Cimento", price: 38, cardPrice: 50 }); });
    expect(api.cart[0]).toEqual({ productId: "p1", name: "Cimento", price: 38, qty: 1, listPrice: 38, unit: undefined, purchaseUnit: undefined, purchaseFactor: undefined });
    expect(api.precoNoCartao).toBeNull();
    act(() => { api.setPayment("cartao"); });
    expect(api.cart[0].price).toBe(38);
    expect(api.totalAfterCoupon).toBe(38);
    act(() => { api.finalizeSale(); });
    expect(mockBodies[0].items[0]).toEqual({
      product_id: "p1", variant_id: undefined, quantity: 1, unit_price: 38,
      item_discount: undefined, product_name_snapshot: "Cimento", lot_allocations: undefined,
    });
    expect(mockBodies[0].payment_method).toBe("cartao");
    tree.unmount();
  });

  test("dividido de sempre: a entrada começa com o total e não se preenche sozinha", () => {
    const tree = montar();
    act(() => { api.addToCart({ id: "p1", name: "Cimento", price: 100 }); });
    act(() => { api.toggleSplitMode(); });
    expect(api.splitPayments).toEqual([{ method: "pix", value: 100 }]);
    act(() => { api.updateSplitPayment(0, { value: 40 }); });
    act(() => { api.addSplitPayment(); });
    expect(api.splitPayments[1]).toEqual({ method: "dinheiro", value: 60, change: undefined });
    expect(api.splitNote).toBeNull();
    tree.unmount();
  });
});

describe("opção ligada — o chip escolhe o preço", () => {
  test("dinheiro/PIX/crediário no preço normal; débito e crédito no do cartão", () => {
    const tree = montar(LIGADO);
    act(() => { api.addToCart({ id: "p1", name: "Cimento", price: 38, cardPrice: null }); });
    act(() => { api.setQty("p1", 10); });
    expect(api.cart[0].price).toBe(38);
    expect(api.cart[0].cardPrice).toBe(42.2);
    expect(api.precoNoCartao).toMatchObject({ totalDinheiro: 380, totalCartao: 422 });
    act(() => { api.setPayment("debito"); });
    expect(api.cart[0].price).toBe(42.2);
    expect(api.totalAfterCoupon).toBe(422);
    act(() => { api.setPayment("crediario"); });
    expect(api.cart[0].price).toBe(38);
    tree.unmount();
  });

  test("trocar de chip não apaga o cupom; 5% vale sobre o preço do método", () => {
    const tree = montar(LIGADO);
    act(() => { api.addToCart({ id: "p1", name: "Cimento", price: 100, cardPrice: 111 }); });
    act(() => {
      api.setCouponRule({ code: "OBRA5", tipo: "percent", valor: 5 });
      api.setCouponApplied({ code: "OBRA5", discount: 5 });
    });
    expect(api.couponDiscount).toBe(5);
    expect(api.totalAfterCoupon).toBe(95);
    act(() => { api.setPayment("cartao"); });
    expect(api.couponApplied).toEqual({ code: "OBRA5", discount: 5 });
    expect(api.couponDiscount).toBe(5.55);
    expect(api.totalAfterCoupon).toBe(105.45);
    act(() => { api.finalizeSale(); });
    expect(mockBodies[0].coupon_code).toBe("OBRA5");
    expect(mockBodies[0].items[0].unit_price).toBe(111);
    tree.unmount();
  });

  test("desconto em R$ tira o mesmo valor dos dois", () => {
    const tree = montar(LIGADO);
    act(() => { api.addToCart({ id: "p1", name: "Cimento", price: 100, cardPrice: 111 }); });
    act(() => { api.setDiscountType("R$"); api.setDiscountValue("10"); });
    expect(api.precoNoCartao).toMatchObject({ totalDinheiro: 90, totalCartao: 101 });
    tree.unmount();
  });

  test("lápis: editar o preço leva o outro na mesma proporção", () => {
    const tree = montar(LIGADO);
    act(() => { api.addToCart({ id: "p1", name: "Cimento", price: 38, cardPrice: null }); });
    act(() => { api.setUnitPrice("p1", 34.2); });
    expect(api.cart[0].cashPrice).toBe(34.2);
    expect(api.cart[0].cardPrice).toBe(37.98);
    tree.unmount();
  });

  test("variante com preço próprio vai na proporção do card_price do pai", () => {
    const tree = montar(LIGADO);
    act(() => { api.addToCart({ id: "p1", name: "Tinta", price: 40, cardPrice: 46 }, { id: "v1", label: "18 L", price: 44 }); });
    expect(api.cart[0].cardPrice).toBe(50.6);
    tree.unmount();
  });
});

describe("opção ligada — dividido (tela 4)", () => {
  function carrinhoDoMockup() {
    act(() => {
      api.addToCart({ id: "cim", name: "Cimento", price: 38, cardPrice: 42.18 });
      api.addToCart({ id: "pis", name: "Porcelanato", price: 64.8, cardPrice: 71.93 });
      api.addToCart({ id: "arg", name: "Argamassa", price: 49, cardPrice: 51.45 });
      api.addToCart({ id: "dis", name: "Disjuntor", price: 20, cardPrice: 24.55 });
    });
    act(() => {
      api.setQty("cim", 10); api.setQty("pis", 5); api.setQty("arg", 4); api.setQty("dis", 5);
    });
  }

  test("PIX 400 + cartão = R$ 666,00; total R$ 1.066,00; Σ linhas = Σ pagamentos", () => {
    const tree = montar(LIGADO);
    carrinhoDoMockup();
    expect(api.precoNoCartao).toMatchObject({ totalDinheiro: 1000, totalCartao: 1110 });
    act(() => { api.toggleSplitMode(); });
    expect(api.splitPayments).toEqual([{ method: "pix", value: 1000, auto: true }]);
    act(() => { api.updateSplitPayment(0, { value: 400 }); });
    act(() => { api.addSplitPayment(); });
    expect(api.splitPayments.map(p => [p.method, p.value])).toEqual([["pix", 400], ["cartao", 666]]);
    expect(api.splitTotal).toBe(1066);
    expect(api.splitIsBalanced).toBe(true);
    expect(api.totalAfterCoupon).toBe(1066);
    expect(api.splitStatus).toBe("Pronto · a conta fecha em R$ 1.066,00");

    act(() => { api.finalizeSale(); });
    const body = mockBodies[0];
    expect(body.payments).toEqual([
      { method: "pix", value: 400, change: undefined },
      { method: "cartao", value: 666, change: undefined },
    ]);
    const linhas = body.items.map((i: any) => {
      const bruto = parseFloat((i.quantity * i.unit_price).toFixed(2));
      return { totalDaLinha: bruto - (i.item_discount || 0) };
    });
    expect(totalComoNoServidor(linhas, {}).total).toBe(1066);
    expect(api.lastSale?.total).toBe(1066);
    // A nota usa items[].price (SaleComplete) — o preço efetivamente cobrado.
    const nota = (api.lastSale?.items || []).reduce((s, i) => s + i.price * i.qty, 0);
    expect(Math.round(nota * 100) / 100).toBe(1066);
    tree.unmount();
  });

  test("a linha 'o que falta' acompanha o carrinho; as digitadas ficam", () => {
    const tree = montar(LIGADO);
    carrinhoDoMockup();
    act(() => { api.toggleSplitMode(); });
    act(() => { api.updateSplitPayment(0, { value: 400 }); });
    act(() => { api.addSplitPayment(); });
    act(() => { api.setQty("dis", 10); }); // +R$ 100 no dinheiro, +R$ 122,75 no cartão
    expect(api.splitPayments[0].value).toBe(400);
    expect(api.splitIsBalanced).toBe(true);
    expect(api.splitPayments[1].value).toBeGreaterThan(666);
    tree.unmount();
  });
});
