// ============================================================
// A régua do crediário liga o WhatsApp oficial (Fase 6j).
//
// A Valen tem 1938 parcelas em aberto. Um clique errado aqui é uma
// fatura da Meta, não um bug de UI. Estes testes seguram:
//
// 1. o interruptor fica TRAVADO enquanto faltar plano/addon, conexão ou
//    os dois templates aprovados — inclusive quando o backend é antigo e
//    simplesmente não devolve `templates_ready` (ausente bloqueia igual
//    a false);
// 2. LIGAR não salva nada antes da prévia: o lojista vê quantos clientes
//    receberiam hoje e só então existe o botão Ativar;
// 3. DESLIGAR é livre e imediato, sem prévia — quem está gastando tem
//    que poder parar mesmo com o /status fora do ar;
// 4. o 403/409 do backend chega em português, nunca como código.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

// O <Modal> do react-native-web monta por portal do ReactDOM, e o
// react-test-renderer não tem onde pendurar um portal. Aqui o
// ResponsiveSheet vira passa-adiante: invisível não renderiza, visível
// renderiza na própria árvore — que é tudo o que estes testes olham.
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

var mockRules: any = {
  company_id: "loja-1", enabled: true, whatsapp_connected: false, pix_key: "loja@exemplo.com",
  whatsapp_auto: false,
  rules: [
    { id: "lembrete", name: "Lembrete", days_relative: -3, template: "oi", channel: "whatsapp", enabled: true },
    { id: "bloqueio", name: "Aviso de bloqueio", days_relative: 15, template: "x", channel: "system", enabled: false },
  ],
};
var mockUpdateRules = jest.fn((_id: string, body: any) => Promise.resolve({ ...mockRules, ...body }));
jest.mock("@/services/creditApi", () => ({
  creditApi: {
    getPlanConfig: () => Promise.resolve({ max_installments: 12, min_installment_value: 20 }),
    getCollectionRules: () => Promise.resolve(mockRules),
    updatePlanConfig: jest.fn(() => Promise.resolve({})),
    updateCollectionRules: (id: string, body: any) => mockUpdateRules(id, body),
  },
}));

var mockStatus: any = null;
var mockPreview: any = { date: "2026-09-14", would_send: 4, skipped: { OPT_OUT: 1 }, items: [] };
var mockGetPreview = jest.fn((_id: string, _o: any) => Promise.resolve(mockPreview));
jest.mock("@/services/waApi", () => {
  const actual = jest.requireActual("@/services/waApi");
  return {
    ...actual,
    waApi: {
      getStatus: () => Promise.resolve(mockStatus),
      getPreview: (id: string, o: any) => mockGetPreview(id, o),
    },
  };
});

import CrediarioSettingsScreen from "@/app/crediario/settings";

const STATUS_LIBERADO = {
  connected: true,
  phone_display: "5511912345678",
  waba_id: "w1",
  queue: {},
  schema_pending: false,
  addon_active: true,
  template_ready: true,
  templates_ready: { parcela_lembrete: true, parcela_atraso: true },
  paused_reason: null,
  usage: { today_sent: 1, month_sent: 12, daily_cap: 300 },
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderer.create(
    <QueryClientProvider client={qc}>
      <CrediarioSettingsScreen />
    </QueryClientProvider>
  );
}

function temTestId(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}

function acharPorTestId(tree: any, id: string): any {
  return tree.root.findAllByProps({ testID: id })[0];
}

describe("interruptor do WhatsApp oficial na régua do crediário", () => {
  beforeEach(() => {
    mockRules = { ...mockRules, whatsapp_auto: false };
    mockPreview = { date: "2026-09-14", would_send: 4, skipped: { OPT_OUT: 1 }, items: [] };
    mockUpdateRules.mockClear();
    mockGetPreview.mockClear();
  });

  it("sem os templates aprovados: travado e com o motivo na tela", async () => {
    mockStatus = { ...STATUS_LIBERADO, templates_ready: { parcela_lembrete: true } };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    expect(temTestId(tree, "crediario-wa-switch-travado")).toBe(true);
    expect(temTestId(tree, "crediario-wa-switch")).toBe(false);
    expect(temTestId(tree, "crediario-wa-motivos")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("ainda não foram aprovados pela Meta");
    // E oferece o caminho para resolver, em vez de só reclamar.
    expect(temTestId(tree, "crediario-wa-configurar")).toBe(true);
    tree.unmount();
  });

  it("backend antigo (sem templates_ready) bloqueia igual — omissão nunca libera", async () => {
    mockStatus = { ...STATUS_LIBERADO };
    delete (mockStatus as any).templates_ready;
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    expect(temTestId(tree, "crediario-wa-switch-travado")).toBe(true);
    tree.unmount();
  });

  it("sem plano nem addon: travado com o texto comercial", async () => {
    mockStatus = { ...STATUS_LIBERADO, addon_active: false };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    expect(temTestId(tree, "crediario-wa-switch-travado")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("não está no seu plano");
    tree.unmount();
  });

  it("status fora do ar: travado, sem liberar por omissão", async () => {
    mockStatus = null;
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(temTestId(tree, "crediario-wa-switch-travado")).toBe(true);
    tree.unmount();
  });

  it("tudo aprovado: LIGAR abre a prévia e não salva nada antes dela", async () => {
    mockStatus = STATUS_LIBERADO;
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    expect(temTestId(tree, "crediario-wa-switch")).toBe(true);
    expect(temTestId(tree, "crediario-wa-previa")).toBe(false);

    await act(async () => { acharPorTestId(tree, "crediario-wa-switch").props.onValueChange(true); });
    await flush();

    expect(temTestId(tree, "crediario-wa-previa")).toBe(true);
    expect(mockGetPreview).toHaveBeenCalled();
    // A prévia é a do crediário, não a da mensalidade do dojô.
    expect(mockGetPreview.mock.calls[0][1]).toEqual({ source: "crediario" });
    expect(mockUpdateRules).not.toHaveBeenCalled();

    // Só depois do Ativar o PUT sai — e sai com whatsapp_auto true.
    await act(async () => { acharPorTestId(tree, "crediario-wa-previa-ativar").props.onPress(); });
    await flush();

    expect(mockUpdateRules).toHaveBeenCalledTimes(1);
    expect(mockUpdateRules.mock.calls[0][1].whatsapp_auto).toBe(true);
    tree.unmount();
  });

  it("desligar é imediato e não passa pela prévia", async () => {
    mockStatus = STATUS_LIBERADO;
    mockRules = { ...mockRules, whatsapp_auto: true };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    await act(async () => { acharPorTestId(tree, "crediario-wa-switch").props.onValueChange(false); });
    await flush();

    expect(temTestId(tree, "crediario-wa-previa")).toBe(false);
    expect(mockGetPreview).not.toHaveBeenCalled();
    expect(mockUpdateRules).toHaveBeenCalledTimes(1);
    expect(mockUpdateRules.mock.calls[0][1].whatsapp_auto).toBe(false);
    tree.unmount();
  });

  it("403 do gate vira português e o interruptor volta para desligado", async () => {
    mockStatus = STATUS_LIBERADO;
    mockUpdateRules.mockImplementationOnce(() => Promise.reject(
      Object.assign(new Error("x"), { status: 403, data: { code: "ADDON_REQUIRED" } })
    ));
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();

    await act(async () => { acharPorTestId(tree, "crediario-wa-switch").props.onValueChange(true); });
    await flush();
    await act(async () => { acharPorTestId(tree, "crediario-wa-previa-ativar").props.onPress(); });
    await flush();

    expect(temTestId(tree, "crediario-wa-erro")).toBe(true);
    const txt = JSON.stringify(tree.toJSON());
    expect(txt).toContain("adicional do plano");
    expect(txt).not.toContain("ADDON_REQUIRED");
    tree.unmount();
  });

  it("chip por etapa diz se a cobrança sai sozinha ou pelo wa.me", async () => {
    mockStatus = STATUS_LIBERADO;
    mockRules = { ...mockRules, whatsapp_auto: false };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(JSON.stringify(tree.toJSON())).toContain("manual (wa.me)");
    // A etapa de canal 'system' (aviso de bloqueio) não ganha chip.
    expect(temTestId(tree, "crediario-canal-bloqueio")).toBe(false);
    expect(temTestId(tree, "crediario-canal-lembrete")).toBe(true);
    tree.unmount();

    mockRules = { ...mockRules, whatsapp_auto: true };
    let tree2: any;
    await act(async () => { tree2 = montar(); });
    await flush();
    expect(JSON.stringify(tree2.toJSON())).toContain("automático");
    tree2.unmount();
  });
});
