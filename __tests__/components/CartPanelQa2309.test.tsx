// ============================================================
// Caixa — carrinho (CartPanel), QA em produção de 23/09/2026.
// Texto na língua do lojista: nada de "CARTAO", "1× SPLIT", "ITENS 510".
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));

import React from "react";
import renderer, { act } from "react-test-renderer";

let mockPdvSettings: any = {};
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }),
}));
jest.mock("@/components/screens/pdv/MerchantLogo", () => ({
  MerchantLogo: () => null,
  useMerchantBrand: () => ({ logoUrl: null, name: "Depósito São Jorge", initial: "D" }),
}));

import { CartPanel, type CartDisplayItem } from "@/components/screens/pdv/CartPanel";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function textoDe(tree: renderer.ReactTestRenderer, id: string): string {
  const achados = porTestID(tree, id);
  return achados.length ? flattenText(achados[0].children) : "";
}

const PISO: CartDisplayItem = { productId: "piso", productBaseId: "piso", name: "Piso", price: 64.8, qty: 10, listPrice: 64.8, unit: "m²" };
const TIJOLO: CartDisplayItem = { productId: "tij", productBaseId: "tij", name: "Tijolo", price: 1392, qty: 0.5, listPrice: 1392, unit: "mlh" };

const METODOS = [
  { key: "dinheiro", label: "Dinheiro", icon: "wallet" },
  { key: "pix", label: "PIX", icon: "dollar" },
  { key: "debito", label: "Débito", icon: "trending_up" },
  { key: "cartao", label: "Crédito", icon: "receipt" },
  { key: "crediario", label: "Crediário", icon: "clock" },
];

function props(extra: Record<string, any> = {}) {
  return {
    items: [PISO, TIJOLO],
    subtotal: 1344, discountAmount: 0, total: 1344, itemCount: 10.5,
    payMethods: METODOS,
    activePay: "pix",
    onPay: jest.fn(), onInc: jest.fn(), onDec: jest.fn(), onRemove: jest.fn(), onClear: jest.fn(), onFinalize: jest.fn(),
    onToggleSplit: jest.fn(), onAddSplitPayment: jest.fn(), onUpdateSplitPayment: jest.fn(), onRemoveSplitPayment: jest.fn(),
    ...extra,
  };
}
function montar(extra: Record<string, any> = {}) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<CartPanel {...props(extra)} />); });
  return tree;
}

beforeEach(() => { mockPdvSettings = {}; });

describe("Pagamento no topo", () => {
  test.each([
    ["cartao", "Crédito"], ["debito", "Débito"], ["crediario", "Crediário"], ["dinheiro", "Dinheiro"], ["pix", "PIX"],
  ])("%s → %s", (key, rotulo) => {
    const tree = montar({ activePay: key });
    expect(textoDe(tree, "carrinho-pagamento")).toBe(rotulo);
    expect(flattenText(tree.toJSON())).not.toMatch(/CARTAO|DEBITO|CREDIARIO|SPLIT/);
    tree.unmount();
  });

  test("dividido: 'Dividido em N' com as linhas que têm valor", () => {
    const tree = montar({
      splitMode: true, splitIsBalanced: false, splitRemaining: 100,
      splitPayments: [{ method: "pix", value: 400 }, { method: "cartao", value: 0 }],
    });
    expect(textoDe(tree, "carrinho-pagamento")).toBe("Dividido em 1");
    expect(flattenText(tree.toJSON())).not.toMatch(/SPLIT/);
    tree.unmount();
  });
});
