// ============================================================
// E1 + E2 (17/11/2026): a barra do Estoque e o "Cadastrar vários".
// Mockup aprovado: estoque-portas-mockup-17-11.html, partes 1 a 3.
//
// Renderiza a tela do Estoque de verdade (o resto vira stub) e prova:
//   1. a barra perdeu "+ Serviço" e "+ Em lote" (8 → 6 botões): ficam o
//      olho, Importar, Selecionar, Conferir estoque, Entrada de mercadoria
//      e "+ Produto", que segue sendo o alvo do tour estoque.novo_produto;
//   2. "+ Produto" abre o cadastro de produto com as ações do "Cadastrar
//      vários"; a planilha usa o seletor de hoje e a lista abre o lote com
//      "← Voltar", que reabre o cadastro já na escolha;
//   3. o cartão "Adicionar em lote" da loja vazia abre o lote sem "Voltar";
//   4. no consolidado não há barra nem cadastro (como antes).
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
const mockEstado = { semProdutos: false };
jest.mock("@/hooks/useProducts", () => ({
  useProducts: () => ({
    products: mockEstado.semProdutos ? [] : [mockProduto()], categories: ["Calçados"], isLoading: false, isDemo: false,
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
const mockEscolherArquivo = jest.fn();
const mockImport = { aberto: false };
jest.mock("@/hooks/useImportProdutos", () => ({
  useImportProdutos: () => ({
    aberto: mockImport.aberto, ocupado: false, escolherArquivo: mockEscolherArquivo,
    fase: mockImport.aberto ? "lendo" : "fechado", fechar: jest.fn(),
  }),
}));
jest.mock("@/hooks/useReajusteDisponivel", () => ({ useReajusteDisponivel: () => false }));
jest.mock("@/hooks/useUltimosReajustes", () => ({ useUltimosReajustes: () => false, ultimosReajustesQueryKey: (id: string) => ["ultimos", id] }));
jest.mock("@/hooks/useEmiteNfse", () => ({ useEmiteNfse: () => false }));
jest.mock("@/components/screens/estoque/useEstoquePremiumStyles", () => ({ useEstoquePremiumStyles: () => {} }));

// ── Componentes pesados da tela: stubs ─────────────────────────
jest.mock("@/components/screens/estoque/ImportPlanilhaModal", () => ({ ImportPlanilhaModal: () => null }));
// Marcadores que guardam as props recebidas (a barra e os modais do E1/E2).
jest.mock("@/components/screens/estoque/ImportarMenu", () => {
  const { View } = jest.requireActual("react-native");
  return {
    ImportarMenu: (props: any) => <View testID="stub-importar-menu" {...{ dados: props }} />,
    OPCOES_IMPORTAR: { nota: { texto: "" }, planilha: { texto: "" } },
  };
});
jest.mock("@/components/screens/estoque/ItemFormModal", () => {
  const { View } = jest.requireActual("react-native");
  return { ItemFormModal: (props: any) => <View testID="stub-item-form" {...{ dados: props }} /> };
});
jest.mock("@/components/screens/estoque/ProductRow", () => ({ ProductRow: () => null }));
jest.mock("@/components/screens/estoque/AlertsList", () => ({ AlertsList: () => null }));
jest.mock("@/components/PrintLabels", () => ({ PrintLabels: () => null }));
jest.mock("@/components/MergeDuplicatesModal", () => ({ MergeDuplicatesModal: () => null }));
jest.mock("@/components/QuickBatchProductsModal", () => {
  const { View } = jest.requireActual("react-native");
  return { QuickBatchProductsModal: (props: any) => <View testID="stub-lista" {...{ dados: props }} /> };
});
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
function textoDaTela(r: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(r.toJSON());
}
function textoDe(n: any): string {
  const partes: string[] = [];
  const andar = (x: any) => {
    if (x == null || typeof x === "boolean") return;
    if (typeof x === "string" || typeof x === "number") { partes.push(String(x)); return; }
    if (Array.isArray(x)) { x.forEach(andar); return; }
    if (x.props) andar(x.props.children);
  };
  andar(n.props.children);
  return partes.join("");
}
const form = (r: TestRenderer.ReactTestRenderer) => porTestID(r, "stub-item-form")[0].props.dados;
const lista = (r: TestRenderer.ReactTestRenderer) => porTestID(r, "stub-lista")[0].props.dados;

const montados: TestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  while (montados.length) { const m = montados.pop()!; act(() => { m.unmount(); }); }
});

let qc: QueryClient;
function tela() {
  return <QueryClientProvider client={qc}><EstoqueScreen /></QueryClientProvider>;
}
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
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(tela()); });
  montados.push(r);
  return r;
}
function abrirProduto(r: TestRenderer.ReactTestRenderer) {
  act(() => { porTestID(r, "estoque-novo-produto")[0].props.onPress(); });
}

const larguraOriginal = window.innerWidth;
function largura(px: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: px });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEstado.semProdutos = false;
  mockImport.aberto = false;
  largura(1280);
});
afterAll(() => { largura(larguraOriginal); });

describe("E1: a barra do Estoque", () => {
  test("sem \"+ Serviço\" e sem \"+ Em lote\"; Importar, Entrada e \"+ Produto\" ficam", () => {
    const r = montar();
    const t = textoDaTela(r);
    expect(t).not.toContain("+ Serviço");
    expect(t).not.toContain("+ Em lote");
    expect(t).toContain("+ Produto");
    expect(t).toContain("Entrada de mercadoria");
    expect(t).toContain("Selecionar");
    expect(porTestID(r, "stub-importar-menu")).toHaveLength(1);
    expect(porTestID(r, "estoque-entrada-topo")).toHaveLength(1);
    expect(porTestID(r, "estoque-novo-produto")).toHaveLength(1);
  });

  test("o tour estoque.novo_produto continua no \"+ Produto\"", () => {
    const r = montar();
    const alvos = r.root.findAll(
      (n: any) => n.props && n.props.dataSet && n.props.dataSet.tour === "estoque.novo_produto",
      { deep: false },
    );
    expect(alvos).toHaveLength(1);
    expect(alvos[0].props.testID).toBe("estoque-novo-produto");
  });

  test("em 375 px também não há os dois botões", () => {
    largura(375);
    const r = montar();
    const t = textoDaTela(r);
    expect(t).not.toContain("+ Serviço");
    expect(t).not.toContain("+ Em lote");
    expect(porTestID(r, "estoque-novo-produto").length).toBeGreaterThan(0);
  });

  test("\"+ Produto\" abre o cadastro de produto com as ações do Cadastrar vários", () => {
    const r = montar();
    expect(form(r).visible).toBe(false);
    abrirProduto(r);
    const f = form(r);
    expect(f.visible).toBe(true);
    expect(f.initialType).toBe("product");
    expect(f.editProduct).toBeNull();
    expect(typeof f.cadastrarVarios.onPlanilha).toBe("function");
    expect(typeof f.cadastrarVarios.onLista).toBe("function");
    expect(f.cadastrarVarios.abrirNaEscolha).toBe(false);
  });
});

describe("E2: as origens do Cadastrar vários", () => {
  test("Planilha usa o seletor de arquivo de hoje; o cadastro só fecha quando a importação abre", () => {
    const r = montar();
    abrirProduto(r);
    act(() => { form(r).cadastrarVarios.onPlanilha(); });
    expect(mockEscolherArquivo).toHaveBeenCalledTimes(1);
    // Seletor cancelado: nada abriu, o cadastro segue aberto na escolha.
    expect(form(r).visible).toBe(true);
    // Arquivo escolhido: a importação abre e o cadastro sai da frente.
    mockImport.aberto = true;
    act(() => { r.update(tela()); });
    expect(form(r).visible).toBe(false);
  });

  test("a importação aberta pelo menu da barra não mexe no cadastro", () => {
    const r = montar();
    abrirProduto(r);
    mockImport.aberto = true;
    act(() => { r.update(tela()); });
    // O cadastro estava aberto sem ter pedido a planilha: continua aberto.
    expect(form(r).visible).toBe(true);
  });

  test("Digitar ou colar uma lista: fecha o cadastro e abre o lote com Voltar; Voltar reabre na escolha", () => {
    const r = montar();
    abrirProduto(r);
    act(() => { form(r).cadastrarVarios.onLista(); });
    expect(form(r).visible).toBe(false);
    expect(lista(r).visible).toBe(true);
    expect(typeof lista(r).onVoltar).toBe("function");

    act(() => { lista(r).onVoltar(); });
    expect(lista(r).visible).toBe(false);
    const f = form(r);
    expect(f.visible).toBe(true);
    expect(f.initialType).toBe("product");
    expect(f.editProduct).toBeNull();
    expect(f.cadastrarVarios.abrirNaEscolha).toBe(true);
  });

  test("fechar o lote pelo X volta ao Estoque; o próximo \"+ Produto\" abre no formulário", () => {
    const r = montar();
    abrirProduto(r);
    act(() => { form(r).cadastrarVarios.onLista(); });
    act(() => { lista(r).onClose(); });
    expect(lista(r).visible).toBe(false);
    expect(form(r).visible).toBe(false);
    expect(lista(r).onVoltar).toBeUndefined();
    abrirProduto(r);
    expect(form(r).cadastrarVarios.abrirNaEscolha).toBe(false);
  });

  test("loja vazia: o cartão Adicionar em lote abre o lote sem Voltar", () => {
    mockEstado.semProdutos = true;
    const r = montar();
    expect(textoDaTela(r)).toContain("Adicionar em lote");
    // O cartão "Adicionar em lote" é o primeiro "Abrir" da loja vazia.
    const botoes = r.root.findAll(
      (n: any) => n.props && typeof n.props.onPress === "function" && textoDe(n) === "Abrir",
      { deep: false },
    );
    expect(botoes.length).toBeGreaterThan(0);
    act(() => { botoes[0].props.onPress(); });
    expect(lista(r).visible).toBe(true);
    expect(lista(r).onVoltar).toBeUndefined();
  });

  test("no consolidado não há barra nem cadastro (como antes)", () => {
    const r = montar({ consolidado: true });
    expect(porTestID(r, "estoque-novo-produto")).toHaveLength(0);
    expect(porTestID(r, "stub-item-form")).toHaveLength(0);
    expect(porTestID(r, "stub-importar-menu")).toHaveLength(0);
  });
});
