// ============================================================
// A virada do WhatsApp (27/11/2026): trava LIGADA. A loja comum (sem
// sandbox, sem equipe, sem número conectado) vê as abas novas e NÃO vê
// os cartões que a tela nova substitui (Uso do mês, Mensagens de
// marketing, link da régua, cartão de aniversário do Painel).
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

jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { user: { id: "u", is_staff: false }, company: { id: "loja-1", name: "Loja" }, token: "t", isDemo: false };
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
import { WHATSAPP_OFICIAL_LIBERADO } from "@/utils/whatsappOficialLiberado";

const temTestId = (tree: any, id: string) => tree.root.findAllByProps({ testID: id }).length > 0;
async function flush() {
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
}

describe("virada: trava ligada, loja comum", () => {
  it("a trava está ligada", () => {
    expect(WHATSAPP_OFICIAL_LIBERADO).toBe(true);
  });

  it("vê Automáticas, Venda+ e Configurações, sem redirecionar", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<WhatsAppScreen />); });
    await flush();
    expect(temTestId(tree, "redirect")).toBe(false);
    expect(temTestId(tree, "wa-varejo-aba-automaticas")).toBe(true);
    expect(temTestId(tree, "wa-varejo-aba-venda_mais")).toBe(true);
    expect(temTestId(tree, "wa-varejo-aba-config")).toBe(true);
    tree.unmount();
  });

  it("Configurações tem Aniversário e Crediário, e nenhum cartão antigo", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<WhatsAppScreen />); });
    await flush();
    const aba = tree.root.findAllByProps({ testID: "wa-varejo-aba-config" })[0];
    await act(async () => { aba.props.onPress(); });
    await flush();
    expect(temTestId(tree, "wa-varejo-secao-aniversario")).toBe(true);
    expect(temTestId(tree, "wa-varejo-secao-crediario")).toBe(true);
    for (const id of ["wa-varejo-uso", "wa-varejo-cota", "wa-marketing-consentimento", "wa-marketing-qualidade", "wa-varejo-ir-para-regua"]) {
      expect(temTestId(tree, id)).toBe(false);
    }
    tree.unmount();
  });
});
