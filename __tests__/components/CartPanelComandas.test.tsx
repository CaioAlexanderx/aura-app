// ============================================================
// Caixa — carrinho (CartPanel): o botão "Comandas (N)" (17/10/2026, tc-02).
// No lugar do "Fechar comanda": abre o painel das abertas e mostra quantas
// estão abertas; sem nenhuma, sem contagem. Funciona com o carrinho vazio.
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));

import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }),
}));
jest.mock("@/components/screens/pdv/MerchantLogo", () => ({
  MerchantLogo: () => null,
  useMerchantBrand: () => ({ logoUrl: null, name: "Adega", initial: "A" }),
}));

import { CartPanel } from "@/components/screens/pdv/CartPanel";

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

const METODOS = [{ key: "pix", label: "PIX", icon: "dollar" }];

function montar(comanda: any) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CartPanel
        items={[]} subtotal={0} discountAmount={0} total={0} itemCount={0}
        payMethods={METODOS as any} activePay="pix"
        onPay={jest.fn()} onInc={jest.fn()} onDec={jest.fn()} onRemove={jest.fn()} onClear={jest.fn()} onFinalize={jest.fn()}
        comanda={comanda}
      />
    );
  });
  return tree;
}

describe("botão Comandas no rodapé", () => {
  test("mostra a contagem das abertas e abre o painel, mesmo com o carrinho vazio", () => {
    const onList = jest.fn();
    const tree = montar({ onAdd: jest.fn(), onList, openCount: 6, charging: null });
    const btn = porTestID(tree, "cta-comandas")[0];
    expect(flattenText(btn.children)).toBe("Comandas6");
    expect(flattenText(porTestID(tree, "cta-comandas-contagem")[0].children)).toBe("6");
    expect(porTestID(tree, "cta-fechar-comanda")).toHaveLength(0);
    act(() => { btn.props.onPress(); });
    expect(onList).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("sem nenhuma aberta, sem contagem", () => {
    const tree = montar({ onAdd: jest.fn(), onList: jest.fn(), openCount: 0, charging: null });
    expect(flattenText(porTestID(tree, "cta-comandas")[0].children)).toBe("Comandas");
    expect(porTestID(tree, "cta-comandas-contagem")).toHaveLength(0);
    tree.unmount();
  });

  test("loja sem comanda: o botão não aparece", () => {
    const tree = montar(null);
    expect(porTestID(tree, "cta-comandas")).toHaveLength(0);
    tree.unmount();
  });
});
