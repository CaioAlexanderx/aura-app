// ============================================================
// "Contratar acesso" no limite de funcionários da Equipe (p-106)
//
//   sem assinatura em dia        → checkout (seletor de acessos);
//   ativa e em dia, na temporada → /black-friday#assento;
//   ativa e em dia, fora dela    → WhatsApp de ajuda;
//   valor combinado              → WhatsApp de ajuda;
//   modo consolidado (sem empresa) → sem botão;
//   relê o /auth/me ao montar (plano velho no JWT).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Linking } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
var mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn(), back: jest.fn() } }));

var mockCompany: any = null;
var mockRefreshMe = jest.fn(async () => {});
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: mockCompany, refreshMe: mockRefreshMe, isDemo: false }),
}));
var mockVisible = new Set<string>(["black_friday"]);
jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => mockVisible }));
var mockLiberada = true;
jest.mock("@/hooks/useBlackFridayLiberada", () => ({ useBlackFridayLiberada: () => mockLiberada }));
var mockTemporada = true;
jest.mock("@/components/screens/configuracoes/assentoTemporada", () => ({ assentoTemporadaVisivel: () => mockTemporada }));
var mockQuote = jest.fn();
jest.mock("@/services/billingApi", () => ({ billingApi: { quote: (...a: any[]) => mockQuote(...a) } }));

import { ContratarAcessoBotao } from "@/components/ContratarAcessoBotao";
import { destinoDoContratarAcesso, MENSAGEM_WHATSAPP_ACESSO, MENSAGEM_WHATSAPP_ACESSO_COMBINADO } from "@/utils/contratarAcesso";

const espera = () => act(async () => { await new Promise((r) => setTimeout(r, 15)); });

async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><ContratarAcessoBotao /></QueryClientProvider>);
  });
  await espera();
  return tree!;
}
const botao = (tree: renderer.ReactTestRenderer) => tree.root.findAllByProps({ testID: "equipe-contratar-acesso" }, { deep: false });
async function aperta(tree: renderer.ReactTestRenderer) {
  await act(async () => { botao(tree)[0].props.onPress(); });
}

let abrir: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockCompany = { id: "emp-1", plan: "negocio", billing_cycle: "monthly", billing_status: "active" };
  mockVisible = new Set(["black_friday"]);
  mockLiberada = true;
  mockTemporada = true;
  mockQuote.mockResolvedValue({ plan: "negocio", cycle: "monthly", value: 169, custom: false, current_extra_seats: 0 });
  abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(true as any);
});
afterEach(() => { abrir.mockRestore(); });

describe("destinoDoContratarAcesso (puro)", () => {
  it("cada conta no seu caminho", () => {
    expect(destinoDoContratarAcesso({ emDia: false, combinado: false, temporada: true })).toEqual({ tipo: "checkout", rota: "/(tabs)/checkout" });
    expect(destinoDoContratarAcesso({ emDia: true, combinado: false, temporada: true })).toEqual({ tipo: "assento", rota: "/black-friday#assento" });
    expect(destinoDoContratarAcesso({ emDia: true, combinado: false, temporada: false }))
      .toEqual({ tipo: "whatsapp", url: "https://wa.me/5511956305269?text=" + encodeURIComponent(MENSAGEM_WHATSAPP_ACESSO) });
    // O combinado vence tudo, até a falta de assinatura em dia.
    for (const emDia of [true, false]) {
      expect(destinoDoContratarAcesso({ emDia, combinado: true, temporada: true }))
        .toEqual({ tipo: "whatsapp", url: "https://wa.me/5511956305269?text=" + encodeURIComponent(MENSAGEM_WHATSAPP_ACESSO_COMBINADO) });
    }
  });
});

describe("ContratarAcessoBotao", () => {
  it("'Contratar acesso' e relê o /auth/me ao montar", async () => {
    const tree = await mount();
    expect(botao(tree)).toHaveLength(1);
    expect(JSON.stringify(tree.toJSON())).toContain("Contratar acesso");
    expect(mockRefreshMe).toHaveBeenCalledTimes(1);
    // Mesma cotação que o checkout abre (Pix, extra_seats=0).
    expect(mockQuote).toHaveBeenCalledWith("emp-1", "negocio", "monthly", "PIX", 0);
    tree.unmount();
  });

  it.each(["trial", "inactive", "overdue", null])("sem assinatura em dia (%s): checkout com o seletor", async (status) => {
    mockCompany = { ...mockCompany, billing_status: status };
    const tree = await mount();
    await aperta(tree);
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/checkout");
    expect(abrir).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("ativa e em dia, na temporada: o acesso de funcionário para a temporada", async () => {
    const tree = await mount();
    await aperta(tree);
    expect(mockPush).toHaveBeenCalledWith("/black-friday#assento");
    tree.unmount();
  });

  it.each([
    ["fora da janela do assento", () => { mockTemporada = false; }],
    ["sem o módulo da Black Friday", () => { mockVisible = new Set(); }],
    ["página Black Friday não liberada", () => { mockLiberada = false; }],
  ])("ativa e em dia, %s: WhatsApp de ajuda", async (_nome, prepara) => {
    (prepara as () => void)();
    const tree = await mount();
    await aperta(tree);
    expect(mockPush).not.toHaveBeenCalled();
    expect(abrir).toHaveBeenCalledWith("https://wa.me/5511956305269?text=" + encodeURIComponent(MENSAGEM_WHATSAPP_ACESSO));
    tree.unmount();
  });

  it("valor combinado (custom na cotação): WhatsApp de ajuda", async () => {
    mockCompany = { ...mockCompany, billing_status: "inactive" };
    mockQuote.mockResolvedValue({ plan: "negocio", cycle: "monthly", value: 211.2, custom: true, extra_seats_ignored: true });
    const tree = await mount();
    await aperta(tree);
    expect(mockPush).not.toHaveBeenCalled();
    expect(abrir).toHaveBeenCalledWith("https://wa.me/5511956305269?text=" + encodeURIComponent(MENSAGEM_WHATSAPP_ACESSO_COMBINADO));
    tree.unmount();
  });

  it("modo consolidado (sem empresa): sem botão", async () => {
    mockCompany = null;
    const tree = await mount();
    expect(botao(tree)).toHaveLength(0);
    expect(mockQuote).not.toHaveBeenCalled();
    tree.unmount();
  });
});
