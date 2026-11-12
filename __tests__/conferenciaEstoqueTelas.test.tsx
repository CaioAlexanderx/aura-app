// ============================================================
// p-108 (entrega B): telas de começar e contar a conferência de estoque.
//   1. Módulo próprio: NAV, MODULE_PLAN_MAP (Essencial) e PERM_TO_MODULES
//      (permissão estoque; quem só consulta não entra).
//   2. Porta: refaz o /auth/me antes de decidir; sem o módulo volta ao
//      Painel; no consolidado pergunta a loja.
//   3. Começar: categoria obrigatória no escopo de categoria, às cegas
//      ligado por padrão, motivo; rascunhos com Continuar e Descartar;
//      503 MIGRATION_PENDING com texto gentil.
//   4. Contar: bipe soma 1 e manda "definir" com o total; às cegas nunca
//      mostra o estoque do sistema; variante pelo código; sem cadastro;
//      queda de rede guarda e avisa; 409 tira a linha com o texto.
//   5. ScannerInput: câmera só com BarcodeDetector quando pedido.
// Mocks do padrão do repo; testID + findAll(..., { deep: false }).
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@expo-google-fonts/dm-sans", () => ({}), { virtual: true });
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/CompanyPickerModal", () => ({ CompanyPickerModal: () => null, getRememberedCompanyId: () => null }));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() };
jest.mock("@/components/Toast", () => ({
  toast: { success: (...a: any[]) => mockToast.success(...a), error: (...a: any[]) => mockToast.error(...a), info: (...a: any[]) => mockToast.info(...a), warning: (...a: any[]) => mockToast.warning(...a) },
}));

const mockPush = jest.fn();
const mockRedirect = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: "k1" }),
  Redirect: (p: any) => { mockRedirect(p.href); return null; },
  Stack: Object.assign(() => null, { Screen: () => null }),
}));

let mockAuth: any;
const mockRefreshMe = jest.fn();
jest.mock("@/stores/auth", () => {
  const useAuthStore = Object.assign(
    (sel?: (s: any) => any) => (typeof sel === "function" ? sel(mockAuth) : mockAuth),
    { getState: () => mockAuth, setState: () => {}, subscribe: () => () => {} },
  );
  return { useAuthStore };
});

let mockVisible: Set<string>;
jest.mock("@/hooks/useVisibleModules", () => {
  const actual = jest.requireActual("@/hooks/useVisibleModules");
  return { ...actual, useVisibleModules: () => mockVisible, useVisibleModulesProntos: () => true };
});

let mockProdutos: any[] = [];
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: mockProdutos }) }));
let mockCategorias: any[] = [];
jest.mock("@/hooks/useProductCategories", () => ({ useProductCategories: () => ({ categories: mockCategorias }) }));

const mockVariantes = jest.fn();
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any; isNetworkError: boolean; code: string | null;
    constructor(m: string, status: number, data?: any, rede = false, code: string | null = null) {
      super(m); this.status = status; this.data = data; this.isNetworkError = rede; this.code = code;
    }
  }
  return { ApiError, request: jest.fn(), companiesApi: { variants: (...a: any[]) => mockVariantes(...a) } };
});
const mockScan = jest.fn();
jest.mock("@/services/pdvApi", () => ({ pdvApi: { scan: (...a: any[]) => mockScan(...a) } }));
jest.mock("@/components/screens/estoque/VariantesConsulta", () => ({ rotuloDaVariante: (v: any) => v.rotulo || "Variante" }));

const mockApi = {
  criar: jest.fn(), listar: jest.fn(), obter: jest.fn(), registrarItem: jest.fn(), removerItem: jest.fn(), descartar: jest.fn(),
};
jest.mock("@/services/conferenciaEstoqueApi", () => {
  const actual = jest.requireActual("@/services/conferenciaEstoqueApi");
  const api: any = {};
  ["criar", "listar", "obter", "registrarItem", "removerItem", "descartar"].forEach((k) => {
    api[k] = (...a: any[]) => (mockApi as any)[k](...a);
  });
  return { ...actual, conferenciaEstoqueApi: api };
});

// 12/11: atalho "Produtos sem custo · Preencher custos" na tela de começar.
const mockContagem = jest.fn();
jest.mock("@/services/custoEmMassaApi", () => ({
  ...jest.requireActual("@/services/custoEmMassaApi"),
  custoEmMassaApi: { contagem: (...a: any[]) => mockContagem(...a) },
}));
let mockCtxCusto: any;
jest.mock("@/hooks/useConferenciaResultado", () => ({ useConferenciaContexto: () => mockCtxCusto }));

// O campo do bipe vira um TextInput simples: o que importa é o onScan, e a
// ref (limpar/focar) que a tela usa depois de escolher da busca.
const mockCampoLimpar = jest.fn();
const mockCampoFocar = jest.fn();
jest.mock("@/components/ScannerInput", () => {
  const R = jest.requireActual("react");
  const { TextInput } = jest.requireActual("react-native");
  return {
    ScannerInput: R.forwardRef((p: any, ref: any) => {
      R.useImperativeHandle(ref, () => ({
        limpar: () => { mockCampoLimpar(); if (p.onChangeText) p.onChangeText(""); },
        focar: () => mockCampoFocar(),
      }));
      return R.createElement(TextInput, {
        testID: p.testID,
        onChangeText: p.onChangeText,
        onSubmitEditing: (e: any) => p.onScan({ code: e.nativeEvent.text, source: "scanner" }),
      });
    }),
  };
});

import { ApiError } from "@/services/api";
import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import ConferenciaRota from "@/app/(tabs)/conferencia-estoque/index";
import ContarRota from "@/app/(tabs)/conferencia-estoque/[id]/index";

const CID = "c1";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function um(tree: renderer.ReactTestRenderer, id: string) {
  const nos = porTestID(tree, id);
  if (!nos.length) throw new Error("sem testID " + id);
  return nos[0];
}
function tem(tree: renderer.ReactTestRenderer, id: string) { return porTestID(tree, id).length > 0; }
function texto(tree: renderer.ReactTestRenderer) { return flattenText(tree.toJSON()); }
async function tocar(tree: renderer.ReactTestRenderer, id: string) { await act(async () => { um(tree, id).props.onPress(); }); }
async function digitar(tree: renderer.ReactTestRenderer, id: string, v: string) {
  const no = um(tree, id);
  const alvo = typeof no.props.onChangeText === "function" ? no : no.findAll((x) => typeof x.props.onChangeText === "function")[0];
  await act(async () => { alvo.props.onChangeText(v); });
}
async function bipar(tree: renderer.ReactTestRenderer, codigo: string) {
  const campo = porTestID(tree, "contar-campo").map((n) => n.findAll((x) => typeof x.props.onSubmitEditing === "function")[0]).filter(Boolean)[0];
  await act(async () => { campo.props.onSubmitEditing({ nativeEvent: { text: codigo } }); });
  await esperar();
}
async function esperar() { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); }

async function montar(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); });
  await esperar();
  return tree;
}

const RASCUNHO = { id: "k1", numero: 3, status: "rascunho", escopo: { tipo: "categoria", category_ids: ["cat1"] }, as_cegas: true, motivo: null };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockAuth = { company: { id: CID, plan: "essencial" }, consolidatedView: false, user: { id: "u1" }, token: "tk", refreshMe: mockRefreshMe, switchCompany: jest.fn(() => Promise.resolve()) };
  mockRefreshMe.mockResolvedValue(undefined);
  mockVisible = new Set(["estoque", "conferencia_estoque"]);
  mockCategorias = [{ id: "cat1", name: "Camisetas", product_count: 2 }];
  mockProdutos = [
    { id: "p1", name: "Cinto de couro", code: "CIN-1", barcode: "7891000100011", category: "Acessórios", unit: "un", stock: 6 },
    { id: "p2", name: "Camiseta Básica", code: "---", barcode: "", category: "Camisetas", unit: "un", stock: 9, has_variants: true, variant_barcodes: ["7891000200018"] },
  ];
  mockApi.listar.mockResolvedValue([]);
  mockApi.obter.mockResolvedValue({ conferencia: RASCUNHO, itens: [], escopo_total: 8 });
  mockApi.registrarItem.mockImplementation(async (_c: string, _k: string, r: any) => ({ item: { id: "i-" + r.product_id + (r.variant_id || ""), contado: r.quantidade } }));
  mockScan.mockRejectedValue(new ApiError("Produto não encontrado", 404, { match: "none" }));
  mockCtxCusto = { companyId: CID, podeEditar: true, semCusto: false, carregandoPermissao: false };
  mockContagem.mockResolvedValue({ todos: 0, desta_conferencia: null, sem_preco: 0, produtos: 10 });
});

describe("atalho dos produtos sem custo (12/11)", () => {
  it("N produtos sem custo: abre a tela de custos", async () => {
    mockContagem.mockResolvedValue({ todos: 25, desta_conferencia: null, sem_preco: 2, produtos: 312 });
    const tree = await montar(<ConferenciaRota />);
    expect(mockContagem).toHaveBeenCalledWith(CID);
    const t = flattenText(um(tree, "atalho-sem-custo").children);
    expect(t).toContain("25");
    expect(t).toContain("Produtos sem custo");
    await tocar(tree, "preencher-custos");
    expect(mockPush).toHaveBeenCalledWith("/conferencia-estoque/custos");
  });

  it("some com N = 0, com erro (antes da migration) e sem permissão", async () => {
    let tree = await montar(<ConferenciaRota />);
    expect(tem(tree, "atalho-sem-custo")).toBe(false);

    mockContagem.mockRejectedValue(new ApiError("x", 503, { code: "MIGRATION_PENDING" }));
    tree = await montar(<ConferenciaRota />);
    expect(tem(tree, "atalho-sem-custo")).toBe(false);

    mockContagem.mockReset().mockResolvedValue({ todos: 25, desta_conferencia: null, sem_preco: 0 });
    mockCtxCusto = { companyId: CID, podeEditar: true, semCusto: true, carregandoPermissao: false };
    tree = await montar(<ConferenciaRota />);
    expect(tem(tree, "atalho-sem-custo")).toBe(false);
    mockCtxCusto = { companyId: CID, podeEditar: false, semCusto: false, carregandoPermissao: false };
    tree = await montar(<ConferenciaRota />);
    expect(tem(tree, "atalho-sem-custo")).toBe(false);
    expect(mockContagem).not.toHaveBeenCalled();
  });
});

describe("módulo próprio", () => {
  it("NAV, plano e permissão com chave própria", () => {
    const layout = fs.readFileSync(path.join(__dirname, "..", "app/(tabs)/_layout.tsx"), "utf8");
    // 12/11/2026 (Caio): fora do menu lateral; entra pelo botão da tela de Estoque.
    expect(layout).not.toContain('r: "/conferencia-estoque"');
    const estoque = fs.readFileSync(path.join(__dirname, "..", "app/(tabs)/estoque.tsx"), "utf8");
    expect(estoque).toContain("Conferir estoque");
    expect(MODULE_PLAN_MAP.conferencia_estoque).toBe("essencial");
    expect(PERM_TO_MODULES.estoque).toContain("conferencia_estoque");
    expect(PERM_TO_MODULES.estoque_consulta).not.toContain("conferencia_estoque");
  });

  it("todo plano vê; membro com estoque vê; quem só consulta não", () => {
    ["essencial", "negocio", "expansao"].forEach((pl) => expect(computeVisibleModules(pl, {}, null).has("conferencia_estoque")).toBe(true));
    expect(computeVisibleModules("essencial", {}, { is_owner: false, permissions: { estoque: true } }).has("conferencia_estoque")).toBe(true);
    expect(computeVisibleModules("essencial", {}, { is_owner: false, permissions: { estoque_consulta: true } }).has("conferencia_estoque")).toBe(false);
    expect(computeVisibleModules("negocio", { conferencia_estoque: false }, null).has("conferencia_estoque")).toBe(false);
  });

  it("botão Conferir estoque na tela de Estoque", () => {
    const estoque = fs.readFileSync(path.join(__dirname, "..", "app/(tabs)/estoque.tsx"), "utf8");
    expect(estoque).toContain('router.push("/conferencia-estoque" as any)');
    expect(estoque).toContain('modulosVisiveis.has("conferencia_estoque")');
  });
});

describe("porta", () => {
  it("espera o /auth/me antes de decidir", async () => {
    let soltar: () => void = () => {};
    mockRefreshMe.mockReturnValue(new Promise<void>((r) => { soltar = r; }));
    const tree = await montar(<ConferenciaRota />);
    expect(mockRefreshMe).toHaveBeenCalled();
    expect(tem(tree, "comecar")).toBe(false);
    await act(async () => { soltar(); });
    await esperar();
    expect(tem(tree, "comecar")).toBe(true);
  });

  it("sem o módulo volta ao Painel", async () => {
    mockVisible = new Set(["estoque"]);
    await montar(<ConferenciaRota />);
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("no consolidado pergunta a loja antes", async () => {
    mockAuth = { ...mockAuth, consolidatedView: true };
    const tree = await montar(<ConferenciaRota />);
    expect(texto(tree)).toContain("Esta tela é por empresa");
    expect(tem(tree, "comecar")).toBe(false);
  });
});

describe("começar", () => {
  it("categoria é obrigatória; às cegas ligado por padrão; cria e vai contar", async () => {
    mockApi.criar.mockResolvedValue({ conferencia: { id: "k9" } });
    const tree = await montar(<ConferenciaRota />);
    expect(um(tree, "comecar").props.disabled).toBe(true);
    expect(um(tree, "as-cegas").props.accessibilityState).toEqual({ checked: true });
    await tocar(tree, "categoria-cat1");
    await digitar(tree, "motivo", "Inventário do mês");
    expect(um(tree, "comecar").props.disabled).toBe(false);
    await tocar(tree, "comecar");
    await esperar();
    expect(mockApi.criar).toHaveBeenCalledWith(CID, { escopo: { tipo: "categoria", category_ids: ["cat1"] }, as_cegas: true, motivo: "Inventário do mês" });
    expect(mockPush).toHaveBeenCalledWith("/conferencia-estoque/k9");
  });

  it("loja toda, sem às cegas", async () => {
    mockApi.criar.mockResolvedValue({ conferencia: { id: "k9" } });
    const tree = await montar(<ConferenciaRota />);
    await tocar(tree, "escopo-loja-toda");
    await tocar(tree, "as-cegas");
    await tocar(tree, "comecar");
    await esperar();
    expect(mockApi.criar).toHaveBeenCalledWith(CID, { escopo: { tipo: "loja_toda" }, as_cegas: false, motivo: null });
  });

  it("rascunhos: Continuar e Descartar (com confirmação); link do histórico", async () => {
    mockApi.listar.mockResolvedValue([
      { ...RASCUNHO, itens_contados: 23, criada_em: "2026-11-08T13:00:00Z" },
      { id: "k0", numero: 2, status: "aplicada", escopo: { tipo: "loja_toda" }, as_cegas: true, aplicada_em: "2026-11-05T13:00:00Z", pode_desfazer_ate: "2026-11-12T13:00:00Z", itens_contados: 31 },
    ]);
    mockApi.descartar.mockResolvedValue({ ok: true });
    const tree = await montar(<ConferenciaRota />);
    const t = texto(tree);
    expect(t).toContain("Em andamento");
    expect(t).toContain("23 itens contados");
    expect(t).toContain("Desfazer até 12/11");
    await tocar(tree, "continuar-k1");
    expect(mockPush).toHaveBeenCalledWith("/conferencia-estoque/k1");
    await tocar(tree, "descartar-k1");
    expect(mockApi.descartar).not.toHaveBeenCalled();
    await tocar(tree, "confirmar-descarte-k1");
    await esperar();
    expect(mockApi.descartar).toHaveBeenCalledWith(CID, "k1");
    await tocar(tree, "ver-historico");
    expect(mockPush).toHaveBeenCalledWith("/conferencia-estoque/historico");
  });

  it("backend sem a migration: texto gentil e sem começar", async () => {
    mockApi.listar.mockRejectedValue(new ApiError("x", 503, { code: "MIGRATION_PENDING" }));
    const tree = await montar(<ConferenciaRota />);
    expect(tem(tree, "conferencia-em-preparo")).toBe(true);
    expect(texto(tree)).toContain("quase pronta");
    await tocar(tree, "categoria-cat1");
    expect(um(tree, "comecar").props.disabled).toBe(true);
  });
});

describe("contar", () => {
  it("bipe soma 1, manda definir com o total, e às cegas nunca mostra o sistema", async () => {
    const tree = await montar(<ContarRota />);
    expect(texto(tree)).toContain("Camisetas");
    expect(texto(tree)).toContain("0 de 8 itens contados");
    await bipar(tree, "7891000100011");
    await bipar(tree, "7891000100011");
    expect(mockApi.registrarItem.mock.calls.map((c: any[]) => c[2])).toEqual([
      { product_id: "p1", variant_id: null, quantidade: 1, modo: "definir" },
      { product_id: "p1", variant_id: null, quantidade: 2, modo: "definir" },
    ]);
    expect(flattenText(um(tree, "linha-numero-p1|"))).toBe("2");
    expect(texto(tree)).toContain("1 de 8 itens contados");
    expect(texto(tree)).not.toContain("sistema:");
    expect(texto(tree)).toContain("Rascunho salvo");
  });

  it("fora do modo às cegas mostra o que o sistema tinha", async () => {
    mockApi.obter.mockResolvedValue({ conferencia: { ...RASCUNHO, as_cegas: false }, itens: [], escopo_total: 8 });
    const tree = await montar(<ContarRota />);
    await bipar(tree, "CIN-1");
    expect(texto(tree)).toContain("sistema: 6");
  });

  it("código de variante: busca as variantes e conta a do código", async () => {
    mockVariantes.mockResolvedValue({ variants: [{ id: "v1", barcode: "7891000200011", rotulo: "Preta · M", stock_qty: 4 }, { id: "v2", barcode: "7891000200018", rotulo: "Preta · G", stock_qty: 2 }] });
    const tree = await montar(<ContarRota />);
    await bipar(tree, "7891000200018");
    expect(mockVariantes).toHaveBeenCalledWith(CID, "p2");
    expect(mockApi.registrarItem).toHaveBeenCalledWith(CID, "k1", { product_id: "p2", variant_id: "v2", quantidade: 1, modo: "definir" });
    expect(texto(tree)).toContain("Preta · G");
    expect(texto(tree)).not.toContain("sistema:");
  });

  it("busca pelo nome: produto com variantes pede qual, às cegas sem estoque", async () => {
    mockVariantes.mockResolvedValue({ variants: [{ id: "v1", rotulo: "Preta · M", stock_qty: 4 }, { id: "v2", rotulo: "Preta · G", stock_qty: 2 }] });
    const tree = await montar(<ContarRota />);
    await digitar(tree, "contar-campo", "camiseta");
    expect(tem(tree, "sugestao-p2")).toBe(true);
    await tocar(tree, "sugestao-p2");
    await esperar();
    expect(tem(tree, "escolher-variante")).toBe(true);
    expect(flattenText(um(tree, "escolher-variante"))).not.toMatch(/\b4\b/);
    await tocar(tree, "variante-v1");
    await esperar();
    expect(mockApi.registrarItem).toHaveBeenCalledWith(CID, "k1", { product_id: "p2", variant_id: "v1", quantidade: 1, modo: "definir" });
    expect(texto(tree)).toContain("sem código, achado pelo nome");
  });

  it("busca pelo nome: escolher da lista limpa o campo e devolve o foco, como depois de um bipe", async () => {
    mockProdutos = [
      ...mockProdutos,
      { id: "p3", name: "Boné azul", code: "BON-1", barcode: "", category: "Acessórios", unit: "un", stock: 4 },
      { id: "p4", name: "Boné preto", code: "BON-2", barcode: "", category: "Acessórios", unit: "un", stock: 5 },
    ];
    const tree = await montar(<ContarRota />);
    await digitar(tree, "contar-campo", "bon");
    expect(tem(tree, "sugestao-p3")).toBe(true);
    expect(tem(tree, "sugestao-p4")).toBe(true);
    await tocar(tree, "sugestao-p3");
    await esperar();
    expect(mockApi.registrarItem).toHaveBeenCalledWith(CID, "k1", { product_id: "p3", variant_id: null, quantidade: 1, modo: "definir" });
    expect(mockCampoLimpar).toHaveBeenCalledTimes(1);
    expect(mockCampoFocar).toHaveBeenCalled();
    // a lista some: o campo ficou vazio
    expect(tem(tree, "sugestoes")).toBe(false);
  });

  it("modo digitar: escolher da busca limpa o campo; o foco vai para a quantidade e volta depois", async () => {
    const tree = await montar(<ContarRota />);
    await tocar(tree, "modo-definir");
    await digitar(tree, "contar-campo", "cinto");
    await tocar(tree, "sugestao-p1");
    await esperar();
    expect(mockCampoLimpar).toHaveBeenCalledTimes(1);
    expect(mockCampoFocar).not.toHaveBeenCalled();
    expect(tem(tree, "pedir-quantidade")).toBe(true);
    await digitar(tree, "quantidade-campo", "3");
    await tocar(tree, "quantidade-ok");
    await esperar();
    expect(mockCampoFocar).toHaveBeenCalledTimes(1);
  });

  it("modo digitar a quantidade", async () => {
    const tree = await montar(<ContarRota />);
    await tocar(tree, "modo-definir");
    await bipar(tree, "7891000100011");
    expect(mockApi.registrarItem).not.toHaveBeenCalled();
    await digitar(tree, "quantidade-campo", "12,5");
    await tocar(tree, "quantidade-ok");
    await esperar();
    expect(mockApi.registrarItem).toHaveBeenCalledWith(CID, "k1", { product_id: "p1", variant_id: null, quantidade: 12.5, modo: "definir" });
  });

  it("+, − e remover; tocar no número digita", async () => {
    mockApi.obter.mockResolvedValue({
      conferencia: RASCUNHO, escopo_total: 8,
      itens: [{ id: "i1", product_id: "p1", variant_id: null, nome: "Cinto de couro", contado: 3, codigo: "CIN-1" }],
    });
    mockApi.removerItem.mockResolvedValue({ ok: true });
    mockApi.registrarItem.mockResolvedValue({ item: { id: "i1" } });
    const tree = await montar(<ContarRota />);
    await tocar(tree, "linha-mais-p1|");
    await esperar();
    expect(mockApi.registrarItem).toHaveBeenLastCalledWith(CID, "k1", { product_id: "p1", variant_id: null, quantidade: 4, modo: "definir" });
    await tocar(tree, "linha-numero-p1|");
    await digitar(tree, "linha-campo-p1|", "10");
    await tocar(tree, "linha-ok-p1|");
    await esperar();
    expect(mockApi.registrarItem).toHaveBeenLastCalledWith(CID, "k1", { product_id: "p1", variant_id: null, quantidade: 10, modo: "definir" });
    await tocar(tree, "linha-remover-p1|");
    await tocar(tree, "linha-remover-sim-p1|");
    await esperar();
    expect(mockApi.removerItem).toHaveBeenCalledWith(CID, "k1", "i1");
    expect(tem(tree, "linha-p1|")).toBe(false);
  });

  it("código desconhecido vai para Sem cadastro e não trava", async () => {
    const tree = await montar(<ContarRota />);
    await bipar(tree, "7890000000001");
    await bipar(tree, "7890000000001");
    expect(mockScan).toHaveBeenCalledWith(CID, "7890000000001");
    expect(mockApi.registrarItem).not.toHaveBeenCalled();
    expect(flattenText(um(tree, "sem-cadastro"))).toContain("7890000000001 · 2 bipes");
    await bipar(tree, "7891000100011");
    expect(mockApi.registrarItem).toHaveBeenCalledTimes(1);
  });

  it("produto que o servidor acha (lista velha) entra", async () => {
    mockScan.mockResolvedValue({ match: "exact", source: "barcode", product: { id: "p7", name: "Boné", barcode: "7890000000077", variants: [] } });
    const tree = await montar(<ContarRota />);
    await bipar(tree, "7890000000077");
    expect(mockApi.registrarItem).toHaveBeenCalledWith(CID, "k1", { product_id: "p7", variant_id: null, quantidade: 1, modo: "definir" });
    expect(tem(tree, "sem-cadastro")).toBe(false);
  });

  it("queda de rede: a linha fica, avisa e não deixa ver as diferenças", async () => {
    mockApi.registrarItem.mockRejectedValue(new ApiError("sem rede", 0, null, true, "network"));
    const tree = await montar(<ContarRota />);
    await bipar(tree, "7891000100011");
    expect(tem(tree, "linha-p1|")).toBe(true);
    expect(texto(tree)).toContain("Sem conexão · 1 item esperando");
    expect(tem(tree, "aviso-fila")).toBe(true);
    expect(texto(tree)).toContain("Guardado aqui, esperando a conexão");
    expect(um(tree, "ver-diferencas").props.disabled).toBe(true);
    const guardado = JSON.parse(localStorage.getItem("aura_conferencia_k1") || "{}");
    expect(guardado.pendentes).toEqual([{ tipo: "definir", chave: "p1|", product_id: "p1", variant_id: null, quantidade: 1 }]);
    mockApi.registrarItem.mockResolvedValue({ item: { id: "i1" } });
    await tocar(tree, "reenviar");
    await esperar();
    expect(texto(tree)).toContain("Rascunho salvo");
    expect(um(tree, "ver-diferencas").props.disabled).toBe(false);
    await tocar(tree, "ver-diferencas");
    expect(mockPush).toHaveBeenCalledWith("/conferencia-estoque/k1/diferencas");
  });

  it("reabrir com bipes guardados manda de novo", async () => {
    localStorage.setItem("aura_conferencia_k1", JSON.stringify({
      pendentes: [{ tipo: "definir", chave: "p1|", product_id: "p1", variant_id: null, quantidade: 5 }],
      nomes: { "p1|": { nome: "Cinto de couro", variante: null, codigo: "CIN-1" } },
      semCadastro: [],
    }));
    const tree = await montar(<ContarRota />);
    expect(mockApi.registrarItem).toHaveBeenCalledWith(CID, "k1", { product_id: "p1", variant_id: null, quantidade: 5, modo: "definir" });
    expect(flattenText(um(tree, "linha-numero-p1|"))).toBe("5");
  });

  it("409 (produto do grupo de outra loja): tira a linha e mostra o texto", async () => {
    mockApi.registrarItem.mockRejectedValue(new ApiError("x", 409, { error: "O estoque deste produto fica na Loja Centro." }));
    const tree = await montar(<ContarRota />);
    await bipar(tree, "7891000100011");
    expect(tem(tree, "linha-p1|")).toBe(false);
    expect(flattenText(um(tree, "aviso-recusado"))).toContain("Cinto de couro: O estoque deste produto fica na Loja Centro.");
  });

  it("conferência que não está em rascunho não conta", async () => {
    mockApi.obter.mockResolvedValue({ conferencia: { ...RASCUNHO, status: "aplicada" }, itens: [], escopo_total: 8 });
    const tree = await montar(<ContarRota />);
    expect(tem(tree, "contar-encerrada")).toBe(true);
    expect(tem(tree, "contar-campo")).toBe(false);
  });

  it("backend sem a rota: texto gentil", async () => {
    mockApi.obter.mockRejectedValue(new ApiError("Rota nao encontrada", 404, { error: "Rota nao encontrada" }));
    const tree = await montar(<ContarRota />);
    expect(flattenText(um(tree, "contar-erro"))).toContain("quase pronta");
  });
});

// Relato do Caio (12/11): topo único da conferência, com voltar de verdade
// (router.push a um caminho fixo) e "Ir para o Estoque".
describe("topo da conferência", () => {
  it("começar: Ir para o Estoque", async () => {
    const tree = await montar(<ConferenciaRota />);
    await tocar(tree, "comecar-ir-estoque");
    expect(mockPush).toHaveBeenCalledWith("/estoque");
  });

  it("contar: Voltar às conferências e Ir para o Estoque", async () => {
    const tree = await montar(<ContarRota />);
    expect(flattenText(um(tree, "contar-voltar").children)).toBe("Voltar às conferências");
    await tocar(tree, "contar-voltar");
    expect(mockPush).toHaveBeenCalledWith("/conferencia-estoque");
    await tocar(tree, "contar-ir-estoque");
    expect(mockPush).toHaveBeenLastCalledWith("/estoque");
  });
});
