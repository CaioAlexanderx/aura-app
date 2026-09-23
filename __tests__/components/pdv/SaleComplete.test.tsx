// ============================================================
// Tela final da venda (components/screens/pdv/SaleComplete.tsx).
// QA 23/09/2026: subtotal − desconto tem de dar o total na tela, com os
// números que o servidor gravou (venda nº 176: R$ 1.440,15 − R$ 216,02 =
// R$ 1.224,13), e "N produtos" conta linhas, não soma m² com tijolo.
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }),
}));
jest.mock("@/services/api", () => ({ BASE_URL: "http://api" }));
jest.mock("@/components/screens/pdv/NfceActions", () => ({ NfceActions: () => null }));
jest.mock("@/components/screens/pdv/OsActions", () => ({ OsActions: () => null }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/utils/clipboard", () => ({ copyText: jest.fn() }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import type { SaleResult } from "@/hooks/useCart";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
function textoDe(tree: renderer.ReactTestRenderer, id: string): string {
  const achados = tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
  return achados.length ? flattenText(achados[0].children) : "";
}
function reais(txt: string): number {
  return parseFloat(txt.replace(/[^\d,]/g, "").replace(",", "."));
}

const VENDA_176: SaleResult = {
  id: "0f6c1d2e-aaaa-bbbb-cccc-000000000176",
  saleNumber: 176,
  total: 1224.13,
  payment: "pix",
  payments: [{ method: "pix", value: 400 }, { method: "cartao", value: 824.13 }],
  items: [
    { productId: "piso", name: "Piso", price: 70.53, qty: 10, unit: "m²" },
    { productId: "tijolo", name: "Tijolo", price: 1469.7, qty: 0.5, unit: "mlh" },
  ],
  date: "23/09/2026",
  couponCode: "15OFF",
  couponDiscount: 216.02,
  subtotal: 1440.15,
  discount: 216.02,
};

function montar(sale: SaleResult, matconEnabled = true) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<SaleComplete sale={sale} onNewSale={jest.fn()} matconEnabled={matconEnabled} />); });
  return tree;
}

describe("tela final da venda", () => {
  test("dividido com cupom: subtotal − desconto = total (o que o banco gravou)", () => {
    const tree = montar(VENDA_176);
    const subtotal = reais(textoDe(tree, "venda-subtotal"));
    const cupom = reais(textoDe(tree, "venda-cupom"));
    const total = reais(textoDe(tree, "venda-total"));
    expect(subtotal).toBe(1440.15);
    expect(cupom).toBe(216.02);
    expect(total).toBe(1224.13);
    expect(Math.round((subtotal - cupom) * 100) / 100).toBe(total);
    tree.unmount();
  });

  test("cupom + desconto manual: cada um na sua linha e a conta fecha", () => {
    const tree = montar({
      ...VENDA_176, total: 170, subtotal: 200, discount: 30, couponCode: "DEZ", couponDiscount: 20, manualDiscount: 10,
      payments: undefined, items: [{ productId: "p1", name: "Camiseta", price: 100, qty: 2 }],
    });
    expect(reais(textoDe(tree, "venda-subtotal"))).toBe(200);
    expect(reais(textoDe(tree, "venda-cupom"))).toBe(20);
    expect(reais(textoDe(tree, "venda-desconto"))).toBe(10);
    expect(reais(textoDe(tree, "venda-total"))).toBe(170);
    tree.unmount();
  });

  test("sem desconto: nada de subtotal riscado", () => {
    const tree = montar({
      ...VENDA_176, total: 200, subtotal: 200, discount: 0, couponCode: undefined, couponDiscount: undefined, payments: undefined,
    });
    expect(textoDe(tree, "venda-subtotal")).toBe("");
    expect(textoDe(tree, "venda-cupom")).toBe("");
    tree.unmount();
  });

  test("venda antiga (sem subtotal/discount): cai na soma dos itens", () => {
    const tree = montar({
      ...VENDA_176, total: 190, subtotal: undefined, discount: undefined, couponCode: "DEZ", couponDiscount: 10,
      payments: undefined, items: [{ productId: "p1", name: "Camiseta", price: 100, qty: 2 }],
    });
    expect(reais(textoDe(tree, "venda-subtotal"))).toBe(200);
    expect(reais(textoDe(tree, "venda-cupom"))).toBe(10);
    tree.unmount();
  });
});
