// ============================================================
// INC-2026-11-18-01 — Estoque consolidado "Somado" com mais de 500 grupos.
//
// O agregado cortava em 500 (Aura-backend#1085 tira o corte). Com a lista
// inteira, a tela:
//   1. pagina de 20 em 20 (não desenha 1.500 linhas de uma vez) e o total
//      é o de todos os grupos;
//   2. o filtro "Loja" vê as duas lojas e filtra a lista INTEIRA (inclusive
//      o que estaria depois do 500º item).
// No main não há paginação nem filtro: os testes falham.
// ============================================================
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockAggregated = jest.fn();
jest.mock("@/services/productLinks", () => {
  const actual = jest.requireActual("@/services/productLinks");
  return { ...actual, productLinksApi: { ...actual.productLinksApi, aggregated: (...a: any[]) => mockAggregated(...a) } };
});
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => {
  const r = { push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => true, navigate: mockPush, setParams: jest.fn() };
  return {
    router: r,
    useRouter: () => r,
    useLocalSearchParams: () => ({}),
    useNavigation: () => ({ getState: () => ({ index: 0, routes: [] }) }),
    useSegments: () => ["(tabs)", "estoque"],
    usePathname: () => "/estoque",
    useFocusEffect: () => {},
    Link: "Link",
  };
});

// WebPortal: passa-adiante (o portal no document.body não aparece no
// renderer). O `active` continua decidindo se monta.
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ active, children }: any) => (active ? children : null),
}));

// ── Hooks de dados ─────────────────────────────────────────────
const mockProdutoBase = {
  id: "p1", name: "Bota Cano Curto", price: 100, cost: 50, stock: 3, minStock: 1,
  category: "Calçados", unit: "un", barcode: "", sku: "", code: "", created_at: "2026-11-01T10:00:00Z",
};
jest.mock("@/hooks/useProducts", () => ({
  useProducts: () => ({
    products: [mockProduto()], categories: ["Calçados"], isLoading: false, isDemo: false,
    deleteProduct: jest.fn(), bulkDeleteProducts: jest.fn(), mergeSuggestion: null,
    clearMergeSuggestion: jest.fn(), updateProduct: jest.fn(),
  }),
}));
function mockProduto() { return mockProdutoBase; }

const mockFeminino = {
  id: "cat-feminino", company_id: "c1", type: "product", parent_id: null, name: "Feminino",
  slug: "feminino", path: "/feminino", depth: 0, sort_order: 0, banner_url: null,
  product_count: 0, product_count_total: 4, children: [],
};
const mockMasculino = { ...mockFeminino, id: "cat-masculino", name: "Masculino", slug: "masculino", path: "/masculino" };
const mockCreate = jest.fn().mockResolvedValue(undefined);
const mockRename = jest.fn().mockResolvedValue(undefined);
const mockMove = jest.fn().mockResolvedValue(undefined);
const mockRemove = jest.fn().mockResolvedValue(null);
jest.mock("@/hooks/useCategories", () => {
  const actual = jest.requireActual("@/hooks/useCategories");
  return {
    ...actual,
    useCategories: () => ({
      tree: [mockFeminino, mockMasculino], flattened: [mockFeminino, mockMasculino].map((category) => ({ category, breadcrumb: [] })), isLoading: false,
      create: mockCreate, isCreating: false, refetch: jest.fn(),
    }),
  };
});
jest.mock("@/hooks/useCategoryTree", () => ({
  useCategoryTree: () => ({
    rename: mockRename, isRenaming: false, remove: mockRemove, isRemoving: false,
    move: mockMove, isMoving: false, merge: jest.fn(), reorder: jest.fn(), cloneFrom: jest.fn(),
  }),
}));
jest.mock("@/hooks/useBannerDeCategoria", () => ({
  useBannerDeCategoria: () => ({ escolherEEnviar: jest.fn(), remover: { mutateAsync: jest.fn() }, enviando: false }),
}));
jest.mock("@/hooks/useProductCategories", () => ({ useProductCategories: () => ({ categoryNames: ["Calçados"], categories: [], refetch: jest.fn() }) }));
jest.mock("@/hooks/useEstoqueConsulta", () => ({ useEstoqueConsulta: () => ({ consulta: false, carregando: false, semCusto: false }) }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {} }) }));
jest.mock("@/hooks/useVisibleModules", () => {
  const actual = jest.requireActual("@/hooks/useVisibleModules");
  return { ...actual, useVisibleModules: () => new Set(["estoque", "configuracoes"]) };
});
jest.mock("@/hooks/useImportProdutos", () => ({
  useImportProdutos: () => ({ aberto: false, ocupado: false, escolherArquivo: jest.fn(), fase: "fechado", fechar: jest.fn() }),
}));
jest.mock("@/hooks/useReajusteDisponivel", () => ({ useReajusteDisponivel: () => false }));
jest.mock("@/hooks/useUltimosReajustes", () => ({ useUltimosReajustes: () => false, ultimosReajustesQueryKey: (id: string) => ["ultimos", id] }));
jest.mock("@/hooks/useEmiteNfse", () => ({ useEmiteNfse: () => false }));
jest.mock("@/components/screens/estoque/useEstoquePremiumStyles", () => ({ useEstoquePremiumStyles: () => {} }));

// ── Componentes pesados da tela: stubs ─────────────────────────
jest.mock("@/components/screens/estoque/ImportPlanilhaModal", () => ({ ImportPlanilhaModal: () => null }));

jest.mock("@/components/screens/estoque/ItemFormModal", () => ({ ItemFormModal: () => null }));
jest.mock("@/components/screens/estoque/ProductRow", () => ({ ProductRow: () => null }));
jest.mock("@/components/screens/estoque/AlertsList", () => ({ AlertsList: () => null }));
jest.mock("@/components/PrintLabels", () => ({ PrintLabels: () => null }));
jest.mock("@/components/MergeDuplicatesModal", () => ({ MergeDuplicatesModal: () => null }));
jest.mock("@/components/QuickBatchProductsModal", () => ({ QuickBatchProductsModal: () => null }));
jest.mock("@/components/screens/estoque/DanfeImportModal", () => ({ DanfeImportModal: () => null }));
jest.mock("@/components/LinkProductModal", () => ({ LinkProductModal: () => null }));
jest.mock("@/components/screens/estoque/ConvitePlanilha", () => ({ ConvitePlanilha: () => null }));
jest.mock("@/components/screens/estoque/EstoqueKpiStrip", () => ({ EstoqueKpiStrip: () => null }));
jest.mock("@/components/screens/estoque/CategoryDropdownWeb", () => ({ CategoryDropdownWeb: () => null }));
jest.mock("@/components/screens/estoque/ProductTableWeb", () => ({ ProductTableWeb: () => null }));
jest.mock("@/components/screens/estoque/ProductGridWeb", () => ({ ProductGridWeb: () => null }));
jest.mock("@/components/screens/estoque/EntradaMercadoriaModal", () => ({ EntradaMercadoriaModal: () => null }));
jest.mock("@/components/screens/estoque/DefinirFornecedorModal", () => ({ DefinirFornecedorModal: () => null }));
jest.mock("@/components/screens/estoque/reajuste/AjustarPrecoModal", () => ({ AjustarPrecoModal: () => null }));
jest.mock("@/components/screens/estoque/reajuste/UltimosReajustesModal", () => ({ UltimosReajustesModal: () => null }));
jest.mock("@/components/screens/estoque/transferencia/TransferirModal", () => ({ TransferirModal: () => null }));
jest.mock("@/components/screens/estoque/transferencia/TransferenciasModal", () => ({ TransferenciasModal: () => null }));
jest.mock("@/components/screens/estoque/transferencia/EstoquePorLoja", () => ({ EstoquePorLoja: () => null }));
jest.mock("@/components/screens/estoque/transferencia/BotaoTransferir", () => ({ BotaoTransferir: () => null }));
jest.mock("@/components/ImportExportBar", () => ({ ImportExportBar: () => null }));
jest.mock("@/components/OlhoValores", () => ({ OlhoValores: () => null }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EstoqueScreen from "@/app/(tabs)/estoque";
import { useAuthStore } from "@/stores/auth";
import { Pagination } from "@/components/Pagination";

const MATRIZ = "loja-matriz";
const FILIAL = "loja-filial";
function grupo(i: number, cid: string, nome: string) {
  const id = "p" + String(i).padStart(4, "0");
  return {
    group_key: "solo:" + id, master_sku: null, is_linked: false, name: "Produto " + String(i).padStart(4, "0"),
    barcode: null, sku: null, avg_price: 10, avg_cost: 5, total_stock: 1, image_url: null, category: null, unit: "un",
    company_count: 1, product_count: 1,
    items: [{ product_id: id, company_id: cid, company_name: nome, stock_qty: 1, price: 10 }],
  };
}
// 600 grupos: os 520 primeiros da matriz, os 80 últimos da filial (todos
// depois do 500º, que o corte antigo escondia).
const GRUPOS = Array.from({ length: 600 }, (_, i) => (i < 520 ? grupo(i, MATRIZ, "Matriz") : grupo(i, FILIAL, "Filial")));

const porTestID = (r: TestRenderer.ReactTestRenderer, id: string) => r.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
const linhas = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n: any) => n.props && typeof n.props.testID === "string" && n.props.testID.indexOf("estoque-consolidado-item-") === 0, { deep: false });
const paginacao = (r: TestRenderer.ReactTestRenderer) => r.root.findAllByType(Pagination as any)[0].props;

async function montar() {
  (useAuthStore as any).setState({
    token: "t", isDemo: false,
    user: { id: "u1", email: "dona@loja.com", email_verified: true },
    company: null,
    availableCompanies: [{ id: MATRIZ, name: "Matriz" }, { id: FILIAL, name: "Filial" }],
    consolidatedView: true,
    refreshMe: jest.fn().mockResolvedValue(undefined),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<QueryClientProvider client={qc}><EstoqueScreen /></QueryClientProvider>);
  });
  // Espera a lista chegar (a consulta resolve fora do primeiro render).
  for (let i = 0; i < 20 && linhas(r).length === 0; i++) {
    await act(async () => { await new Promise((ok) => setTimeout(ok, 0)); });
  }
  return r;
}

beforeEach(() => {
  window.localStorage.clear();
  mockAggregated.mockReset();
  mockAggregated.mockResolvedValue({ products: GRUPOS, total: GRUPOS.length, searched_companies: 2 });
});

test("lista inteira paginada de 20 em 20, total de todos os grupos", async () => {
  const r = await montar();
  expect(linhas(r)).toHaveLength(20);
  expect(paginacao(r).total).toBe(600);
  expect(paginacao(r).totalPages).toBe(30);
  act(() => { r.unmount(); });
});

test("filtro Loja vê as duas lojas e acha os da filial depois do 500º", async () => {
  const r = await montar();
  expect(porTestID(r, "estoque-consolidado-filtro-loja")).toHaveLength(1);
  act(() => { porTestID(r, "estoque-consolidado-loja-" + FILIAL)[0].props.onPress(); });
  expect(paginacao(r).total).toBe(80);
  expect(linhas(r)[0].props.testID).toBe("estoque-consolidado-item-solo:p0520");
  act(() => { r.unmount(); });
});
