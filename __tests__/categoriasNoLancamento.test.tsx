// ============================================================
// 09/11/2026 — Categorias e subcategorias dentro do lançamento
// (TransactionModal; mockup, seção C + ajuste do Caio: "+ nova categoria"
// também, não só subcategoria, sem sair do lançamento).
//
// O que este arquivo trava:
//   1. a grade é a das categorias da loja; tocar numa abre as subcategorias;
//   2. "+ nova" cria a subcategoria ali mesmo e o lançamento sai com o texto
//      da MÃE e o category_id da sub;
//   3. "+ nova categoria" cria a categoria ali mesmo e já a escolhe;
//   4. sem o backend novo (lista null): a lista fixa de antes, sem "+ nova";
//   5. edição: abre com a subcategoria marcada e o PATCH leva o category_id;
//      o "A Receber" do crediário (texto que não casa) vai sem id, como antes.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text, TextInput } from "react-native";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "loja-1" }, user: { id: "user-1" }, isDemo: false }),
}));
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: [] }) }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {} }) }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQuery: () => ({ data: undefined }),
  useMutation: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false }),
}));
const mockUpdate = jest.fn((..._a: any[]) => Promise.resolve({}));
jest.mock("@/services/api", () => ({
  request: jest.fn(),
  pdvApi: { createSale: jest.fn() },
  companiesApi: { customers: jest.fn(), variants: jest.fn(), updateTransaction: (...a: any[]) => mockUpdate(...a) },
  employeesApi: { list: jest.fn() },
}));

function sub(id: string, parent: string, name: string): any {
  return { id, kind: "expense", parent_id: parent, name, color: null, is_system: false, manual: true, sort_order: 10, archived_at: null, count: 0 };
}
function cat(id: string, kind: string, name: string, subs: any[], extra?: any): any {
  return { id, kind, parent_id: null, name, color: null, dre_line: null, dre_label: null, is_system: false, manual: true, sort_order: 10, archived_at: null, count: 0, count_direct: 0, subcategories: subs, ...extra };
}
function listaInicial(): any {
  return {
    ano: 2026, lojas: 1, pode_todas_as_lojas: false, dre_lines: { income: [], expense: [] },
    categories: [
      cat("forn", "expense", "Fornecedores", [], { is_system: true }),
      cat("fixas", "expense", "Fixas", [sub("alug", "fixas", "Aluguel"), sub("ener", "fixas", "Energia")]),
      cat("taxa", "expense", "Taxas de cartão", [], { is_system: true, manual: false }),
      cat("vendas", "income", "Vendas", [], { is_system: true }),
    ],
  };
}
let mockLista: any = null;
const mockCriar = jest.fn(async (body: any) => {
  // Simula o refetch: a lista nova já traz o que foi criado.
  const novo = JSON.parse(JSON.stringify(mockLista));
  if (body.parent_id) {
    const s = sub("nova-sub", body.parent_id, body.name);
    novo.categories.find((c: any) => c.id === body.parent_id).subcategories.push(s);
    mockLista = novo;
    return { category: s, criadas_em: ["loja-1"], ja_existia_em: [] };
  }
  const c = cat("nova-cat", body.kind, body.name, []);
  novo.categories.push(c);
  mockLista = novo;
  return { category: c, criadas_em: ["loja-1"], ja_existia_em: [] };
});
jest.mock("@/hooks/useFinanceCategories", () => ({
  useFinanceCategories: () => ({ lista: mockLista, carregando: false, erro: false, refetch: jest.fn(), invalidar: jest.fn(), criar: (b: any) => mockCriar(b), companyId: "loja-1" }),
}));

import { TransactionModal } from "@/components/screens/financeiro/TransactionModal";

function porId(t: renderer.ReactTestRenderer, testID: string): any {
  return t.root.findAll((n: any) => n.props && n.props.testID === testID, { deep: false })[0];
}
function botao(t: renderer.ReactTestRenderer, texto: string) {
  const txt = t.root.findAll((n: any) => n.type === Text && n.props.children === texto)[0];
  if (!txt) throw new Error("sem o texto " + texto);
  let n: any = txt;
  while (n && !n.props?.onPress) n = n.parent;
  return n;
}
function input(t: renderer.ReactTestRenderer, placeholder: string) {
  return t.root.findAll((n: any) => n.type === TextInput && n.props.placeholder === placeholder)[0];
}
function selecionado(t: renderer.ReactTestRenderer, testID: string): boolean {
  const n = porId(t, testID);
  return !!(n && n.props.accessibilityState && n.props.accessibilityState.selected);
}

const onSave = jest.fn();
function montar(props?: any) {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<TransactionModal visible onClose={jest.fn()} onSave={onSave} {...props} />); });
  return t;
}
function preencherDespesa(t: renderer.ReactTestRenderer) {
  act(() => { botao(t, "Despesa").props.onPress(); });
  act(() => { input(t, "R$ 0,00").props.onChangeText("185000"); });
  act(() => { input(t, "Ex: Venda cliente Maria").props.onChangeText("Aluguel de novembro"); });
}

beforeEach(() => {
  mockLista = listaInicial();
  mockCriar.mockClear();
  mockUpdate.mockClear();
  onSave.mockClear();
});

describe("categorias dentro do lançamento", () => {
  test("a grade é a da loja; a taxa da maquininha fica de fora; tocar abre as subcategorias", () => {
    const t = montar();
    preencherDespesa(t);
    expect(porId(t, "tx-cat-Fornecedores")).toBeDefined();
    expect(porId(t, "tx-cat-Taxas de cartão")).toBeUndefined();
    expect(porId(t, "tx-subcategorias")).toBeUndefined();
    act(() => { porId(t, "tx-cat-Fixas").props.onPress(); });
    expect(porId(t, "tx-sub-Aluguel")).toBeDefined();
    expect(porId(t, "tx-organizar-categorias")).toBeUndefined(); // sem callback, sem link
  });

  test("+ nova subcategoria ali mesmo: o lançamento sai com o texto da mãe e o id da sub", async () => {
    const t = montar();
    preencherDespesa(t);
    act(() => { porId(t, "tx-cat-Fixas").props.onPress(); });
    act(() => { porId(t, "tx-nova-sub").props.onPress(); });
    act(() => { porId(t, "tx-nova-sub-input").props.onChangeText("Material de limpeza"); });
    await act(async () => { await porId(t, "tx-nova-sub-criar").props.onPress(); });
    expect(mockCriar).toHaveBeenCalledWith({ parent_id: "fixas", name: "Material de limpeza" });
    // re-render com a lista nova
    act(() => { t.update(<TransactionModal visible onClose={jest.fn()} onSave={onSave} />); });
    expect(selecionado(t, "tx-sub-Material de limpeza")).toBe(true);
    await act(async () => { await botao(t, "Lancar despesa").props.onPress(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ type: "expense", amount: 1850, category: "Fixas", category_id: "nova-sub" });
  });

  test("+ nova categoria ali mesmo: cria, já escolhe e o lançamento sai com ela", async () => {
    const t = montar();
    preencherDespesa(t);
    act(() => { porId(t, "tx-nova-categoria").props.onPress(); });
    act(() => { porId(t, "tx-nova-categoria-input").props.onChangeText("Veículo"); });
    await act(async () => { await porId(t, "tx-nova-categoria-criar").props.onPress(); });
    expect(mockCriar).toHaveBeenCalledWith({ kind: "expense", name: "Veículo" });
    act(() => { t.update(<TransactionModal visible onClose={jest.fn()} onSave={onSave} />); });
    expect(selecionado(t, "tx-cat-Veículo")).toBe(true);
    // A subcategoria também pode nascer ali: a linha aparece para a categoria nova.
    expect(porId(t, "tx-nova-sub")).toBeDefined();
    await act(async () => { await botao(t, "Lancar despesa").props.onPress(); });
    expect(onSave.mock.calls[0][0]).toMatchObject({ category: "Veículo", category_id: "nova-cat" });
  });

  test("tocar de novo na subcategoria desmarca: vai o id da mãe", async () => {
    const t = montar();
    preencherDespesa(t);
    act(() => { porId(t, "tx-cat-Fixas").props.onPress(); });
    act(() => { porId(t, "tx-sub-Energia").props.onPress(); });
    act(() => { porId(t, "tx-sub-Energia").props.onPress(); });
    await act(async () => { await botao(t, "Lancar despesa").props.onPress(); });
    expect(onSave.mock.calls[0][0]).toMatchObject({ category: "Fixas", category_id: "fixas" });
  });

  test("sem o backend novo: a lista fixa de antes, sem + nova e sem category_id", async () => {
    mockLista = null;
    const t = montar();
    preencherDespesa(t);
    expect(porId(t, "tx-cat-Operacional")).toBeDefined();
    expect(porId(t, "tx-nova-categoria")).toBeUndefined();
    act(() => { porId(t, "tx-cat-Fixas").props.onPress(); });
    expect(porId(t, "tx-subcategorias")).toBeUndefined();
    await act(async () => { await botao(t, "Lancar despesa").props.onPress(); });
    expect(onSave.mock.calls[0][0].category).toBe("Fixas");
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("category_id");
  });

  test("edição: abre com a subcategoria marcada e o PATCH leva o category_id", async () => {
    const tx: any = { id: "tx-1", type: "expense", amount: 1850, desc: "Aluguel", category: "Fixas", category_id: "alug", status: "pending", due_date: "2026-11-05" };
    const t = montar({ editTransaction: tx });
    expect(selecionado(t, "tx-cat-Fixas")).toBe(true);
    expect(selecionado(t, "tx-sub-Aluguel")).toBe(true);
    act(() => { porId(t, "tx-sub-Energia").props.onPress(); });
    await act(async () => { await botao(t, "Salvar alterações").props.onPress(); });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][2]).toMatchObject({ category: "Fixas", category_id: "ener" });
  });

  test("edição do A Receber do crediário: texto que não casa vai como está, sem id", async () => {
    mockLista.categories.push(cat("cred", "income", "Crediário", [], { is_system: true }));
    const tx: any = { id: "tx-2", type: "income", amount: 300, desc: "Carnê", category: "Crediario - A Receber", status: "pending", due_date: "2026-11-05", idempotency_key: "credit-sale-abc" };
    const t = montar({ editTransaction: tx });
    await act(async () => { await botao(t, "Salvar alterações").props.onPress(); });
    expect(mockUpdate.mock.calls[0][2].category).toBe("Crediario - A Receber");
    expect(mockUpdate.mock.calls[0][2]).not.toHaveProperty("category_id");
  });

  test("Organizar categorias chama o callback", () => {
    const org = jest.fn();
    const t = montar({ onOrganizarCategorias: org });
    act(() => { porId(t, "tx-organizar-categorias").props.onPress(); });
    expect(org).toHaveBeenCalled();
  });
});
