// ============================================================
// Comanda: "Dividir a conta" no Caixa (17/10/2026, card tc-04).
//
// useCart + useComandaNoCaixa juntos. O critério da Nina: comanda 12 com 4
// itens dividida por 3 vira UMA venda com 3 pagamentos que somam o total.
// O dividido do carrinho já nasce com as partes; a venda leva comanda_id e
// payments[] (o backend grava uma linha por parte em sale_payments).
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
jest.mock("@/components/screens/pdv/ComandaModals", () => ({
  chaveDasComandas: (id: string) => ["comandas-abertas", id],
}));
jest.mock("@/services/comandaApi", () => ({ comandaApi: { addItems: jest.fn() } }));

const mockBodies: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => {
      mockBodies.push(body);
      cb?.onSuccess?.({ sale: { id: "venda-1", sale_number: 9 } });
    },
  }),
}));

import { toast } from "@/components/Toast";
import { useCart } from "@/hooks/useCart";
import { useComandaNoCaixa } from "@/hooks/useComandaNoCaixa";
import type { Comanda } from "@/utils/comanda";

let cart: ReturnType<typeof useCart>;
let comandas: ReturnType<typeof useComandaNoCaixa>;
function Harness() {
  cart = useCart();
  comandas = useComandaNoCaixa({
    companyId: "empresa-1", enabled: true, isDemo: false,
    cart: cart.cart, comanda: cart.comanda, setComanda: cart.setComanda,
    limpar: cart.newSale, addToCart: cart.addToCart, setQty: cart.setQty,
    products: [],
    dividir: cart.dividirPagamento,
  });
  return null;
}
function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness />); });
  return tree;
}

const COMANDA: Comanda = {
  id: "44444444-4444-4444-8444-444444444444", number: 12, name: "João", status: "open", opened_at: "", items_count: 4, subtotal: 160,
  items: [
    { id: "i1", product_id: null, variant_id: null, name: "Heineken 600 ml", unit: null, quantity: 4, unit_price: 14, total: 56 },
    { id: "i2", product_id: null, variant_id: null, name: "Porção de fritas", unit: null, quantity: 1, unit_price: 38, total: 38 },
    { id: "i3", product_id: null, variant_id: null, name: "Caipirinha", unit: null, quantity: 3, unit_price: 18, total: 54 },
    { id: "i4", product_id: null, variant_id: null, name: "Água", unit: null, quantity: 2, unit_price: 6, total: 12 },
  ],
};
const PARTES = [
  { method: "pix", value: 53.34 },
  { method: "cartao", value: 53.33 },
  { method: "dinheiro", value: 53.33 },
];

beforeEach(() => {
  mockBodies.length = 0;
  jest.clearAllMocks();
});

test("dividir por 3: uma venda, 3 pagamentos que somam o total, com a comanda", () => {
  const tree = montar();
  act(() => { comandas.cobrar(COMANDA, 0, { partes: PARTES }); });

  expect(cart.cart).toHaveLength(4);
  expect(cart.totalAfterCoupon).toBe(160);
  expect(cart.splitMode).toBe(true);
  expect(cart.splitPayments.map((p) => [p.method, p.value])).toEqual([["pix", 53.34], ["cartao", 53.33], ["dinheiro", 53.33]]);
  expect(cart.splitIsBalanced).toBe(true);
  expect(toast.success).toHaveBeenCalledWith("Comanda 12 · João no carrinho, dividida em 3. Confira e finalize.");

  act(() => { cart.finalizeSale(); });
  expect(mockBodies).toHaveLength(1);
  const body = mockBodies[0];
  expect(body.comanda_id).toBe(COMANDA.id);
  expect(body.payments.map((p: any) => [p.method, p.value])).toEqual([["pix", 53.34], ["cartao", 53.33], ["dinheiro", 53.33]]);
  expect(Math.round(body.payments.reduce((s: number, p: any) => s + p.value, 0) * 100) / 100).toBe(160);
  // a venda seguinte volta ao normal: sem dividido
  expect(cart.splitMode).toBe(false);
  tree.unmount();
});

test("com a taxa: as partes cobrem consumo + 10%", () => {
  const tree = montar();
  act(() => {
    comandas.cobrar(COMANDA, 10, { partes: [{ method: "pix", value: 88 }, { method: "cartao", value: 88 }] });
  });
  expect(cart.totalAfterCoupon).toBe(176);
  expect(cart.splitIsBalanced).toBe(true);
  act(() => { cart.finalizeSale(); });
  expect(mockBodies[0].comanda_service_fee_pct).toBe(10);
  expect(mockBodies[0].payments).toHaveLength(2);
  tree.unmount();
});

test("cobrar tudo (sem partes) segue sem dividido", () => {
  const tree = montar();
  act(() => { comandas.cobrar(COMANDA, 0); });
  expect(cart.splitMode).toBe(false);
  act(() => { cart.finalizeSale(); });
  expect(mockBodies[0].payments).toBeUndefined();
  expect(mockBodies[0].comanda_id).toBe(COMANDA.id);
  tree.unmount();
});
