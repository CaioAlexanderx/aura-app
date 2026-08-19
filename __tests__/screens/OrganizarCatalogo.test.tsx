// ============================================================
// AURA. — C1: tela Organizar catálogo (F0)
//
// O que estes testes provam — são os critérios de aceite do item:
//   1. Nó pai mostra a contagem da SUBÁRVORE (product_count_total), não
//      só a dele. Mostrar product_count faria "Feminino" parecer vazio
//      quando tudo está em "Feminino > Calçados".
//   2. Excluir categoria com produtos NÃO apaga: o 409
//      CATEGORY_HAS_PRODUCTS vira a pergunta "para onde vão os N
//      produtos?", e a segunda tentativa vai com move_to.
//   3. O nível 2 não oferece "+ sub" — três níveis, nunca quatro.
//   4. Mover não oferece a própria subárvore como destino (o backend
//      barra com CATEGORY_CYCLE; oferecer seria oferecer um erro).
//   5. parseCategoryError lê o código em err.data.code E o P0001 que
//      chega só como mensagem — mapear só por code deixaria
//      CATEGORY_CYCLE virar erro genérico.
//
// Mesmo padrão dos testes do B3 e do C2: react-native e hooks mockados,
// sem QueryClient, auth store ou rede.
// ============================================================
import TestRenderer, { act } from "react-test-renderer";
import React from "react";

jest.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  TextInput: "TextInput", ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s }, Platform: { OS: "web" },
}));

jest.mock("@/constants/colors", () => ({
  useColors: () => ({ bg: "#060816", bg3: "#0e1228", ink: "#f0edff", ink3: "#aaa", border: "#222" }),
}));

jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));

// requireActual de useCategories/useCategoryTree puxa stores/auth, que
// importa expo-secure-store — e expo-modules-core não carrega sob Jest.
// Mockar aqui é o que permite usar a implementação REAL de
// canHaveChildren e parseCategoryError, que é o ponto destes testes.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("@/components/Toast", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

jest.mock("@/hooks/useCategories", () => {
  const actual = jest.requireActual("@/hooks/useCategories");
  return { ...actual, useCategories: jest.fn() };
});
jest.mock("@/hooks/useCategoryTree", () => {
  const actual = jest.requireActual("@/hooks/useCategoryTree");
  return { ...actual, useCategoryTree: jest.fn() };
});

import OrganizarCatalogoScreen from "@/app/catalogo/organizar";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryTree, parseCategoryError } from "@/hooks/useCategoryTree";

const mockCategories = useCategories as unknown as jest.Mock;
const mockTree = useCategoryTree as unknown as jest.Mock;

const BOTAS = {
  id: "cat-botas", company_id: "c1", type: "product", parent_id: "cat-calcados",
  name: "Botas", slug: "botas", path: "/feminino/calcados/botas", depth: 2,
  sort_order: 0, color: null, image_url: null, banner_url: null,
  is_visible_storefront: true, seo_title: null, seo_description: null,
  product_count: 12, product_count_total: 12, children: [],
} as any;

const CALCADOS = {
  ...BOTAS, id: "cat-calcados", parent_id: "cat-feminino", name: "Calçados",
  slug: "calcados", path: "/feminino/calcados", depth: 1,
  product_count: 0, product_count_total: 12, children: [BOTAS],
} as any;

const FEMININO = {
  ...BOTAS, id: "cat-feminino", parent_id: null, name: "Feminino",
  slug: "feminino", path: "/feminino", depth: 0,
  product_count: 0, product_count_total: 12, children: [CALCADOS],
} as any;

function montar(over: { remove?: jest.Mock } = {}) {
  const remove = over.remove || jest.fn().mockResolvedValue(null);
  const move = jest.fn().mockResolvedValue(undefined);

  mockCategories.mockReturnValue({
    tree: [FEMININO],
    flattened: [FEMININO, CALCADOS, BOTAS],
    isLoading: false,
    create: jest.fn().mockResolvedValue(undefined),
    isCreating: false,
    refetch: jest.fn(),
  });
  mockTree.mockReturnValue({
    rename: jest.fn().mockResolvedValue(undefined),
    isRenaming: false,
    remove, isRemoving: false,
    move, isMoving: false,
    merge: jest.fn(), reorder: jest.fn(), cloneFrom: jest.fn(),
  });

  let r: any;
  act(() => { r = TestRenderer.create(<OrganizarCatalogoScreen />); });
  return { r, remove, move };
}

// Coleta todo texto renderizado, para asserção independente de layout.
function textos(r: any): string[] {
  return r.root.findAllByType("Text")
    .map((n: any) => (Array.isArray(n.props.children) ? n.props.children.join("") : String(n.props.children ?? "")))
    .filter(Boolean);
}

describe("C1 — Organizar catálogo", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test("nó pai mostra a contagem da subárvore, não a dele", () => {
    const { r } = montar();
    const t = textos(r);
    // Feminino tem product_count 0 e product_count_total 12: o que
    // aparece tem que ser 12, senão o pai parece vazio.
    expect(t).toContain("12");
    expect(t).toContain("Feminino");
  });

  test("nível 2 não oferece criar subcategoria", () => {
    const { r } = montar();
    const t = textos(r);
    // Feminino (0) e Calçados (1) oferecem "+ sub"; Botas (2) não.
    // Com a árvore aberta nos três níveis, isso dá exatamente 2.
    expect(t.filter((x) => x === "+ sub")).toHaveLength(2);
  });

  test("excluir com produtos pergunta o destino em vez de apagar", async () => {
    const remove = jest.fn()
      .mockResolvedValueOnce({ code: "CATEGORY_HAS_PRODUCTS", message: "x", productCount: 12 });
    const { r } = montar({ remove });

    // Dispara o handler do primeiro "excluir" da árvore.
    const pressables = r.root.findAllByType("Pressable");
    const alvo = pressables.find((p: any) => {
      const kids = p.props.children;
      const txt = kids?.props?.children;
      return txt === "excluir";
    });
    expect(alvo).toBeTruthy();

    await act(async () => { await alvo.props.onPress(); });

    // Primeira tentativa foi SEM move_to — é o 409 que informa a contagem.
    expect(remove).toHaveBeenCalledWith("cat-feminino");
    const t = textos(r);
    expect(t.some((x) => x.includes("12 produto(s) usam esta categoria"))).toBe(true);
  });

  test("mover não oferece a própria subárvore como destino", () => {
    const { r } = montar();
    const pressables = r.root.findAllByType("Pressable");
    const moverBtn = pressables.find((p: any) => p.props.children?.props?.children === "mover");
    expect(moverBtn).toBeTruthy();

    act(() => { moverBtn.props.onPress(); });

    const t = textos(r);
    // Movendo "Feminino": o destino "Feminino › Calçados" está dentro da
    // própria subárvore e não pode aparecer.
    expect(t.some((x) => x.includes("Feminino › Calçados"))).toBe(false);
    // "Tornar categoria principal" é sempre válido.
    expect(t).toContain("Tornar categoria principal");
  });
});

describe("parseCategoryError — as duas famílias de erro do contrato §6", () => {
  test("lê o código em err.data.code e traz a contagem junto", () => {
    const e = parseCategoryError({
      message: "conflito",
      data: { code: "CATEGORY_HAS_PRODUCTS", product_count: 12 },
    });
    expect(e.code).toBe("CATEGORY_HAS_PRODUCTS");
    expect(e.productCount).toBe(12);
    expect(e.message).toContain("12");
  });

  test("CATEGORY_HAS_CHILDREN usa children_count na mensagem", () => {
    const e = parseCategoryError({ message: "x", data: { code: "CATEGORY_HAS_CHILDREN", children_count: 3 } });
    expect(e.message).toContain("3");
  });

  test("erro de trigger (P0001) chega só como mensagem e ainda assim é mapeado", () => {
    // Sem `code` no corpo: o backend levanta RAISE EXCEPTION e a string
    // vem em err.message. Mapear só por code deixaria isso virar genérico.
    const e = parseCategoryError({ message: "CATEGORY_CYCLE: ciclo detectado", data: {} });
    expect(e.code).toBe("CATEGORY_CYCLE");
    expect(e.message).toContain("dentro dela mesma");
  });

  test("erro desconhecido cai na mensagem crua, sem inventar código", () => {
    const e = parseCategoryError({ message: "Erro de rede", data: {} });
    expect(e.code).toBeNull();
    expect(e.message).toBe("Erro de rede");
  });
});
