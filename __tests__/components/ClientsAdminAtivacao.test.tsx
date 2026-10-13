// ============================================================
// Gestão Aura › Clientes — funil do trial (12/10/2026)
//
// O self-service converteu 0 de 21 contas e a tela não dizia em que degrau
// cada conta parou. O slide-over mostra a seção "Ativação" (importou estoque
// → abriu o Caixa → vendeu → viu o checkout + último acesso) e os cards de
// trial/vencido mostram os quatro pontos numa linha compacta. Cliente
// pagante não ganha a linha.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));
jest.mock("@/components/admin/ResyncSubscriptionButton", () => ({ ResyncSubscriptionButton: "Resync" }));
jest.mock("@/components/admin/FrenteSection", () => ({
  FrenteSection: "FrenteSection", STUDIO_PLAN_MSG: "Studio exige Negócio+", isStudioPlanError: () => false,
}));
jest.mock("@/hooks/useVisibleModules", () => ({ MODULE_PLAN_MAP: {}, PLAN_LEVEL: {} }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ token: "t", isStaff: true, company: null }),
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

import { ClientsAdmin } from "@/components/admin/ClientsAdmin";

const at = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const base = {
  plan: "negocio", is_active: true, billing_status: "trial", billing_cycle: "monthly",
  module_overrides: null, tax_regime: "mei", owner_email: "a@b.com", owner_name: "Dona",
  health_score: null, risk_level: null, tx_count: 0, prod_count: 0, cust_count: 0, total_revenue: 0,
  activity_score: 0, usage_score: 0, payment_score: 0, adoption_score: 0,
  vertical_active: null, legal_name: "", sale_count: 0, login_days: 0,
};
const PARCIAL = {
  ...base, id: "parcial", trade_name: "Loja Parcial", stage: "trial", created_at: at(-5), trial_ends_at: at(2),
  prod_count: 4, imported_rows: 180, caixa_sessions: 2, last_caixa_at: at(-3),
  first_sale_at: null, sale_count: 0, checkout_viewed_at: null, checkout_views: 0,
  login_days: 3, last_login_at: at(-2), last_active_at: at(-1),
  ativacao: { importou: true, abriu_caixa: true, vendeu: false, viu_checkout: false },
};
const PAGANTE = {
  ...base, id: "paga", trade_name: "Cliente Pagante", stage: "cliente", billing_status: "active",
  created_at: at(-100), trial_ends_at: at(-70), prod_count: 300, sale_count: 900,
  ativacao: { importou: true, abriu_caixa: true, vendeu: true, viu_checkout: true },
};

async function mount() {
  mockRequest.mockImplementation(async (path: string) => {
    if (path === "/admin/clients-360") return { total: 2, clients: [PARCIAL, PAGANTE] };
    return {
      usage: { total_transactions: 0, tx_30d: 0, total_sales: 0, total_revenue: 0, total_products: 4, total_customers: 0, active_employees: 0 },
      features_used: [], features_count: 0, recent_transactions: [],
    };
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><ClientsAdmin /></QueryClientProvider>);
  });
  await act(async () => { await Promise.resolve(); });
  return tree!;
}

// testID no nível do componente (deep:false), como os outros testes da tela.
const byTestId = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAllByProps({ testID: id }, { deep: false });
const idsStartingWith = (tree: renderer.ReactTestRenderer, prefix: string) =>
  tree.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith(prefix) && typeof n.type !== "string")
    .map((n) => n.props.testID as string)
    .filter((v, i, a) => a.indexOf(v) === i);
const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

async function press(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { byTestId(tree, id)[0].props.onPress(); });
  await act(async () => { await Promise.resolve(); });
}

describe("ClientsAdmin — Ativação", () => {
  it("card de trial mostra os quatro pontos; pagante não", async () => {
    const tree = await mount();
    expect(byTestId(tree, "client-ativacao-parcial")).toHaveLength(1);
    expect(idsStartingWith(tree, "client-ativacao-parcial-")).toEqual([
      "client-ativacao-parcial-importou-feito",
      "client-ativacao-parcial-abriu_caixa-feito",
      "client-ativacao-parcial-vendeu-pendente",
      "client-ativacao-parcial-viu_checkout-pendente",
    ]);
    const out = text(tree);
    for (const label of ["estoque", "caixa", "venda", "checkout"]) expect(out).toContain(label);

    await press(tree, "stage-tab-cliente");
    expect(byTestId(tree, "client-row-paga")).toHaveLength(1);
    expect(byTestId(tree, "client-ativacao-paga")).toHaveLength(0);
    expect(idsStartingWith(tree, "client-ativacao-")).toEqual([]);
    tree.unmount();
  });

  it("slide-over mostra a seção Ativação acima de Estender trial, com os pontos certos", async () => {
    const tree = await mount();
    await press(tree, "client-row-parcial");

    expect(byTestId(tree, "ativacao-secao")).toHaveLength(1);
    expect(idsStartingWith(tree, "ativacao-passo-")).toEqual([
      "ativacao-passo-importou-feito",
      "ativacao-passo-abriu_caixa-feito",
      "ativacao-passo-vendeu-pendente",
      "ativacao-passo-viu_checkout-pendente",
    ]);

    const out = text(tree);
    expect(out).toContain("Importou estoque");
    expect(out).toContain("4 produtos · 180 linhas importadas");
    expect(out).toContain("Abriu o Caixa");
    expect(out).toContain("2 vezes · último ");
    expect(out).toContain("nenhuma venda");
    expect(out).toContain("não chegou");
    expect(out).toMatch(/Último acesso: \d\d\/\d\d \(ha 1 dia\) · 3 dias com login/);
    // Logo acima de "Estender trial".
    expect(out.indexOf("Ativação")).toBeGreaterThan(-1);
    expect(out.indexOf("Ativação")).toBeLessThan(out.indexOf("Estender trial"));
    tree.unmount();
  });
});
