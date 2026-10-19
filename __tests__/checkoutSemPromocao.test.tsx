// ============================================================
// Checkout sem a campanha PRIMEIROMES (19/10/2026)
//
// Decisão do Caio (19/10): a promoção "Assine até 31/10 e não pague novembro"
// saiu do produto. O checkout mostra só o preço normal e o cupom digitado,
// mesmo que a API ainda devolva uma promoção (backend antigo, cache). Cupom
// digitado, cupom de dias grátis e a mensagem do backend na tela de sucesso
// seguem funcionando.
// ============================================================
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

var mockHydrate = jest.fn(async () => {});
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    company: { id: "emp-1", plan: "negocio", billing_cycle: "monthly", billing_status: "trial", cnpj: "", vertical_active: null },
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

const PROMO_DA_API = {
  codigo: "PRIMEIROMES",
  titulo: "Assine até 31/10 e não pague novembro",
  descricao: "Quem assina até 31/10 não paga novembro: a primeira cobrança só acontece em 01/12/2026.",
  termina_em: "2099-11-01T02:59:59.999Z",
  primeira_cobranca_em: "2026-12-01",
  elegivel: true,
};
const TEXTOS_DA_CAMPANHA = [
  "não pague novembro", "Primeira cobrança em", "1ª cobrança em 01/12", "Hoje: R$ 0",
  "PRIMEIROMES", "a promoção não soma", "Assinar · 1ª cobrança",
];

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
const input = (tree: renderer.ReactTestRenderer, placeholder: string, nth = 0) =>
  tree.root.findAll((n) => n.props.placeholder === placeholder && typeof n.type !== "string")[nth];
async function digita(tree: renderer.ReactTestRenderer, placeholder: string, valor: string, nth = 0) {
  await act(async () => { input(tree, placeholder, nth).props.onChangeText(valor); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBilling.status.mockResolvedValue({ billing_status: "trial", needs_cpf_cnpj: false, discount: null });
  mockBilling.promocaoAtiva.mockResolvedValue(PROMO_DA_API);
  (global as any).fetch = jest.fn(async () => ({ json: async () => ({ erro: true }) }));
});

describe("Checkout — instrumentação (t2-04)", () => {
  it("abrir a tela avisa o backend uma vez, mesmo com vários re-renders (status, quote)", async () => {
    const tree = await mount();
    expect(mockBilling.checkoutViewed).toHaveBeenCalledTimes(1);
    expect(mockBilling.checkoutViewed).toHaveBeenCalledWith("emp-1");
    tree.unmount();
  });
});

describe("Checkout — sem a campanha", () => {
  it("mesmo com a API devolvendo uma promoção elegível, a tela mostra só o preço normal", async () => {
    const tree = await mount();
    expect(byTestId(tree, "checkout-promocao")).toHaveLength(0);
    expect(byTestId(tree, "checkout-promocao-resumo")).toHaveLength(0);
    const out = text(tree);
    for (const t of TEXTOS_DA_CAMPANHA) expect(out).not.toContain(t);
    expect(out).toContain("Gerar Pix - R$ 169,00");
    expect(out).toContain("Total hoje");
    // O app nem pergunta: a rota da campanha deixou de ser chamada.
    expect(mockBilling.promocaoAtiva).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("assinar sem cupom: o app não manda código e a tela segue no Pix com o QR", async () => {
    mockBilling.subscribe.mockResolvedValue({
      plan: "negocio", cycle: "monthly", value: 169, billing_type: "PIX", charged_now: 169,
      pix_qr_code: "QR", pix_copy_paste: "000201", pix_expiration: "2026-10-20T00:00:00Z",
    });
    const tree = await mount();
    await press(tree, "checkout-pagar-pix");

    expect(mockBilling.subscribe).toHaveBeenCalledTimes(1);
    expect(mockBilling.subscribe.mock.calls[0][4].accessCode).toBeUndefined();
    expect(byTestId(tree, "checkout-sucesso-mensagem")).toHaveLength(0);
    expect(text(tree)).toContain("Copiar código Pix");
    tree.unmount();
  });
});

describe("Checkout — cupom digitado", () => {
  it("cupom de desconto: o valor da 1ª cobrança vem do backend e a tela só mostra", async () => {
    mockBilling.validateCoupon.mockResolvedValue({
      valid: true, code: "DEZ", type: "discount", discount_pct: 10,
      first_charge_value: 152.1, recurring_value: 169, first_charge_date: "2026-10-19",
    });
    const tree = await mount();
    await digita(tree, "CUPOM OU CÓDIGO DE INDICAÇÃO", "DEZ");
    await press(tree, "checkout-cupom-aplicar");

    const out = text(tree);
    expect(out).toContain("Gerar Pix - R$ 152,10");
    expect(out).toContain("Mensalidades seguintes: R$ 169,00/mês");
    for (const t of TEXTOS_DA_CAMPANHA) expect(out).not.toContain(t);
    tree.unmount();
  });

  it("cupom de dias grátis no Pix: botão 'Ativar 7 dias grátis', sem QR, mensagem do backend na tela", async () => {
    mockBilling.validateCoupon.mockResolvedValue({
      valid: true, code: "INDICA7", type: "trial", discount_pct: 0, trial_days: 7,
      first_charge_value: 0, recurring_value: 169, first_charge_date: "2026-10-26",
    });
    mockBilling.subscribe.mockResolvedValue({
      plan: "negocio", cycle: "monthly", value: 169, billing_type: "PIX", charged_now: 0,
      coupon: { code: "INDICA7", trial_days: 7, discount_pct: 0 },
      message: "7 dias grátis ativados! A primeira mensalidade de R$ 169,00 será em 26/10/2026.",
    });
    const tree = await mount();
    await digita(tree, "CUPOM OU CÓDIGO DE INDICAÇÃO", "INDICA7");
    await press(tree, "checkout-cupom-aplicar");

    const antes = text(tree);
    expect(antes).toContain("Ativar 7 dias grátis");
    expect(antes).toContain("Você paga hoje");

    await press(tree, "checkout-pagar-pix");
    expect(mockBilling.subscribe.mock.calls[0][4].accessCode).toBe("INDICA7");
    expect(text(tree)).toContain("A primeira mensalidade de R$ 169,00 será em 26/10/2026.");
    expect(mockHydrate).toHaveBeenCalled();
    await act(async () => { byTestId(tree, "checkout-sucesso-continuar")[0].props.onPress(); });
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/");
    tree.unmount();
  });

  it("PRIMEIROMES digitado à mão (campanha encerrada): texto genérico de dias grátis, sem frase da promoção", async () => {
    mockBilling.validateCoupon.mockResolvedValue({
      valid: true, code: "PRIMEIROMES", type: "trial", discount_pct: 0, trial_days: 49,
      first_charge_value: 0, recurring_value: 169, first_charge_date: "2026-12-01",
    });
    const tree = await mount();
    await digita(tree, "CUPOM OU CÓDIGO DE INDICAÇÃO", "PRIMEIROMES");
    await press(tree, "checkout-cupom-aplicar");

    const out = text(tree);
    expect(out).toContain("49 dias grátis");
    expect(out).not.toContain("Promoção PRIMEIROMES");
    expect(out).not.toContain("não pague novembro");
    tree.unmount();
  });
});

describe("Checkout — cartão", () => {
  it("a mensagem do backend aparece na tela de sucesso e no toast", async () => {
    const MSG = "Assinatura ativada! Seu cartão ficou salvo.";
    mockBilling.tokenize.mockResolvedValue({ credit_card_token: "tok_1" });
    mockBilling.subscribe.mockResolvedValue({
      plan: "negocio", cycle: "monthly", value: 169, billing_type: "CREDIT_CARD", charged_now: 169, message: MSG,
    });
    const tree = await mount();
    await press(tree, "checkout-metodo-cartao");

    await digita(tree, "0000 0000 0000 0000", "4111111111111111");
    await digita(tree, "MM/AA", "1230");
    await digita(tree, "123", "123", 0);       // CVV
    await digita(tree, "NOME DO TITULAR", "TESTE DA SILVA");
    await digita(tree, "000.000.000-00", "52998224725");
    await digita(tree, "00000-000", "01001000");
    await digita(tree, "123", "10", 1);        // número
    await digita(tree, "Rua...", "Praça da Sé");
    await espera();

    expect(text(tree)).toContain("Assinar Agora - R$ 169,00");
    await press(tree, "checkout-pagar-cartao");

    expect(mockBilling.tokenize).toHaveBeenCalledTimes(1);
    expect(mockBilling.subscribe).toHaveBeenCalledTimes(1);
    expect(text(tree)).toContain(MSG);
    expect(mockToast.success).toHaveBeenCalledWith(MSG);
    tree.unmount();
  });
});
