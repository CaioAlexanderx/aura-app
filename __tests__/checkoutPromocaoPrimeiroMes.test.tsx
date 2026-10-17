// ============================================================
// Checkout × promoção "primeiro mês pelo calendário" (13/10/2026)
//
// Quem assina até 31/10 não paga novembro: a 1ª cobrança é em 01/12. O backend
// (#808) aplica o cupom PRIMEIROMES sozinho e responde GET /promocao-ativa.
// O checkout só mostra: aviso no topo + "Hoje: R$ 0 · a partir de 01/12" no
// resumo; com erro de API ou elegivel:false a tela fica como sempre foi.
// Depois de assinar, a mensagem do backend aparece na tela de sucesso.
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

var mockBilling = {
  status: jest.fn(),
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
import { _resetPromocaoAtiva } from "@/hooks/usePromocaoAtiva";

const PROMO = {
  codigo: "PRIMEIROMES",
  titulo: "Assine até 31/10 e não pague novembro",
  descricao: "Quem assina até 31/10 não paga novembro: a primeira cobrança só acontece em 01/12/2026.",
  termina_em: "2099-11-01T02:59:59.999Z",
  primeira_cobranca_em: "2026-12-01",
  elegivel: true,
};
const MENSAGEM = "Promoção PRIMEIROMES aplicada! Nenhuma cobrança até 01/12/2026 — a primeira mensalidade de R$ 169,00 será nessa data.";

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
  _resetPromocaoAtiva();
  mockBilling.status.mockResolvedValue({ billing_status: "trial", needs_cpf_cnpj: false, discount: null });
  mockBilling.promocaoAtiva.mockResolvedValue(PROMO);
  (global as any).fetch = jest.fn(async () => ({ json: async () => ({ erro: true }) }));
});

describe("Checkout — instrumentação (t2-04)", () => {
  it("abrir a tela avisa o backend uma vez, mesmo com vários re-renders (status, promoção, quote)", async () => {
    const tree = await mount();
    expect(mockBilling.checkoutViewed).toHaveBeenCalledTimes(1);
    expect(mockBilling.checkoutViewed).toHaveBeenCalledWith("emp-1");
    tree.unmount();
  });
});

describe("Checkout — aviso da promoção", () => {
  it("elegível: aviso no topo com título, descrição e data; resumo mostra Hoje R$ 0 e o valor a partir de 01/12", async () => {
    const tree = await mount();
    expect(mockBilling.promocaoAtiva).toHaveBeenCalledWith("emp-1");
    expect(byTestId(tree, "checkout-promocao")).toHaveLength(1);
    const out = text(tree);
    expect(out).toContain(PROMO.titulo);
    expect(out).toContain(PROMO.descricao);
    expect(out).toContain("Primeira cobrança em 01/12");
    expect(out).toContain("Hoje: R$ 0 · a partir de 01/12: R$ 169,00");
    // Hoje não se cobra nada: o botão não promete valor.
    expect(out).toContain("Assinar · 1ª cobrança em 01/12");
    expect(out).not.toContain("Gerar Pix - R$ 169,00");
    tree.unmount();
  });

  it("inelegível (elegivel:false): nada muda na tela", async () => {
    mockBilling.promocaoAtiva.mockResolvedValue({ ...PROMO, elegivel: false });
    const tree = await mount();
    expect(byTestId(tree, "checkout-promocao")).toHaveLength(0);
    expect(byTestId(tree, "checkout-promocao-resumo")).toHaveLength(0);
    const out = text(tree);
    expect(out).not.toContain("Hoje: R$ 0");
    expect(out).toContain("Gerar Pix - R$ 169,00");
    tree.unmount();
  });

  it("erro de API: nada muda na tela e nada quebra", async () => {
    mockBilling.promocaoAtiva.mockRejectedValue(new Error("500"));
    const tree = await mount();
    expect(byTestId(tree, "checkout-promocao")).toHaveLength(0);
    expect(text(tree)).toContain("Gerar Pix - R$ 169,00");
    expect(mockToast.error).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("com cupom comum aplicado, vale o cupom: o resumo deixa de falar da promoção", async () => {
    mockBilling.validateCoupon.mockResolvedValue({
      valid: true, code: "DEZ", type: "discount", discount_pct: 10,
      first_charge_value: 152.1, recurring_value: 169, first_charge_date: "2026-10-13",
    });
    const tree = await mount();
    await digita(tree, "CUPOM OU CÓDIGO DE INDICAÇÃO", "DEZ");
    await press(tree, "checkout-cupom-aplicar");

    expect(byTestId(tree, "checkout-promocao-resumo")).toHaveLength(0);
    const out = text(tree);
    expect(out).toContain("Você aplicou um cupom: vale o cupom, a promoção não soma.");
    expect(out).toContain("Gerar Pix - R$ 152,10");
    tree.unmount();
  });
});

describe("Checkout — tela de sucesso com a mensagem do backend", () => {
  it("Pix: promoção aplicada pelo backend → sem QR, sem polling, mensagem na tela", async () => {
    mockBilling.subscribe.mockResolvedValue({
      plan: "negocio", cycle: "monthly", value: 169, billing_type: "PIX", charged_now: 0,
      coupon: { code: "PRIMEIROMES", trial_days: 49, discount_pct: 0, discount_amount: 169, automatic: true, campaign: true, first_charge_date: "2026-12-01" },
      message: MENSAGEM,
    });
    const tree = await mount();
    await press(tree, "checkout-pagar-pix");

    // Nenhum cupom foi digitado: o app não manda código, o backend aplica sozinho.
    expect(mockBilling.subscribe).toHaveBeenCalledTimes(1);
    expect(mockBilling.subscribe.mock.calls[0][0]).toBe("emp-1");
    expect(mockBilling.subscribe.mock.calls[0][4].accessCode).toBeUndefined();

    const msg = byTestId(tree, "checkout-sucesso-mensagem");
    expect(msg).toHaveLength(1);
    expect(text(tree)).toContain(MENSAGEM);
    expect(mockHydrate).toHaveBeenCalled();
    // Com mensagem para ler, "Continuar" leva embora na hora.
    expect(byTestId(tree, "checkout-sucesso-continuar")).toHaveLength(1);
    await act(async () => { byTestId(tree, "checkout-sucesso-continuar")[0].props.onPress(); });
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/");
    tree.unmount();
  });

  it("Cartão: a mensagem do backend também aparece", async () => {
    mockBilling.tokenize.mockResolvedValue({ credit_card_token: "tok_1" });
    mockBilling.subscribe.mockResolvedValue({
      plan: "negocio", cycle: "monthly", value: 169, billing_type: "CREDIT_CARD", charged_now: 0,
      coupon: { code: "PRIMEIROMES", trial_days: 49, discount_pct: 0, automatic: true, campaign: true, first_charge_date: "2026-12-01" },
      message: MENSAGEM + " Seu cartão ficou salvo.",
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

    await press(tree, "checkout-pagar-cartao");

    expect(mockBilling.tokenize).toHaveBeenCalledTimes(1);
    expect(mockBilling.subscribe).toHaveBeenCalledTimes(1);
    expect(text(tree)).toContain(MENSAGEM + " Seu cartão ficou salvo.");
    expect(mockToast.success).toHaveBeenCalledWith(MENSAGEM + " Seu cartão ficou salvo.");
    tree.unmount();
  });

  it("assinatura comum (sem cupom): tela de sucesso como antes, sem mensagem nem botão Continuar", async () => {
    mockBilling.promocaoAtiva.mockResolvedValue({ ...PROMO, elegivel: false });
    mockBilling.subscribe.mockResolvedValue({
      plan: "negocio", cycle: "monthly", value: 169, billing_type: "PIX", charged_now: 169,
      pix_qr_code: "QR", pix_copy_paste: "000201", pix_expiration: "2026-10-14T00:00:00Z",
    });
    const tree = await mount();
    await press(tree, "checkout-pagar-pix");
    // Veio QR: a tela segue no Pix, esperando o pagamento — não é sucesso.
    expect(byTestId(tree, "checkout-sucesso-mensagem")).toHaveLength(0);
    expect(text(tree)).toContain("Copiar código Pix");
    tree.unmount();
  });
});
