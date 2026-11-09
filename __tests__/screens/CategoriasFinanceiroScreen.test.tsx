// ============================================================
// Financeiro › Categorias (09/11/2026, mockup seção A e B)
//
// Cobre: as abas Despesas/Receitas com o formato real do GET
// /finance-categories; "usada pela Aura" sem Renomear/Arquivar no menu;
// "+ subcategoria" cria com parent_id; "Nova categoria" com "Em todas as
// minhas lojas"; consolidado pede para escolher uma loja.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
var mockAuth: any = { company: { id: "loja-1" }, token: "t", isDemo: false, consolidatedView: false };
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
jest.mock("expo-router", () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true } }));

var mockListar = jest.fn();
var mockCriar = jest.fn();
var mockAtualizar = jest.fn();
jest.mock("@/services/financeCategoriesApi", () => ({
  financeCategoriesApi: {
    listar: (...a: any[]) => mockListar(...a),
    criar: (...a: any[]) => mockCriar(...a),
    atualizar: (...a: any[]) => mockAtualizar(...a),
    juntar: jest.fn(),
  },
}));

import CategoriasRoute from "@/app/(tabs)/financeiro/categorias";

function sub(id: string, parent: string, name: string, count: number): any {
  return { id, kind: "expense", parent_id: parent, name, color: null, is_system: false, manual: true, sort_order: 10, archived_at: null, count };
}
const LISTA: any = {
  ano: 2026, lojas: 3, pode_todas_as_lojas: true,
  dre_lines: { expense: [{ key: "despesas_variaveis", label: "Despesas variáveis" }, { key: "despesas_fixas", label: "Despesas fixas" }], income: [{ key: "outras_receitas", label: "Outras receitas" }] },
  categories: [
    { id: "forn", kind: "expense", parent_id: null, name: "Fornecedores", color: "#dc2626", dre_line: "compras_mercadoria", dre_label: "Compras de mercadoria", is_system: true, manual: true, sort_order: 10, archived_at: null, count: 42, count_direct: 5,
      subcategories: [sub("merc", "forn", "Mercadoria para revenda", 31), sub("emb", "forn", "Embalagens", 6)] },
    { id: "fixas", kind: "expense", parent_id: null, name: "Fixas", color: "#7c3aed", dre_line: "despesas_fixas", dre_label: "Despesas fixas", is_system: false, manual: true, sort_order: 20, archived_at: null, count: 24, count_direct: 0,
      subcategories: [sub("alug", "fixas", "Aluguel", 10)] },
    { id: "vendas", kind: "income", parent_id: null, name: "Vendas", color: "#059669", dre_line: "receita_vendas", dre_label: "Receita de vendas", is_system: true, manual: true, sort_order: 10, archived_at: null, count: 900, count_direct: 900, subcategories: [] },
  ],
};

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
function porId(tree: any, testID: string): any {
  return tree.root.findAll((n: any) => n.props && n.props.testID === testID, { deep: false })[0];
}
async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><CategoriasRoute /></QueryClientProvider>);
  });
  await flush();
  return tree;
}

beforeEach(() => {
  mockAuth = { company: { id: "loja-1" }, token: "t", isDemo: false, consolidatedView: false };
  mockListar.mockReset().mockResolvedValue(LISTA);
  mockCriar.mockReset().mockResolvedValue({ category: {}, criadas_em: ["loja-1"], ja_existia_em: [] });
  mockAtualizar.mockReset();
});

describe("Financeiro › Categorias", () => {
  // No jsdom a janela mede 0 px: a tela rende no layout de celular (375 px),
  // com os rótulos curtos do mockup ("Aura", "+ sub", "+ Nova").
  it("Despesas (celular): cada categoria com subcategorias, contagem e o selo da Aura", async () => {
    const tree = await montar();
    expect(mockListar).toHaveBeenCalledWith("loja-1", { incluirArquivadas: false });
    const forn = texto(porId(tree, "categoria-Fornecedores").children);
    expect(forn).toContain("42 lançamentos em 2026 · entra como “Compras de mercadoria” no resultado");
    expect(forn).toContain("Aura");
    expect(forn).toContain("Mercadoria para revenda");
    expect(forn).toContain("+ sub");
    expect(texto(porId(tree, "categorias-nova").children)).toBe("+ Nova");
    expect(porId(tree, "categoria-Vendas")).toBeUndefined();
    await act(async () => { porId(tree, "categorias-aba-income").props.onPress(); });
    expect(texto(porId(tree, "categoria-Vendas").children)).toContain("Vem do Caixa e da loja online");
  });

  it("menu da usada pela Aura não tem Renomear nem Arquivar; o da loja tem", async () => {
    const tree = await montar();
    await act(async () => { porId(tree, "categoria-menu-Fornecedores").props.onPress(); });
    expect(porId(tree, "menu-renomear")).toBeUndefined();
    expect(porId(tree, "menu-arquivar")).toBeUndefined();
    expect(porId(tree, "menu-cor")).toBeDefined();
    await act(async () => { porId(tree, "categoria-menu-Fixas").props.onPress(); });
    expect(porId(tree, "menu-renomear")).toBeDefined();
    expect(porId(tree, "menu-arquivar")).toBeDefined();
    expect(porId(tree, "menu-juntar")).toBeDefined();
  });

  it("+ subcategoria cria dentro da categoria (inclusive numa usada pela Aura)", async () => {
    const tree = await montar();
    await act(async () => { porId(tree, "categoria-add-sub-Fornecedores").props.onPress(); });
    const input = porId(tree, "categoria-sub-input");
    await act(async () => { input.props.onChangeText("Frete de compra"); });
    await act(async () => { porId(tree, "categoria-sub-input").props.onSubmitEditing(); });
    await flush();
    expect(mockCriar).toHaveBeenCalledWith("loja-1", { parent_id: "forn", name: "Frete de compra" });
  });

  it("Nova categoria: nome, subcategoria e Em todas as minhas lojas (3)", async () => {
    const tree = await montar();
    await act(async () => { porId(tree, "categorias-nova").props.onPress(); });
    expect(texto(porId(tree, "nova-categoria-modal").children)).toContain("Em todas as minhas lojas (3)");
    expect(texto(porId(tree, "nova-categoria-modal").children)).toContain("Onde entra no DRE: Despesas variáveis");
    await act(async () => { porId(tree, "nova-categoria-nome").props.onChangeText("Veículo"); });
    await act(async () => { porId(tree, "nova-categoria-add-sub").props.onPress(); });
    await act(async () => { porId(tree, "nova-categoria-sub-input").props.onChangeText("Combustível"); });
    await act(async () => { porId(tree, "nova-categoria-sub-input").props.onSubmitEditing(); });
    await act(async () => { porId(tree, "nova-categoria-todas").props.onPress(); });
    await act(async () => { porId(tree, "nova-categoria-criar").props.onPress(); });
    await flush();
    expect(mockCriar).toHaveBeenCalledWith("loja-1", {
      kind: "expense", name: "Veículo", color: "#7c3aed", dre_line: "despesas_variaveis", subcategories: ["Combustível"], todas_as_lojas: true,
    });
  });

  it("consolidado: categorias são por loja, pede para escolher uma", async () => {
    mockAuth = { ...mockAuth, consolidatedView: true };
    const tree = await montar();
    expect(mockListar).not.toHaveBeenCalled();
    expect(texto(tree.toJSON())).toContain("Escolha uma empresa no seletor");
  });
});
