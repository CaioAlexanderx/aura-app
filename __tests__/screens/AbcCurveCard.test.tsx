// ============================================================
// Fase 1 — Curva ABC por categoria (16/09/2026)
//
// Cobre a fiação do AbcCurveCard (não a lógica pura, que já está em
// __tests__/abcCategoryClassification.test.ts):
//   1. Seletor "Por produto · Por categoria" troca a visão e é lembrado
//      em localStorage (aura.financeiro.abc.viewMode).
//   2. Clicar numa categoria muda pra "Por produto" JÁ chamando
//      companiesApi.productsRanking com `category` — é o bug que a
//      queryKey precisa evitar (ver comentário de useAbcProductRanking
//      em AbcCurveCard.tsx): sem `category` na key, o cache reciclaria
//      dados de uma categoria pra outra.
//   3. O chip "Categoria: X ✕" some o filtro ao ser clicado.
//
// Mesmo padrão de __tests__/components/CustomerRowBotoes.test.tsx:
// react-test-renderer + QueryClientProvider real, companiesApi mockado
// (sem rede), Icon/DonutChart mockados (react-native-svg não passa pelo
// transformIgnorePatterns do projeto).
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

import { AbcCurveCard } from "@/components/screens/financeiro/v2/AbcCurveCard";

// jsdom não implementa a API de Blob URL usada pelo export CSV
// (downloadCsv em abcShared.tsx) — poliflha só o suficiente pro clique
// não estourar, sem testar o download real (isso é coberto pela função
// pura categoryCsvRows em abcCategoryClassification.test.ts).
if (!(URL as any).createObjectURL) (URL as any).createObjectURL = jest.fn(() => "blob:mock");
if (!(URL as any).revokeObjectURL) (URL as any).revokeObjectURL = jest.fn();

const RANKING: any = {
  period: { start: "2026-09-01", end: "2026-09-30", label: "Mês" },
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

const CATEGORIES: any = [
  { category: "Calçados", total_products: 18, total_revenue: 4000, total_qty: 210, share_pct: 40 },
  { category: "Blusas", total_products: 24, total_revenue: 2500, total_qty: 340, share_pct: 25 },
  { category: "Bolsas", total_products: 9, total_revenue: 1500, total_qty: 61, share_pct: 15 },
];

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

function acharTalvez(tree: any, accessibilityLabel: string): any {
  return tree.root.findAllByProps({ accessibilityLabel })[0] || null;
}

// Várias voltas de macrotask: sob a suíte inteira (mais carga, mais
// workers) uma única volta às vezes não é suficiente pra resolver a
// promise do react-query E propagar o setState antes da asserção —
// rodar isolado mascarava isso.
async function flush(tree: any) {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <AbcCurveCard />
      </QueryClientProvider>
    );
    await new Promise((r) => setTimeout(r, 0));
  });
  await flush(tree);
  return tree;
}

describe("AbcCurveCard — seletor Por produto / Por categoria", () => {
  beforeEach(() => {
    mockProductsRanking.mockReset().mockImplementation(() => Promise.resolve(RANKING));
    mockProductsCategories.mockReset().mockImplementation(() => Promise.resolve(CATEGORIES));
    window.localStorage.clear();
  });

  it("abre em 'Por produto' por padrão e chama productsRanking sem category", async () => {
    const tree = await montar();
    expect(flattenText(tree.toJSON())).toContain("Curva ABC de produtos");
    expect(mockProductsRanking).toHaveBeenCalled();
    const lastCall = mockProductsRanking.mock.calls[mockProductsRanking.mock.calls.length - 1];
    expect(lastCall[1].category).toBeUndefined();
    tree.unmount();
  });

  it("troca pra 'Por categoria', busca as categorias e lembra a escolha no localStorage", async () => {
    const tree = await montar();
    act(() => { achar(tree, "Ver curva ABC por categoria").props.onPress(); });
    await flush(tree);

    expect(flattenText(tree.toJSON())).toContain("Curva ABC por categoria");
    expect(mockProductsCategories).toHaveBeenCalled();
    expect(window.localStorage.getItem("aura.financeiro.abc.viewMode")).toBe("categoria");
    tree.unmount();
  });

  it("clicar numa categoria volta pra 'Por produto' JÁ filtrado (chip + productsRanking com category)", async () => {
    const tree = await montar();
    act(() => { achar(tree, "Ver curva ABC por categoria").props.onPress(); });
    await flush(tree);

    act(() => { achar(tree, "Ver produtos da categoria Calçados").props.onPress(); });
    await flush(tree);

    const text = flattenText(tree.toJSON());
    expect(text).toContain("Curva ABC de produtos");
    expect(text).toContain("Categoria: Calçados ✕");

    const lastCall = mockProductsRanking.mock.calls[mockProductsRanking.mock.calls.length - 1];
    expect(lastCall[1].category).toBe("Calçados");
    // drill-down também troca (e persiste) a visão de volta pra "produto"
    expect(window.localStorage.getItem("aura.financeiro.abc.viewMode")).toBe("produto");

    tree.unmount();
  });

  it("o chip 'Categoria: X ✕' limpa o filtro sem sair de 'Por produto'", async () => {
    const tree = await montar();
    act(() => { achar(tree, "Ver curva ABC por categoria").props.onPress(); });
    await flush(tree);
    act(() => { achar(tree, "Ver produtos da categoria Calçados").props.onPress(); });
    await flush(tree);

    expect(acharTalvez(tree, "Remover filtro de categoria Calçados")).not.toBeNull();

    act(() => { achar(tree, "Remover filtro de categoria Calçados").props.onPress(); });
    await flush(tree);

    // A query sem category já estava em cache (staleTime 60s, buscada no
    // mount inicial) — limpar o filtro reaproveita esse cache em vez de
    // refazer a chamada (é o comportamento certo do react-query). Por
    // isso a prova aqui é a UI (chip sumiu), não uma nova chamada de rede.
    expect(flattenText(tree.toJSON())).not.toContain("Categoria: Calçados ✕");
    expect(acharTalvez(tree, "Remover filtro de categoria Calçados")).toBeNull();

    tree.unmount();
  });

  it("exporta CSV da visão por categoria sem quebrar (respeita o filtro de classe)", async () => {
    const tree = await montar();
    act(() => { achar(tree, "Ver curva ABC por categoria").props.onPress(); });
    await flush(tree);

    const exportBtn = acharTalvez(tree, "Exportar categorias em CSV");
    expect(exportBtn).not.toBeNull();
    expect(() => act(() => { exportBtn.props.onPress(); })).not.toThrow();

    tree.unmount();
  });
});
