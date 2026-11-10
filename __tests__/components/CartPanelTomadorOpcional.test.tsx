// ============================================================
// Caixa — carrinho (CartPanel): "CPF ou CNPJ de quem contratou (opcional)"
// (decisão do dono em 10/11/2026: tomador OPCIONAL na NFS-e, como o "CPF na
// nota" da NFC-e). O campo nunca leva asterisco nem trava o carrinho; com
// dígito errado mostra o erro; sem a prop `tomador` é o "CPF na nota" de
// sempre. Mocks do padrão do repo; testID + deep:false.
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
  useMerchantBrand: () => ({ logoUrl: null, name: "Studio Bela", initial: "S" }),
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

const CORTE: CartDisplayItem = {
  productId: "srv-corte", productBaseId: "srv-corte",
  name: "Corte feminino", price: 80, qty: 1, listPrice: 80,
  unit: "srv", purchaseUnit: null, purchaseFactor: null,
};
const METODOS = [{ key: "pix", label: "PIX", icon: "dollar" }];

function montar(cpf: string, tomador: any) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CartPanel
        items={[CORTE]} subtotal={80} discountAmount={0} total={80} itemCount={1}
        payMethods={METODOS as any} activePay="pix"
        onPay={jest.fn()} onInc={jest.fn()} onDec={jest.fn()} onRemove={jest.fn()} onClear={jest.fn()} onFinalize={jest.fn()}
        finalizeDisabled={false} requiredHints={[]}
        cpfNaNota={cpf} onCpfNaNotaChange={jest.fn()}
        tomador={tomador}
      />
    );
  });
  return tree;
}

const TOMADOR = { temProduto: false, mostrarNome: true, nome: "", onNome: jest.fn() };

describe("CPF ou CNPJ de quem contratou — sempre opcional", () => {
  test("vazio: rótulo com (opcional), sem asterisco, e o texto diz que a nota sai sem identificar", () => {
    const tree = montar("", TOMADOR);
    const caixa = porTestID(tree, "carrinho-doc-tomador");
    expect(caixa).toHaveLength(1);
    const texto = flattenText(caixa[0].children);
    expect(texto).toContain("CPF ou CNPJ de quem contratou");
    expect(porTestID(tree, "carrinho-doc-tomador-opcional")).toHaveLength(1);
    expect(texto).not.toMatch(/\*/);
    expect(texto).toMatch(/pode deixar em branco: a nota sai sem identificar o cliente/);
    expect(texto).not.toMatch(/prefeitura não aceita/);
    tree.unmount();
  });

  test("dígito errado: mostra o erro sob o campo (o documento não vai — ver caixaNfseTomador)", () => {
    const tree = montar("529.982.247-26", TOMADOR);
    const msg = porTestID(tree, "carrinho-doc-tomador-msg")[0];
    expect(flattenText(msg.children)).toMatch(/^Esse CPF não confere/);
    expect(porTestID(tree, "carrinho-doc-tomador-opcional")).toHaveLength(1);
    tree.unmount();
  });

  test("válido: confirma que vai na nota de serviço", () => {
    const tree = montar("529.982.247-25", TOMADOR);
    const msg = porTestID(tree, "carrinho-doc-tomador-msg")[0];
    expect(flattenText(msg.children)).toBe("✓ CPF confere. Vai na nota de serviço.");
    tree.unmount();
  });

  test("sem a prop tomador (venda só de produto): o \"CPF na nota\" de sempre", () => {
    const tree = montar("", null);
    expect(porTestID(tree, "carrinho-doc-tomador")).toHaveLength(0);
    tree.unmount();
  });
});
