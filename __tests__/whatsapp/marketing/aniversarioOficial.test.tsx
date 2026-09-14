// ============================================================
// O parabéns pelo WhatsApp OFICIAL (Fase 8).
//
// O modal de cupom de aniversário sempre teve um caminho grátis: monta a
// mensagem e abre o wa.me. A Fase 8 põe ao lado dele um caminho PAGO — o
// template MARKETING saindo pelo número da loja, sem ninguém abrir o
// WhatsApp. São dois botões parecidos com consequências diferentes, e é
// isso que estes testes seguram:
//
// 1. a opção oficial só aparece quando TUDO está no lugar (plano,
//    conexão, template aprovado e consentimento declarado). Faltando
//    qualquer um — inclusive por o backend ser antigo e não devolver o
//    campo — ela some, e o wa.me continua lá;
// 2. um clique não envia: aparece a confirmação dizendo que é 1 mensagem
//    de marketing PAGA, e só o segundo clique chama a rota;
// 3. `queued:false` não é erro: é guarda. Vira frase em português no
//    próprio modal (nunca o código cru), e o modal fica aberto porque o
//    cupom foi criado e ainda dá para mandar pelo wa.me.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
// O portal do web joga a árvore no document.body; aqui ele é passa-adiante.
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children }: any) => children }));

jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { company: { id: "loja-1", name: "Loja Exemplo" }, token: "t" };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));

jest.mock("@/services/messaging", () => ({
  sendBirthdayMessage: jest.fn(() => Promise.resolve({ ok: true })),
  renderTemplate: (t: string) => t,
  buildWaMeUrl: () => "https://wa.me/5511999999999",
  formatDiscountDescription: () => "10% de desconto",
  formatExpiresAt: () => "21/09/2026",
  resolveChannel: () => "wa_link",
  normalizeBrPhone: (p: string) => (String(p || "").replace(/\D/g, "").length >= 10 ? p : null),
}));

var mockSettings: any = {
  defaults: { discount_type: "percent", discount_value: 10, validity_days: 7, min_order_value: 0, max_uses: 1 },
  template: "Oi, {{nome}}!",
  configured: true,
};
var mockSendWhatsapp = jest.fn((_id: string, _b: any) => Promise.resolve({ queued: true, outbox_id: "o1", reason: null, coupon: null }));
var mockCreateCoupon = jest.fn(() => Promise.resolve({
  coupon: { id: "c1", code: "ANIV-ANA-26", discount_type: "percent", discount_value: 10, expires_at: "2026-09-21" },
}));
jest.mock("@/services/birthdayApi", () => ({
  birthdayApi: {
    getSettings: () => Promise.resolve(mockSettings),
    saveSettings: jest.fn(() => Promise.resolve({ ok: true })),
    createCoupon: (..._a: any[]) => mockCreateCoupon(),
    logSent: jest.fn(() => Promise.resolve({ log: {} })),
    sentThisYear: jest.fn(() => Promise.resolve({ year: 2026, total: 0, sent: [] })),
    sendWhatsapp: (id: string, b: any) => mockSendWhatsapp(id, b),
    preview: jest.fn(() => Promise.resolve({ would_send: 0, skipped: {}, items: [] })),
  },
}));
// O modal importa `birthdayApi` pela fachada services/api; ela reexporta o
// mesmo módulo, então o mock acima vale — mas a fachada arrasta o resto do
// app junto, e aqui só interessa o cupom.
jest.mock("@/services/api", () => ({
  birthdayApi: require("@/services/birthdayApi").birthdayApi,
  request: jest.fn(),
}));

var mockStatus: any = null;
jest.mock("@/services/waApi", () => {
  const actual = jest.requireActual("@/services/waApi");
  return {
    ...actual,
    waApi: { getStatus: () => Promise.resolve(mockStatus) },
  };
});

import { BirthdayCouponModal } from "@/components/BirthdayCouponModal";

const STATUS_PRONTO = {
  connected: true,
  phone_display: "5511912345678",
  waba_id: "w1",
  queue: {},
  schema_pending: false,
  addon_active: true,
  template_ready: true,
  templates_ready: { aniversario_cupom: true },
  marketing_consent_at: "2026-09-14T10:00:00.000Z",
  marketing_ready: true,
  quality_rating: "GREEN",
  paused_reason: null,
  usage: { today_sent: 1, month_sent: 4, daily_cap: 300 },
};

const CLIENTE: any = {
  id: "cli-1", name: "Ana Souza", phone: "11999998888", email: null,
  birth_date: "1990-09-14", total_purchases: 3, total_spent: 450,
  days_until: 0, is_today: true, marketing_opt_out: false,
};

// Duas queries (settings e status do WhatsApp) e um efeito que depende
// das duas. Contar microtasks aqui deu teste que passava ou falhava
// conforme a ORDEM em que rodava — o que sobra de um teste desloca a
// contagem do seguinte. Ceder o event loop de verdade (setTimeout 0)
// drena as duas filas e torna o resultado o mesmo isolado ou em suíte.
async function flush(voltas: number = 4) {
  for (let i = 0; i < voltas; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

function montar(customer: any = CLIENTE) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderer.create(
    <QueryClientProvider client={qc}>
      <BirthdayCouponModal visible onClose={jest.fn()} customer={customer} />
    </QueryClientProvider>
  );
}

function tem(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}
function achar(tree: any, id: string): any {
  return tree.root.findAllByProps({ testID: id })[0];
}

describe("opção oficial do aniversário", () => {
  beforeEach(() => {
    mockSendWhatsapp.mockClear();
    mockCreateCoupon.mockClear();
    mockSendWhatsapp.mockImplementation(() =>
      Promise.resolve({ queued: true, outbox_id: "o1", reason: null, coupon: null } as any)
    );
  });

  it("com tudo no lugar, aparece", async () => {
    mockStatus = STATUS_PRONTO;
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "aniversario-wa-oficial")).toBe(true);
    tree.unmount();
  });

  it("sem consentimento declarado, NÃO aparece", async () => {
    mockStatus = { ...STATUS_PRONTO, marketing_consent_at: null, marketing_ready: false };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "aniversario-wa-oficial")).toBe(false);
    // E o caminho grátis continua inteiro.
    expect(JSON.stringify(tree.toJSON())).toContain("Criar e enviar");
    tree.unmount();
  });

  it("backend antigo (sem os campos de marketing) também não libera", async () => {
    mockStatus = { ...STATUS_PRONTO };
    delete (mockStatus as any).marketing_consent_at;
    delete (mockStatus as any).marketing_ready;
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "aniversario-wa-oficial")).toBe(false);
    tree.unmount();
  });

  it("template de aniversário não aprovado esconde a opção", async () => {
    mockStatus = { ...STATUS_PRONTO, templates_ready: { parcela_lembrete: true } };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "aniversario-wa-oficial")).toBe(false);
    tree.unmount();
  });

  it("status fora do ar não libera envio pago", async () => {
    mockStatus = null;
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "aniversario-wa-oficial")).toBe(false);
    tree.unmount();
  });

  it("cliente em opt-out não recebe marketing, mesmo com tudo aprovado", async () => {
    mockStatus = STATUS_PRONTO;
    let tree: any;
    await act(async () => { tree = montar({ ...CLIENTE, marketing_opt_out: true }); });
    await flush();
    expect(tem(tree, "aniversario-wa-oficial")).toBe(false);
    tree.unmount();
  });
});

describe("um clique não envia", () => {
  beforeEach(() => {
    mockSendWhatsapp.mockClear();
    mockCreateCoupon.mockClear();
    mockSendWhatsapp.mockImplementation(() =>
      Promise.resolve({ queued: true, outbox_id: "o1", reason: null, coupon: null } as any)
    );
    mockStatus = STATUS_PRONTO;
  });

  it("primeiro clique só abre a confirmação com o custo escrito", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    await act(async () => { achar(tree, "aniversario-wa-oficial-abrir").props.onPress(); });
    await flush();

    expect(tem(tree, "aniversario-wa-oficial-confirmar")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("1 mensagem de marketing paga");
    expect(mockSendWhatsapp).not.toHaveBeenCalled();
    expect(mockCreateCoupon).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("o segundo clique cria o cupom e manda pela rota oficial", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    await act(async () => { achar(tree, "aniversario-wa-oficial-abrir").props.onPress(); });
    await flush();
    await act(async () => { achar(tree, "aniversario-wa-oficial-enviar").props.onPress(); });
    await flush();

    expect(mockCreateCoupon).toHaveBeenCalledTimes(1);
    expect(mockSendWhatsapp).toHaveBeenCalledTimes(1);
    // O cupom da TELA vai junto: o lojista pode ter mudado desconto e validade.
    expect(mockSendWhatsapp.mock.calls[0][1]).toEqual({ customer_id: "cli-1", coupon_id: "c1" });
    tree.unmount();
  });

  it("queued:false mostra o motivo em português e não fecha o modal", async () => {
    mockSendWhatsapp.mockImplementation(() =>
      Promise.resolve({ queued: false, outbox_id: null, reason: "FREQUENCIA_MARKETING", coupon: null } as any)
    );
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    await act(async () => { achar(tree, "aniversario-wa-oficial-abrir").props.onPress(); });
    await flush();
    await act(async () => { achar(tree, "aniversario-wa-oficial-enviar").props.onPress(); });
    await flush();

    expect(tem(tree, "aniversario-wa-oficial-motivo")).toBe(true);
    const txt = JSON.stringify(tree.toJSON());
    expect(txt).toContain("últimos 7 dias");
    expect(txt).not.toContain("FREQUENCIA_MARKETING");
    tree.unmount();
  });

  it("409 SEM_CONSENTIMENTO do backend chega como frase, não como código", async () => {
    mockSendWhatsapp.mockImplementation(() => Promise.reject(
      Object.assign(new Error("x"), { status: 409, data: { code: "SEM_CONSENTIMENTO" } })
    ));
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    await act(async () => { achar(tree, "aniversario-wa-oficial-abrir").props.onPress(); });
    await flush();
    await act(async () => { achar(tree, "aniversario-wa-oficial-enviar").props.onPress(); });
    await flush();

    const txt = JSON.stringify(tree.toJSON());
    expect(tem(tree, "aniversario-wa-oficial-motivo")).toBe(true);
    expect(txt).not.toContain("SEM_CONSENTIMENTO");
    tree.unmount();
  });
});
