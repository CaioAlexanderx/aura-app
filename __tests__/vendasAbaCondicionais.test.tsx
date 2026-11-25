// ============================================================
// Vendas › aba Condicionais atrás da trava e do módulo (C4, 25/11/2026)
//
// Regra do card: com a trava CONDICIONAL_LIBERADA desligada, ou sem o módulo
// vendas.condicionais (plano, override ou permissão), a aba não existe e a
// tela de Vendas fica IDÊNTICA à de hoje: as mesmas abas, na mesma ordem,
// as pílulas rolando de lado no celular, nenhuma ida a /auth/my-permissions
// nem /auth/me a mais. Ligada e com o módulo, a ordem é Vendas ·
// Condicionais · Pedidos · Ranking · Fechamentos de caixa, e as pílulas
// quebram em linhas abaixo de 700 px.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let mockCondicionalLiberada = false;
let mockPedidoLiberado = false;
let mockUser: any = { id: "u1", is_staff: false };
let mockCompany: any = { id: "comp-1", plan: "essencial", module_overrides: {} };
let mockParams: any = {};
const mockRefreshMe = jest.fn(() => Promise.resolve());
const mockRequest = jest.fn();

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/utils/condicionalLiberada", () => {
  const real = jest.requireActual("@/utils/condicionalLiberada");
  return { ...real, condicionalLiberada: (user: any) => real.condicionalLiberada(user, mockCondicionalLiberada) };
});
jest.mock("@/utils/pedidoLiberado", () => {
  const real = jest.requireActual("@/utils/pedidoLiberado");
  return { ...real, pedidoLiberado: (user: any) => real.pedidoLiberado(user, mockPedidoLiberado) };
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
jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams, router: { push: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => {
    const st = {
      user: mockUser, company: mockCompany, token: "t", consolidatedView: false,
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
import { MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import { CONDICIONAL_LIBERADA, MODULO_CONDICIONAIS } from "@/utils/condicionalLiberada";

// A função de verdade (o mock acima só troca o padrão da trava).
const { condicionalLiberada } = jest.requireActual("@/utils/condicionalLiberada");

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><VendasScreen /></QueryClientProvider>);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

function chaves(tree: any) {
  return tree.root.findByType("ScreenTabs").props.tabs.map((t: any) => t.key);
}
function temCondicional(tree: any) {
  return tree.root.findAllByProps({ testID: "aba-condicionais" }).length > 0;
}

beforeEach(() => {
  mockCondicionalLiberada = false;
  mockPedidoLiberado = false;
  mockUser = { id: "u1", is_staff: false };
  mockCompany = { id: "comp-1", plan: "essencial", module_overrides: {} };
  mockParams = {};
  mockRefreshMe.mockClear();
  mockRequest.mockReset();
  mockRequest.mockImplementation((path: string) => {
    if (path === "/auth/my-permissions") return Promise.resolve({ is_owner: true });
    return Promise.resolve({ orders: [], kpis: { abertos: 0 }, counts: {}, pagination: {} });
  });
});

describe("módulo próprio vendas.condicionais", () => {
  it("chave própria no Essencial, acompanha a permissão de Vendas, trava desligada", () => {
    expect(MODULO_CONDICIONAIS).toBe("vendas.condicionais");
    expect(MODULE_PLAN_MAP["vendas.condicionais"]).toBe("essencial");
    expect(PERM_TO_MODULES.vendas).toContain("vendas.condicionais");
    expect(PERM_TO_MODULES.pdv).not.toContain("vendas.condicionais");
    expect(CONDICIONAL_LIBERADA).toBe(false);
    expect(condicionalLiberada({ is_staff: false })).toBe(false);
    expect(condicionalLiberada({ is_staff: true })).toBe(true);
    expect(condicionalLiberada({ is_staff: false }, true)).toBe(true);
  });
});

describe("Vendas › aba Condicionais", () => {
  it("1. trava desligada (lojista): Vendas como hoje, sem aba, sem quebra, nenhuma ida a mais", async () => {
    const tree = await montar();
    expect(chaves(tree)).toEqual(["vendas", "ranking", "fechamentos"]);
    expect(tree.root.findByType("ScreenTabs").props.quebraNoCelular).toBe(false);
    expect(temCondicional(tree)).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockRefreshMe).not.toHaveBeenCalled();
  });

  it("2. trava desligada com ?tab=condicionais: abre em Vendas", async () => {
    mockParams = { tab: "condicionais" };
    const tree = await montar();
    expect(tree.root.findByType("ScreenTabs").props.active).toBe("vendas");
    expect(temCondicional(tree)).toBe(false);
  });

  it("3. trava ligada mas override do módulo false: sem aba e sem quebra", async () => {
    mockCondicionalLiberada = true;
    mockCompany = { id: "comp-1", plan: "negocio", module_overrides: { "vendas.condicionais": false } };
    const tree = await montar();
    expect(chaves(tree)).toEqual(["vendas", "ranking", "fechamentos"]);
    expect(tree.root.findByType("ScreenTabs").props.quebraNoCelular).toBe(false);
  });

  it("4. trava ligada, membro sem a permissão de Vendas: sem aba", async () => {
    mockCondicionalLiberada = true;
    mockRequest.mockImplementation((path: string) => {
      if (path === "/auth/my-permissions") return Promise.resolve({ is_owner: false, permissions: { pdv: true } });
      return Promise.resolve({});
    });
    const tree = await montar();
    expect(chaves(tree)).toEqual(["vendas", "ranking", "fechamentos"]);
  });

  it("5. trava ligada e módulo no plano: Condicionais é a segunda, com quebra no celular", async () => {
    mockCondicionalLiberada = true;
    const tree = await montar();
    expect(chaves(tree)).toEqual(["vendas", "condicionais", "ranking", "fechamentos"]);
    const abas = tree.root.findByType("ScreenTabs");
    expect(abas.props.quebraNoCelular).toBe(true);
    expect(abas.props.tabs[1]).toEqual({ key: "condicionais", label: "Condicionais", testID: "aba-vendas-condicionais" });
    expect(mockRefreshMe).toHaveBeenCalledTimes(1);

    act(() => { abas.props.onSelect("condicionais"); });
    expect(temCondicional(tree)).toBe(true);
    const hero = tree.root.findByType("ScreenHero");
    expect(hero.props.subtitle).toBe("Peças que as clientes levaram para experimentar. Nada é cobrado até ela decidir.");
    expect(hero.props.live).toBe(false);
    expect(hero.props.actions).toBeUndefined();
  });

  it("6. as duas travas ligadas: Vendas · Condicionais · Pedidos · Ranking · Fechamentos", async () => {
    mockCondicionalLiberada = true;
    mockPedidoLiberado = true;
    const tree = await montar();
    expect(chaves(tree)).toEqual(["vendas", "condicionais", "pedidos", "ranking", "fechamentos"]);
  });

  it("7. equipe Aura com as travas desligadas vê as duas abas (QA em produção)", async () => {
    mockUser = { id: "u1", is_staff: true };
    const tree = await montar();
    expect(chaves(tree)).toEqual(["vendas", "condicionais", "pedidos", "ranking", "fechamentos"]);
  });

  it("8. ?tab=condicionais com a aba liberada abre nela; estado vazio com o texto do mockup", async () => {
    mockCondicionalLiberada = true;
    mockParams = { tab: "condicionais" };
    const tree = await montar();
    expect(tree.root.findByType("ScreenTabs").props.active).toBe("condicionais");
    const textos = tree.root.findAll((n: any) => typeof n.props?.children === "string").map((n: any) => n.props.children);
    expect(textos).toContain("Nenhuma condicional por aqui");
    expect(textos).toContain("Quando uma cliente quiser levar peças para experimentar em casa, registre aqui. A loja sabe o que saiu, com quem está e até quando volta.");
    // Sem cadeado, sem convite e sem botão sem destino nesta fase.
    expect(tree.root.findAll((n: any) => n.type === "Icon").filter((n: any) => n.props.name === "lock").length).toBe(0);
  });
});
