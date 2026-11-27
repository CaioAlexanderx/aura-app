// ============================================================
// Tela do WhatsApp oficial para a equipe Aura (26/11/2026).
//
// A Meta aprovou o App Review em 25/11. Antes de ligar a trava para as
// lojas (utils/whatsappOficialLiberado), a equipe Aura (is_staff que o
// backend devolve no usuário) já abre a tela: o Caio conecta o número da
// própria Aura, logado na empresa "Aura.", pelo Embedded Signup.
//
// O que este arquivo segura, com a trava DESLIGADA e o número da loja
// AINDA NÃO conectado:
//   - equipe: a tela abre na aba Conexão, com "Conectar WhatsApp" e a
//     escolha do modo; Coexistência vem marcada e chega à Meta e ao
//     backend (featureType do onboarding pelo app, mode: coexistence);
//   - lojista: nada muda — volta ao Painel (Redirect), sem botão.
//
// react-test-renderer direto, como em telaReal.test.tsx: sob
// react-native-web a identidade vem do testID.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
  Redirect: ({ href }: any) => {
    const R = require("react");
    return R.createElement("Redirect", { testID: "redirect", href });
  },
}));

jest.mock("@/components/screens/whatsapp/TabConversas", () => ({ TabConversas: () => null }));
jest.mock("@/components/screens/whatsapp/TabAutomacoes", () => ({ TabAutomacoes: () => null }));
jest.mock("@/components/screens/whatsapp/TabCampanhas", () => ({ TabCampanhas: () => null }));
jest.mock("@/components/screens/whatsapp/TabConfig", () => ({ TabConfig: () => null }));

jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => new Set<string>() }));
jest.mock("@/components/screens/hub/HubView", () => ({ HubView: () => null }));

var mockUser: any = null;
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = {
        user: mockUser,
        company: { id: "aura-1", name: "Aura." },
        token: "t",
        isDemo: false,
      };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));

jest.mock("@/hooks/useWhatsApp", () => ({
  useWhatsApp: () => ({
    conversations: [], messages: [], automations: [], campaigns: [],
    unreadCount: 0, openCount: 0, activeAutomations: 0, totalSent: 0,
    isConnected: false, isDemo: false, isLoading: false,
    toggleAutomation: jest.fn(), sendMessage: jest.fn(),
  }),
}));
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({
    customers: [], isLoading: false, plan: "negocio",
    consolidatedView: false, companyCount: 1,
  }),
}));

// Número ainda não conectado, Embedded Signup configurado no backend.
var mockStatus: any = {
  connected: false, phone_display: null, waba_id: null, queue: {},
  schema_pending: false, addon_active: true,
  usage: { today_sent: 0, month_sent: 0, daily_cap: 300 },
  embedded_signup: { app_id: "1496711532094674", config_id: "cfg-1", graph_version: "v21.0" },
};
var mockConnect = jest.fn((..._a: any[]) =>
  Promise.resolve({ connected: true, subscribed: true, registered: true, warnings: [] as string[] })
);
jest.mock("@/services/waApi", () => {
  const actual = jest.requireActual("@/services/waApi");
  return {
    ...actual,
    waApi: {
      getStatus: () => Promise.resolve(mockStatus),
      listTemplates: () => Promise.resolve({ data: [] }),
      listOutbox: () => Promise.resolve({ data: [] }),
      createTemplate: jest.fn(() => Promise.resolve({ name: "x", language: "pt_BR" })),
      syncTemplates: jest.fn(() => Promise.resolve({ synced: 0 })),
      connect: (...a: any[]) => mockConnect(...a),
      disconnect: jest.fn(), getPreview: jest.fn(),
    },
  };
});

import WhatsAppScreen from "@/app/(tabs)/whatsapp";
import { WHATSAPP_OFICIAL_LIBERADO } from "@/utils/whatsappOficialLiberado";

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

async function montar() {
  let tree: any;
  await act(async () => { tree = renderer.create(<WhatsAppScreen />); });
  await flush();
  return tree;
}

describe("tela do WhatsApp oficial depois da virada (trava ligada)", () => {
  beforeEach(() => {
    instalarFbFake();
    mockConnect.mockClear();
    mockUser = null;
  });

  it("a trava está ligada para as lojas (virada de 27/11/2026)", () => {
    expect(WHATSAPP_OFICIAL_LIBERADO).toBe(true);
  });

  it("lojista sem número conectado: a tela abre com o botão de conectar, sem voltar ao Painel", async () => {
    mockUser = { id: "u-1", email: "dona@loja.com.br", is_staff: false };
    const tree = await montar();
    expect(temTestId(tree, "redirect")).toBe(false);
    expect(temTestId(tree, "wa-varejo-real")).toBe(true);
    expect(temTestId(tree, "wa-varejo-conectar")).toBe(true);
    tree.unmount();
  });

  it("equipe Aura: a tela abre com 'Conectar WhatsApp' e Coexistência marcada", async () => {
    mockUser = { id: "u-2", email: "caio@getaura.com.br", is_staff: true };
    const tree = await montar();
    expect(temTestId(tree, "redirect")).toBe(false);
    expect(temTestId(tree, "wa-varejo-real")).toBe(true);
    expect(temTestId(tree, "wa-varejo-conexao-disponivel")).toBe(true);
    expect(temTestId(tree, "wa-varejo-conectar")).toBe(true);
    const radio = (id: string) => tree.root.findAllByProps({ testID: id, accessibilityRole: "radio" })[0];
    expect(radio("wa-varejo-modo-coexistence").props.accessibilityState.checked).toBe(true);
    expect(radio("wa-varejo-modo-padrao").props.accessibilityState.checked).toBe(false);
    expect(temTestId(tree, "wa-varejo-modo-hint")).toBe(true);
    tree.unmount();
  });

  it("equipe Aura: conectar em Coexistência chega à Meta e ao backend com mode: coexistence", async () => {
    mockUser = { id: "u-2", is_staff: true };
    const tree = await montar();

    // Vai para "número novo" e volta: a escolha do modo responde.
    await act(async () => { tree.root.findAllByProps({ testID: "wa-varejo-modo-padrao" })[0].props.onPress(); });
    expect(temTestId(tree, "wa-varejo-modo-hint")).toBe(false);
    await act(async () => { tree.root.findAllByProps({ testID: "wa-varejo-modo-coexistence" })[0].props.onPress(); });
    expect(temTestId(tree, "wa-varejo-modo-hint")).toBe(true);

    await act(async () => { tree.root.findAllByProps({ testID: "wa-varejo-conectar" })[0].props.onPress(); });
    expect(ultimoLogin).not.toBeNull();
    expect(ultimoLogin!.opts.config_id).toBe("cfg-1");
    expect(ultimoLogin!.opts.extras).toEqual({
      setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3",
    });

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify({
          type: "WA_EMBEDDED_SIGNUP", event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
          data: { phone_number_id: "pn-aura", waba_id: "waba-aura" },
        }),
        origin: "https://www.facebook.com",
      }));
    });
    await act(async () => { ultimoLogin!.cb({ authResponse: { code: "code-aura" } }); });
    await flush();

    expect(mockConnect).toHaveBeenCalledWith("aura-1", {
      code: "code-aura", waba_id: "waba-aura", phone_number_id: "pn-aura", mode: "coexistence",
    });
    tree.unmount();
  });
});
