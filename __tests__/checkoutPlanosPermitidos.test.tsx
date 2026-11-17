// p-197: o checkout oferece só os planos do allowed_plans do /billing/status.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
var mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
// getter: os imports sobem antes dos `var mock...`, então o valor é lido só no uso.
jest.mock("@/components/Toast", () => ({ get toast() { return mockToast; } }));

var mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: (...a: any[]) => mockReplace(...a), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

var mockCompany: any = { id: "emp-1", plan: "negocio", billing_cycle: "monthly", billing_status: "trial", cnpj: "", vertical_active: null };
var mockHydrate = jest.fn(async () => {});
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    company: mockCompany,
    hydrate: mockHydrate, logout: jest.fn(), trialActive: true, isDemo: false, isStaff: false,
  }),
}));

var mockBilling: any = {
  status: jest.fn(),
  // Mesmo que a API ainda responda a rota da campanha, o app não a consulta.
  promocaoAtiva: jest.fn(),
  subscribe: jest.fn(),
  tokenize: jest.fn(),
  validateCoupon: jest.fn(),
  invoices: jest.fn(),
  checkoutViewed: jest.fn(async () => ({ registrado: true })),
};
class MockApiError extends Error { data: any; constructor(m: string, data?: any) { super(m); this.data = data; } }
jest.mock("@/services/api", () => ({ get billingApi() { return mockBilling; }, get ApiError() { return MockApiError; } }));
jest.mock("@/services/billingApi", () => ({ get billingApi() { return mockBilling; } }));

import CheckoutScreen from "@/app/(tabs)/checkout";

const espera = (ms = 15) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><CheckoutScreen /></QueryClientProvider>); });
  await espera(); await espera();
  return tree!;
}
const byTestId = (tree: renderer.ReactTestRenderer, id: string) => tree.root.findAllByProps({ testID: id }, { deep: false });
const planos = (tree: renderer.ReactTestRenderer) => ["essencial", "negocio", "expansao"].filter((k) => byTestId(tree, "checkout-plano-" + k).length > 0);
const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockCompany = { id: "emp-1", plan: "negocio", billing_cycle: "monthly", billing_status: "trial", cnpj: "", vertical_active: null };
  (global as any).fetch = jest.fn(async () => ({ json: async () => ({ erro: true }) }));
});
const status = (extra: any) => mockBilling.status.mockResolvedValue({ billing_status: "trial", needs_cpf_cnpj: false, discount: null, ...extra });

describe("Checkout — allowed_plans do /billing/status", () => {
  it("allowed_plans sem o Essencial: a tela não oferece o Essencial nem convite de upgrade", async () => {
    status({ allowed_plans: ["negocio", "expansao"] });
    mockCompany.plan = "essencial";
    const tree = await mount();
    expect(planos(tree)).toEqual(["negocio", "expansao"]);
    expect(text(tree)).not.toContain("Essencial");
    tree.unmount();
  });

  it("loja comum com os três planos: igual a hoje", async () => {
    status({ allowed_plans: ["essencial", "negocio", "expansao"] });
    const tree = await mount();
    expect(planos(tree)).toEqual(["essencial", "negocio", "expansao"]);
    tree.unmount();
  });

  it("sem o campo (backend antigo): três planos para loja comum", async () => {
    status({});
    const tree = await mount();
    expect(planos(tree)).toEqual(["essencial", "negocio", "expansao"]);
    tree.unmount();
  });

  it("sem o campo e vertical Studio: segue a regra de hoje (sem Essencial)", async () => {
    status({});
    mockCompany.vertical_active = "studio";
    const tree = await mount();
    expect(planos(tree)).toEqual(["negocio", "expansao"]);
    tree.unmount();
  });
});
