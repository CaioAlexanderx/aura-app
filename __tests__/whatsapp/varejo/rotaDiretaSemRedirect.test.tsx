// ============================================================
// Rota direta /whatsapp (QA da Nina, 27/11/2026).
//
// Abrir o endereço direto mandava a empresa de teste (is_sandbox) ao
// Painel: o guard decidia com o que o JWT/último /me guardou (sem
// is_sandbox) antes de o /auth/me chegar. Agora a tela espera o /me.
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

var mockCompany: any = { id: "loja-1", name: "Loja" };
var mockRefresh: () => Promise<void> = () => Promise.resolve();
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { user: { id: "u", is_staff: false }, company: mockCompany, token: "t", isDemo: false };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t", refreshMe: () => mockRefresh() }) }
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
  useCustomers: () => ({ customers: [], isLoading: false, plan: "negocio", consolidatedView: false, companyCount: 1 }),
}));
jest.mock("@/services/waApi", () => {
  const actual = jest.requireActual("@/services/waApi");
  return {
    ...actual,
    waApi: {
      getStatus: () => Promise.resolve({ connected: false, phone_display: null, waba_id: null, queue: {}, schema_pending: false, addon_active: true, usage: { today_sent: 0, month_sent: 0, daily_cap: 300 } }),
      listTemplates: () => Promise.resolve({ data: [] }),
      listOutbox: () => Promise.resolve({ data: [] }),
      disconnect: jest.fn(), getPreview: jest.fn(),
    },
  };
});

import WhatsAppScreen from "@/app/(tabs)/whatsapp";

const temTestId = (tree: any, id: string) => tree.root.findAllByProps({ testID: id }).length > 0;
async function flush() {
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
}

describe("rota direta /whatsapp com a trava desligada", () => {
  it("sem is_sandbox no primeiro render e com ele depois do /me: abre, não redireciona", async () => {
    mockCompany = { id: "loja-1", name: "Loja" };
    let liberaMe: () => void = () => {};
    mockRefresh = () => new Promise<void>((ok) => {
      liberaMe = () => { mockCompany = { id: "loja-1", name: "Loja", is_sandbox: true }; ok(); };
    });
    let tree: any;
    await act(async () => { tree = renderer.create(<WhatsAppScreen />); });
    await flush();
    // /me ainda não chegou: nada de redirecionar.
    expect(temTestId(tree, "redirect")).toBe(false);
    await act(async () => { liberaMe(); });
    await act(async () => { tree.update(<WhatsAppScreen />); });
    await flush();
    expect(temTestId(tree, "redirect")).toBe(false);
    expect(temTestId(tree, "wa-varejo-real")).toBe(true);
    tree.unmount();
  });

  it("loja comum, /me confirmado sem sandbox: volta ao Painel", async () => {
    mockCompany = { id: "loja-1", name: "Loja" };
    mockRefresh = () => Promise.resolve();
    let tree: any;
    await act(async () => { tree = renderer.create(<WhatsAppScreen />); });
    await flush();
    expect(temTestId(tree, "redirect")).toBe(true);
    tree.unmount();
  });
});
