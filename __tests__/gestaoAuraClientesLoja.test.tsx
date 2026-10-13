// ============================================================
// Gestão Aura › Clientes com ?loja= (13/10/2026)
//
// "Abrir cliente" na ficha da tela Hoje levava à lista de Clientes: a rota não
// aceitava parâmetro. Agora /gestao-aura-clientes?loja=<company_id> abre o
// painel lateral da loja e, se ela está em outra aba (vencidos, clientes...),
// muda para a aba certa — é a aba que aparece ao voltar para a lista.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
var mockToastInfo = jest.fn();
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: (...a: any[]) => mockToastInfo(...a) } }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));
jest.mock("@/components/admin/ResyncSubscriptionButton", () => ({ ResyncSubscriptionButton: "Resync" }));
jest.mock("@/components/admin/FrenteSection", () => ({
  FrenteSection: "FrenteSection", STUDIO_PLAN_MSG: "Studio exige Negócio+", isStudioPlanError: () => false,
}));
jest.mock("@/hooks/useVisibleModules", () => ({ MODULE_PLAN_MAP: {}, PLAN_LEVEL: {} }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ token: "t", isStaff: true, company: null }),
}));

// O barrel traz todas as telas admin (seletor de arquivo etc.): só o ClientsAdmin importa aqui.
jest.mock("@/components/admin", () => ({ ClientsAdmin: require("@/components/admin/ClientsAdmin").ClientsAdmin }));

var mockParams: Record<string, any> = {};
var mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));

var mockRequest = jest.fn();
jest.mock("@/services/api", () => ({
  request: (...a: any[]) => mockRequest(...a),
  adminApi: {
    notes: { list: jest.fn(async () => ({ notes: [] })), create: jest.fn() },
    extendTrial: jest.fn(),
    subVerticalOptions: jest.fn(async () => ({ by_vertical: {} })),
  },
}));

import GestaoAuraClientesScreen from "@/app/(tabs)/gestao-aura-clientes";

const at = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const base = {
  plan: "negocio", is_active: true, billing_status: "trial", billing_cycle: "monthly",
  module_overrides: null, tax_regime: "mei", owner_email: "a@b.com", owner_name: "Dona",
  health_score: null, risk_level: null, tx_count: 0, prod_count: 0, cust_count: 0, total_revenue: 0,
  activity_score: 0, usage_score: 0, payment_score: 0, adoption_score: 0,
  vertical_active: null, legal_name: "", sale_count: 0, login_days: 0, created_at: at(-30),
};
const CLIENTES = [
  { ...base, id: "em-trial", trade_name: "Loja do Trial", stage: "trial", trial_ends_at: at(3) },
  { ...base, id: "vencida", trade_name: "Loja Vencida", stage: "vencido", trial_ends_at: at(-4) },
  { ...base, id: "paga", trade_name: "Loja Paga", stage: "cliente", billing_status: "active", trial_ends_at: at(-60) },
];

async function mount(params: Record<string, any>) {
  mockParams = params;
  mockRequest.mockImplementation(async (path: string) => {
    if (path === "/admin/clients-360") return { total: CLIENTES.length, clients: CLIENTES };
    return {
      usage: { total_transactions: 0, tx_30d: 0, total_sales: 0, total_revenue: 0, total_products: 0, total_customers: 0, active_employees: 0 },
      features_used: [], features_count: 0, recent_transactions: [],
    };
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><GestaoAuraClientesScreen /></QueryClientProvider>);
  });
  // Espera a lista chegar (o esqueleto some), sem depender de quantos ticks isso leva.
  for (let i = 0; i < 30 && tree!.root.findAllByType("ListSkeleton" as any).length > 0; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
  await act(async () => { await Promise.resolve(); });
  return tree!;
}

const byTestId = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAllByProps({ testID: id }, { deep: false });
const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());
async function press(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { byTestId(tree, id)[0].props.onPress(); });
  await act(async () => { await Promise.resolve(); });
}
/** Linhas de cliente visíveis na lista (a aba ativa). */
const linhas = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("client-row-") && typeof n.type !== "string")
    .map((n) => n.props.testID as string)
    .filter((v, i, a) => a.indexOf(v) === i);

beforeEach(() => { mockToastInfo.mockClear(); mockPush.mockClear(); });

describe("gestao-aura-clientes ?loja=", () => {
  it("sem ?loja a tela abre a lista na aba de trial, sem painel", async () => {
    const tree = await mount({});
    expect(byTestId(tree, "client-voltar")).toHaveLength(0);
    expect(linhas(tree)).toEqual(["client-row-em-trial"]);
    tree.unmount();
  });

  it("?loja de um cliente pagante abre o painel dele e, ao voltar, a aba é Clientes", async () => {
    const tree = await mount({ loja: "paga" });
    expect(byTestId(tree, "client-voltar")).toHaveLength(1);
    expect(text(tree)).toContain("Loja Paga");
    expect(text(tree)).not.toContain("Loja do Trial");

    await press(tree, "client-voltar");
    expect(linhas(tree)).toEqual(["client-row-paga"]);
    tree.unmount();
  });

  it("?loja de um trial vencido abre o painel e leva à aba Vencidos", async () => {
    const tree = await mount({ loja: "vencida" });
    expect(text(tree)).toContain("Loja Vencida");

    await press(tree, "client-voltar");
    expect(linhas(tree)).toEqual(["client-row-vencida"]);
    tree.unmount();
  });

  it("?loja de quem está em trial fica na aba Em trial", async () => {
    const tree = await mount({ loja: "em-trial" });
    expect(text(tree)).toContain("Loja do Trial");

    await press(tree, "client-voltar");
    expect(linhas(tree)).toEqual(["client-row-em-trial"]);
    tree.unmount();
  });

  it("na web o parâmetro pode vir como lista: vale o primeiro", async () => {
    const tree = await mount({ loja: ["paga", "vencida"] });
    expect(text(tree)).toContain("Loja Paga");
    tree.unmount();
  });

  it("loja que não está na lista volta à lista com um aviso, sem painel vazio", async () => {
    const tree = await mount({ loja: "nao-existe" });
    expect(byTestId(tree, "client-voltar")).toHaveLength(0);
    expect(linhas(tree)).toEqual(["client-row-em-trial"]);
    expect(mockToastInfo).toHaveBeenCalledTimes(1);
    expect(mockToastInfo.mock.calls[0][0]).toContain("Não encontrei essa loja");
    tree.unmount();
  });

  it("a aba só é aplicada uma vez: depois de voltar, trocar de aba não é desfeito", async () => {
    const tree = await mount({ loja: "paga" });
    await press(tree, "client-voltar");
    await press(tree, "stage-tab-vencido");
    expect(linhas(tree)).toEqual(["client-row-vencida"]);
    tree.unmount();
  });
});
