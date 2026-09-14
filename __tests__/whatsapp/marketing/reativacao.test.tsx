// ============================================================
// A tela de reativação envia (Fase 7).
//
// Até aqui o motor de reativação só listava quem sumiu. Esta tela dispara
// cupom de MARKETING — a mensagem mais cara do app. O que os testes
// seguram é a distância entre "quero mandar" e "mandei":
//
// 1. nada sai sem prévia. O botão abre a simulação e só depois existe o
//    confirmar; enquanto isso o POST /send não foi chamado;
// 2. ligar o automático semanal também passa pela prévia; DESLIGAR salva
//    na hora, sem diálogo — quem está gastando tem que poder parar;
// 3. faltando consentimento (ou com o backend anterior à fase, que nem
//    devolve o campo) o envio fica travado e o motivo aparece escrito;
// 4. o resultado do disparo é lido em português: `skipped_reason` e
//    `skipped` viram frase, nunca código.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
}));

jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { company: { id: "loja-1", name: "Loja Exemplo" }, token: "t" };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));

var mockDashboard: any = {
  metrics: { at_risk: 2, dormant: 1, lost: 5 },
  priority_reactivation: [
    {
      id: "c1", name: "Ana Souza", phone: "11999998888", total_spent: 900,
      days_since_purchase: 45, segment: "at_risk", reactivation_status: "active", contacted_at: null,
    },
    {
      id: "c2", name: "Bruno Lima", phone: "11988887777", total_spent: 400,
      days_since_purchase: 52, segment: "at_risk", reactivation_status: "contacted",
      contacted_at: "2026-09-01T12:00:00.000Z",
    },
    {
      id: "c3", name: "Carla Dias", phone: "11977776666", total_spent: 250,
      days_since_purchase: 90, segment: "dormant", reactivation_status: "active", contacted_at: null,
    },
  ],
};
var mockSettings: any = { wa_reactivation_auto: false };
var mockPreview: any = { source: "reativacao", would_send: 2, skipped: { JA_ENVIADO: 1 }, items: [] };
var mockGetPreview = jest.fn((_id: string, _o: any) => Promise.resolve(mockPreview));
var mockSend = jest.fn((_id: string, _b: any) => Promise.resolve({ queued: 2, skipped: {}, skipped_reason: null }));
var mockSaveSettings = jest.fn((_id: string, b: any) => Promise.resolve({ ok: true, ...b }));
jest.mock("@/services/reactivationApi", () => ({
  reactivationApi: {
    get: () => Promise.resolve(mockDashboard),
    getSettings: () => Promise.resolve(mockSettings),
    saveSettings: (id: string, b: any) => mockSaveSettings(id, b),
    preview: (id: string, o: any) => mockGetPreview(id, o),
    send: (id: string, b: any) => mockSend(id, b),
    markContacted: jest.fn(),
  },
}));

var mockStatus: any = null;
jest.mock("@/services/waApi", () => {
  const actual = jest.requireActual("@/services/waApi");
  return { ...actual, waApi: { getStatus: () => Promise.resolve(mockStatus) } };
});

import ReativacaoScreen from "@/app/clientes/reativacao";

const STATUS_PRONTO = {
  connected: true,
  phone_display: "5511912345678",
  waba_id: "w1",
  queue: {},
  schema_pending: false,
  addon_active: true,
  template_ready: true,
  templates_ready: { reativacao_cupom: true },
  marketing_consent_at: "2026-09-14T10:00:00.000Z",
  marketing_ready: true,
  quality_rating: "GREEN",
  paused_reason: null,
  usage: { today_sent: 0, month_sent: 3, daily_cap: 300 },
};

// Ceder o event loop (e não contar microtasks) deixa o resultado igual
// isolado e em suíte — ver a nota no teste do aniversário.
async function flush(voltas: number = 4) {
  for (let i = 0; i < voltas; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

function montar() {
  return renderer.create(<ReativacaoScreen />);
}
function tem(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}
function achar(tree: any, id: string): any {
  return tree.root.findAllByProps({ testID: id })[0];
}

describe("disparo de reativação", () => {
  beforeEach(() => {
    mockStatus = STATUS_PRONTO;
    mockSettings = { wa_reactivation_auto: false };
    mockPreview = { source: "reativacao", would_send: 2, skipped: { JA_ENVIADO: 1 }, items: [] };
    mockGetPreview.mockClear();
    mockSend.mockClear();
    mockSaveSettings.mockClear();
  });

  it("o botão abre a prévia e NÃO envia nada antes dela", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    expect(tem(tree, "reativacao-enviar")).toBe(true);
    expect(tem(tree, "reativacao-previa")).toBe(false);

    await act(async () => { achar(tree, "reativacao-enviar").props.onPress(); });
    await flush();

    expect(tem(tree, "reativacao-previa")).toBe(true);
    expect(mockGetPreview).toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();

    // A prévia diz o custo com todas as letras antes de existir confirmação.
    expect(JSON.stringify(tree.toJSON())).toContain("mensagens de marketing pagas");

    await act(async () => { achar(tree, "reativacao-previa-confirmar").props.onPress(); });
    await flush();

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][1].segment).toBe("at_risk");
    tree.unmount();
  });

  it("com clientes marcados, o envio vai só para eles", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    await act(async () => { achar(tree, "reativacao-cliente-c1").props.onPress(); });
    await flush(1);
    await act(async () => { achar(tree, "reativacao-enviar").props.onPress(); });
    await flush();
    await act(async () => { achar(tree, "reativacao-previa-confirmar").props.onPress(); });
    await flush();

    expect(mockSend.mock.calls[0][1].customer_ids).toEqual(["c1"]);
    tree.unmount();
  });

  it("o resultado do disparo é lido em português", async () => {
    mockSend.mockImplementationOnce(() => Promise.resolve({
      queued: 0, skipped: { FREQUENCIA_MARKETING: 2 }, skipped_reason: null,
    } as any));
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    await act(async () => { achar(tree, "reativacao-enviar").props.onPress(); });
    await flush();
    await act(async () => { achar(tree, "reativacao-previa-confirmar").props.onPress(); });
    await flush();

    expect(tem(tree, "reativacao-resultado")).toBe(true);
    const txt = JSON.stringify(tree.toJSON());
    expect(txt).toContain("marketing nos últimos 7 dias");
    expect(txt).not.toContain("FREQUENCIA_MARKETING");
    tree.unmount();
  });

  it("quem já foi contatado aparece com a data", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "reativacao-contatado-c2")).toBe(true);
    // O <Text> vira dois nós ("contatado" + " em 01/09"): a data é o que
    // importa, e é ela que o JSON precisa mostrar.
    expect(JSON.stringify(tree.toJSON())).toContain("em 01/09");
    tree.unmount();
  });
});

describe("guardas de marketing travam o disparo", () => {
  beforeEach(() => {
    mockSettings = { wa_reactivation_auto: false };
    mockGetPreview.mockClear();
    mockSend.mockClear();
    mockSaveSettings.mockClear();
  });

  it("sem consentimento: botão travado, motivo escrito e caminho para resolver", async () => {
    mockStatus = { ...STATUS_PRONTO, marketing_consent_at: null, marketing_ready: false };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    expect(tem(tree, "reativacao-enviar-travado")).toBe(true);
    expect(tem(tree, "reativacao-enviar")).toBe(false);
    expect(tem(tree, "reativacao-bloqueios")).toBe(true);
    expect(tem(tree, "reativacao-configurar-wa")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("consentimento de marketing");
    tree.unmount();
  });

  it("backend anterior à fase (sem os campos) trava igual", async () => {
    mockStatus = { ...STATUS_PRONTO };
    delete (mockStatus as any).marketing_consent_at;
    delete (mockStatus as any).marketing_ready;
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "reativacao-enviar-travado")).toBe(true);
    tree.unmount();
  });

  it("template de reativação não aprovado trava", async () => {
    mockStatus = { ...STATUS_PRONTO, templates_ready: { parcela_lembrete: true } };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "reativacao-enviar-travado")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("não foi aprovado pela Meta");
    tree.unmount();
  });
});

describe("reativação automática semanal", () => {
  beforeEach(() => {
    mockStatus = STATUS_PRONTO;
    mockSettings = { wa_reactivation_auto: false };
    mockPreview = { source: "reativacao", would_send: 4, skipped: {}, items: [] };
    mockGetPreview.mockClear();
    mockSaveSettings.mockClear();
  });

  it("LIGAR passa pela prévia e só salva depois dela", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    await act(async () => { achar(tree, "reativacao-auto").props.onValueChange(true); });
    await flush();

    expect(tem(tree, "reativacao-auto-previa")).toBe(true);
    expect(mockSaveSettings).not.toHaveBeenCalled();

    await act(async () => { achar(tree, "reativacao-auto-previa-confirmar").props.onPress(); });
    await flush();

    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
    expect(mockSaveSettings.mock.calls[0][1]).toEqual({ wa_reactivation_auto: true });
    tree.unmount();
  });

  it("DESLIGAR é imediato e não passa pela prévia", async () => {
    mockSettings = { wa_reactivation_auto: true };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    await act(async () => { achar(tree, "reativacao-auto").props.onValueChange(false); });
    await flush();

    expect(tem(tree, "reativacao-auto-previa")).toBe(false);
    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
    expect(mockSaveSettings.mock.calls[0][1]).toEqual({ wa_reactivation_auto: false });
    tree.unmount();
  });

  it("sem consentimento o interruptor fica travado", async () => {
    mockStatus = { ...STATUS_PRONTO, marketing_consent_at: null, marketing_ready: false };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "reativacao-auto-travado")).toBe(true);
    expect(tem(tree, "reativacao-auto")).toBe(false);
    tree.unmount();
  });

  it("403 do gate vira português e o interruptor volta para desligado", async () => {
    mockSaveSettings.mockImplementationOnce(() => Promise.reject(
      Object.assign(new Error("x"), { status: 403, data: { code: "ADDON_REQUIRED" } })
    ));
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    await act(async () => { achar(tree, "reativacao-auto").props.onValueChange(true); });
    await flush();
    await act(async () => { achar(tree, "reativacao-auto-previa-confirmar").props.onPress(); });
    await flush();

    expect(tem(tree, "reativacao-auto-erro")).toBe(true);
    const txt = JSON.stringify(tree.toJSON());
    // Sem `error` no corpo, quem escreve a frase é o mapeador do app —
    // e ele fala do plano que inclui o WhatsApp oficial, nunca do código.
    expect(txt).toMatch(/plano Negócio e do Aura Dojô/);
    expect(txt).not.toContain("ADDON_REQUIRED");
    tree.unmount();
  });
});
