// ============================================================
// Pedido separado de venda (A1, p-63a): o "Guardar" do rodapé do Caixa.
// Mockup aprovado em 17/11/2026, parte 1.
//   - com o Pedido ligado, o botão do meio é "Guardar" e abre Pedido /
//     Orçamento; o Orçamento chama a MESMA ação de antes (imprimir; Matcon:
//     salvar);
//   - carrinho vazio: "Guardar" desabilitado;
//   - Comanda ligada: "Comandas (N)" sobe para a linha de atalhos, como na
//     loja Matcon (pendência 2), sem mudar o fluxo da Comanda;
//   - editando um orçamento do Matcon, o botão segue "Salvar orçamento".
// A prova de que o rodapé SEM o Pedido não mudou está em
// CartPanelRodapeIgual.test.tsx. A regra de quem vê está em
// __tests__/pedidoNoCaixa.test.ts.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ active, children }: any) => (active ? children : null),
}));

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
  useMerchantBrand: () => ({ logoUrl: null, name: "Loja", initial: "L" }),
}));

import { CartPanel } from "@/components/screens/pdv/CartPanel";
import { TEXTOS_DO_GUARDAR } from "@/components/screens/pdv/GuardarMenu";

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
const ITEM = {
  productId: "p-1", productBaseId: "p-1", name: "Vestido Midi Linho", price: 189.9, qty: 1, listPrice: 189.9,
  unit: "un", purchaseUnit: null, purchaseFactor: null,
};

function montar(extra: Record<string, any> = {}, items: any[] = [ITEM]) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CartPanel
        items={items} subtotal={189.9} discountAmount={0} total={189.9} itemCount={items.length}
        payMethods={METODOS as any} activePay="pix"
        onPay={jest.fn()} onInc={jest.fn()} onDec={jest.fn()} onRemove={jest.fn()} onClear={jest.fn()} onFinalize={jest.fn()}
        {...extra}
      />
    );
  });
  return tree;
}

afterEach(() => { mockPdvSettings = {}; });

describe("rodapé com o Pedido ligado", () => {
  test("o botão do meio vira Guardar e abre Pedido / Orçamento com os textos do mockup", () => {
    const onNovoPedido = jest.fn();
    const onGenerateQuote = jest.fn();
    const tree = montar({ pedido: { onNovoPedido }, showOrcamento: true, onGenerateQuote });
    const guardar = porTestID(tree, "cta-guardar")[0];
    expect(flattenText(guardar.children)).toBe("Guardar");
    expect(porTestID(tree, "guardar-menu")).toHaveLength(0);

    act(() => { guardar.props.onPress(); });
    const menu = porTestID(tree, "guardar-menu")[0];
    const texto = flattenText(menu.children);
    expect(texto).toContain(TEXTOS_DO_GUARDAR.titulo);
    expect(texto).toContain("Pedido" + "As peças ficam reservadas para a cliente. Dá para receber um sinal agora.");
    expect(texto).toContain("Orçamento" + "Só o preço, para a cliente pensar. Nada fica reservado.");

    act(() => { porTestID(tree, "guardar-opcao-pedido")[0].props.onPress(); });
    expect(onNovoPedido).toHaveBeenCalledTimes(1);
    expect(onGenerateQuote).not.toHaveBeenCalled();
    expect(porTestID(tree, "guardar-menu")).toHaveLength(0);
    tree.unmount();
  });

  test("Orçamento faz o mesmo de antes: imprime", () => {
    const onGenerateQuote = jest.fn();
    const tree = montar({ pedido: { onNovoPedido: jest.fn() }, showOrcamento: true, onGenerateQuote });
    act(() => { porTestID(tree, "cta-guardar")[0].props.onPress(); });
    act(() => { porTestID(tree, "guardar-opcao-orcamento")[0].props.onPress(); });
    expect(onGenerateQuote).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("loja Matcon: Orçamento salva na esteira (onSaveQuote), como o botão de antes", () => {
    mockPdvSettings = { matcon_enabled: true };
    const onSaveQuote = jest.fn();
    const onGenerateQuote = jest.fn();
    const tree = montar({ pedido: { onNovoPedido: jest.fn() }, showOrcamento: true, onGenerateQuote, onSaveQuote });
    expect(porTestID(tree, "cta-salvar-orcamento")).toHaveLength(0);
    act(() => { porTestID(tree, "cta-guardar")[0].props.onPress(); });
    act(() => { porTestID(tree, "guardar-opcao-orcamento")[0].props.onPress(); });
    expect(onSaveQuote).toHaveBeenCalledTimes(1);
    expect(onGenerateQuote).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("editando um orçamento do Matcon: o botão continua Salvar orçamento", () => {
    mockPdvSettings = { matcon_enabled: true };
    const tree = montar({ pedido: { onNovoPedido: jest.fn() }, onSaveQuote: jest.fn(), editingQuote: { number: 3, onCancel: jest.fn() } });
    expect(porTestID(tree, "cta-guardar")).toHaveLength(0);
    expect(flattenText(porTestID(tree, "cta-salvar-orcamento")[0].children)).toBe("Salvar orçamento");
    tree.unmount();
  });

  test("sem ação de orçamento na loja, o menu só tem o Pedido", () => {
    const tree = montar({ pedido: { onNovoPedido: jest.fn() } });
    act(() => { porTestID(tree, "cta-guardar")[0].props.onPress(); });
    expect(porTestID(tree, "guardar-opcao-pedido")).toHaveLength(1);
    expect(porTestID(tree, "guardar-opcao-orcamento")).toHaveLength(0);
    tree.unmount();
  });

  test("carrinho vazio: Guardar desabilitado e o menu não abre", () => {
    const tree = montar({ pedido: { onNovoPedido: jest.fn() }, showOrcamento: true, onGenerateQuote: jest.fn() }, []);
    const guardar = porTestID(tree, "cta-guardar")[0];
    expect(guardar.props.disabled).toBe(true);
    act(() => { guardar.props.onPress(); });
    expect(porTestID(tree, "guardar-menu")).toHaveLength(0);
    tree.unmount();
  });

  test("venda em andamento: Guardar desabilitado", () => {
    const tree = montar({ pedido: { onNovoPedido: jest.fn() }, showOrcamento: true, onGenerateQuote: jest.fn(), isProcessing: true });
    expect(porTestID(tree, "cta-guardar")[0].props.disabled).toBe(true);
    tree.unmount();
  });

  test("Fechar fecha o menu sem fazer nada", () => {
    const onNovoPedido = jest.fn();
    const tree = montar({ pedido: { onNovoPedido }, showOrcamento: true, onGenerateQuote: jest.fn() });
    act(() => { porTestID(tree, "cta-guardar")[0].props.onPress(); });
    expect(porTestID(tree, "guardar-menu")).toHaveLength(1);
    // No computador o menu é um cartão: tocar fora fecha.
    const fundo = tree.root.findAll((n) => n.props && n.props.accessibilityLabel === TEXTOS_DO_GUARDAR.fechar && typeof n.props.onPress === "function", { deep: false })[0];
    act(() => { fundo.props.onPress(); });
    expect(porTestID(tree, "guardar-menu")).toHaveLength(0);
    expect(onNovoPedido).not.toHaveBeenCalled();
    tree.unmount();
  });
});

describe("Comanda ligada com o Pedido (pendência 2)", () => {
  const COMANDA = { onAdd: jest.fn(), onList: jest.fn(), openCount: 4, charging: null };

  test("sem Matcon: Comandas (N) sobe para o atalho e o rodapé fica Limpar · Guardar · Finalizar", () => {
    const onList = jest.fn();
    const tree = montar({ pedido: { onNovoPedido: jest.fn() }, showOrcamento: true, onGenerateQuote: jest.fn(), comanda: { ...COMANDA, onList } });
    expect(porTestID(tree, "cta-comandas")).toHaveLength(0);
    expect(porTestID(tree, "cta-guardar")).toHaveLength(1);
    const atalho = porTestID(tree, "cta-comandas-atalho")[0];
    expect(flattenText(atalho.children)).toBe("Comandas (4)");
    act(() => { atalho.props.onPress(); });
    expect(onList).toHaveBeenCalledTimes(1);
    expect(porTestID(tree, "cta-adicionar-comanda")).toHaveLength(1);
    tree.unmount();
  });

  test("com Matcon: igual ao Matcon de hoje, com Guardar no lugar do Orçamento", () => {
    mockPdvSettings = { matcon_enabled: true };
    const tree = montar({ pedido: { onNovoPedido: jest.fn() }, onSaveQuote: jest.fn(), comanda: COMANDA });
    expect(porTestID(tree, "cta-comandas")).toHaveLength(0);
    expect(porTestID(tree, "cta-comandas-atalho")).toHaveLength(1);
    expect(porTestID(tree, "cta-guardar")).toHaveLength(1);
    tree.unmount();
  });

  test("sem o Pedido: a Comanda volta para o rodapé de sempre", () => {
    const tree = montar({ pedido: null, showOrcamento: true, onGenerateQuote: jest.fn(), comanda: COMANDA });
    expect(porTestID(tree, "cta-comandas")).toHaveLength(1);
    expect(porTestID(tree, "cta-comandas-atalho")).toHaveLength(0);
    expect(porTestID(tree, "cta-guardar")).toHaveLength(0);
    tree.unmount();
  });
});
