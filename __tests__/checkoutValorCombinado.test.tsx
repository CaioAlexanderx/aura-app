// ============================================================
// Checkout × valor combinado da empresa (14/10/2026)
//
// GET /companies/:id/billing/quote devolve custom:true com o valor mensal que
// a equipe combinou (caso Luis Henrique: R$ 211,20, Negócio anual). O checkout
// mostra o selo "Valor combinado", "R$ X por mês" e o valor nos botões. Sem a
// rota (404), com erro ou custom:false, a tela fica no cálculo de tabela —
// o checkout é caminho de cobrança e nunca pode quebrar por causa disto.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
var mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("@/components/Toast", () => ({ get toast() { return mockToast; } }));

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

var mockCompany: any = {};
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    company: mockCompany,
    hydrate: jest.fn(async () => {}), logout: jest.fn(), trialActive: false, isDemo: false, isStaff: false,
  }),
}));

var mockBilling: any = {
  status: jest.fn(),
  promocaoAtiva: jest.fn(),
  quote: jest.fn(),
  subscribe: jest.fn(),
  tokenize: jest.fn(),
  validateCoupon: jest.fn(),
  invoices: jest.fn(),
};
class MockApiError extends Error { data: any; constructor(m: string, data?: any) { super(m); this.data = data; } }
jest.mock("@/services/api", () => ({ get billingApi() { return mockBilling; }, get ApiError() { return MockApiError; } }));
jest.mock("@/services/billingApi", () => ({ get billingApi() { return mockBilling; } }));

import CheckoutScreen from "@/app/(tabs)/checkout";
import { _resetPromocaoAtiva } from "@/hooks/usePromocaoAtiva";

const espera = (ms = 15) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><CheckoutScreen /></QueryClientProvider>);
  });
  await espera();
  await espera();
  return tree!;
}
const byTestId = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAllByProps({ testID: id }, { deep: false });
const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());
async function press(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { await byTestId(tree, id)[0].props.onPress(); });
  await espera();
}

const COTACAO = { plan: "negocio", cycle: "annual", value: 211.2, custom: true, table_value: 159.83 };

beforeEach(() => {
  jest.clearAllMocks();
  _resetPromocaoAtiva();
  // Negócio anual com 1 acesso extra: tabela = 140,83 + 19 = R$ 159,83.
  mockCompany = { id: "emp-1", plan: "negocio", billing_cycle: "annual", billing_status: "pending", cnpj: "", vertical_active: null, extra_seats_granted: 1 };
  mockBilling.status.mockResolvedValue({ billing_status: "pending", needs_cpf_cnpj: false, discount: null });
  mockBilling.promocaoAtiva.mockResolvedValue(null);
  (global as any).fetch = jest.fn(async () => ({ json: async () => ({ erro: true }) }));
});

describe("Checkout — valor combinado", () => {
  it("custom:true: selo, R$ X por mês e o valor nos botões; some a conta de tabela e dos acessos extras", async () => {
    mockBilling.quote.mockResolvedValue(COTACAO);
    const tree = await mount();

    expect(mockBilling.quote).toHaveBeenCalledWith("emp-1", "negocio", "annual", "PIX");
    expect(byTestId(tree, "checkout-valor-combinado")).toHaveLength(1);
    const out = text(tree);
    expect(out).toContain("Valor combinado");
    expect(out).toContain("R$ 211,20 por mês");
    expect(out).toContain("Gerar Pix - R$ 211,20");
    // O valor combinado já inclui os acessos extras e não mostra a tabela.
    expect(out).not.toContain("R$ 19,00/mes");
    expect(out).not.toContain("159,83");
    expect(out).not.toContain("economia de");
    tree.unmount();
  });

  it("troca para cartão: pede a cotação da forma CREDIT_CARD e o botão leva o valor combinado", async () => {
    mockBilling.quote.mockResolvedValue(COTACAO);
    const tree = await mount();
    await press(tree, "checkout-metodo-cartao");
    await espera();

    expect(mockBilling.quote).toHaveBeenCalledWith("emp-1", "negocio", "annual", "CREDIT_CARD");
    expect(text(tree)).toContain("Assinar Agora - R$ 211,20");
    tree.unmount();
  });

  it("endpoint ausente (erro): o checkout segue no cálculo de tabela, sem selo e sem aviso", async () => {
    mockBilling.quote.mockRejectedValue(new MockApiError("404 not found"));
    const tree = await mount();

    expect(byTestId(tree, "checkout-valor-combinado")).toHaveLength(0);
    const out = text(tree);
    expect(out).toContain("Gerar Pix - R$ 159,83");
    expect(out).toContain("R$ 19,00/mes");
    expect(mockToast.error).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("camada de API sem o método quote (versão antiga): não quebra", async () => {
    const guardado = mockBilling.quote;
    mockBilling.quote = undefined;
    const tree = await mount();
    expect(text(tree)).toContain("Gerar Pix - R$ 159,83");
    mockBilling.quote = guardado;
    tree.unmount();
  });

  it("custom:false: tabela, sem selo", async () => {
    mockBilling.quote.mockResolvedValue({ ...COTACAO, custom: false, value: 159.83 });
    const tree = await mount();
    expect(byTestId(tree, "checkout-valor-combinado")).toHaveLength(0);
    expect(text(tree)).toContain("Gerar Pix - R$ 159,83");
    tree.unmount();
  });

  it("cupom sobre o valor combinado: o backend manda o valor da 1ª cobrança e a tela só mostra", async () => {
    mockBilling.quote.mockResolvedValue(COTACAO);
    mockBilling.validateCoupon.mockResolvedValue({
      valid: true, code: "DEZ", type: "discount", discount_pct: 10,
      first_charge_value: 190.08, recurring_value: 211.2, first_charge_date: "2026-10-14",
    });
    const tree = await mount();
    const campo = tree.root.findAll((n) => n.props.placeholder === "CUPOM OU CÓDIGO DE INDICAÇÃO" && typeof n.type !== "string")[0];
    await act(async () => { campo.props.onChangeText("DEZ"); });
    await press(tree, "checkout-cupom-aplicar");

    const out = text(tree);
    expect(out).toContain("Gerar Pix - R$ 190,08");
    expect(out).toContain("Mensalidades seguintes: R$ 211,20/mês");
    tree.unmount();
  });
});
