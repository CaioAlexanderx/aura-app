// ============================================================
// /financeiro/produtos dentro da casca do app (24/10/2026)
//
// A curva ABC morava em app/financeiro/produtos.tsx, fora de (tabs): abria
// sem a barra lateral e o Voltar caía no Painel. Cobre:
//   1. a rota de (tabs) monta a tela com as duas visões (por produto e por
//      categoria, esta com o formato real { period, categories });
//   2. o Voltar: back() só quando a tela anterior é o Financeiro; nos outros
//      casos replace para o Financeiro, na aba de origem (?de=).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/charts/DonutChart", () => ({ DonutChart: () => null }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, consolidatedView: false }),
}));
jest.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ flattened: [] }),
}));

var mockProductsRanking = jest.fn();
var mockProductsCategories = jest.fn();
jest.mock("@/services/companiesApi", () => ({
  companiesApi: {
    productsRanking: (...args: any[]) => mockProductsRanking(...args),
    productsCategories: (...args: any[]) => mockProductsCategories(...args),
  },
}));

var mockBack = jest.fn();
var mockReplace = jest.fn();
var mockCanGoBack = jest.fn(() => true);
var mockNavState: any = null;
var mockParams: any = {};
jest.mock("expo-router", () => ({
  router: {
    back: (...a: any[]) => mockBack(...a),
    replace: (...a: any[]) => mockReplace(...a),
    canGoBack: () => mockCanGoBack(),
    push: jest.fn(),
  },
  useNavigation: () => ({ getState: () => mockNavState }),
  useLocalSearchParams: () => mockParams,
}));

import ProdutosFinanceiroRoute from "@/app/(tabs)/financeiro/produtos";
import { destinoDoVoltar } from "@/components/screens/financeiro/ProdutosFinanceiroScreen";

if (!(URL as any).createObjectURL) (URL as any).createObjectURL = jest.fn(() => "blob:mock");
if (!(URL as any).revokeObjectURL) (URL as any).revokeObjectURL = jest.fn();

const RANKING: any = {
  period: { start: "2026-10-01", end: "2026-10-24", label: "month" },
  total_revenue: 1000,
  total_products: 1,
  curve_summary: { A: 1, B: 0, C: 0 },
  pagination: { limit: 200, offset: 0, total_items: 1, filtered_items: 1, returned: 1, abc_filter: null },
  products: [
    { id: "p1", name: "Tênis Casual", category: "Calçados", qty_sold: 10, revenue: 1000, abc: "A", total_qty: 10, total_revenue: 1000, accumulated_pct: 100 },
  ],
  summary: { total_products: 1, total_sold: 10, total_revenue: 1000 },
  class_breakdown: [
    { grade: "A", count: 1, total_revenue: 1000, total_qty: 10, revenue_pct: 100, qty_pct: 100 },
    { grade: "B", count: 0, total_revenue: 0, total_qty: 0, revenue_pct: 0, qty_pct: 0 },
    { grade: "C", count: 0, total_revenue: 0, total_qty: 0, revenue_pct: 0, qty_pct: 0 },
  ],
};

// Formato real de GET /products/categories (src/routes/productsRanking.js).
const CATEGORIES: any = {
  period: "month",
  categories: [
    { category: "Calçados", total_products: 18, total_revenue: 4000, total_qty: 210, share_pct: 50 },
    { category: "Blusas", total_products: 24, total_revenue: 2500, total_qty: 340, share_pct: 31.3 },
    { category: "Bolsas", total_products: 9, total_revenue: 1500, total_qty: 61, share_pct: 18.8 },
  ],
};

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

function achar(tree: any, accessibilityLabel: string): any {
  return tree.root.findAllByProps({ accessibilityLabel })[0];
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <ProdutosFinanceiroRoute />
      </QueryClientProvider>
    );
    await new Promise((r) => setTimeout(r, 0));
  });
  await flush();
  return tree;
}

describe("destinoDoVoltar", () => {
  const base = { rotaFinanceiro: "financeiro", hrefFinanceiro: "/(tabs)/financeiro" };

  it("tela anterior é o Financeiro → back (devolve a aba em que estava)", () => {
    expect(destinoDoVoltar({ ...base, rotaAnterior: "financeiro", de: "receitas" })).toEqual({ tipo: "back" });
  });

  it("tela anterior é o Painel (atalho ?focus=abc) → replace no Financeiro, na aba de origem", () => {
    expect(destinoDoVoltar({ ...base, rotaAnterior: "index", de: "receitas" }))
      .toEqual({ tipo: "replace", href: "/(tabs)/financeiro?tab=receitas" });
  });

  it("link direto, sem histórico e sem ?de → replace no Financeiro", () => {
    expect(destinoDoVoltar({ ...base, rotaAnterior: null })).toEqual({ tipo: "replace", href: "/(tabs)/financeiro" });
  });

  it("?de com aba desconhecida é ignorado", () => {
    expect(destinoDoVoltar({ ...base, rotaAnterior: null, de: "cupons" })).toEqual({ tipo: "replace", href: "/(tabs)/financeiro" });
    expect(destinoDoVoltar({ ...base, rotaAnterior: null, de: "<script>" })).toEqual({ tipo: "replace", href: "/(tabs)/financeiro" });
  });

  it("Studio: compara com a rota do Financeiro do Studio", () => {
    expect(destinoDoVoltar({ rotaFinanceiro: "gestao/financeiro", hrefFinanceiro: "/studio/gestao/financeiro", rotaAnterior: "gestao/financeiro" }))
      .toEqual({ tipo: "back" });
    expect(destinoDoVoltar({ rotaFinanceiro: "gestao/financeiro", hrefFinanceiro: "/studio/gestao/financeiro", rotaAnterior: "index", de: "receitas" }))
      .toEqual({ tipo: "replace", href: "/studio/gestao/financeiro?tab=receitas" });
  });
});

describe("app/(tabs)/financeiro/produtos", () => {
  beforeEach(() => {
    mockProductsRanking.mockReset().mockImplementation(() => Promise.resolve(RANKING));
    mockProductsCategories.mockReset().mockImplementation(() => Promise.resolve(CATEGORIES));
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset().mockImplementation(() => true);
    mockNavState = null;
    mockParams = {};
    window.localStorage.clear();
  });

  it("renderiza a visão por produto", async () => {
    const tree = await montar();
    const text = flattenText(tree.toJSON());
    expect(text).toContain("Produtos que mais dão dinheiro");
    expect(text).toContain("Curva ABC de produtos");
    expect(text).toContain("Tênis Casual");
    tree.unmount();
  });

  it("renderiza a visão por categoria com a resposta real sem quebrar", async () => {
    const tree = await montar();
    act(() => { achar(tree, "Ver curva ABC por categoria").props.onPress(); });
    await flush();
    const text = flattenText(tree.toJSON());
    expect(text).toContain("Curva ABC por categoria");
    expect(text).toContain("Blusas");
    expect(text).toContain("1 categoria faz 80% da receita: Calçados");
    tree.unmount();
  });

  it("Voltar com o Financeiro logo antes na pilha usa router.back()", async () => {
    mockNavState = { index: 1, routes: [{ name: "financeiro" }, { name: "financeiro/produtos" }] };
    mockParams = { de: "receitas" };
    const tree = await montar();
    act(() => { achar(tree, "Voltar para o Financeiro").props.onPress(); });
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("Voltar vindo do Painel vai para o Financeiro na aba Receitas, não para o Painel", async () => {
    mockNavState = { index: 1, routes: [{ name: "index" }, { name: "financeiro/produtos" }] };
    mockParams = { de: "receitas" };
    const tree = await montar();
    act(() => { achar(tree, "Voltar para o Financeiro").props.onPress(); });
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/financeiro?tab=receitas");
    tree.unmount();
  });

  it("Voltar por link direto (sem histórico) faz replace para o Financeiro", async () => {
    mockNavState = { index: 0, routes: [{ name: "financeiro/produtos" }] };
    mockCanGoBack.mockImplementation(() => false);
    const tree = await montar();
    act(() => { achar(tree, "Voltar para o Financeiro").props.onPress(); });
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/financeiro");
    tree.unmount();
  });
});
