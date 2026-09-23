// ============================================================
// Tela final da venda (components/screens/pdv/SaleComplete.tsx).
// QA 23/09/2026: subtotal − desconto tem de dar o total na tela, com os
// números que o servidor gravou (venda nº 176: R$ 1.440,15 − R$ 216,02 =
// R$ 1.224,13), e "N produtos" conta linhas, não soma m² com tijolo.
// QA 23/09/2026 (Matcon): com `matcon` na resposta, a entrega criada e os
// pontos da indicação aparecem; sem `matcon`, a tela não muda nem quebra.
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
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

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

  test("'N produtos' conta linhas: 10 m² + 500 tijolos = 2 produtos", () => {
    const tree = montar(VENDA_176);
    expect(textoDe(tree, "venda-produtos")).toBe("2 produtos");
    tree.unmount();
    const um = montar({ ...VENDA_176, items: [VENDA_176.items[0]] }, false);
    expect(textoDe(um, "venda-produtos")).toBe("1 produto");
    um.unmount();
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

describe("tela final da venda — Matcon", () => {
  const { router } = require("expo-router");

  function montarMatcon(sale: SaleResult, extra: any = {}) {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <SaleComplete sale={sale} onNewSale={jest.fn()} matconEnabled matconDeliveryDays={2} {...extra} />,
      );
    });
    return tree;
  }

  function dataDaquiA(dias: number): string {
    const d = new Date();
    const alvo = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
    return String(alvo.getDate()).padStart(2, "0") + "/" + String(alvo.getMonth() + 1).padStart(2, "0");
  }

  test("sem `matcon` na resposta: nenhuma linha nova e a tela segue de pé", () => {
    const tree = montarMatcon(VENDA_176);
    expect(textoDe(tree, "venda-matcon-entrega")).toBe("");
    expect(textoDe(tree, "venda-matcon-pontos")).toBe("");
    expect(reais(textoDe(tree, "venda-total"))).toBe(1224.13);
    tree.unmount();

    const nulo = montarMatcon({ ...VENDA_176, matcon: null });
    expect(textoDe(nulo, "venda-matcon-entrega")).toBe("");
    nulo.unmount();
  });

  test("venda de orçamento: 'Entrega nº 1 criada para DD/MM — acompanhe em Entregas', toque abre Entregas", () => {
    const tree = montarMatcon({
      ...VENDA_176,
      matcon: { quote_id: "q-1", delivery_id: "d-1", delivery_token: "tok" },
    });
    expect(textoDe(tree, "venda-matcon-entrega")).toBe(
      "Entrega nº 1 criada para " + dataDaquiA(2) + " — acompanhe em Entregas",
    );
    expect(textoDe(tree, "venda-matcon-pontos")).toBe("");
    const linha = tree.root.findAll((n) => n.props && n.props.testID === "venda-matcon-entrega", { deep: false })[0];
    act(() => { linha.props.onPress(); });
    expect(router.push).toHaveBeenCalledWith("/matcon/entregas");
    tree.unmount();
  });

  test("venda indicada: 'Abbey ganhou 10 pontos com esta venda' (nome do chip)", () => {
    const tree = montarMatcon(
      { ...VENDA_176, matcon: { referral: { credited: true, points: 10, points_balance: 40, professional_id: "pro-1" } } },
      { referralName: "Abbey" },
    );
    expect(textoDe(tree, "venda-matcon-pontos")).toBe("Abbey ganhou 10 pontos com esta venda");
    expect(textoDe(tree, "venda-matcon-entrega")).toBe("");
    tree.unmount();
  });

  test("indicação que não creditou (clube desligado etc.): nada sobre pontos", () => {
    const tree = montarMatcon(
      { ...VENDA_176, matcon: { referral: { credited: false, reason: "CLUB_DISABLED" } } },
      { referralName: "Abbey" },
    );
    expect(textoDe(tree, "venda-matcon-pontos")).toBe("");
    tree.unmount();
  });
});
