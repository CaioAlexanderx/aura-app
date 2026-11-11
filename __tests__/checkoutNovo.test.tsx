// ============================================================
// Checkout novo (p-104, 11/11/2026) e o checkout do assento (p-105)
//
// Muda o visual e os textos; a lógica de cobrança é a de antes (os testes
// dela seguem em checkoutValorCombinado e checkoutSemPromocao). Aqui:
//   · plano marcado ao abrir: o da conta; sem plano, o Negócio; a Expansão
//     nunca vem marcada por padrão;
//   · preço de cada plano vem do /billing/quote (table_value − acessos);
//   · acessos extras liberados (extra_seats da cotação) no resumo;
//   · cupom: linha verde do aplicado, laranja da recusa;
//   · CTA "Gerar Pix de R$ x" / "Pagar R$ x no cartão";
//   · "Voltar ao Caixa" vai ao Caixa;
//   · ?de=assento: a frase do assento (em atraso, com a cobrança em aberto);
//   · relê o /auth/me ao abrir (plano velho no JWT).
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
var mockRefreshMe = jest.fn(async () => {});
var mockTrial = false;
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    company: mockCompany, refreshMe: mockRefreshMe,
    hydrate: jest.fn(async () => {}), logout: jest.fn(), trialActive: mockTrial, isDemo: false, isStaff: false,
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
  precoDoPlanoNaCotacao, acessosExtrasDaConta, linhaDoCupomAplicado, mensagemDoCupomRecusado,
  textoDepoisDoCupom, rotuloDoCupomNoResumo, textoDoBotaoDePagar, rotuloDoPlanoNoResumo, CUPOM_NAO_ENCONTRADO,
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
const marcado = (tree: renderer.ReactTestRenderer) =>
  ["essencial", "negocio", "expansao"].filter((k) => {
    const n = byTestId(tree, "checkout-plano-" + k)[0];
    return n && n.props.accessibilityState && n.props.accessibilityState.selected;
  });
async function press(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { await byTestId(tree, id)[0].props.onPress(); });
  await espera();
}
async function aplicaCupom(tree: renderer.ReactTestRenderer, codigo: string) {
  await act(async () => { byTestId(tree, "checkout-cupom-campo")[0].props.onChangeText(codigo); });
  await press(tree, "checkout-cupom-aplicar");
}

// Cotação como o backend devolve: table_value = plano + 19 × extra_seats.
const TABELA: Record<string, Record<string, number>> = {
  essencial: { monthly: 89, annual: 74.17 }, negocio: { monthly: 169, annual: 140.83 }, expansao: { monthly: 269, annual: 224.17 },
};
function cotacaoReal(extras = 0) {
  return async (_cid: string, plan: string, cycle: string, billingType: string) => {
    const v = Math.round((TABELA[plan][cycle] + 19 * extras) * 100) / 100;
    return { plan, cycle, billing_type: billingType, value: v, custom: false, table_value: v, extra_seats: extras };
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockTrial = false;
  mockCompany = { id: "emp-1", plan: "negocio", billing_cycle: "monthly", billing_status: "inactive", cnpj: "", vertical_active: null };
  mockBilling.status.mockResolvedValue({ billing_status: "inactive", needs_cpf_cnpj: false, discount: null });
  mockBilling.quote.mockImplementation(cotacaoReal(0));
  (global as any).fetch = jest.fn(async () => ({ json: async () => ({ erro: true }) }));
});

describe("plano marcado ao abrir", () => {
  it.each([
    ["essencial", ["essencial"]],
    ["negocio", ["negocio"]],
    ["expansao", ["expansao"]],
  ])("conta no %s: o plano da conta", async (plano, esperado) => {
    mockCompany = { ...mockCompany, plan: plano };
    const tree = await mount();
    expect(marcado(tree)).toEqual(esperado);
    tree.unmount();
  });

  it.each([null, "", "personalizado", "trial"])("sem plano válido (%s): o Negócio, nunca a Expansão", async (plano) => {
    mockCompany = { ...mockCompany, plan: plano };
    const tree = await mount();
    expect(marcado(tree)).toEqual(["negocio"]);
    tree.unmount();
  });

  it("?plan=negocio (link do assento) vence o plano da conta, mesmo na Expansão", async () => {
    mockCompany = { ...mockCompany, plan: "expansao" };
    mockParams = { plan: "negocio" };
    const tree = await mount();
    expect(marcado(tree)).toEqual(["negocio"]);
    tree.unmount();
  });

  it("?plan= com chave que não existe é ignorado (não cai no primeiro da lista)", async () => {
    mockCompany = { ...mockCompany, plan: null };
    mockParams = { plan: "personalizado" };
    const tree = await mount();
    expect(marcado(tree)).toEqual(["negocio"]);
    tree.unmount();
  });

  it("Studio sem plano: o Negócio (o Essencial não aparece)", async () => {
    mockCompany = { ...mockCompany, plan: null, vertical_active: "studio" };
    const tree = await mount();
    expect(byTestId(tree, "checkout-plano-essencial")).toHaveLength(0);
    expect(marcado(tree)).toEqual(["negocio"]);
    tree.unmount();
  });

  it("relê o /auth/me ao abrir (plano velho no JWT)", async () => {
    const tree = await mount();
    expect(mockRefreshMe).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  it("o selo 'Mais escolhido' só no Negócio", async () => {
    const tree = await mount();
    expect(byTestId(tree, "checkout-plano-selo-negocio")).toHaveLength(1);
    expect(byTestId(tree, "checkout-plano-selo-essencial")).toHaveLength(0);
    expect(byTestId(tree, "checkout-plano-selo-expansao")).toHaveLength(0);
    expect(text(tree)).toContain("Mais escolhido");
    expect(text(tree)).not.toContain("Mais popular");
    tree.unmount();
  });
});

describe("valores e resumo", () => {
  it("mensal: 89, 169 e 269 da cotação; descrições com acento; resumo e CTA do Pix", async () => {
    const tree = await mount();
    const out = text(tree);
    for (const v of ["R$ 89,00", "R$ 169,00", "R$ 269,00"]) expect(out).toContain(v);
    expect(out).toContain("Base para começar");
    expect(out).toContain("Operação completa");
    expect(out).toContain("Escala e automação");
    expect(out).toContain("Plano Negócio (mensal)");
    expect(out).toContain("Total hoje");
    expect(out).toContain("Gerar Pix de R$ 169,00");
    expect(out).toContain("Pagamento processado pela Asaas.");
    expect(mockBilling.quote).toHaveBeenCalledWith("emp-1", "essencial", "monthly", "PIX", 0);
    expect(mockBilling.quote).toHaveBeenCalledWith("emp-1", "expansao", "monthly", "PIX", 0);
    tree.unmount();
  });

  it("anual: 74,17, 140,83 e 224,17 por mês, 'cobrado por mês, plano anual' e o selo do anual", async () => {
    const tree = await mount();
    await press(tree, "checkout-ciclo-anual");
    await espera();
    const out = text(tree);
    for (const v of ["R$ 74,17", "R$ 140,83", "R$ 224,17"]) expect(out).toContain(v);
    expect(out).toContain("cobrado por mês, plano anual");
    expect(out).toContain("2 meses grátis");
    expect(out).toContain("Plano Negócio (anual, cobrado por mês)");
    expect(out).toContain("Gerar Pix de R$ 140,83");
    tree.unmount();
  });

  it("o preço do cartão é o do backend, não o da tabela local", async () => {
    mockBilling.quote.mockImplementation(async (_c: string, plan: string, cycle: string) => {
      const v = plan === "negocio" ? 179 : TABELA[plan][cycle];
      return { plan, cycle, value: v, custom: false, table_value: v, extra_seats: 0 };
    });
    const tree = await mount();
    expect(text(tree)).toContain("Gerar Pix de R$ 179,00");
    tree.unmount();
  });

  it("acessos extras já liberados (extra_seats da cotação): a linha de hoje no resumo, somada ao total", async () => {
    mockBilling.quote.mockImplementation(cotacaoReal(2));
    const tree = await mount();
    expect(byTestId(tree, "checkout-resumo-acessos")).toHaveLength(1);
    const out = text(tree);
    expect(out).toContain("2 acessos de funcionário adicionais");
    expect(out).toContain("R$ 38,00");
    // O cartão do plano mostra só o plano.
    expect(out).toContain("R$ 169,00");
    expect(out).toContain("Gerar Pix de R$ 207,00");
    tree.unmount();
  });

  it("sem acessos extras: nenhuma linha de acessos", async () => {
    const tree = await mount();
    expect(byTestId(tree, "checkout-resumo-acessos")).toHaveLength(0);
    tree.unmount();
  });

  it("cartão: 'Pagar R$ x no cartão'", async () => {
    const tree = await mount();
    await press(tree, "checkout-metodo-cartao");
    expect(text(tree)).toContain("Pagar R$ 169,00 no cartão");
    tree.unmount();
  });
});

describe("cupom", () => {
  it("BLACK50: linha verde, desconto no resumo e 'Depois, R$ y por mês'", async () => {
    mockBilling.validateCoupon.mockResolvedValue({
      valid: true, code: "BLACK50", type: "promo", discount_pct: 50, discount_months: 1,
      first_charge_value: 84.5, recurring_value: 169, first_charge_date: "2026-11-11",
    });
    const tree = await mount();
    await aplicaCupom(tree, "black50");
    expect(mockBilling.validateCoupon).toHaveBeenCalledWith("emp-1", "BLACK50", "negocio", "monthly", "PIX", undefined);
    const out = text(tree);
    expect(byTestId(tree, "checkout-cupom-ok")).toHaveLength(1);
    expect(out).toContain("BLACK50 aplicado: a primeira mensalidade sai pela metade.");
    expect(out).toContain("Cupom BLACK50 · 1ª mensalidade");
    expect(out).toContain("− R$ 84,50");
    expect(out).toContain("Depois, R$ 169,00 por mês. Desconto só na primeira mensalidade.");
    expect(out).toContain("Gerar Pix de R$ 84,50");
    tree.unmount();
  });

  it("código que não existe: a linha laranja da recusa, do jeito do backend", async () => {
    mockBilling.validateCoupon.mockResolvedValue({ valid: false, error: "Cupom nao encontrado." });
    const tree = await mount();
    await aplicaCupom(tree, "XYZ");
    expect(byTestId(tree, "checkout-cupom-recusado")).toHaveLength(1);
    expect(text(tree)).toContain("Não encontrei esse código. Confira e tente de novo.");
    expect(text(tree)).toContain("Gerar Pix de R$ 169,00");
    tree.unmount();
  });

  it("remover o cupom volta ao campo vazio e ao valor cheio", async () => {
    mockBilling.validateCoupon.mockResolvedValue({ valid: true, code: "DEZ", discount_pct: 10, first_charge_value: 152.1, recurring_value: 169 });
    const tree = await mount();
    await aplicaCupom(tree, "DEZ");
    await press(tree, "checkout-cupom-remover");
    expect(byTestId(tree, "checkout-cupom-campo")).toHaveLength(1);
    expect(text(tree)).toContain("Gerar Pix de R$ 169,00");
    tree.unmount();
  });
});

describe("rodapé", () => {
  it("'Voltar ao Caixa' vai ao Caixa", async () => {
    const tree = await mount();
    expect(text(tree)).toContain("Voltar ao Caixa");
    expect(text(tree)).not.toContain("Cancelar");
    await press(tree, "checkout-voltar-caixa");
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/pdv");
    tree.unmount();
  });

  it("sem assinatura: também 'Sair da conta'; assinante, não", async () => {
    let tree = await mount();
    expect(byTestId(tree, "checkout-sair")).toHaveLength(1);
    tree.unmount();
    mockCompany = { ...mockCompany, billing_status: "active" };
    tree = await mount();
    expect(byTestId(tree, "checkout-sair")).toHaveLength(0);
    tree.unmount();
  });
});

describe("p-105 · checkout do assento (?de=assento)", () => {
  it("sem assinatura: a frase do assento no topo, com o Negócio marcado", async () => {
    mockCompany = { ...mockCompany, plan: "expansao" };
    mockParams = { plan: "negocio", de: "assento" };
    const tree = await mount();
    expect(byTestId(tree, "checkout-aviso-assento")).toHaveLength(1);
    expect(text(tree)).toContain("Para contratar o assento, a loja precisa de uma assinatura ativa.");
    expect(byTestId(tree, "checkout-aviso-assento-pagar")).toHaveLength(0);
    expect(marcado(tree)).toEqual(["negocio"]);
    tree.unmount();
  });

  it("em atraso: 'Regularize a mensalidade' e o botão que abre a cobrança em aberto", async () => {
    const abrir = jest.fn();
    const antes = window.open;
    (window as any).open = abrir;
    mockCompany = { ...mockCompany, plan: "essencial", billing_status: "overdue" };
    mockBilling.status.mockResolvedValue({ billing_status: "overdue", needs_cpf_cnpj: false, discount: null });
    mockBilling.invoices.mockResolvedValue({ total: 1, invoices: [{ id: "p1", status: "OVERDUE", due_date: "2026-11-01", invoice_url: "https://asaas.test/i/p1" }] });
    mockParams = { de: "assento" };
    const tree = await mount();
    expect(text(tree)).toContain("Regularize a mensalidade para contratar o assento.");
    // Em atraso o plano é o da conta: regulariza, não troca.
    expect(marcado(tree)).toEqual(["essencial"]);
    await press(tree, "checkout-aviso-assento-pagar");
    expect(mockBilling.invoices).toHaveBeenCalledWith("emp-1");
    expect(abrir).toHaveBeenCalledWith("https://asaas.test/i/p1", "_blank");
    (window as any).open = antes;
    tree.unmount();
  });

  it("sem ?de=assento: nenhum aviso do assento", async () => {
    const tree = await mount();
    expect(byTestId(tree, "checkout-aviso-assento")).toHaveLength(0);
    tree.unmount();
  });
});

describe("textos (puros)", () => {
  it("precoDoPlanoNaCotacao: tira os acessos do table_value; cotação de outro plano ou sem extra_seats → null", () => {
    expect(precoDoPlanoNaCotacao({ plan: "negocio", cycle: "annual", table_value: 159.83, extra_seats: 1 }, "negocio", "annual")).toBe(140.83);
    expect(precoDoPlanoNaCotacao({ plan: "negocio", cycle: "annual", table_value: 159.83, extra_seats: 1 }, "essencial", "annual")).toBeNull();
    expect(precoDoPlanoNaCotacao({ plan: "negocio", cycle: "annual", table_value: 159.83, extra_seats: 1 }, "negocio", "monthly")).toBeNull();
    expect(precoDoPlanoNaCotacao({ plan: "negocio", cycle: "annual", table_value: 159.83 }, "negocio", "annual")).toBeNull();
    expect(precoDoPlanoNaCotacao(undefined, "negocio", "annual")).toBeNull();
  });
  it("acessosExtrasDaConta: a cotação vence; sem ela, a empresa", () => {
    expect(acessosExtrasDaConta({ extra_seats: 3 }, { extra_seats_granted: 1 })).toBe(3);
    expect(acessosExtrasDaConta({ extra_seats: 0 }, { extra_seats_granted: 1 })).toBe(0);
    expect(acessosExtrasDaConta(undefined, { extra_seats_granted: "2" })).toBe(2);
    expect(acessosExtrasDaConta(undefined, {})).toBe(0);
  });
  it("cupom: dias grátis, várias mensalidades e valor fixo", () => {
    const trial = { valid: true, code: "INDICA7", trial_days: 7, first_charge_date: "2026-11-18" };
    expect(linhaDoCupomAplicado(trial)).toBe("INDICA7 aplicado: 7 dias grátis. A primeira cobrança é em 18/11/2026.");
    expect(rotuloDoCupomNoResumo(trial)).toBeNull();
    expect(textoDepoisDoCupom(trial, 169)).toBe("Depois, R$ 169,00 por mês, a partir de 18/11/2026.");
    const tres = { valid: true, code: "TRES", discount_value: 50, discount_months: 3, first_full_charge_date: "2027-02-11" };
    expect(linhaDoCupomAplicado(tres)).toBe("TRES aplicado: as 3 primeiras mensalidades saem com R$ 50,00 de desconto.");
    expect(rotuloDoCupomNoResumo(tres)).toBe("Cupom TRES · 3 primeiras mensalidades");
    expect(textoDepoisDoCupom(tres, 169)).toBe("Depois, R$ 169,00 por mês, a partir da 4ª mensalidade (11/02/2027).");
    expect(linhaDoCupomAplicado({ valid: true, code: "DEZ", discount_pct: 10 })).toBe("DEZ aplicado: a primeira mensalidade sai com 10% de desconto.");
  });
  it("recusa: as mensagens do backend com acento e no tom da tela; o resto passa como veio", () => {
    expect(mensagemDoCupomRecusado("Cupom nao encontrado.")).toBe(CUPOM_NAO_ENCONTRADO);
    expect(mensagemDoCupomRecusado("Cupom expirado.")).toBe("Esse código já venceu.");
    expect(mensagemDoCupomRecusado("Cupom ja atingiu o limite de usos.")).toBe("Esse código já chegou ao limite de usos.");
    expect(mensagemDoCupomRecusado("Esta empresa ja usou este cupom.")).toBe("Esta loja já usou esse código.");
    expect(mensagemDoCupomRecusado(undefined)).toBe(CUPOM_NAO_ENCONTRADO);
    expect(mensagemDoCupomRecusado("Outra coisa.")).toBe("Outra coisa.");
  });
  it("botão e rótulo do plano", () => {
    expect(textoDoBotaoDePagar({ metodo: "pix", valor: 84.5, diasGratis: 0 })).toBe("Gerar Pix de R$ 84,50");
    expect(textoDoBotaoDePagar({ metodo: "card", valor: 169, diasGratis: 0 })).toBe("Pagar R$ 169,00 no cartão");
    expect(textoDoBotaoDePagar({ metodo: "pix", valor: 0, diasGratis: 7 })).toBe("Ativar 7 dias grátis");
    expect(rotuloDoPlanoNoResumo("Negócio", false)).toBe("Plano Negócio (mensal)");
    expect(rotuloDoPlanoNoResumo("Negócio", true)).toBe("Plano Negócio (anual, cobrado por mês)");
  });
});
