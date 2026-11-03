// 03/11/2026 — tela "Vendas por produto e numeração" (mockup
// docs/mockups/relatorio-vendas-por-numeracao.html, telas 1-4).
let mockLargura = 1280;
let mockQuery: any = {};
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return { ...RN, Modal: ({ visible, children }: any) => (visible ? children : null), useWindowDimensions: () => ({ width: mockLargura, height: 900 }) };
});
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({ period: "week" }),
  useNavigation: () => ({ getState: () => ({ index: 0, routes: [] }) }),
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn((o: any) => { mockQuery.ultimaChave = o.queryKey; return mockQuery.resposta; }) }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "c1" }, consolidatedView: mockQuery.consolidado || false }) }));
jest.mock("@/stores/valoresOcultos", () => ({ useValoresOcultos: () => ({ m: (t: string) => t, ocultos: false }) }));
jest.mock("@/components/OlhoValores", () => ({ OlhoValores: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/utils/clipboard", () => ({ copyToClipboard: jest.fn(async () => true) }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/components/screens/financeiro/ProdutosFinanceiroScreen", () => ({ destinoDoVoltar: () => ({ tipo: "replace", href: "/(tabs)/financeiro" }) }));

import React from "react";
import { Pressable, Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import { VendasPorNumeracaoScreen } from "@/components/screens/financeiro/VendasPorNumeracaoScreen";

const DADOS = {
  periodo: { inicio: "2026-10-27", fim: "2026-11-02", dias: 7, rotulo: "27/10 a 02/11" },
  unidade: "pares",
  kpis: { vendidos: 14, receita: 1660, ticket_medio: 118.57, modelos_venderam: 2, modelos_total: 10, campea: { numeracao: "37", vendidos: 5, pct: 36 }, vendidos_anterior: 10, variacao_pct: 40 },
  colunas: ["36", "37", "38", "39"],
  categorias: ["Sandália", "Tênis"],
  modelos: [
    { product_id: "p1", nome: "Tênis Runner Branco", sku: "TR-100", tipo: "Tênis", cor: null, vendidos: 10, receita: 1400, estoque: 4, giro_pct: 71, dura_dias: 2, repor: 7,
      fornecedor: { id: "f1", nome: "Distribuidora Alfa", telefone: "11998765432" },
      numeracoes: [{ numeracao: "36", vendidos: 3, estoque: 1 }, { numeracao: "37", vendidos: 4, estoque: 3 }, { numeracao: "38", vendidos: 3, estoque: 0 }] },
    { product_id: "p2", nome: "Sandália Flat Nude", sku: null, tipo: "Sandália", cor: null, vendidos: 4, receita: 260, estoque: 9, giro_pct: 31, dura_dias: 15, repor: 0,
      fornecedor: null, numeracoes: [{ numeracao: "37", vendidos: 1, estoque: 5 }, { numeracao: "39", vendidos: 3, estoque: 4 }] },
  ],
  numeracoes: [{ numeracao: "37", vendidos: 5, pct: 36, estoque: 8, repor: 0 }, { numeracao: "36", vendidos: 3, pct: 21, estoque: 1, repor: 2 }],
  totais: { vendidos: 14, receita: 1660, estoque: 13, giro_pct: 52, dura_dias: 6, repor: 7 },
};

function textos(root: any): string {
  return root.findAllByType(Text as any)
    .map((t: any) => [].concat(t.props.children).flat(Infinity as any).filter((c: any) => typeof c === "string" || typeof c === "number").join(""))
    .join(" | ");
}
const id = (tree: renderer.ReactTestRenderer, t: string) => tree.root.find((n: any) => n.props && n.props.testID === t);
const existe = (tree: renderer.ReactTestRenderer, t: string) => tree.root.findAll((n: any) => n.props && n.props.testID === t).length > 0;
function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<VendasPorNumeracaoScreen rotaFinanceiro="financeiro" hrefFinanceiro="/(tabs)/financeiro" />); });
  return tree;
}

beforeEach(() => { mockLargura = 1280; mockQuery = { resposta: { data: DADOS, isLoading: false, isError: false, refetch: jest.fn(), isFetching: false } }; });

test("abre no período do link (?period=week) e mostra KPIs com variação", () => {
  const tree = montar();
  expect(mockQuery.ultimaChave[3]).toMatchObject({ period: "week" });
  const t = textos(tree.root);
  expect(t).toMatch(/PARES VENDIDOS \| 14 \| \+40% que o período anterior/);
  expect(t).toMatch(/NUMERAÇÃO CAMPEÃ \| 37 \| 5 pares · 36%/);
  expect(t).toMatch(/de 10 no estoque/);
});

test("por modelo: a linha abre as numerações com 'tem N' e 'acabou'", () => {
  const tree = montar();
  expect(existe(tree, "vn-numeracoes-p1")).toBe(false);
  act(() => { id(tree, "vn-modelo-p1").props.onPress(); });
  const t = textos(id(tree, "vn-numeracoes-p1"));
  expect(t).toBe("36 | 3 | tem 1 | 37 | 4 | tem 3 | 38 | 3 | acabou");
  expect(textos(tree.root)).toMatch(/Total \(2 modelos\)/);
});

test("grade: total por numeração e % dos pares", () => {
  const tree = montar();
  act(() => { id(tree, "vn-visao-grade").props.onPress(); });
  const t = textos(id(tree, "vn-grade"));
  expect(t).toMatch(/Total por numeração/);
  // 36: 3 · 37: 5 · 38: 3 · 39: 3 · total 14
  expect(t).toMatch(/3 \| 5 \| 3 \| 3 \| 14/);
  expect(t).toMatch(/21% \| 36% \| 21% \| 21% \| 100%/);
});

test("por numeração e montar pedido (só o que falta, por fornecedor)", () => {
  const tree = montar();
  act(() => { id(tree, "vn-visao-numeracao").props.onPress(); });
  expect(textos(id(tree, "vn-tabela-numeracao"))).toMatch(/37 \| 5 \| 36% \| 8 \| 0/);
  act(() => { id(tree, "vn-montar-pedido").props.onPress(); });
  const t = textos(id(tree, "vn-pedido-modal"));
  expect(t).toContain("Pedido — Distribuidora Alfa\n• Tênis Runner Branco: 36 ×2, 37 ×1, 38 ×3\nTotal: 6 pares");
  expect(t).toContain("Abrir no WhatsApp");
  expect(t).not.toContain("Sandália");
});

test("celular: cartões por modelo", () => {
  mockLargura = 390;
  const tree = montar();
  expect(existe(tree, "vn-cartoes")).toBe(true);
  expect(existe(tree, "vn-tabela-modelo")).toBe(false);
  expect(textos(id(tree, "vn-cartoes"))).toMatch(/Comprar p\/ repor: \| 7 pares|Comprar p\/ repor: .*7/);
});

test("sem permissão: frase de balcão, sem tentar de novo", () => {
  mockQuery = { resposta: { data: undefined, isLoading: false, isError: true, error: { status: 403, data: { code: "SEM_PERMISSAO_RELATORIO" } }, refetch: jest.fn() } };
  const tree = montar();
  const t = textos(tree.root);
  expect(t).toMatch(/Este relatório é de quem cuida do financeiro da loja/);
  expect(t).not.toMatch(/Tentar de novo/);
});

test("consolidado: subtítulo diz todas as lojas", () => {
  mockQuery.consolidado = true;
  const tree = montar();
  expect(textos(tree.root)).toMatch(/todas as lojas/);
});
