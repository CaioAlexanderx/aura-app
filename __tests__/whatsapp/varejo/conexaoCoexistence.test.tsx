// ============================================================
// ConexaoCard — escolha de modo (Coexistence x padrão) no varejo.
//
// Espelha __tests__/karate/dojoWhatsapp/conectarNumero.test.tsx: a
// mecânica do popup é a mesma (useWaEmbeddedSignup), só o desenho do
// cartão muda. O que este arquivo garante, específico do varejo:
//   - o default da tela é "coexistence" (a maioria das lojas já usa o
//     número no app WhatsApp Business do celular);
//   - trocar para "número novo" volta o featureType/mode ao valor
//     histórico (modo padrão, sem quebrar quem já usa hoje);
//   - o selo "Também no celular" só aparece com status.coexistence.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

var mockConnect = jest.fn(() => Promise.resolve({ connected: true, subscribed: true, registered: true, warnings: [] as string[] }));
var mockDisconnect = jest.fn(() => Promise.resolve());
jest.mock("@/services/waApi", () => ({
  waApi: {
    connect: (...a: any[]) => mockConnect.apply(null, a as any),
    disconnect: (...a: any[]) => mockDisconnect.apply(null, a as any),
  },
}));

import { ConexaoCard } from "@/components/whatsapp/ConexaoCard";

const EMBEDDED = { app_id: "1496711532094674", config_id: "cfg-1", graph_version: "v21.0" };

const STATUS_DESCONECTADO: any = {
  connected: false, phone_display: null, waba_id: null, queue: {},
  schema_pending: false, embedded_signup: EMBEDDED,
};
const STATUS_CONECTADO: any = {
  ...STATUS_DESCONECTADO, connected: true, phone_display: "5511912345678", waba_id: "waba-9",
};

let ultimoLogin: { cb: (r: any) => void; opts: any } | null = null;

function instalarFbFake() {
  ultimoLogin = null;
  (window as any).FB = {
    init: jest.fn(),
    login: (cb: any, opts: any) => { ultimoLogin = { cb, opts }; },
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function temTestId(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}

function postarDaMeta(data: any, origin: string) {
  window.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data), origin }));
}

describe("ConexaoCard — modo do número (Coexistence)", () => {
  beforeEach(() => {
    instalarFbFake();
    mockConnect.mockClear();
    mockDisconnect.mockClear();
  });

  it("coexistence vem marcado por default e mostra o aviso do QR code", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<ConexaoCard companyId="loja-1" status={STATUS_DESCONECTADO} onChanged={() => {}} />);
    });
    await flush();
    // findAllByProps também casa o wrapper ModeOption (só tem testID, sem
    // accessibilityState) — accessibilityRole:"radio" pega o Pressable de dentro.
    const radio = (id: string) => tree.root.findAllByProps({ testID: id, accessibilityRole: "radio" })[0];
    expect(radio("wa-varejo-modo-coexistence").props.accessibilityState.checked).toBe(true);
    expect(radio("wa-varejo-modo-padrao").props.accessibilityState.checked).toBe(false);
    expect(temTestId(tree, "wa-varejo-modo-hint")).toBe(true);
    tree.unmount();
  });

  it("default coexistence: FB.login manda o featureType do onboarding pelo app e o code chega com mode: coexistence", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<ConexaoCard companyId="loja-1" status={STATUS_DESCONECTADO} onChanged={() => {}} />);
    });
    await flush();

    await act(async () => { tree.root.findAllByProps({ testID: "wa-varejo-conectar" })[0].props.onPress(); });
    expect(ultimoLogin).not.toBeNull();
    expect(ultimoLogin!.opts.extras).toEqual({
      setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3",
    });

    await act(async () => {
      postarDaMeta(
        { type: "WA_EMBEDDED_SIGNUP", event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", data: { phone_number_id: "pn-1", waba_id: "waba-1" } },
        "https://www.facebook.com"
      );
    });
    await act(async () => { ultimoLogin!.cb({ authResponse: { code: "code-abc" } }); });
    await flush();

    expect(mockConnect).toHaveBeenCalledWith("loja-1", {
      code: "code-abc", waba_id: "waba-1", phone_number_id: "pn-1", mode: "coexistence",
    });
    tree.unmount();
  });

  it("trocando para 'número novo': featureType e mode voltam ao valor histórico (padrão)", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<ConexaoCard companyId="loja-1" status={STATUS_DESCONECTADO} onChanged={() => {}} />);
    });
    await flush();

    await act(async () => { tree.root.findAllByProps({ testID: "wa-varejo-modo-padrao" })[0].props.onPress(); });
    expect(temTestId(tree, "wa-varejo-modo-hint")).toBe(false);

    await act(async () => { tree.root.findAllByProps({ testID: "wa-varejo-conectar" })[0].props.onPress(); });
    expect(ultimoLogin!.opts.extras).toEqual({ setup: {}, featureType: "", sessionInfoVersion: "3" });

    await act(async () => {
      postarDaMeta(
        { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { phone_number_id: "pn-2", waba_id: "waba-2" } },
        "https://www.facebook.com"
      );
    });
    await act(async () => { ultimoLogin!.cb({ authResponse: { code: "code-xyz" } }); });
    await flush();

    expect(mockConnect).toHaveBeenCalledWith("loja-1", {
      code: "code-xyz", waba_id: "waba-2", phone_number_id: "pn-2", mode: "padrao",
    });
    tree.unmount();
  });

  it("selo 'Também no celular' só aparece com status.coexistence true", async () => {
    let treeSem: any;
    await act(async () => {
      treeSem = renderer.create(<ConexaoCard companyId="loja-1" status={STATUS_CONECTADO} onChanged={() => {}} />);
    });
    await flush();
    expect(temTestId(treeSem, "wa-varejo-coexistence-badge")).toBe(false);
    treeSem.unmount();

    let treeCom: any;
    await act(async () => {
      treeCom = renderer.create(
        <ConexaoCard companyId="loja-1" status={{ ...STATUS_CONECTADO, coexistence: true }} onChanged={() => {}} />
      );
    });
    await flush();
    expect(temTestId(treeCom, "wa-varejo-coexistence-badge")).toBe(true);
    treeCom.unmount();
  });
});
