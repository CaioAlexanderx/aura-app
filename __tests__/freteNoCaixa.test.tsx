// ============================================================
// Frete no Caixa — a conta do carrinho (hooks/useCart.ts), 30/10/2026.
//
// Mockup docs/mockups/frete-no-caixa.html, tela C: cimento R$ 128 +
// argamassa R$ 120 = R$ 248; 10% de desconto = R$ 24,80 (só nos
// produtos); frete R$ 25 → total R$ 248,20. Confere:
//   · o total da venda soma o frete depois do desconto;
//   · o dividido parte do total com frete;
//   · o POST leva a linha "Frete" sem product_id e o desconto em R$;
//   · a tela final mostra o frete; nova venda zera.
// Mesmo harness de __tests__/useCartQa2309.test.tsx.
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
let mockResposta: any = { sale: { id: "venda-1", sale_number: 1204 } };
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => {
      mockBodies.push(body);
      cb?.onSuccess?.(mockResposta);
    },
  }),
}));

import { useCart } from "@/hooks/useCart";
import type { ConfigDoCartao } from "@/utils/precoNoCartao";

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
function carrinhoDoMockup() {
  act(() => {
    api.addToCart({ id: "cimento", name: "Cimento CP-II 50 kg", price: 32 });
    api.addToCart({ id: "argamassa", name: "Argamassa AC-II 20 kg", price: 24 });
  });
  act(() => { api.setQty("cimento", 4); api.setQty("argamassa", 5); });
}

beforeEach(() => { mockBodies.length = 0; mockResposta = { sale: { id: "venda-1", sale_number: 1204 } }; });

describe("frete no carrinho", () => {
  test("soma no total depois do desconto; o desconto em % vale só nos produtos", () => {
    const tree = montar();
    carrinhoDoMockup();
    expect(api.total).toBe(248);
    act(() => { api.setFreteValor("25"); });
    expect(api.frete).toBe(25);
    expect(api.totalAfterCoupon).toBe(273);

    act(() => { api.setDiscountType("%"); api.setDiscountValue("10"); });
    expect(api.manualDiscountAmount).toBe(24.8);
    expect(api.totalAfterCoupon).toBe(248.2);
    tree.unmount();
  });

  test("valor inválido não é frete", () => {
    const tree = montar();
    carrinhoDoMockup();
    act(() => { api.setFreteValor("abc"); });
    expect(api.frete).toBe(0);
    expect(api.totalAfterCoupon).toBe(248);
    tree.unmount();
  });

  test("o dividido parte do total com frete", () => {
    const tree = montar();
    carrinhoDoMockup();
    act(() => { api.setFreteValor("25"); });
    act(() => { api.toggleSplitMode(); });
    expect(api.splitPayments[0].value).toBe(273);
    expect(api.splitIsBalanced).toBe(true);
    act(() => { api.updateSplitPayment(0, { value: 200 }); });
    expect(api.splitRemaining).toBe(73);
    act(() => { api.addSplitPayment(); });
    expect(api.splitPayments[1].value).toBe(73);
    expect(api.splitIsBalanced).toBe(true);
    tree.unmount();
  });

  test("POST: linha Frete sem product_id, desconto em R$ e tela final com o frete", () => {
    const tree = montar();
    carrinhoDoMockup();
    act(() => { api.setFreteValor("25"); api.setDiscountType("%"); api.setDiscountValue("10"); });
    act(() => { api.finalizeSale(); });

    expect(mockBodies).toHaveLength(1);
    const body = mockBodies[0];
    expect(body.items).toHaveLength(3);
    const linha = body.items[2];
    expect(linha.product_id).toBeUndefined();
    expect(linha.product_name_snapshot).toBe("Frete");
    expect(linha.quantity).toBe(1);
    expect(linha.unit_price).toBe(25);
    // Em % o servidor descontaria o frete também: vai o valor sobre os produtos.
    expect(body.discount_type).toBe("fixed");
    expect(body.discount_value).toBe(24.8);

    expect(api.lastSale).toBeTruthy();
    expect(api.lastSale!.frete).toBe(25);
    expect(api.lastSale!.total).toBe(248.2);
    expect(api.lastSale!.subtotal).toBe(273);
    expect(api.lastSale!.discount).toBe(24.8);
    // A venda seguinte começa sem frete.
    expect(api.frete).toBe(0);
    expect(api.freteValor).toBe("");
    tree.unmount();
  });

  test("sem frete o POST é o de sempre (sem linha extra, desconto em %)", () => {
    const tree = montar();
    carrinhoDoMockup();
    act(() => { api.setDiscountType("%"); api.setDiscountValue("10"); });
    act(() => { api.finalizeSale(); });
    const body = mockBodies[0];
    expect(body.items).toHaveLength(2);
    expect(body.discount_type).toBe("percent");
    expect(body.discount_value).toBe(10);
    expect(api.lastSale!.frete).toBeUndefined();
    tree.unmount();
  });

  test("nova venda e Limpar zeram o frete", () => {
    const tree = montar();
    carrinhoDoMockup();
    act(() => { api.setFreteValor("25"); });
    act(() => { api.newSale(); });
    expect(api.frete).toBe(0);
    expect(api.freteValor).toBe("");
    tree.unmount();
  });

  test("preço no cartão: o frete vale o mesmo nos dois lados e as linhas rateadas ficam só com os produtos", () => {
    const tree = montar({ enabled: true, pct: 10 });
    act(() => { api.addToCart({ id: "piso", name: "Piso", price: 100, cardPrice: 110 }); });
    act(() => { api.setFreteValor("20"); });
    expect(api.precoNoCartao!.totalDinheiro).toBe(100);
    expect(api.precoNoCartao!.totalCartao).toBe(110);
    expect(api.totalAfterCoupon).toBe(120);
    act(() => { api.setPayment("cartao"); });
    expect(api.totalAfterCoupon).toBe(130);
    act(() => { api.finalizeSale(); });
    const body = mockBodies[0];
    expect(body.items).toHaveLength(2);
    expect(body.items[0].unit_price).toBe(110);
    expect(body.items[1].product_name_snapshot).toBe("Frete");
    expect(body.items[1].unit_price).toBe(20);
    expect(api.lastSale!.total).toBe(130);
    tree.unmount();
  });
});
