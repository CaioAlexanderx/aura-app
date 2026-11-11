// ============================================================
// Checkout · acessos de funcionário adicionais (p-106, 11/11/2026)
//
// Contrato do backend: Aura-backend#999. Aqui:
//   · o seletor abre com os acessos atuais (quote com extra_seats=0), vai de
//     0 a 10 e traz a frase do plano ao lado;
//   · o resumo mostra "N acessos de funcionário adicionais" (R$ 19 × N) e os
//     de temporada numa linha própria; o total vem do backend;
//   · o cupom abate só o plano (o valor vem do backend mockado);
//   · valor combinado: sem seletor e sem extra_seats;
//   · loja ativa e em dia no mesmo plano: travado; 409 ASSINATURA_ATIVA:
//     a mensagem do backend e o seletor travado no valor atual;
//   · extra_seats vai no quote, no validate-coupon e no subscribe (Pix e
//     cartão); depois de assinar, o aviso de que liberam no pagamento.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
var mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("@/components/Toast", () => ({ get toast() { return mockToast; } }));

var mockReplace = jest.fn();
var mockParams: Record<string, any> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: (...a: any[]) => mockReplace(...a), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

var mockCompany: any = {};
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    company: mockCompany, refreshMe: jest.fn(async () => {}),
    hydrate: jest.fn(async () => {}), logout: jest.fn(), trialActive: false, isDemo: false, isStaff: false,
  }),
}));

var mockBilling: any = {
  status: jest.fn(), quote: jest.fn(), subscribe: jest.fn(), tokenize: jest.fn(),
  validateCoupon: jest.fn(), invoices: jest.fn(), checkoutViewed: jest.fn(async () => ({ registrado: true })),
};
class MockApiError extends Error { data: any; constructor(m: string, data?: any) { super(m); this.data = data; } }
jest.mock("@/services/api", () => ({ get billingApi() { return mockBilling; }, get ApiError() { return MockApiError; } }));
jest.mock("@/services/billingApi", () => ({ get billingApi() { return mockBilling; } }));

import CheckoutScreen from "@/app/(tabs)/checkout";
import {
  textoAoLadoDoSeletor, oQueOPlanoInclui, seletorDaCotacao, totalDaCotacaoComAcessos,
  rotuloDosAcessosExtras, rotuloDosAcessosDaTemporada, precoDoPlanoNaCotacao,
} from "@/components/billing/textosDoCheckout";

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
const byTestId = (tree: renderer.ReactTestRenderer, id: string) => tree.root.findAllByProps({ testID: id }, { deep: false });
const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());
const valor = (tree: renderer.ReactTestRenderer) => byTestId(tree, "checkout-acessos-valor")[0].props.children;
async function press(tree: renderer.ReactTestRenderer, id: string, vezes = 1) {
  for (let i = 0; i < vezes; i++) {
    await act(async () => { await byTestId(tree, id)[0].props.onPress(); });
    await espera();
  }
}
async function aplicaCupom(tree: renderer.ReactTestRenderer, codigo: string) {
  await act(async () => { byTestId(tree, "checkout-cupom-campo")[0].props.onChangeText(codigo); });
  await press(tree, "checkout-cupom-aplicar");
}

const TABELA: Record<string, Record<string, number>> = {
  essencial: { monthly: 89, annual: 74.17 }, negocio: { monthly: 169, annual: 140.83 }, expansao: { monthly: 269, annual: 224.17 },
};
const INCLUIDOS: Record<string, number> = { essencial: 1, negocio: 3, expansao: 5 };
const r2 = (v: number) => Math.round(v * 100) / 100;

// /billing/quote do Aura-backend#999. `ajuste` soma ao value (prova que o
// total é o do backend, não a conta local).
function cotacaoP106(o: { atuais?: number; temporada?: number; combinado?: number | null; ajuste?: number } = {}) {
  const atuais = o.atuais || 0;
  const temporada = o.temporada || 0;
  return async (_cid: string, plan: string, cycle: string, billingType: string, extra?: number) => {
    const base = TABELA[plan][cycle];
    if (typeof extra !== "number") {
      const v = r2(base + 19 * (atuais + temporada));
      return { plan, cycle, billing_type: billingType, value: v, custom: false, table_value: v, extra_seats: atuais + temporada };
    }
    const seletor = { current_extra_seats: o.combinado ? atuais + temporada : atuais, pending_extra_seats: null, max_extra_seats: 10, seat_price: 19, plan_included_seats: INCLUIDOS[plan] };
    if (o.combinado) {
      const granted = atuais + temporada;
      return { plan, cycle, billing_type: billingType, value: o.combinado, custom: true, table_value: r2(base + 19 * granted), extra_seats: granted, extra_seats_ignored: true, ...seletor };
    }
    const cobrados = extra + temporada;
    const v = r2(base + 19 * cobrados);
    return {
      plan, cycle, billing_type: billingType, value: r2(v + (o.ajuste || 0)), custom: false, table_value: v,
      extra_seats: extra, season_extra_seats: temporada, charged_extra_seats: cobrados, ...seletor,
    };
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockCompany = { id: "emp-1", plan: "negocio", billing_cycle: "monthly", billing_status: "inactive", cnpj: "", vertical_active: null };
  mockBilling.status.mockResolvedValue({ billing_status: "inactive", needs_cpf_cnpj: false, discount: null });
  mockBilling.quote.mockImplementation(cotacaoP106());
  mockBilling.subscribe.mockResolvedValue({ plan: "negocio", cycle: "monthly", value: 169, billing_type: "PIX", pix_qr_code: "QR", pix_copy_paste: "copia", extra_seats_pending: true });
  (global as any).fetch = jest.fn(async () => ({ json: async () => ({ erro: true }) }));
});

describe("seletor", () => {
  it("abre com os acessos atuais (quote com extra_seats=0) e a frase do plano ao lado", async () => {
    mockBilling.quote.mockImplementation(cotacaoP106({ atuais: 2 }));
    const tree = await mount();
    expect(mockBilling.quote).toHaveBeenCalledWith("emp-1", "negocio", "monthly", "PIX", 0);
    expect(byTestId(tree, "checkout-acessos")).toHaveLength(1);
    expect(valor(tree)).toBe("2");
    expect(text(tree)).toContain(
      "O plano Negócio inclui o seu acesso e mais 2 de funcionário. Precisa de mais? Cada acesso de funcionário adicional custa R$ 19 por mês, em qualquer plano.",
    );
    // Abriu em 2: a cotação da escolha vai com extra_seats=2.
    expect(mockBilling.quote).toHaveBeenCalledWith("emp-1", "negocio", "monthly", "PIX", 2);
    tree.unmount();
  });

  it("a frase acompanha o plano: Essencial 'só o seu acesso', Expansão 'mais 4'", async () => {
    const tree = await mount();
    await press(tree, "checkout-plano-essencial");
    expect(text(tree)).toContain("O plano Essencial inclui só o seu acesso. Precisa de mais?");
    await press(tree, "checkout-plano-expansao");
    expect(text(tree)).toContain("O plano Expansão inclui o seu acesso e mais 4 de funcionário. Precisa de mais?");
    tree.unmount();
  });

  it("limites: não desce de 0 nem passa de 10", async () => {
    const tree = await mount();
    expect(valor(tree)).toBe("0");
    expect(byTestId(tree, "checkout-acessos-menos")[0].props.disabled).toBe(true);
    await press(tree, "checkout-acessos-menos");
    expect(valor(tree)).toBe("0");
    await press(tree, "checkout-acessos-mais", 10);
    expect(valor(tree)).toBe("10");
    expect(byTestId(tree, "checkout-acessos-mais")[0].props.disabled).toBe(true);
    await press(tree, "checkout-acessos-mais");
    expect(valor(tree)).toBe("10");
    expect(byTestId(tree, "checkout-acessos-menos")[0].props.disabled).toBe(false);
    expect(mockBilling.quote).toHaveBeenCalledWith("emp-1", "negocio", "monthly", "PIX", 10);
    expect(mockBilling.quote).not.toHaveBeenCalledWith("emp-1", "negocio", "monthly", "PIX", 11);
    tree.unmount();
  });
});

describe("resumo", () => {
  it("N acessos: a linha R$ 19 × N e o total do backend", async () => {
    // O backend devolve R$ 0,50 a mais que a conta local: a tela mostra o dele.
    mockBilling.quote.mockImplementation(cotacaoP106({ ajuste: 0.5 }));
    const tree = await mount();
    expect(byTestId(tree, "checkout-resumo-acessos")).toHaveLength(0);
    await press(tree, "checkout-acessos-mais", 2);
    expect(byTestId(tree, "checkout-resumo-acessos")).toHaveLength(1);
    const out = text(tree);
    expect(out).toContain("2 acessos de funcionário adicionais");
    expect(out).toContain("R$ 38,00");
    expect(out).toContain("R$ 169,00");
    expect(out).toContain("Gerar Pix de R$ 207,50");
    await press(tree, "checkout-acessos-menos");
    expect(text(tree)).toContain("1 acesso de funcionário adicional");
    expect(text(tree)).toContain("Gerar Pix de R$ 188,50");
    tree.unmount();
  });

  it("acessos de temporada ativos: linha própria, somados ao total", async () => {
    mockBilling.quote.mockImplementation(cotacaoP106({ atuais: 1, temporada: 2 }));
    const tree = await mount();
    expect(valor(tree)).toBe("1");
    expect(byTestId(tree, "checkout-resumo-temporada")).toHaveLength(1);
    const out = text(tree);
    expect(out).toContain("1 acesso de funcionário adicional");
    expect(out).toContain("2 acessos de funcionário para a temporada");
    // Cartão do plano: só o plano (table_value − charged_extra_seats × 19).
    expect(out).toContain("R$ 169,00");
    expect(out).toContain("Gerar Pix de R$ 226,00");
    tree.unmount();
  });

  it("cupom: abate só o plano; o valor vem do backend e revalida ao mudar a quantidade", async () => {
    mockBilling.validateCoupon.mockImplementation(async (_c: string, code: string, _p: string, _ci: string, _b: string, extra?: number) => {
      const n = extra || 0;
      return {
        valid: true, code, type: "promo", discount_pct: 50, discount_months: 1,
        first_charge_value: r2(84.5 + 19 * n), recurring_value: r2(169 + 19 * n), first_charge_date: "2026-11-11",
        extra_seats: n, season_extra_seats: 0, charged_extra_seats: n, seat_price: 19, custom: false,
      };
    });
    const tree = await mount();
    await press(tree, "checkout-acessos-mais", 2);
    await aplicaCupom(tree, "black50");
    expect(mockBilling.validateCoupon).toHaveBeenLastCalledWith("emp-1", "BLACK50", "negocio", "monthly", "PIX", 2);
    let out = text(tree);
    expect(out).toContain("− R$ 84,50");
    expect(out).toContain("Gerar Pix de R$ 122,50");
    expect(out).toContain("Depois, R$ 207,00 por mês. Desconto só na primeira mensalidade.");

    await press(tree, "checkout-acessos-mais");
    await espera();
    expect(mockBilling.validateCoupon).toHaveBeenLastCalledWith("emp-1", "BLACK50", "negocio", "monthly", "PIX", 3);
    out = text(tree);
    expect(out).toContain("− R$ 84,50");
    expect(out).toContain("Gerar Pix de R$ 141,50");
    tree.unmount();
  });
});

describe("valor combinado", () => {
  it("custom: sem seletor, só o valor combinado, e o subscribe sem extra_seats", async () => {
    mockBilling.quote.mockImplementation(cotacaoP106({ atuais: 1, combinado: 211.2 }));
    const tree = await mount();
    expect(byTestId(tree, "checkout-acessos")).toHaveLength(0);
    expect(byTestId(tree, "checkout-valor-combinado")).toHaveLength(1);
    expect(byTestId(tree, "checkout-resumo-acessos")).toHaveLength(0);
    expect(text(tree)).toContain("Gerar Pix de R$ 211,20");
    await press(tree, "checkout-pagar-pix");
    expect(mockBilling.subscribe).toHaveBeenCalledTimes(1);
    expect(mockBilling.subscribe.mock.calls[0][4].extraSeats).toBeUndefined();
    tree.unmount();
  });

  it("backend sem o p-106 (sem current_extra_seats): sem seletor e sem extra_seats", async () => {
    mockBilling.quote.mockImplementation(async (_c: string, plan: string, cycle: string) => {
      const v = TABELA[plan][cycle];
      return { plan, cycle, value: v, custom: false, table_value: v, extra_seats: 0 };
    });
    const tree = await mount();
    expect(byTestId(tree, "checkout-acessos")).toHaveLength(0);
    await press(tree, "checkout-pagar-pix");
    expect(mockBilling.subscribe.mock.calls[0][4].extraSeats).toBeUndefined();
    tree.unmount();
  });
});

describe("loja ativa e em dia", () => {
  it("mesmo plano e ciclo: travado no valor atual, com a nota e o WhatsApp de ajuda", async () => {
    const abrir = jest.fn();
    const antes = window.open;
    (window as any).open = abrir;
    mockCompany = { ...mockCompany, billing_status: "active" };
    mockBilling.status.mockResolvedValue({ billing_status: "active", needs_cpf_cnpj: false, discount: null });
    mockBilling.quote.mockImplementation(cotacaoP106({ atuais: 2 }));
    const tree = await mount();
    expect(valor(tree)).toBe("2");
    expect(byTestId(tree, "checkout-acessos-mais")[0].props.disabled).toBe(true);
    expect(byTestId(tree, "checkout-acessos-menos")[0].props.disabled).toBe(true);
    await press(tree, "checkout-acessos-mais");
    expect(valor(tree)).toBe("2");
    expect(byTestId(tree, "checkout-acessos-travado")).toHaveLength(1);
    await press(tree, "checkout-acessos-whatsapp");
    expect(abrir.mock.calls[0][0]).toContain("https://wa.me/");
    // Outro plano é troca de plano: libera.
    await press(tree, "checkout-plano-expansao");
    expect(byTestId(tree, "checkout-acessos-mais")[0].props.disabled).toBe(false);
    (window as any).open = antes;
    tree.unmount();
  });

  it("409 ASSINATURA_ATIVA: a mensagem do backend e o seletor travado no valor atual", async () => {
    const msg = "Sua assinatura já está ativa e em dia, então os acessos de funcionário não mudam pelo checkout.";
    mockBilling.quote.mockImplementation(cotacaoP106({ atuais: 1 }));
    mockBilling.subscribe.mockRejectedValue(new MockApiError(msg, { code: "ASSINATURA_ATIVA", stage: "extra_seats", current_extra_seats: 1, season_extra_seats: 0 }));
    const tree = await mount();
    await press(tree, "checkout-acessos-mais", 2);
    expect(valor(tree)).toBe("3");
    await press(tree, "checkout-pagar-pix");
    expect(mockBilling.subscribe.mock.calls[0][4].extraSeats).toBe(3);
    expect(mockToast.error).toHaveBeenCalledWith(msg);
    expect(byTestId(tree, "checkout-acessos-travado")).toHaveLength(1);
    expect(text(tree)).toContain(msg);
    expect(valor(tree)).toBe("1");
    expect(byTestId(tree, "checkout-acessos-mais")[0].props.disabled).toBe(true);
    tree.unmount();
  });
});

describe("extra_seats em cada chamada", () => {
  it("Pix: subscribe com extra_seats e o aviso de que os acessos liberam no pagamento", async () => {
    const tree = await mount();
    await press(tree, "checkout-acessos-mais", 3);
    expect(mockBilling.quote).toHaveBeenCalledWith("emp-1", "negocio", "monthly", "PIX", 3);
    await press(tree, "checkout-pagar-pix");
    expect(mockBilling.subscribe).toHaveBeenCalledWith("emp-1", "negocio", "PIX", "monthly", expect.objectContaining({ extraSeats: 3 }));
    expect(byTestId(tree, "checkout-acessos-pendentes")).toHaveLength(1);
    expect(text(tree)).toContain("Os acessos de funcionário liberam assim que o pagamento for confirmado.");
    tree.unmount();
  });

  it("Pix sem mudar a quantidade: sem o aviso", async () => {
    mockBilling.quote.mockImplementation(cotacaoP106({ atuais: 2 }));
    const tree = await mount();
    await press(tree, "checkout-pagar-pix");
    expect(mockBilling.subscribe.mock.calls[0][4].extraSeats).toBe(2);
    expect(byTestId(tree, "checkout-acessos-pendentes")).toHaveLength(0);
    tree.unmount();
  });

  it("cartão: quote com CREDIT_CARD, validate-coupon e subscribe com extra_seats", async () => {
    mockBilling.validateCoupon.mockImplementation(async (_c: string, code: string, _p: string, _ci: string, _b: string, extra?: number) => ({
      valid: true, code, discount_pct: 10, first_charge_value: r2(152.1 + 19 * (extra || 0)), recurring_value: r2(169 + 19 * (extra || 0)), extra_seats: extra,
    }));
    mockBilling.tokenize.mockResolvedValue({ credit_card_token: "tok", credit_card_brand: "VISA", credit_card_last4: "1111" });
    mockBilling.subscribe.mockResolvedValue({ plan: "negocio", cycle: "monthly", value: 207, billing_type: "CREDIT_CARD", extra_seats_pending: true });
    const tree = await mount();
    await press(tree, "checkout-metodo-cartao");
    await press(tree, "checkout-acessos-mais", 2);
    expect(mockBilling.quote).toHaveBeenCalledWith("emp-1", "negocio", "monthly", "CREDIT_CARD", 0);
    expect(mockBilling.quote).toHaveBeenCalledWith("emp-1", "negocio", "monthly", "CREDIT_CARD", 2);
    await aplicaCupom(tree, "DEZ");
    expect(mockBilling.validateCoupon).toHaveBeenLastCalledWith("emp-1", "DEZ", "negocio", "monthly", "CREDIT_CARD", 2);

    const campo = (ph: string, i = 0) => tree.root.findAll((n) => n.props.placeholder === ph && typeof n.props.onChangeText === "function" && typeof n.type !== "string")[i];
    await act(async () => {
      campo("0000 0000 0000 0000").props.onChangeText("4111111111111111");
      campo("MM/AA").props.onChangeText("1230");
      campo("123", 0).props.onChangeText("123");
      campo("NOME DO TITULAR").props.onChangeText("Fulana de Tal");
      campo("000.000.000-00").props.onChangeText("52998224725");
      campo("00000-000").props.onChangeText("01001000");
      campo("123", 1).props.onChangeText("10");
      campo("Rua...").props.onChangeText("Praça da Sé");
    });
    await espera();
    await press(tree, "checkout-pagar-cartao");
    expect(mockBilling.tokenize).toHaveBeenCalledTimes(1);
    expect(mockBilling.subscribe).toHaveBeenCalledWith("emp-1", "negocio", "CREDIT_CARD", "monthly", expect.objectContaining({ extraSeats: 2, accessCode: "DEZ" }));
    expect(byTestId(tree, "checkout-acessos-pendentes")).toHaveLength(1);
    tree.unmount();
  });
});

describe("textos (puros)", () => {
  it("o que o plano inclui e a frase da versão 6", () => {
    expect(oQueOPlanoInclui(1)).toBe("só o seu acesso");
    expect(oQueOPlanoInclui(3)).toBe("o seu acesso e mais 2 de funcionário");
    expect(oQueOPlanoInclui(5)).toBe("o seu acesso e mais 4 de funcionário");
    expect(textoAoLadoDoSeletor("Essencial", 1)).toBe(
      "O plano Essencial inclui só o seu acesso. Precisa de mais? Cada acesso de funcionário adicional custa R$ 19 por mês, em qualquer plano.",
    );
  });
  it("rótulos do resumo", () => {
    expect(rotuloDosAcessosExtras(1)).toBe("1 acesso de funcionário adicional");
    expect(rotuloDosAcessosExtras(4)).toBe("4 acessos de funcionário adicionais");
    expect(rotuloDosAcessosDaTemporada(1)).toBe("1 acesso de funcionário para a temporada");
    expect(rotuloDosAcessosDaTemporada(2)).toBe("2 acessos de funcionário para a temporada");
  });
  it("seletorDaCotacao: sem current_extra_seats, combinado ou outro plano → null", () => {
    const q = { plan: "negocio", cycle: "monthly", current_extra_seats: 2, season_extra_seats: 1, max_extra_seats: 10, plan_included_seats: 3, seat_price: 19 };
    expect(seletorDaCotacao(q, "negocio", "monthly")).toEqual({ atuais: 2, temporada: 1, maximo: 10, incluidos: 3, preco: 19 });
    expect(seletorDaCotacao({ ...q, current_extra_seats: undefined }, "negocio", "monthly")).toBeNull();
    expect(seletorDaCotacao({ ...q, custom: true }, "negocio", "monthly")).toBeNull();
    expect(seletorDaCotacao({ ...q, extra_seats_ignored: true }, "negocio", "monthly")).toBeNull();
    expect(seletorDaCotacao(q, "essencial", "monthly")).toBeNull();
    expect(seletorDaCotacao(q, "negocio", "annual")).toBeNull();
  });
  it("totalDaCotacaoComAcessos: só a cotação desta quantidade", () => {
    const q = { plan: "negocio", cycle: "monthly", extra_seats: 2, value: 207 };
    expect(totalDaCotacaoComAcessos(q, "negocio", "monthly", 2)).toBe(207);
    expect(totalDaCotacaoComAcessos(q, "negocio", "monthly", 3)).toBeNull();
    expect(totalDaCotacaoComAcessos(q, "expansao", "monthly", 2)).toBeNull();
  });
  it("precoDoPlanoNaCotacao: com temporada, tira os charged_extra_seats", () => {
    expect(precoDoPlanoNaCotacao({ plan: "negocio", cycle: "monthly", table_value: 207, extra_seats: 0, charged_extra_seats: 2 }, "negocio", "monthly")).toBe(169);
  });
});
