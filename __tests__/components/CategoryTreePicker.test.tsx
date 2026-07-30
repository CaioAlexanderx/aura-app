// ============================================================
// AURA. — CategoryTreePicker (Bloco B3, F0 taxonomia de catalogo)
//
// Mock de arvore aqui embaixo E o entregavel de mock do bloco (briefing
// 5.5): reflete o objeto Category do contrato congelado
// (aura-backend docs/CONTRACT_CATEGORIES.md secao 2), com path/depth/
// product_count_total coerentes. Espelha os nomes da fixture do backend
// (tests/fixtures/categoryTree.js) onde faz sentido, mais os nos que o
// aceite deste bloco exige explicitamente (Infantil > Botas, Chinelos).
//
// useCategories e mockado por inteiro (normalize/MAX_DEPTH/canHaveChildren
// permanecem reais via requireActual) para nao depender de QueryClient,
// auth store ou rede no teste de componente -- so este arquivo de teste
// existe no bloco (briefing sec.3), entao a busca/normalizacao e
// exercitada aqui mesmo, contra a implementacao real de `normalize`.
// ============================================================
import TestRenderer, { act } from "react-test-renderer";
import React from "react";

jest.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  TextInput: "TextInput", StyleSheet: { create: (s: any) => s }, Platform: { OS: "web" },
}));

jest.mock("@/constants/colors", () => ({
  useColors: () => ({
    bg: "#060816", bg2: "#090c1a", bg3: "#0e1228", bg4: "#141830",
    ink: "#f0edff", ink2: "#ccc", ink3: "#aaa",
    border: "#222", border2: "#333",
    violet: "#7c3aed", violet2: "#8b5cf6", violet3: "#a78bfa", violet4: "#c4b5fd",
    green: "#34d399", red: "#f87171", amber: "#fbbf24",
  }),
}));

jest.mock("@/hooks/useCategories", () => {
  const actual = jest.requireActual("@/hooks/useCategories");
  return { ...actual, useCategories: jest.fn() };
});

import { CategoryTreePicker, type CategorySelection } from "@/components/catalog/CategoryTreePicker";
import { useCategories, normalize, canHaveChildren, type Category } from "@/hooks/useCategories";

const mockedUseCategories = useCategories as jest.Mock;

// ── Mock de arvore (Category[]) ─────────────────────────────────────────
function leaf(id: string, name: string, parentPath: string, sort: number, count: number): Category {
  const slug = normalize(name).replace(/\s+/g, "-");
  return {
    id, company_id: "company-1", type: "product", parent_id: null, name, slug,
    path: parentPath + "/" + slug, depth: 2, sort_order: sort, color: null,
    image_url: null, banner_url: null, is_visible_storefront: true,
    seo_title: null, seo_description: null, product_count: count, product_count_total: count,
  };
}

const botasFem = leaf("cat-fem-cal-botas", "Botas", "/feminino/calcados", 1, 12);
const sandalias = leaf("cat-fem-cal-sandalias", "Sandálias", "/feminino/calcados", 2, 8);
const tenisFem = leaf("cat-fem-cal-tenis", "Tênis", "/feminino/calcados", 3, 5);
const tenisMasc = leaf("cat-masc-cal-tenis", "Tênis", "/masculino/calcados", 1, 7);
const chinelosMasc = leaf("cat-masc-cal-chinelos", "Chinelos", "/masculino/calcados", 2, 3);
const botasInf = leaf("cat-inf-botas", "Botas", "/infantil", 1, 4);
const chinelosInf = leaf("cat-inf-chinelos", "Chinelos", "/infantil", 2, 2);

const calcadosFem: Category = {
  id: "cat-fem-calcados", company_id: "company-1", type: "product", parent_id: "cat-feminino",
  name: "Calçados", slug: "calcados", path: "/feminino/calcados", depth: 1, sort_order: 1,
  color: null, image_url: null, banner_url: null, is_visible_storefront: true,
  seo_title: null, seo_description: null, product_count: 0, product_count_total: 25,
  children: [botasFem, sandalias, tenisFem],
};
const calcadosMasc: Category = {
  id: "cat-masc-calcados", company_id: "company-1", type: "product", parent_id: "cat-masculino",
  name: "Calçados", slug: "calcados", path: "/masculino/calcados", depth: 1, sort_order: 1,
  color: null, image_url: null, banner_url: null, is_visible_storefront: true,
  seo_title: null, seo_description: null, product_count: 0, product_count_total: 10,
  children: [tenisMasc, chinelosMasc],
};

const feminino: Category = {
  id: "cat-feminino", company_id: "company-1", type: "product", parent_id: null,
  name: "Feminino", slug: "feminino", path: "/feminino", depth: 0, sort_order: 1,
  color: "#7c3aed", image_url: null, banner_url: null, is_visible_storefront: true,
  seo_title: null, seo_description: null, product_count: 0, product_count_total: 25,
  children: [calcadosFem],
};
const masculino: Category = {
  id: "cat-masculino", company_id: "company-1", type: "product", parent_id: null,
  name: "Masculino", slug: "masculino", path: "/masculino", depth: 0, sort_order: 2,
  color: "#2563eb", image_url: null, banner_url: null, is_visible_storefront: true,
  seo_title: null, seo_description: null, product_count: 0, product_count_total: 10,
  children: [calcadosMasc],
};
const infantil: Category = {
  id: "cat-infantil", company_id: "company-1", type: "product", parent_id: null,
  name: "Infantil", slug: "infantil", path: "/infantil", depth: 0, sort_order: 3,
  color: "#f59e0b", image_url: null, banner_url: null, is_visible_storefront: true,
  seo_title: null, seo_description: null, product_count: 0, product_count_total: 6,
  children: [botasInf, chinelosInf],
};

const MOCK_TREE: Category[] = [feminino, masculino, infantil];

// Flatten local ao teste (nao importa internals do hook) -- usa a mesma
// `normalize` real exportada por hooks/useCategories.ts.
type FlatCat = { category: Category; breadcrumb: Category[] };
function flatten(nodes: Category[], ancestors: Category[] = []): FlatCat[] {
  let out: FlatCat[] = [];
  for (const n of nodes) {
    const breadcrumb = [...ancestors, n];
    out.push({ category: n, breadcrumb });
    if (n.children) out = out.concat(flatten(n.children, breadcrumb));
  }
  return out;
}
const FLATTENED = flatten(MOCK_TREE);
const BY_ID: Record<string, Category> = {};
FLATTENED.forEach((f) => { BY_ID[f.category.id] = f.category; });

function makeHook(overrides: Partial<ReturnType<typeof useCategories>> = {}) {
  return {
    tree: MOCK_TREE,
    byId: BY_ID,
    search: (q: string) => {
      const nq = normalize(q);
      if (!nq) return [];
      return FLATTENED.filter((f) => normalize(f.category.name).includes(nq));
    },
    create: jest.fn().mockResolvedValue({ ...leaf("cat-new", "Roupas", "", 1, 0), depth: 0 as any }),
    isCreating: false,
    assignProductCategories: jest.fn(),
    isAssigning: false,
    isLoading: false,
    flatCategories: [], flattened: FLATTENED, refetch: jest.fn(),
    ...overrides,
  };
}

function renderPicker(value: CategorySelection, onChange = jest.fn(), productId?: string) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<CategoryTreePicker value={value} onChange={onChange} productId={productId} />);
  });
  return { renderer, onChange };
}

function allTexts(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root.findAllByType("Text" as any).map((n) => {
    const c = n.props.children;
    return Array.isArray(c) ? c.join("") : String(c ?? "");
  });
}

const EMPTY: CategorySelection = { primaryCategoryId: null, alsoInIds: [] };

describe("CategoryTreePicker", () => {
  beforeEach(() => { mockedUseCategories.mockReturnValue(makeHook()); });

  it("busca 'bota' acha Feminino > Calcados > Botas e Infantil > Botas", () => {
    const { renderer } = renderPicker(EMPTY);
    const input = renderer.root.findByType("TextInput" as any);
    act(() => { input.props.onChangeText("bota"); });
    const texts = allTexts(renderer);
    expect(texts).toContain("Feminino");
    expect(texts).toContain("Infantil");
    expect(texts.filter((t) => t === "Botas").length).toBe(2);
  });

  it("busca e insensivel a acento e caixa ('sandalia' acha 'Sandálias')", () => {
    const { renderer } = renderPicker(EMPTY);
    const input = renderer.root.findByType("TextInput" as any);
    act(() => { input.props.onChangeText("sandalia"); });
    expect(allTexts(renderer)).toContain("Sandálias");
  });

  it("campo vazio faz drill-down com contadores no nivel raiz", () => {
    const { renderer } = renderPicker(EMPTY);
    const texts = allTexts(renderer);
    expect(texts).toContain("Feminino");
    expect(texts).toContain("Masculino");
    expect(texts).toContain("Infantil");
    expect(texts.some((t) => t.includes("25"))).toBe(true);
  });

  it("selecionar uma categoria define a primaria", () => {
    const { renderer, onChange } = renderPicker(EMPTY);
    const row = renderer.root.findByProps({ accessibilityLabel: "Selecionar Feminino" });
    act(() => { row.props.onPress(); });
    expect(onChange).toHaveBeenCalledWith({ primaryCategoryId: "cat-feminino", alsoInIds: [] });
  });

  it("adiciona categoria como also_in sem trocar a primaria", () => {
    const value: CategorySelection = { primaryCategoryId: "cat-feminino", alsoInIds: [] };
    const { renderer, onChange } = renderPicker(value);
    const also = renderer.root.findByProps({ accessibilityLabel: "Tambem em Masculino" });
    act(() => { also.props.onPress(); });
    expect(onChange).toHaveBeenCalledWith({ primaryCategoryId: "cat-feminino", alsoInIds: ["cat-masculino"] });
  });

  it("remove chip de also_in pelo x", () => {
    const value: CategorySelection = { primaryCategoryId: "cat-feminino", alsoInIds: ["cat-masculino"] };
    const { renderer, onChange } = renderPicker(value);
    const remove = renderer.root.findByProps({ accessibilityLabel: "Remover Masculino" });
    act(() => { remove.props.onPress(); });
    expect(onChange).toHaveBeenCalledWith({ primaryCategoryId: "cat-feminino", alsoInIds: [] });
  });

  it("estado vazio mostra CTA e o fluxo de criacao funciona", async () => {
    const hook = makeHook({ tree: [] });
    mockedUseCategories.mockReturnValue(hook);
    const { renderer, onChange } = renderPicker(EMPTY);
    expect(allTexts(renderer)).toContain("Nenhuma categoria ainda");
    const cta = renderer.root.findByProps({ children: "Criar primeira categoria" });
    act(() => { (cta.parent as any).props.onPress(); });
    const input = renderer.root.findByProps({ placeholder: "Nome da categoria" });
    act(() => { input.props.onChangeText("Roupas"); });
    const submit = renderer.root.findByProps({ children: "Criar" });
    await act(async () => { await (submit.parent as any).props.onPress(); });
    expect(hook.create).toHaveBeenCalledWith({ name: "Roupas", parent_id: null });
    expect(onChange).toHaveBeenCalled();
  });

  it("no de depth=2 nao oferece drill-down (bloqueio de 4o nivel antes da chamada)", () => {
    const { renderer } = renderPicker(EMPTY);
    act(() => { renderer.root.findByProps({ accessibilityLabel: "Entrar em Feminino" }).props.onPress(); });
    act(() => { renderer.root.findByProps({ accessibilityLabel: "Entrar em Calçados" }).props.onPress(); });
    // Calcados (depth 1) permite criar subcategoria...
    expect(renderer.root.findAllByProps({ accessibilityLabel: "Criar subcategoria" }).length).toBe(1);
    // ...mas seus filhos (depth 2: Botas/Sandalias/Tenis) nao oferecem "Entrar".
    expect(renderer.root.findAllByProps({ accessibilityLabel: "Entrar em Botas" }).length).toBe(0);
  });

  it("canHaveChildren bloqueia depth=2 e libera depth<2", () => {
    expect(canHaveChildren({ depth: 2 })).toBe(false);
    expect(canHaveChildren({ depth: 1 })).toBe(true);
    expect(canHaveChildren({ depth: 0 })).toBe(true);
    expect(canHaveChildren(null)).toBe(true);
  });
});
