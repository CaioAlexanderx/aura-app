// ============================================================
// Entrada de mercadoria e custo oculto na tela (03/11/2026).
// Mockup: docs/mockups/estoque-entrada-por-fornecedor.html.
//
// 1. modal: resumo antes → depois (tela 2), corpo do POST, aviso "Confere?"
// 2. modal sem custo visível: sem campo de custo, entrada só com quantidade
// 3. linha do Estoque: botão ↓ Entrada; semCusto tira Custo e Margem
// ============================================================
const mockDarEntrada = jest.fn(async (..._a: any[]) => ({ quantity: 20, supplier: null, before: { stock_qty: 4 }, after: { stock_qty: 24 } }));
jest.mock("@/services/api", () => ({ request: jest.fn(), companiesApi: { variants: jest.fn() } }));
jest.mock("@/services/suppliersApi", () => ({
  suppliersApi: { list: jest.fn(), create: jest.fn() },
  fornecedoresDoProdutoApi: { list: jest.fn(), darEntrada: (...a: any[]) => mockDarEntrada(...a) },
}));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "c1" } }) }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQuery: jest.fn(({ queryKey }: any) => {
    if (queryKey[0] === "suppliers") return { data: { suppliers: [{ id: "s1", name: "Distribuidora Alfa" }, { id: "s2", name: "Brás Capas" }] } };
    if (queryKey[0] === "product-suppliers") return { data: { suppliers: [{ supplier_id: "s1", cost: 5.5, is_main: true }], product: { avg_cost: 5.5 } } };
    return { data: undefined, isLoading: false };
  }),
}));
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return { ...RN, Modal: ({ visible, children }: any) => (visible ? children : null) };
});
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: "ProductImageUpload" }));

import React from "react";
import { Pressable, Text, TextInput } from "react-native";
import renderer, { act } from "react-test-renderer";
import { EntradaMercadoriaModal } from "@/components/screens/estoque/EntradaMercadoriaModal";
import { ProductRow } from "@/components/screens/estoque/ProductRow";

const PRODUTO = { id: "p1", name: "Capa iPhone 15 - Space", stock: 4, cost: 5.5, price: 35, unit: "un", has_variants: false };

function textos(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text as any)
    .map((t) => [].concat(t.props.children).flat(Infinity as any).filter((c: any) => typeof c === "string" || typeof c === "number").join(""))
    .join(" | ");
}
// O item mais interno que contém o texto (o card inteiro também "contém").
const pressavelCom = (tree: renderer.ReactTestRenderer, txt: string) =>
  tree.root.findAllByType(Pressable as any).filter((p: any) => textos({ root: p } as any).includes(txt)).pop()!;
const porTestID = (tree: renderer.ReactTestRenderer, id: string) => tree.root.find((n: any) => n.props && n.props.testID === id);
function montar(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  return tree;
}

beforeEach(() => mockDarEntrada.mockClear());

describe("modal Entrada de mercadoria", () => {
  test("tela 2: escolhe fornecedor, 20 un a R$ 5,90 → resumo e POST", async () => {
    const tree = montar(<EntradaMercadoriaModal visible produto={PRODUTO} semCusto={false} onClose={() => {}} />);
    expect(textos(tree)).toMatch(/últ\. custo R\$ 5,50/);
    act(() => { pressavelCom(tree, "Distribuidora Alfa").props.onPress(); });
    expect(textos(tree)).toMatch(/Distribuidora Alfa \| trocar/);
    act(() => { porTestID(tree, "entrada-quantidade").props.onChangeText("20"); });
    act(() => { porTestID(tree, "entrada-custo").props.onChangeText("590"); });
    const t = textos(tree);
    // Texto aninhado: "4 → " e "24 un" saem em pedaços separados.
    expect(t).toMatch(/24 un \| 4 → /);
    expect(t).toMatch(/R\$ 5,83 \| R\$ 5,50 → /);
    expect(t).toMatch(/83% \| 84% → /);
    expect(t).toMatch(/Total da compra: R\$ 118,00/);
    expect(t).toMatch(/Dar entrada em 20 un/);
    await act(async () => { porTestID(tree, "entrada-confirmar").props.onPress(); });
    expect(mockDarEntrada).toHaveBeenCalledWith("c1", "p1", { quantity: 20, supplier_id: "s1", unit_cost: 5.9, update_cost: true });
  });

  test("custo 50% acima pede confirmação antes de gravar", async () => {
    const tree = montar(<EntradaMercadoriaModal visible produto={PRODUTO} semCusto={false} onClose={() => {}} />);
    act(() => { porTestID(tree, "entrada-quantidade").props.onChangeText("2"); });
    act(() => { porTestID(tree, "entrada-custo").props.onChangeText("5900"); });
    expect(textos(tree)).toMatch(/Confere\?/);
    await act(async () => { porTestID(tree, "entrada-confirmar").props.onPress(); });
    expect(mockDarEntrada).not.toHaveBeenCalled();
    await act(async () => { porTestID(tree, "entrada-confirmar").props.onPress(); });
    expect(mockDarEntrada).toHaveBeenCalledTimes(1);
  });

  test("sem custo visível: sem campo de custo, sem R$ no resumo, POST só com quantidade", async () => {
    const tree = montar(<EntradaMercadoriaModal visible produto={{ ...PRODUTO, cost: null }} semCusto onClose={() => {}} />);
    expect(tree.root.findAll((n: any) => n.props && n.props.testID === "entrada-custo")).toHaveLength(0);
    expect(textos(tree)).not.toMatch(/últ\. custo/);
    act(() => { porTestID(tree, "entrada-quantidade").props.onChangeText("3"); });
    expect(textos(tree)).not.toMatch(/Custo médio|Margem/);
    await act(async () => { porTestID(tree, "entrada-confirmar").props.onPress(); });
    expect(mockDarEntrada).toHaveBeenCalledWith("c1", "p1", { quantity: 3 });
  });

  test("botão do topo: pede o produto antes", () => {
    const tree = montar(<EntradaMercadoriaModal visible produto={null} produtos={[PRODUTO]} semCusto={false} onClose={() => {}} />);
    expect(textos(tree)).toMatch(/Qual produto chegou\?/);
    act(() => { pressavelCom(tree, "Capa iPhone 15").props.onPress(); });
    expect(textos(tree)).toMatch(/De qual fornecedor você comprou\?/);
  });
});

describe("linha do Estoque", () => {
  const P: any = { id: "p1", name: "Capa", code: "C1", barcode: "", category: "Capas", price: 35, cost: 5.5, stock: 4, minStock: 0, unit: "un", notes: "", color: "", size: "" };
  const abrir = (tree: renderer.ReactTestRenderer) => act(() => { tree.root.findAllByType(Pressable as any)[0].props.onPress(); });

  test("↓ Entrada abre com o produto", () => {
    const onEntrada = jest.fn();
    const tree = montar(<ProductRow product={P} onEntrada={onEntrada} />);
    act(() => { porTestID(tree, "estoque-entrada-p1").props.onPress(); });
    expect(onEntrada).toHaveBeenCalledWith(P);
  });

  test("custo oculto: o preço da linha fica, Custo, Margem e Valor estoque somem", () => {
    const tree = montar(<ProductRow product={P} semCusto />);
    abrir(tree);
    const t = textos(tree);
    expect(t).toMatch(/R\$ 35,00/);
    expect(t).not.toMatch(/Custo|Margem|Valor estoque/);
  });

  test("sem a prop, igual a antes (Custo e Margem aparecem)", () => {
    const tree = montar(<ProductRow product={P} />);
    abrir(tree);
    expect(textos(tree)).toMatch(/Custo.*Margem|Margem.*Custo/);
  });
});
