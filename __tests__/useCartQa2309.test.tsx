// ============================================================
// Caixa — QA em produção de 23/09/2026 (hooks/useCart.ts).
//
// O carrinho do QA: piso R$ 648,00 (cartão R$ 719,30) + tijolo R$ 696,00
// (cartão R$ 772,65), cupom 15OFF (15%), dividido PIX R$ 400 + crédito.
//   · dinheiro R$ 1.344,00 − 201,60 = R$ 1.142,40; cartão R$ 1.491,95 −
//     223,79 = R$ 1.268,16; crédito do dividido = R$ 824,13;
//   · o servidor recalcula o cupom sobre o subtotal RATEADO: R$ 1.440,15
//     − R$ 216,02 = R$ 1.224,13. É isso que a tela final tem de mostrar.
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
let mockResposta: any = { sale: { id: "venda-1", sale_number: 176 } };
let mockFalha: any = null;
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => {
      mockBodies.push(body);
      if (mockFalha) cb?.onError?.(mockFalha);
      else cb?.onSuccess?.(mockResposta);
    },
  }),
}));

import { toast } from "@/components/Toast";
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
const LIGADO: ConfigDoCartao = { enabled: true, pct: 11 };

function carrinhoDoQa() {
  act(() => {
    api.addToCart({ id: "piso", name: "Piso", price: 648, cardPrice: 719.3 });
    api.addToCart({ id: "tijolo", name: "Tijolo", price: 696, cardPrice: 772.65 });
  });
  act(() => {
    api.setCouponRule({ code: "15OFF", tipo: "percent", valor: 15 });
    api.setCouponApplied({ code: "15OFF", discount: 201.6 });
  });
}
function divididoDoQa() {
  act(() => { api.toggleSplitMode(); });
  act(() => { api.updateSplitPayment(0, { value: 400 }); });
  act(() => { api.addSplitPayment({ method: "cartao" }); });
}

beforeEach(() => {
  mockBodies.length = 0;
  mockResposta = { sale: { id: "venda-1", sale_number: 176 } };
  mockFalha = null;
  jest.clearAllMocks();
});

describe("tela final: a conta fecha com o que o servidor gravou", () => {
  test("dividido com cupom: cupom recalculado sobre o subtotal rateado (R$ 216,02)", () => {
    const tree = montar(LIGADO);
    carrinhoDoQa();
    expect(api.precoNoCartao).toMatchObject({ totalDinheiro: 1142.4, totalCartao: 1268.16 });
    divididoDoQa();
    expect(api.splitPayments.map((p) => [p.method, p.value])).toEqual([["pix", 400], ["cartao", 824.13]]);
    act(() => { api.finalizeSale(); });
    const v = api.lastSale!;
    expect(v.total).toBe(1224.13);
    expect(v.subtotal).toBe(1440.15);
    expect(v.couponDiscount).toBe(216.02);
    expect(v.discount).toBe(216.02);
    expect(Math.round((v.subtotal! - v.discount!) * 100) / 100).toBe(v.total);
    tree.unmount();
  });

  test("com a resposta do servidor, vale total_amount e discount_amount", () => {
    mockResposta = { sale: { id: "venda-1", sale_number: 176, total_amount: "1224.13", discount_amount: "216.02" } };
    const tree = montar(LIGADO);
    carrinhoDoQa();
    divididoDoQa();
    act(() => { api.finalizeSale(); });
    expect(api.lastSale).toMatchObject({ subtotal: 1440.15, discount: 216.02, couponDiscount: 216.02, total: 1224.13 });
    tree.unmount();
  });

  test("crédito num método só: desconto e subtotal do cartão", () => {
    const tree = montar(LIGADO);
    carrinhoDoQa();
    act(() => { api.setPayment("cartao"); });
    act(() => { api.finalizeSale(); });
    expect(api.lastSale).toMatchObject({ subtotal: 1491.95, couponDiscount: 223.79, discount: 223.79, total: 1268.16 });
    tree.unmount();
  });

  test("opção desligada: cupom + desconto manual fecham (subtotal − desconto = total)", () => {
    const tree = montar();
    act(() => { api.addToCart({ id: "p1", name: "Camiseta", price: 100 }); });
    act(() => { api.setQty("p1", 2); });
    act(() => {
      api.setCouponApplied({ code: "DEZ", discount: 20 });
      api.setDiscountType("R$"); api.setDiscountValue("10");
    });
    expect(api.totalAfterCoupon).toBe(170);
    act(() => { api.finalizeSale(); });
    expect(api.lastSale).toMatchObject({ subtotal: 200, couponDiscount: 20, manualDiscount: 10, discount: 30, total: 170 });
    tree.unmount();
  });
});

describe("erro da venda nunca mostra texto de sistema", () => {
  test("404 'Rota nao encontrada' vira frase neutra", () => {
    mockFalha = Object.assign(new Error("Rota nao encontrada"), { status: 404, data: { error: "Rota nao encontrada" } });
    const tree = montar();
    act(() => { api.addToCart({ id: "p1", name: "Camiseta", price: 100 }); });
    act(() => { api.finalizeSale(); });
    expect(toast.error).toHaveBeenCalledWith("Não deu para registrar a venda. Tente de novo.");
    tree.unmount();
  });
});
