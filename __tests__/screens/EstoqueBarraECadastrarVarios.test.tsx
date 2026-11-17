// ============================================================
// E1 + E2 + A8 (17/11/2026): a barra do Estoque, o "Cadastrar vários" e a
// porta do "Chegou mercadoria".
// Mockup aprovado: estoque-portas-mockup-17-11.html, partes 1 a 3 e 6.
//
// Renderiza a tela do Estoque de verdade (o resto vira stub) e prova:
//   1. a barra tem cinco botões: olho, Selecionar, Conferir estoque,
//      "Chegou mercadoria" e "+ Produto" (que segue sendo o alvo do tour
//      estoque.novo_produto). Saíram "+ Serviço", "+ Em lote", o menu
//      "Importar" e o "Entrada de mercadoria";
//   2. "Chegou mercadoria" abre o wizard da loja escolhida, também com a
//      loja vazia;
//   3. no celular (375 px): três ícones com nome para leitor de tela ao lado
//      do título e uma linha com as duas portas escritas;
//   4. a loja vazia tem os três cartões novos;
//   5. demo: só o olho e "+ Produto"; consolidado e só consulta: sem barra;
//   6. "+ Produto" abre o cadastro com as ações do "Cadastrar vários"
//      (planilha, lista com "← Voltar" e o aviso que leva ao wizard).
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
const mockEstado = { semProdutos: false, demo: false, consulta: false };
jest.mock("@/hooks/useProducts", () => ({
  useProducts: () => ({
    products: mockEstado.semProdutos || mockEstado.demo ? [] : [mockProduto()], categories: ["Calçados"], isLoading: false, isDemo: mockEstado.demo,
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
jest.mock("@/hooks/useEstoqueConsulta", () => ({ useEstoqueConsulta: () => ({ consulta: mockEstado.consulta, carregando: false, semCusto: false }) }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {} }) }));
jest.mock("@/hooks/useVisibleModules", () => {
  const actual = jest.requireActual("@/hooks/useVisibleModules");
  return { ...actual, useVisibleModules: () => new Set(["estoque", "configuracoes", "conferencia_estoque"]) };
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
// Marcadores que guardam as props recebidas (os modais do E1/E2/A8).
jest.mock("@/components/screens/estoque/chegou/ChegouMercadoriaModal", () => {
  const { View } = jest.requireActual("react-native");
  return { ChegouMercadoriaModal: (props: any) => <View testID="stub-chegou" {...{ dados: props }} /> };
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
const chegou = (r: TestRenderer.ReactTestRenderer) => porTestID(r, "stub-chegou").map((n: any) => n.props.dados);

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
  mockEstado.demo = false;
  mockEstado.consulta = false;
  mockImport.aberto = false;
  largura(1280);
});
afterAll(() => { largura(larguraOriginal); });

describe("E1: a barra do Estoque", () => {
  test("cinco botões: olho, Selecionar, Conferir, \"Chegou mercadoria\" e \"+ Produto\" na ponta", () => {
    const r = montar();
    const t = textoDaTela(r);
    expect(t).not.toContain("+ Serviço");
    expect(t).not.toContain("+ Em lote");
    expect(t).not.toContain("Importar");
    expect(t).not.toContain("Entrada de mercadoria");
    expect(porTestID(r, "estoque-entrada-topo")).toHaveLength(0);
    expect(t).toContain("Selecionar");
    expect(t).toContain("Conferir estoque");
    expect(t).toContain("Chegou mercadoria");
    expect(t).toContain("+ Produto");
    // Ordem: da ação mais rara para a mais comum, "+ Produto" na ponta.
    const ids = r.root.findAll((n: any) => n.props && typeof n.props.testID === "string" && /^estoque-(selecionar|conferir|chegou-mercadoria|novo-produto)$/.test(n.props.testID), { deep: false })
      .map((n: any) => n.props.testID);
    expect(ids).toEqual(["estoque-selecionar", "estoque-conferir", "estoque-chegou-mercadoria", "estoque-novo-produto"]);
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

  test("em 375 px também não há os botões que saíram", () => {
    largura(375);
    const r = montar();
    const t = textoDaTela(r);
    expect(t).not.toContain("+ Serviço");
    expect(t).not.toContain("+ Em lote");
    expect(t).not.toContain("Importar");
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

describe("A8: \"Chegou mercadoria\" na barra", () => {
  test("abre o wizard da loja escolhida; fechar desmonta (a próxima abertura nasce com chave nova)", () => {
    const r = montar();
    expect(chegou(r)).toHaveLength(0);
    act(() => { porTestID(r, "estoque-chegou-mercadoria")[0].props.onPress(); });
    const w = chegou(r);
    expect(w).toHaveLength(1);
    expect(w[0].visible).toBe(true);
    expect(w[0].companyId).toBe("c1");
    expect(w[0].lojaNome).toBe("Loja");
    expect(w[0].products.map((p: any) => p.id)).toEqual(["p1"]);
    expect(w[0].semCusto).toBe(false);
    expect(w[0].inicio).toBeUndefined();
    act(() => { w[0].onClose(); });
    expect(chegou(r)).toHaveLength(0);
  });

  test("tem nome para leitor de tela e não é alvo de tour", () => {
    const r = montar();
    const b = porTestID(r, "estoque-chegou-mercadoria")[0];
    expect(b.props.accessibilityLabel).toBe("Chegou mercadoria");
    expect(b.props.accessibilityRole).toBe("button");
    expect(b.props.dataSet).toBeUndefined();
  });

  test("\"Ver os produtos novos\" fecha o wizard e volta a lista ao começo", () => {
    const r = montar();
    act(() => { porTestID(r, "estoque-chegou-mercadoria")[0].props.onPress(); });
    act(() => { chegou(r)[0].onVerNovos(["n1", "n2"]); });
    expect(chegou(r)).toHaveLength(0);
  });

  test("o botão \"Entrada\" de cada linha continua com o modal de um produto (pendência 9)", () => {
    // A tela não abre mais a escolha de produto pelo topo: o
    // EntradaMercadoriaModal só recebe o produto da linha.
    const fonte = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "app", "(tabs)", "estoque.tsx"), "utf8");
    expect(fonte).toContain("onEntrada={!isDemo && !consulta && !consolidatedView ? abrirEntrada : undefined}");
    expect(fonte).not.toContain("setEntrada({ produto: null })");
  });
});

describe("A8: barra do celular (375 px)", () => {
  test("três ícones com nome ao lado do título e uma linha com as duas portas escritas", () => {
    largura(375);
    const r = montar();
    const linha = porTestID(r, "estoque-portas-celular");
    expect(linha).toHaveLength(1);
    const naLinha = linha[0].findAll((n: any) => n.props && typeof n.props.testID === "string" && n.props.testID !== "estoque-portas-celular", { deep: false }).map((n: any) => n.props.testID);
    expect(naLinha).toEqual(expect.arrayContaining(["estoque-chegou-mercadoria", "estoque-novo-produto"]));
    expect(textoDe(porTestID(r, "estoque-chegou-mercadoria")[0])).toBe("Chegou mercadoria");
    expect(textoDe(porTestID(r, "estoque-novo-produto")[0])).toBe("Produto");

    // Ícones sem texto, com nome para leitor de tela e alvo de 44 px.
    for (const [id, nome] of [["estoque-selecionar", "Selecionar"], ["estoque-conferir", "Conferir estoque"]]) {
      const b = porTestID(r, id)[0];
      expect(b.props.accessibilityLabel).toBe(nome);
      expect(textoDe(b)).toBe("");
      const estilo = ([] as any[]).concat(b.props.style).flat(Infinity).filter(Boolean);
      expect(estilo.some((st: any) => st.minWidth === 44 && st.minHeight === 44)).toBe(true);
      // fora da linha das portas
      expect(naLinha).not.toContain(id);
    }
  });

  test("o tour estoque.novo_produto continua no \"+ Produto\"", () => {
    largura(375);
    const r = montar();
    const alvos = r.root.findAll(
      (n: any) => n.props && n.props.dataSet && n.props.dataSet.tour === "estoque.novo_produto",
      { deep: false },
    );
    expect(alvos).toHaveLength(1);
    expect(alvos[0].props.testID).toBe("estoque-novo-produto");
  });

  test("Selecionar ligado: o leitor de tela diz \"Sair da seleção\"", () => {
    largura(375);
    const r = montar();
    act(() => { porTestID(r, "estoque-selecionar")[0].props.onPress(); });
    expect(porTestID(r, "estoque-selecionar")[0].props.accessibilityLabel).toBe("Sair da seleção");
  });
});

describe("A8: loja vazia", () => {
  test("barra com olho, \"Chegou mercadoria\" e \"+ Produto\"; os três cartões novos", () => {
    mockEstado.semProdutos = true;
    const r = montar();
    expect(porTestID(r, "estoque-chegou-mercadoria")).toHaveLength(1);
    expect(porTestID(r, "estoque-selecionar")).toHaveLength(0);
    expect(porTestID(r, "estoque-conferir")).toHaveLength(0);
    const t = textoDaTela(r);
    for (const frase of [
      "Sua loja ainda não tem produtos",
      "Comece do jeito que for mais fácil para você. Dá para trocar de ideia depois.",
      "Tenho a nota do fornecedor", "A Aura cadastra os produtos da nota e já dá entrada no estoque, com o custo.",
      "Tenho uma planilha", "Excel ou CSV com os seus produtos. Você confere antes de gravar.",
      "Escolher planilha", "Baixar modelo",
      "Vou cadastrar à mão", "Um de cada vez, ou cole uma lista com vários.", "Colar uma lista",
    ]) expect(t).toContain(frase);
    // Os cartões de antes saíram.
    expect(t).not.toContain("Nenhum produto cadastrado");
    expect(t).not.toContain("Adicionar em lote");
    expect(t).not.toContain("Importar nota do fornecedor");
  });

  test("os botões dos cartões", () => {
    mockEstado.semProdutos = true;
    const r = montar();
    act(() => { porTestID(r, "estoque-vazio-chegou")[0].props.onPress(); });
    expect(chegou(r)).toHaveLength(1);
    act(() => { chegou(r)[0].onClose(); });

    act(() => { porTestID(r, "estoque-vazio-planilha")[0].props.onPress(); });
    expect(mockEscolherArquivo).toHaveBeenCalledTimes(1);
    // O link de download de sempre (BaixarModelo): o nó que leva o href.
    const modelo = r.root.findAll((n: any) => n.props && n.props.testID === "estoque-vazio-modelo" && n.props.accessibilityRole !== undefined)[0];
    expect(modelo.props.href).toBe("/modelo-produtos-aura.xlsx");

    act(() => { porTestID(r, "estoque-vazio-produto")[0].props.onPress(); });
    expect(form(r).visible).toBe(true);
    expect(form(r).initialType).toBe("product");
    act(() => { form(r).onClose(); });

    act(() => { porTestID(r, "estoque-vazio-lista")[0].props.onPress(); });
    expect(lista(r).visible).toBe(true);
    expect(lista(r).onVoltar).toBeUndefined();
  });

  test("375 px: os mesmos três cartões, com os textos curtos", () => {
    mockEstado.semProdutos = true;
    largura(375);
    const r = montar();
    const t = textoDaTela(r);
    expect(t).toContain("Comece do jeito que for mais fácil para você.");
    expect(t).not.toContain("Dá para trocar de ideia depois.");
    expect(t).toContain("Cadastra e já dá entrada.");
    expect(t).toContain("Você confere antes de gravar.");
    expect(porTestID(r, "estoque-vazio-nota")).toHaveLength(1);
    expect(porTestID(r, "estoque-vazio-planilha-cartao")).toHaveLength(1);
    expect(porTestID(r, "estoque-vazio-mao")).toHaveLength(1);
    expect(porTestID(r, "estoque-portas-celular")).toHaveLength(1);
  });
});

describe("A8: demo, só consulta e consolidado", () => {
  test("demo: só o olho e \"+ Produto\"; sem cartões da loja vazia e sem Cadastrar vários", () => {
    mockEstado.demo = true;
    const r = montar();
    expect(porTestID(r, "estoque-novo-produto")).toHaveLength(1);
    for (const id of ["estoque-selecionar", "estoque-conferir", "estoque-chegou-mercadoria", "estoque-vazio"]) {
      expect(porTestID(r, id)).toHaveLength(0);
    }
    abrirProduto(r);
    expect(form(r).cadastrarVarios).toBeUndefined();
  });

  test("demo no celular: a linha das portas só com \"+ Produto\"", () => {
    mockEstado.demo = true;
    largura(375);
    const r = montar();
    expect(porTestID(r, "estoque-chegou-mercadoria")).toHaveLength(0);
    expect(porTestID(r, "estoque-novo-produto")).toHaveLength(1);
  });

  test("só consulta: sem barra e sem portas (como antes)", () => {
    mockEstado.consulta = true;
    const r = montar();
    expect(porTestID(r, "estoque-novo-produto")).toHaveLength(0);
    expect(porTestID(r, "estoque-chegou-mercadoria")).toHaveLength(0);
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

  test("A8: \"Ir para Chegou mercadoria\" fecha o cadastro e abre o wizard", () => {
    const r = montar();
    abrirProduto(r);
    expect(typeof form(r).cadastrarVarios.onChegou).toBe("function");
    act(() => { form(r).cadastrarVarios.onChegou(); });
    expect(form(r).visible).toBe(false);
    expect(chegou(r)).toHaveLength(1);
  });

  test("no consolidado não há barra, cadastro nem wizard (como antes)", () => {
    const r = montar({ consolidado: true });
    expect(porTestID(r, "estoque-novo-produto")).toHaveLength(0);
    expect(porTestID(r, "estoque-chegou-mercadoria")).toHaveLength(0);
    expect(porTestID(r, "stub-item-form")).toHaveLength(0);
    expect(porTestID(r, "stub-chegou")).toHaveLength(0);
  });
});

describe("A8: tour dos primeiros passos", () => {
  test("todo passo que leva ao Estoque aponta para o \"+ Produto\"; nada aponta para o Importar que saiu", () => {
    const { FRENTES } = jest.requireActual("@/constants/primeirosPassos");
    const doEstoque: any[] = [];
    for (const frente of Object.values(FRENTES) as any[]) {
      for (const passo of Object.values(frente.passos || {}) as any[]) {
        if (passo.path === "/estoque") doEstoque.push(passo);
      }
    }
    expect(doEstoque.length).toBeGreaterThan(0);
    for (const passo of doEstoque) {
      expect(passo.targets).toEqual(['[data-tour="estoque.novo_produto"]']);
      expect(passo.tip.body).not.toMatch(/Importar/);
    }
  });
});
