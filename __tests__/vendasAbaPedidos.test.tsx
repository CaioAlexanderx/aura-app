// ============================================================
// Vendas › aba Pedidos atrás da trava e do módulo (A5a, 17/11/2026)
//
// Regra do card: com a trava PEDIDO_LIBERADO desligada, ou sem o módulo
// vendas.pedidos, a aba não aparece e a tela de Vendas fica IDÊNTICA à de
// hoje: as mesmas três abas, na mesma ordem, o mesmo subtítulo, nenhuma ida
// a /pedidos, a /me/pedidos nem a /auth/my-permissions, e nenhum /auth/me
// a mais. Ligada e com o módulo, "Pedidos" entra entre Vendas e Ranking e
// o /auth/me é revalidado ao montar (plano stale no JWT).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let mockLiberado = false;
let mockUser: any = { id: "u1", is_staff: false };
let mockCompany: any = { id: "comp-1", plan: "essencial", module_overrides: {} };
let mockConsolidado = false;
const mockRefreshMe = jest.fn(() => Promise.resolve());
const mockRequest = jest.fn();

jest.mock("@/utils/pedidoLiberado", () => {
  const real = jest.requireActual("@/utils/pedidoLiberado");
  return {
    ...real,
    pedidoLiberado: (user: any) => real.pedidoLiberado(user, mockLiberado),
  };
});
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/EmptyState", () => ({ EmptyState: "EmptyState" }));
jest.mock("@/components/screens/vendas/SaleDetailModal", () => ({ SaleDetailModal: () => null }));
jest.mock("@/components/screens/vendas/FechamentosTab", () => ({ FechamentosTab: "FechamentosTab" }));
jest.mock("@/components/screens/vendas/SalesRanking", () => ({ SalesRanking: "SalesRanking" }));
jest.mock("@/components/screens/vendas/VendasFiltros", () => ({ VendasFiltros: "VendasFiltros" }));
jest.mock("@/components/screens/vendas/pedidos/AbaPedidos", () => ({ AbaPedidos: "AbaPedidos" }));
jest.mock("@/components/ScreenHero", () => ({ ScreenHero: "ScreenHero", ScreenTabs: "ScreenTabs" }));
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({}), router: { push: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => {
    const st = {
      user: mockUser, company: mockCompany, token: "t", consolidatedView: mockConsolidado,
      isHydrated: true, refreshMe: mockRefreshMe,
    };
    return typeof sel === "function" ? sel(st) : st;
  },
}));
jest.mock("@/hooks/useSales", () => ({
  useSalesList: () => ({
    sales: [], stats: { total_sales: 0, active_sales: 0, cancelled_sales: 0, revenue: 0, avg_ticket: 0 },
    total: 0, isLoading: false, isFetching: false, error: null, refetch: jest.fn(),
    breakdown: [], companyCount: 1,
  }),
  useHideSale: () => ({ hideSale: jest.fn(), isHiding: false }),
}));

import VendasScreen from "@/app/(tabs)/vendas";

const ABAS_DE_HOJE = [
  { key: "vendas", label: "Vendas" },
  { key: "ranking", label: "Ranking" },
  { key: "fechamentos", label: "Fechamentos de caixa" },
];

function respostaDosPedidos(abertos: number) {
  return {
    orders: [], situacao: "abertos",
    kpis: { abertos, pecas_reservadas: 0, atrasados: 0, sinais_recebidos: 0, falta_receber: 0 },
    counts: { abertos, aguardando: abertos, separando: 0, prontos: 0, concluidos: 0, cancelados: 0, atrasados: 0, todos: abertos },
    pagination: { page: 1, limit: 100, total: 0, pages: 0 },
  };
}

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><VendasScreen /></QueryClientProvider>);
  });
  // Deixa as consultas responderem.
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

function abas(tree: any) {
  return tree.root.findByType("ScreenTabs").props.tabs.map((t: any) => ({ key: t.key, label: t.label }));
}

function caminhosPedidos() {
  return mockRequest.mock.calls.map((c) => String(c[0]));
}

beforeEach(() => {
  mockLiberado = false;
  mockUser = { id: "u1", is_staff: false };
  mockCompany = { id: "comp-1", plan: "essencial", module_overrides: {} };
  mockConsolidado = false;
  mockRefreshMe.mockClear();
  mockRequest.mockReset();
  mockRequest.mockImplementation((path: string) => {
    if (path === "/auth/my-permissions") return Promise.resolve({ is_owner: true });
    if (path.indexOf("/pedidos") >= 0) return Promise.resolve(respostaDosPedidos(7));
    return Promise.resolve({});
  });
});

describe("Vendas › aba Pedidos", () => {
  it("1. trava desligada (lojista): as três abas de hoje, nada de Pedidos, nenhuma ida a mais", async () => {
    const tree = await montar();
    expect(abas(tree)).toEqual(ABAS_DE_HOJE);
    expect(tree.root.findAllByType("AbaPedidos").length).toBe(0);
    expect(caminhosPedidos()).toEqual([]);
    expect(mockRefreshMe).not.toHaveBeenCalled();
    const hero = tree.root.findByType("ScreenHero");
    expect(hero.props.live).toBe(true);
  });

  it("2. trava desligada com ?tab=pedidos na URL: abre em Vendas, como hoje", async () => {
    const er = require("expo-router");
    const antes = er.useLocalSearchParams;
    er.useLocalSearchParams = () => ({ tab: "pedidos" });
    try {
      const tree = await montar();
      expect(abas(tree)).toEqual(ABAS_DE_HOJE);
      expect(tree.root.findByType("ScreenTabs").props.active).toBe("vendas");
      expect(tree.root.findAllByType("AbaPedidos").length).toBe(0);
    } finally {
      er.useLocalSearchParams = antes;
    }
  });

  it("3. trava ligada mas sem o módulo (override false): sem a aba", async () => {
    mockLiberado = true;
    mockCompany = { id: "comp-1", plan: "negocio", module_overrides: { "vendas.pedidos": false } };
    const tree = await montar();
    expect(abas(tree)).toEqual(ABAS_DE_HOJE);
    expect(caminhosPedidos().some((p) => p.indexOf("/pedidos") >= 0)).toBe(false);
  });

  it("4. trava ligada, membro sem a permissão de Vendas: sem a aba", async () => {
    mockLiberado = true;
    mockRequest.mockImplementation((path: string) => {
      if (path === "/auth/my-permissions") return Promise.resolve({ is_owner: false, permissions: { pdv: true } });
      return Promise.resolve(respostaDosPedidos(3));
    });
    const tree = await montar();
    expect(abas(tree)).toEqual(ABAS_DE_HOJE);
  });

  it("5. trava ligada e módulo no plano: Pedidos entre Vendas e Ranking, com o número dos abertos", async () => {
    mockLiberado = true;
    const tree = await montar();
    expect(abas(tree)).toEqual([
      { key: "vendas", label: "Vendas" },
      { key: "pedidos", label: "Pedidos 7" },
      { key: "ranking", label: "Ranking" },
      { key: "fechamentos", label: "Fechamentos de caixa" },
    ]);
    expect(mockRefreshMe).toHaveBeenCalledTimes(1);
    expect(caminhosPedidos()).toContain("/companies/comp-1/pedidos?situacao=abertos&limit=100");

    act(() => { tree.root.findByType("ScreenTabs").props.onSelect("pedidos"); });
    expect(tree.root.findAllByType("AbaPedidos").length).toBe(1);
    expect(tree.root.findByType("ScreenHero").props.subtitle).toBe("Pedidos guardados no Caixa.");
  });

  it("6. equipe Aura vê a aba com a trava desligada (QA em produção, como o backend)", async () => {
    mockUser = { id: "u1", is_staff: true };
    const tree = await montar();
    // 25/11/2026 (C4): a equipe Aura também vê a aba Condicionais (mesma regra da trava).
    expect(abas(tree).map((t: any) => t.key)).toEqual(["vendas", "condicionais", "pedidos", "ranking", "fechamentos"]);
  });

  it("7. consolidado: o número da aba vem de /me/pedidos", async () => {
    mockLiberado = true;
    mockConsolidado = true;
    await montar();
    expect(caminhosPedidos()).toContain("/me/pedidos?situacao=abertos&limit=100");
    expect(caminhosPedidos().some((p) => p.indexOf("/companies/") === 0)).toBe(false);
  });
});
