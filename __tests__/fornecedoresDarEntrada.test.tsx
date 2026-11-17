// ============================================================
// Estoque, Fase 4 (F1, F2): as portas do "Chegou mercadoria" na tela de
// Fornecedores.
//
// 0. A8 (17/11/2026): a trava está LIGADA no código (o valor de hoje).
// 1. Trava desligada (FORNECEDORES_ABREM_O_CHEGOU = false, para voltar atrás):
//    a tela e a ficha ficam IDÊNTICAS às de antes. O snapshot foi gravado
//    rodando este arquivo contra app/(tabs)/fornecedores.tsx e
//    components/fornecedores/FornecedorFicha.tsx de feat/chegou-mercadoria-a6
//    (a2d62432), antes da Fase 4; não regravar para fazer passar.
// 2. Trava ligada: "Dar entrada" no cartão e na ficha abre o wizard no
//    passo 2 com o fornecedor; "Importar a lista deste fornecedor" chega com
//    a Planilha marcada; fornecedor só da nota abre o "Novo fornecedor"
//    preenchido; demo e perfil só consulta não veem as portas.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

let mockPorta = false;
jest.mock("@/components/screens/estoque/chegou/portaDoChegou", () => ({
  get FORNECEDORES_ABREM_O_CHEGOU() { return mockPorta; },
}));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ children, visible }: any) => (visible ? children : null) }));
jest.mock("@/components/RequireCompanyScope", () => ({ RequireCompanyScope: ({ children }: any) => children }));
jest.mock("@/components/ScreenHero", () => {
  const R = require("react");
  return { ScreenHero: (p: any) => R.createElement("ScreenHero", { title: p.title }, p.subtitle, p.actions) };
});
jest.mock("@/components/matcon/PedidoCompraSheet", () => ({ PedidoCompraSheet: () => null }));
jest.mock("@/components/fornecedores/FornecedorFormSheet", () => {
  const R = require("react");
  return {
    FornecedorFormSheet: (p: any) => (p.visible ? R.createElement("FornecedorFormSheet", { testID: "form-fornecedor", inicial: p.inicial, noPasso: !!p.noPasso }) : null),
  };
});
jest.mock("@/hooks/useAtalhosDoCaixa", () => ({ dialogoAbertoNaTela: () => false }));
jest.mock("@/components/screens/estoque/DanfeImportModal", () => ({ DanfeImportModal: () => null }));
jest.mock("@/hooks/useServerImport", () => ({ lerArquivoPlanilha: jest.fn() }));
jest.mock("@/services/estoqueEntradasApi", () => ({
  estoqueEntradasApi: { darEntrada: jest.fn(), notaJaLancada: jest.fn(), codigosDoFornecedor: jest.fn() },
}));

let mockAuth: any = {};
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => new Set<string>() }));
jest.mock("@/services/matconApi", () => ({ matconApi: {} }));
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: [] }) }));
let mockConsulta = { consulta: false, carregando: false, semCusto: false };
jest.mock("@/hooks/useEstoqueConsulta", () => ({ useEstoqueConsulta: () => mockConsulta }));
jest.mock("@/services/suppliersApi", () => ({ suppliersApi: { list: jest.fn(), get: jest.fn() } }));

let mockQueries: Record<string, any> = {};
jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey, enabled }: any) =>
    enabled === false ? { data: undefined, isLoading: false, isError: false, refetch: jest.fn() }
      : (mockQueries[queryKey[0]] || { data: undefined, isLoading: false, isError: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

import FornecedoresRoute from "../app/(tabs)/fornecedores";

const ALFA = {
  id: "f-alfa", company_id: "c1", name: "Distribuidora Alfa", cnpj: "11222333000181", contact_name: "Marcos",
  phone: "11988881234", email: null, notes: null, is_active: true, product_count: 38,
};
const BETA = {
  id: "f-beta", company_id: "c1", name: "Beta Cosméticos", cnpj: null, contact_name: null,
  phone: null, email: null, notes: null, is_active: true, product_count: 0,
};
const DETALHE = {
  ...ALFA,
  products: [{ id: "p1", name: "Esmalte Cremoso Vermelho 8 ml", sku: null, stock_qty: 36, price: 9.9, is_active: true }],
  linked_products: [
    { id: "p1", name: "Esmalte Cremoso Vermelho 8 ml", sku: null, stock_qty: 36, is_active: true, supplier_code: "AL-1", is_main: true, last_purchase_at: "2026-11-14T15:00:00Z" },
    { id: "p2", name: "Acetona 100 ml", sku: null, stock_qty: 16, is_active: true, supplier_code: null, is_main: false, last_purchase_at: null },
  ],
};

function porId(tree: any, id: string): any[] {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}
const tem = (tree: any, id: string) => porId(tree, id).length > 0;
const texto = (tree: any) => JSON.stringify(tree.toJSON());
async function tocar(tree: any, id: string) {
  const no = porId(tree, id)[0];
  if (!no) throw new Error("não achei " + id);
  await act(async () => { no.props.onPress(); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
}
async function montar() {
  let tree: any;
  await act(async () => { tree = renderer.create(<FornecedoresRoute />); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return tree;
}

beforeEach(() => {
  mockPorta = false;
  mockAuth = { company: { id: "c1", name: "Flor de Maio · Centro" }, isDemo: false };
  mockConsulta = { consulta: false, carregando: false, semCusto: false };
  mockQueries = {
    suppliers: { data: { suppliers: [ALFA, BETA], total: 2 }, isLoading: false, isError: false },
    supplier: { data: DETALHE, isLoading: false, isError: false },
  };
  (global as any).innerWidth = 1280;
});

describe("A8: o valor de hoje", () => {
  test("a trava está ligada (\"Dar entrada\" e \"Importar a lista\" aparecem)", () => {
    expect(jest.requireActual("@/components/screens/estoque/chegou/portaDoChegou").FORNECEDORES_ABREM_O_CHEGOU).toBe(true);
  });
});

describe("trava desligada: a tela de Fornecedores fica igual", () => {
  test("a lista", async () => {
    const tree = await montar();
    expect(tree.toJSON()).toMatchSnapshot();
  });
  test("a ficha aberta", async () => {
    const tree = await montar();
    await tocar(tree, "fornecedor-abrir-f-alfa");
    expect(tree.toJSON()).toMatchSnapshot();
  });
});

describe("trava ligada: as portas do Chegou mercadoria", () => {
  beforeEach(() => { mockPorta = true; });

  test("\"Dar entrada\" no cartão abre o wizard no passo 2 com o fornecedor", async () => {
    const tree = await montar();
    expect(tem(tree, "chegou-mercadoria")).toBe(false);
    await tocar(tree, "fornecedor-dar-entrada-f-alfa");
    expect(tem(tree, "chegou-mercadoria")).toBe(true);
    expect(tem(tree, "chegou-passo-2")).toBe(true);
    expect(tem(tree, "chegou-origem-planilha-dica")).toBe(false);
    const t = texto(tree);
    expect(t).toContain("Fornecedor · Distribuidora Alfa");
    expect(t).toContain("Entrada na loja Flor de Maio · Centro");
  });

  test("ficha: \"Dar entrada\" (principal) e \"Importar a lista\", e os ligados com a última entrada", async () => {
    const tree = await montar();
    await tocar(tree, "fornecedor-abrir-f-alfa");
    expect(tem(tree, "fornecedor-ficha-dar-entrada")).toBe(true);
    expect(tem(tree, "fornecedor-ficha-importar-lista")).toBe(true);
    const t = texto(tree);
    expect(t).toContain("36 un · última entrada 14/11");
    expect(t).toContain("Acetona 100 ml");
    expect(t).toContain("16 un");

    await tocar(tree, "fornecedor-ficha-dar-entrada");
    expect(tem(tree, "fornecedor-ficha-portas")).toBe(false); // a ficha fecha
    expect(tem(tree, "chegou-passo-2")).toBe(true);
  });

  test("\"Importar a lista deste fornecedor\" chega com a Planilha marcada", async () => {
    const tree = await montar();
    await tocar(tree, "fornecedor-abrir-f-alfa");
    await tocar(tree, "fornecedor-ficha-importar-lista");
    expect(tem(tree, "chegou-passo-2")).toBe(true);
    const cartao = porId(tree, "chegou-origem-planilha")[0];
    expect(cartao.props.accessibilityState).toEqual({ selected: true });
    expect(texto(tree)).toContain("Sem a coluna de quantidade, a Aura só liga os produtos à Distribuidora Alfa");
  });

  test("fornecedor só da nota: \"Dar entrada\" abre o Novo fornecedor preenchido com o CNPJ da nota", async () => {
    mockQueries.suppliers = { data: { suppliers: [ALFA], total: 1 }, isLoading: false, isError: false };
    // a linha "da nota, sem cadastro" vem da reposição do Matcon; sem Matcon,
    // monta-se pelo utilitário com um fornecedor só da nota
    const util = require("@/utils/fornecedoresUtil");
    const { inicioDaLinha } = require("../app/(tabs)/fornecedores");
    const [linhaNota] = util.montarLinhas({
      suppliers: [],
      reposicao: [{ key: "gama", supplier_name: "Gama Distribuidora", supplier_cnpj: "23456789000101", supplier_phone: null, items: [], total_est: 0, min_days_to_stockout: null }],
      pedidos: [],
    });
    expect(linhaNota.origem).toBe("nota");
    expect(inicioDaLinha(linhaNota)).toMatchObject({ tipo: "novo_fornecedor", inicial: { name: "Gama Distribuidora", cnpj: "23456789000101" } });
    // a lista do fornecedor só existe para quem está cadastrado
    expect(inicioDaLinha(linhaNota, true)).toBeNull();
  });

  test("demo e perfil só consulta: sem portas", async () => {
    mockConsulta = { consulta: true, carregando: false, semCusto: true };
    let tree = await montar();
    expect(tem(tree, "fornecedor-dar-entrada-f-alfa")).toBe(false);
    mockConsulta = { consulta: false, carregando: false, semCusto: false };
    mockAuth = { ...mockAuth, isDemo: true };
    tree = await montar();
    expect(tem(tree, "fornecedor-dar-entrada-f-alfa")).toBe(false);
  });
});
