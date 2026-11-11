// ============================================================
// Estoque → "Organizar categorias" abre um MODAL (10/11/2026).
//
// Antes o botão fazia router.push("/catalogo/organizar"): página fora do
// shell, com outro desenho, e o "Voltar" levava ao Painel. Estes testes
// renderizam a tela do Estoque de verdade (o resto dela vira stub) e
// provam:
//   1. o botão abre o modal e não navega (larguras de desktop e 375 px);
//   2. fechar (X, "Fechar", fundo) some com o modal, segue no Estoque,
//      sem navegar, e recarrega o que o filtro usa;
//   3. as ações de categoria dentro do modal chamam a mesma API de antes
//      (useCategories.create, useCategoryTree.rename/move/remove);
//   4. no consolidado o botão não aparece (comportamento de antes).
// ============================================================
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

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
jest.mock("@/components/screens/estoque/ImportarMenu", () => ({
  ImportarMenu: () => null,
  OPCOES_IMPORTAR: { nota: { texto: "" }, planilha: { texto: "" } },
}));
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

function porTestID(r: TestRenderer.ReactTestRenderer, id: string) {
  return r.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}

let qc: QueryClient;
let invalidadas: any[][] = [];

const montados: TestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  while (montados.length) { const m = montados.pop()!; act(() => { m.unmount(); }); }
});

function montar(opts: { consolidado?: boolean } = {}) {
  (useAuthStore as any).setState({
    token: "t", isDemo: false,
    user: { id: "u1", email: "dona@loja.com", email_verified: true },
    company: { id: "c1", name: "Loja", plan: "negocio", module_overrides: null },
    availableCompanies: [{ id: "c1", name: "Loja" }],
    consolidatedView: !!opts.consolidado,
    refreshMe: jest.fn().mockResolvedValue(undefined),
  });
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  invalidadas = [];
  const orig = qc.invalidateQueries.bind(qc);
  (qc as any).invalidateQueries = (f: any) => { invalidadas.push(f?.queryKey); return orig(f); };
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <QueryClientProvider client={qc}><EstoqueScreen /></QueryClientProvider>
    );
  });
  montados.push(r);
  return r;
}

function abrir(r: TestRenderer.ReactTestRenderer) {
  const botao = porTestID(r, "estoque-organizar-categorias");
  expect(botao).toHaveLength(1);
  act(() => { botao[0].props.onPress(); });
}

const larguraOriginal = window.innerWidth;
function largura(px: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: px });
}

beforeEach(() => {
  jest.clearAllMocks();
  largura(1280);
});
afterAll(() => { largura(larguraOriginal); });

describe("Estoque: Organizar categorias vira modal", () => {
  test("o botão abre o modal e não navega (desktop)", () => {
    const r = montar();
    expect(porTestID(r, "organizar-categorias-modal")).toHaveLength(0);
    abrir(r);
    expect(porTestID(r, "organizar-categorias-modal")).toHaveLength(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    // Cabeçalho do modal: título e botão de fechar.
    expect(porTestID(r, "organizar-categorias-x")).toHaveLength(1);
    // A árvore está lá dentro.
    expect(porTestID(r, "organizar-no-cat-feminino")).toHaveLength(1);
  });

  test("em 375 px o botão também abre o modal", () => {
    largura(375);
    const r = montar();
    abrir(r);
    expect(porTestID(r, "organizar-categorias-modal")).toHaveLength(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  test.each([
    ["X do cabeçalho", "organizar-categorias-x"],
    ["botão Fechar", "organizar-categorias-fechar"],
    ["toque no fundo", "organizar-categorias-fundo"],
  ])("fechar pelo %s mantém no Estoque e recarrega o filtro", (_nome, testID) => {
    const r = montar();
    abrir(r);
    act(() => { porTestID(r, testID)[0].props.onPress(); });
    expect(porTestID(r, "organizar-categorias-modal")).toHaveLength(0);
    // Continua na tela do Estoque, com o botão de volta à vista.
    expect(porTestID(r, "estoque-organizar-categorias")).toHaveLength(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    // Chips e dropdown leem ["product-categories"]: recarregam ao fechar.
    expect(invalidadas).toEqual(expect.arrayContaining([
      ["product-categories", "c1"], ["categories", "c1"], ["products", "c1"],
    ]));
  });

  test("no consolidado o botão não aparece (como antes)", () => {
    const r = montar({ consolidado: true });
    expect(porTestID(r, "estoque-organizar-categorias")).toHaveLength(0);
    expect(porTestID(r, "organizar-categorias-modal")).toHaveLength(0);
  });
});

describe("Dentro do modal: as mesmas chamadas de antes", () => {
  test("criar categoria principal chama useCategories.create", async () => {
    const r = montar();
    abrir(r);
    act(() => { porTestID(r, "organizar-nova-raiz")[0].props.onPress(); });
    act(() => { porTestID(r, "organizar-criar-nome")[0].props.onChangeText("Infantil"); });
    await act(async () => { await porTestID(r, "organizar-criar-confirmar")[0].props.onPress(); });
    expect(mockCreate).toHaveBeenCalledWith({ name: "Infantil" });
  });

  test("criar subcategoria manda o parent_id", async () => {
    const r = montar();
    abrir(r);
    act(() => { porTestID(r, "organizar-sub-cat-feminino")[0].props.onPress(); });
    act(() => { porTestID(r, "organizar-criar-nome")[0].props.onChangeText("Calçados"); });
    await act(async () => { await porTestID(r, "organizar-criar-confirmar")[0].props.onPress(); });
    expect(mockCreate).toHaveBeenCalledWith({ name: "Calçados", parent_id: "cat-feminino" });
  });

  test("renomear chama useCategoryTree.rename", async () => {
    const r = montar();
    abrir(r);
    act(() => { porTestID(r, "organizar-renomear-cat-feminino")[0].props.onPress(); });
    const campo = porTestID(r, "organizar-renomear-campo-cat-feminino")[0];
    act(() => { campo.props.onChangeText("Feminina"); });
    await act(async () => { await porTestID(r, "organizar-renomear-campo-cat-feminino")[0].props.onSubmitEditing(); });
    expect(mockRename).toHaveBeenCalledWith("cat-feminino", "Feminina");
  });

  test("mover para dentro de outra chama useCategoryTree.move", async () => {
    const r = montar();
    abrir(r);
    act(() => { porTestID(r, "organizar-mover-cat-feminino")[0].props.onPress(); });
    await act(async () => { await porTestID(r, "organizar-mover-destino-cat-masculino")[0].props.onPress(); });
    expect(mockMove).toHaveBeenCalledWith("cat-feminino", "cat-masculino");
    // Volta para a árvore, ainda dentro do modal.
    expect(porTestID(r, "organizar-categorias-modal")).toHaveLength(1);
    expect(porTestID(r, "organizar-mover-painel")).toHaveLength(0);
  });

  test("excluir com produtos pergunta o destino e manda move_to", async () => {
    mockRemove
      .mockResolvedValueOnce({ code: "CATEGORY_HAS_PRODUCTS", message: "x", productCount: 4 })
      .mockResolvedValueOnce(null);
    const r = montar();
    abrir(r);
    await act(async () => { await porTestID(r, "organizar-excluir-cat-feminino")[0].props.onPress(); });
    expect(mockRemove).toHaveBeenNthCalledWith(1, "cat-feminino");
    expect(porTestID(r, "organizar-excluir-painel")).toHaveLength(1);
    act(() => { porTestID(r, "organizar-excluir-destino")[0].props.onChangeText("Masculino"); });
    await act(async () => { await porTestID(r, "organizar-excluir-confirmar")[0].props.onPress(); });
    expect(mockRemove).toHaveBeenNthCalledWith(2, "cat-feminino", "Masculino");
  });
});
