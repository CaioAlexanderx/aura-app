// ============================================================
// Conectar o número do dojô pelo Embedded Signup (Fase 3b).
//
// O popup do Facebook devolve o `waba_id`/`phone_number_id` por
// window.postMessage. Isso é uma porta aberta na página: QUALQUER
// iframe pode postar uma mensagem parecida. O teste que mais importa
// aqui é o de origem — uma mensagem de evil.com não pode virar um
// waba_id enviado ao nosso backend.
//
// Os outros três seguram o que o sensei vê: no celular não existe
// popup (orientação, não botão morto); sem config_id vindo do backend
// o botão não aparece; conectado, aparece o número e o "Desconectar".
//
// react-test-renderer direto (não RTL) — moduleNameMapper aponta
// react-native → react-native-web e tudo vira div; a identidade vem do
// testID. O <Modal> do RNW monta por portal do ReactDOM, que o
// react-test-renderer não hospeda: vira passa-adiante.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return { ...RN, Modal: ({ visible, children }: any) => (visible ? children : null) };
});
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

var mockConnect = jest.fn(() => Promise.resolve({ connected: true, subscribed: true, registered: true, warnings: [] as string[] }));
var mockDisconnect = jest.fn(() => Promise.resolve());
jest.mock("@/services/waApi", () => ({
  waApi: {
    connect: (...a: any[]) => mockConnect.apply(null, a as any),
    disconnect: (...a: any[]) => mockDisconnect.apply(null, a as any),
  },
}));

import { WaConnectCard } from "@/components/karate/dojoWhatsapp/WaConnectCard";
import { waConnectMode } from "@/components/karate/dojoWhatsapp/helpers";

const EMBEDDED = { app_id: "1496711532094674", config_id: "cfg-1", graph_version: "v21.0" };

const STATUS_DESCONECTADO: any = {
  connected: false, phone_display: null, waba_id: null, queue: {},
  schema_pending: false, embedded_signup: EMBEDDED,
};
const STATUS_CONECTADO: any = {
  ...STATUS_DESCONECTADO, connected: true, phone_display: "5511912345678", waba_id: "waba-9",
};

// Guarda o último FB.login para inspecionar opções e disparar o callback.
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

function botao(tree: any, label: string) {
  const achados = tree.root.findAllByProps({ accessibilityLabel: label });
  return achados.length ? achados[0] : null;
}

function postarDaMeta(data: any, origin: string) {
  window.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data), origin }));
}

describe("waConnectMode — o que o cartão mostra", () => {
  it("web com config do backend: botão de conectar", () => {
    expect(waConnectMode(true, STATUS_DESCONECTADO)).toBe("conectar");
  });
  it("web sem app_id/config_id: indisponível, nunca um popup que a Meta recusaria", () => {
    expect(waConnectMode(true, { ...STATUS_DESCONECTADO, embedded_signup: null })).toBe("indisponivel");
    expect(waConnectMode(true, { ...STATUS_DESCONECTADO, embedded_signup: { app_id: "x" } } as any)).toBe("indisponivel");
    // Backend anterior à Fase 1 nem manda o campo.
    expect(waConnectMode(true, { connected: false, phone_display: null, waba_id: null, queue: {}, schema_pending: false } as any))
      .toBe("indisponivel");
  });
  it("no celular vira orientação, não botão", () => {
    expect(waConnectMode(false, STATUS_DESCONECTADO)).toBe("nativo");
  });
  it("token vencido pede reconexão; conectado não pede nada", () => {
    expect(waConnectMode(true, { ...STATUS_DESCONECTADO, token_expired: true })).toBe("reconectar");
    expect(waConnectMode(true, STATUS_CONECTADO)).toBe("conectado");
    // Conectado mas com token vencido continua sendo reconexão.
    expect(waConnectMode(true, { ...STATUS_CONECTADO, token_expired: true })).toBe("reconectar");
  });
});

describe("WaConnectCard na tela", () => {
  beforeEach(() => {
    instalarFbFake();
    mockConnect.mockClear();
    mockDisconnect.mockClear();
  });

  it("com config do backend, oferece o botão de conectar", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<WaConnectCard companyId="dojo-1" status={STATUS_DESCONECTADO} onChanged={() => {}} />);
    });
    await flush();
    expect(temTestId(tree, "wa-connect-disponivel")).toBe(true);
    expect(temTestId(tree, "wa-connect-indisponivel")).toBe(false);
    tree.unmount();
  });

  it("sem config_id, explica em vez de mostrar botão", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <WaConnectCard companyId="dojo-1" status={{ ...STATUS_DESCONECTADO, embedded_signup: null }} onChanged={() => {}} />
      );
    });
    await flush();
    expect(temTestId(tree, "wa-connect-indisponivel")).toBe(true);
    expect(temTestId(tree, "wa-connect-disponivel")).toBe(false);
    tree.unmount();
  });

  it("conectado: mostra o número e o caminho para desconectar", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<WaConnectCard companyId="dojo-1" status={STATUS_CONECTADO} onChanged={() => {}} />);
    });
    await flush();
    expect(temTestId(tree, "wa-connect-conectado")).toBe(true);
    expect(temTestId(tree, "wa-disconnect-btn")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("+55 (11) 91234-5678");
    // Sem coexistence no status, nenhum selo "Também no celular".
    expect(temTestId(tree, "wa-connect-coexistence-badge")).toBe(false);
    tree.unmount();
  });

  it("conectado em coexistence: mostra o selo 'Também no celular'", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <WaConnectCard companyId="dojo-1" status={{ ...STATUS_CONECTADO, coexistence: true }} onChanged={() => {}} />
      );
    });
    await flush();
    expect(temTestId(tree, "wa-connect-coexistence-badge")).toBe(true);
    tree.unmount();
  });

  it("escolha do número: coexistence vem marcado por default, e dá para trocar para padrão", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<WaConnectCard companyId="dojo-1" status={STATUS_DESCONECTADO} onChanged={() => {}} />);
    });
    await flush();
    // findAllByProps também casa o wrapper ModeOption (só tem testID, sem
    // accessibilityState) — accessibilityRole:"radio" pega o Pressable de dentro.
    const radio = (id: string) => tree.root.findAllByProps({ testID: id, accessibilityRole: "radio" })[0];
    expect(radio("wa-connect-modo-coexistence").props.accessibilityState.checked).toBe(true);
    expect(radio("wa-connect-modo-padrao").props.accessibilityState.checked).toBe(false);
    expect(temTestId(tree, "wa-connect-modo-hint")).toBe(true);

    await act(async () => { radio("wa-connect-modo-padrao").props.onPress(); });
    expect(radio("wa-connect-modo-coexistence").props.accessibilityState.checked).toBe(false);
    expect(radio("wa-connect-modo-padrao").props.accessibilityState.checked).toBe(true);
    expect(temTestId(tree, "wa-connect-modo-hint")).toBe(false);
    tree.unmount();
  });

  it("desconectar só depois de confirmar", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<WaConnectCard companyId="dojo-1" status={STATUS_CONECTADO} onChanged={() => {}} />);
    });
    await flush();
    expect(mockDisconnect).not.toHaveBeenCalled();

    await act(async () => { tree.root.findAllByProps({ testID: "wa-disconnect-btn" })[0].props.onPress(); });
    await flush();
    // Agora sim o botão destrutivo existe.
    const confirmar = botao(tree, "Desconectar");
    expect(confirmar).not.toBeNull();
    await act(async () => { confirmar.props.onPress(); });
    await flush();
    expect(mockDisconnect).toHaveBeenCalledWith("dojo-1");
    tree.unmount();
  });

  it("FB.login vai com os parâmetros do Embedded Signup e o code chega ao backend (default: coexistence)", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<WaConnectCard companyId="dojo-1" status={STATUS_DESCONECTADO} onChanged={() => {}} />);
    });
    await flush();

    // Nenhum radio foi tocado — o default da tela é "coexistence" (Fase
    // coexistence/set-2026): a maioria dos dojôs já usa o número no app.
    await act(async () => { botao(tree, "Conectar meu WhatsApp").props.onPress(); });
    expect(ultimoLogin).not.toBeNull();
    expect(ultimoLogin!.opts).toEqual({
      config_id: "cfg-1",
      response_type: "code",
      override_default_response_type: true,
      extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
    });

    // A Meta posta o FINISH antes de o popup fechar.
    await act(async () => {
      postarDaMeta(
        { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { phone_number_id: "pn-1", waba_id: "waba-1" } },
        "https://www.facebook.com"
      );
    });
    await act(async () => { ultimoLogin!.cb({ authResponse: { code: "code-abc" } }); });
    await flush();

    expect(mockConnect).toHaveBeenCalledWith("dojo-1", {
      code: "code-abc", waba_id: "waba-1", phone_number_id: "pn-1", mode: "coexistence",
    });
    tree.unmount();
  });

  it("modo padrão: escolhendo 'número novo' o featureType e o mode voltam ao valor histórico", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<WaConnectCard companyId="dojo-1" status={STATUS_DESCONECTADO} onChanged={() => {}} />);
    });
    await flush();

    await act(async () => { tree.root.findAllByProps({ testID: "wa-connect-modo-padrao" })[0].props.onPress(); });
    await act(async () => { botao(tree, "Conectar meu WhatsApp").props.onPress(); });
    expect(ultimoLogin!.opts).toEqual({
      config_id: "cfg-1",
      response_type: "code",
      override_default_response_type: true,
      extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
    });

    await act(async () => {
      postarDaMeta(
        { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { phone_number_id: "pn-2", waba_id: "waba-2" } },
        "https://www.facebook.com"
      );
    });
    await act(async () => { ultimoLogin!.cb({ authResponse: { code: "code-xyz" } }); });
    await flush();

    expect(mockConnect).toHaveBeenCalledWith("dojo-1", {
      code: "code-xyz", waba_id: "waba-2", phone_number_id: "pn-2", mode: "padrao",
    });
    tree.unmount();
  });

  it("coexistence: aceita o evento FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING igual ao FINISH", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<WaConnectCard companyId="dojo-1" status={STATUS_DESCONECTADO} onChanged={() => {}} />);
    });
    await flush();

    await act(async () => { botao(tree, "Conectar meu WhatsApp").props.onPress(); });
    await act(async () => {
      postarDaMeta(
        {
          type: "WA_EMBEDDED_SIGNUP",
          event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
          data: { phone_number_id: "pn-coex", waba_id: "waba-coex" },
        },
        "https://www.facebook.com"
      );
    });
    await act(async () => { ultimoLogin!.cb({ authResponse: { code: "code-coex" } }); });
    await flush();

    expect(mockConnect).toHaveBeenCalledWith("dojo-1", {
      code: "code-coex", waba_id: "waba-coex", phone_number_id: "pn-coex", mode: "coexistence",
    });
    tree.unmount();
  });

  it("mensagem de origem estranha é ignorada — ninguém injeta um waba_id alheio", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<WaConnectCard companyId="dojo-1" status={STATUS_DESCONECTADO} onChanged={() => {}} />);
    });
    await flush();

    await act(async () => { botao(tree, "Conectar meu WhatsApp").props.onPress(); });
    await act(async () => {
      postarDaMeta(
        { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { phone_number_id: "pn-hostil", waba_id: "waba-hostil" } },
        "https://evil.example.com"
      );
    });
    await act(async () => { ultimoLogin!.cb({ authResponse: { code: "code-abc" } }); });
    await flush();

    expect(mockConnect).toHaveBeenCalledWith("dojo-1", {
      code: "code-abc", waba_id: null, phone_number_id: null, mode: "coexistence",
    });
    tree.unmount();
  });

  it("popup fechado sem code: explica e não chama o backend", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<WaConnectCard companyId="dojo-1" status={STATUS_DESCONECTADO} onChanged={() => {}} />);
    });
    await flush();

    await act(async () => { botao(tree, "Conectar meu WhatsApp").props.onPress(); });
    await act(async () => {
      postarDaMeta(
        { type: "WA_EMBEDDED_SIGNUP", event: "CANCEL", data: { current_step: "PHONE_NUMBER_SELECTION" } },
        "https://www.facebook.com"
      );
    });
    await act(async () => { ultimoLogin!.cb({ status: "unknown" }); });
    await flush();

    expect(mockConnect).not.toHaveBeenCalled();
    expect(temTestId(tree, "wa-connect-erro")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("PHONE_NUMBER_SELECTION");
    tree.unmount();
  });

  it("conexão parcial vira aviso, não silêncio", async () => {
    mockConnect.mockImplementationOnce(() =>
      Promise.resolve({ connected: true, subscribed: false, registered: false, warnings: [] })
    );
    let tree: any;
    await act(async () => {
      tree = renderer.create(<WaConnectCard companyId="dojo-1" status={STATUS_DESCONECTADO} onChanged={() => {}} />);
    });
    await flush();
    await act(async () => { botao(tree, "Conectar meu WhatsApp").props.onPress(); });
    await act(async () => { ultimoLogin!.cb({ authResponse: { code: "c" } }); });
    await flush();
    expect(temTestId(tree, "wa-connect-warnings")).toBe(true);
    tree.unmount();
  });
});
