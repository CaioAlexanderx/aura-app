// ============================================================
// Caixa — carrinho (CartPanel): o frete (30/10/2026).
// Mockup docs/mockups/frete-no-caixa.html. Com a prop `frete`: atalho
// "Frete" na linha de atalhos; aberto, a seção com o campo e o cliente da
// venda; com valor, a linha "Frete" no resumo. Sem a prop, nada muda.
// Mocks do padrão do repo; testID + deep:false.
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
  useMerchantBrand: () => ({ logoUrl: null, name: "Depósito do Zé", initial: "D" }),
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

const CIMENTO: CartDisplayItem = {
  productId: "prod-cimento", productBaseId: "prod-cimento",
  name: "Cimento CP-II 50 kg", price: 32, qty: 4, listPrice: 32,
  unit: "sc", purchaseUnit: null, purchaseFactor: null,
};
const METODOS = [{ key: "pix", label: "PIX", icon: "dollar" }];

function montar(frete: any, extra: Record<string, any> = {}) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CartPanel
        items={[CIMENTO]} subtotal={128} discountAmount={0} total={128 + (frete?.amount || 0)} itemCount={4}
        payMethods={METODOS as any} activePay="pix"
        onPay={jest.fn()} onInc={jest.fn()} onDec={jest.fn()} onRemove={jest.fn()} onClear={jest.fn()} onFinalize={jest.fn()}
        frete={frete}
        {...extra}
      />
    );
  });
  return tree;
}

function freteFechado(extra: Record<string, any> = {}) {
  return { value: "", onChange: jest.fn(), amount: 0, open: false, onToggle: jest.fn(), onClear: jest.fn(), customerName: null, ...extra };
}

describe("frete no carrinho", () => {
  test("loja sem a chave: nem atalho, nem seção, nem linha", () => {
    const tree = montar(null);
    expect(porTestID(tree, "cta-frete")).toHaveLength(0);
    expect(porTestID(tree, "frete-secao")).toHaveLength(0);
    expect(porTestID(tree, "resumo-frete")).toHaveLength(0);
    tree.unmount();
  });

  test("fechado: o atalho \"Frete\" abre a seção", () => {
    const onToggle = jest.fn();
    const tree = montar(freteFechado({ onToggle }));
    const atalho = porTestID(tree, "cta-frete")[0];
    expect(flattenText(atalho.children)).toBe("Frete");
    expect(porTestID(tree, "frete-secao")).toHaveLength(0);
    act(() => { atalho.props.onPress(); });
    expect(onToggle).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("aberto com valor e cliente: seção, linha no resumo e \"Sem frete\" tira tudo", () => {
    const onClear = jest.fn();
    const onPickCustomer = jest.fn();
    const tree = montar(freteFechado({ value: "25", amount: 25, open: true, onClear, customerName: "Dona Lúcia", onPickCustomer }));
    expect(porTestID(tree, "frete-secao")).toHaveLength(1);
    expect(porTestID(tree, "frete-valor")[0].props.value).toBe("25");
    expect(flattenText(porTestID(tree, "frete-resultado")[0].children)).toBe("+R$ 25,00");
    expect(flattenText(porTestID(tree, "resumo-frete")[0].children)).toBe("FreteR$ 25,00");

    const cliente = porTestID(tree, "frete-cliente")[0];
    expect(flattenText(cliente.children)).toBe("Entrega para Dona LúciaTrocar");
    act(() => { cliente.props.onPress(); });
    expect(onPickCustomer).toHaveBeenCalledTimes(1);

    const atalho = porTestID(tree, "cta-frete")[0];
    expect(flattenText(atalho.children)).toBe("Sem frete");
    act(() => { atalho.props.onPress(); });
    expect(onClear).toHaveBeenCalledTimes(1);
    act(() => { porTestID(tree, "frete-tirar")[0].props.onPress(); });
    expect(onClear).toHaveBeenCalledTimes(2);
    tree.unmount();
  });

  test("aberto sem cliente: convida a vincular; sem Clientes no Caixa a linha some", () => {
    const comSeletor = montar(freteFechado({ open: true, onPickCustomer: jest.fn() }));
    expect(flattenText(porTestID(comSeletor, "frete-cliente")[0].children)).toBe("Entrega sem cliente vinculadoVincular cliente");
    expect(porTestID(comSeletor, "resumo-frete")).toHaveLength(0);
    comSeletor.unmount();

    const semSeletor = montar(freteFechado({ open: true }));
    expect(porTestID(semSeletor, "frete-cliente")).toHaveLength(0);
    semSeletor.unmount();
  });

  test("digitar passa pelo filtro do texto", () => {
    const onChange = jest.fn();
    const tree = montar(freteFechado({ open: true, onChange }));
    act(() => { porTestID(tree, "frete-valor")[0].props.onChangeText("2a5,999"); });
    expect(onChange).toHaveBeenCalledWith("25,99");
    tree.unmount();
  });
});
