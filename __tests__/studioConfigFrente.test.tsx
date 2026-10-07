// ============================================================
// Aura Studio › Configurações › "Frente da loja" (07/10/2026)
// Empresa Studio não chega em /configuracoes (o guard raiz devolve para
// /studio): a saída do Studio mora aqui. Mesmo controle do varejo
// (FrenteDaLoja) — seta só para dono/admin/staff; trocar studio → outra
// frente chama a API, grava o store ANTES de redirecionar e vai a /(tabs).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  return { router, useRouter: () => router };
});
jest.mock("@/components/MembersSection", () => ({ MembersSection: () => null }));
jest.mock("@/components/studio/StudioScreen", () => ({ StudioScreen: ({ children }: any) => children }));
jest.mock("@/components/screens/configuracoes/CardFeeSection", () => ({ CardFeeSection: () => null }));
jest.mock("@/contexts/StudioThemeMode", () => {
  const tokens = new Proxy({}, { get: (_t, k) => (typeof k === "string" ? "#123456" : undefined) });
  return {
    useStudioTokens: () => tokens,
    useStudioTheme: () => ({ mode: "light", setMode: jest.fn() }),
  };
});
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    health: jest.fn(() => Promise.resolve({ approval_enabled: false, approval_mode: "wa_me", settings: {} })),
    getSettings: jest.fn(() => Promise.resolve({})),
    saveSettings: jest.fn(() => Promise.resolve({})),
  },
}));

let mockAuth: any = {};
jest.mock("@/stores/auth", () => {
  const fn: any = (sel?: any) => (typeof sel === "function" ? sel(mockAuth) : mockAuth);
  fn.getState = () => mockAuth;
  return { useAuthStore: fn };
});

let mockSettings: any = {};
const mockInvalidate = jest.fn();
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockSettings, isLoading: false, error: null, invalidate: mockInvalidate }),
}));

const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({
  request: (...a: any[]) => mockRequest(...a),
  pdvSettingsApi: { save: jest.fn() },
  companiesApi: { products: jest.fn() },
}));

import StudioConfiguracoes from "@/app/studio/(estudio)/configuracoes";
import { router } from "expo-router";

const mockRouter = router as unknown as { push: jest.Mock; replace: jest.Mock };

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children !== undefined ? node.children : node.props?.children);
}
const byId = (tree: renderer.ReactTestRenderer, id: string) => tree.root.findAllByProps({ testID: id }, { deep: false });
const press = async (tree: renderer.ReactTestRenderer, id: string) => {
  await act(async () => { byId(tree, id)[0].props.onPress(); });
};
async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
let invalidateSpy: jest.SpyInstance;
async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidateSpy = jest.spyOn(qc, "invalidateQueries");
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><StudioConfiguracoes /></QueryClientProvider>); });
  await flush();
  return tree;
}
const invalidou = (key: string) => invalidateSpy.mock.calls.some(([arg]: any[]) => arg?.queryKey?.[0] === key);

// Ordem do que acontece na troca: o store precisa ser gravado antes do redirect.
let ordem: string[] = [];
function auth(extra: any = {}, company: any = {}) {
  return {
    token: "t", isStaff: false,
    refreshMe: jest.fn(() => { ordem.push("refreshMe"); return Promise.resolve(); }),
    updateCompany: jest.fn((p: any) => { ordem.push("updateCompany:" + String(p.vertical_active)); }),
    ...extra,
    company: { id: "c1", plan: "negocio", segment: "studio", member_role: "owner", vertical_active: "studio", ...company },
  };
}

beforeEach(() => {
  ordem = [];
  mockRequest.mockReset();
  mockInvalidate.mockReset();
  mockRouter.push.mockReset(); mockRouter.replace.mockReset();
  mockRouter.replace.mockImplementation((to: string) => { ordem.push("replace:" + to); });
  mockAuth = auth();
  mockSettings = { studio_enabled: true };
});

describe("Studio › Configurações › Frente da loja", () => {
  it("renderiza o controle com a frente atual e a seta para o dono", async () => {
    const tree = await mount();
    expect(byId(tree, "studio-config-frente")).toHaveLength(1);
    expect(flatten(tree.toJSON())).toContain("Sua frente: Personalizados (Aura Studio)");
    const seta = byId(tree, "pdv-settings-frente-trocar");
    expect(seta).toHaveLength(1);
    expect(seta[0].props.accessibilityLabel).toBe("Mudar a frente da loja");
    await press(tree, "pdv-settings-frente-trocar");
    expect(byId(tree, "pdv-settings-frente-opcao-studio")[0].props.accessibilityState).toEqual({ selected: true });
    expect(byId(tree, "pdv-settings-frente-opcao-varejo")).toHaveLength(1);
    tree.unmount();
  });

  it("studio → varejo: avisa que sai do Studio, chama a API, grava o store e só então vai para /(tabs)", async () => {
    mockRequest.mockResolvedValue({
      segment: "varejo", segment_source: "user", vertical_active: null,
      flags: { matcon_enabled: false, otica_enabled: false, os_enabled: false, studio_enabled: false },
    });
    const tree = await mount();
    await press(tree, "pdv-settings-frente-trocar");
    await press(tree, "pdv-settings-frente-opcao-varejo");
    await press(tree, "pdv-settings-frente-salvar");
    expect(flatten(byId(tree, "pdv-settings-frente-confirmacao")[0].props.children)).toContain(
      "Sua Aura volta a abrir como Loja em geral. Você sai do Aura Studio; seu catálogo e seus pedidos continuam guardados."
    );
    expect(mockRequest).not.toHaveBeenCalled();
    ordem = [];
    await press(tree, "pdv-settings-frente-confirmar");
    await flush();

    expect(mockRequest).toHaveBeenCalledWith("/companies/c1/segment", { method: "PATCH", body: { segment: "varejo", extras: [] }, retry: 0 });
    expect(mockAuth.updateCompany).toHaveBeenCalledWith({ segment: "varejo", vertical_active: null });
    expect(mockInvalidate).toHaveBeenCalled();
    expect(invalidou("pdv-settings")).toBe(true);
    expect(invalidou("first-steps")).toBe(true);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith("/(tabs)");
    // vertical_active nulo ANTES do redirect (é o que o guard raiz lê), e de
    // novo depois do /auth/me — um /me velho em voo não devolve o Studio.
    expect(ordem).toEqual(["updateCompany:null", "refreshMe", "updateCompany:null", "replace:/(tabs)"]);
    tree.unmount();
  });

  it("redireciona mesmo quando o refreshMe falha ou não existe (janela de 3 s não importa)", async () => {
    mockAuth = auth({ refreshMe: jest.fn(() => Promise.reject(new Error("rede"))) });
    mockRequest.mockResolvedValue({ segment: "otica", segment_source: "user", vertical_active: null, flags: {} });
    const tree = await mount();
    await press(tree, "pdv-settings-frente-trocar");
    await press(tree, "pdv-settings-frente-opcao-otica");
    await press(tree, "pdv-settings-frente-salvar");
    await press(tree, "pdv-settings-frente-confirmar");
    await flush();
    expect(mockAuth.updateCompany).toHaveBeenLastCalledWith({ segment: "otica", vertical_active: null });
    expect(mockRouter.replace).toHaveBeenCalledWith("/(tabs)");
    tree.unmount();
  });

  it("erro na troca não redireciona nem mexe no store", async () => {
    mockRequest.mockRejectedValue(Object.assign(new Error("x"), { status: 500, data: {} }));
    const tree = await mount();
    await press(tree, "pdv-settings-frente-trocar");
    await press(tree, "pdv-settings-frente-opcao-varejo");
    await press(tree, "pdv-settings-frente-salvar");
    await press(tree, "pdv-settings-frente-confirmar");
    await flush();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockAuth.updateCompany).not.toHaveBeenCalled();
    expect(byId(tree, "pdv-settings-frente-erro")).toHaveLength(1);
    tree.unmount();
  });

  it("membro comum lê a frente, sem seta", async () => {
    mockAuth = auth({}, { member_role: "Vendedor" });
    const tree = await mount();
    expect(byId(tree, "studio-config-frente")).toHaveLength(1);
    expect(flatten(tree.toJSON())).toContain("Sua frente: Personalizados (Aura Studio)");
    expect(byId(tree, "pdv-settings-frente-trocar")).toHaveLength(0);
    expect(byId(tree, "pdv-settings-frente-opcoes")).toHaveLength(0);
    tree.unmount();
  });

  it("conta Studio antiga sem segment gravado lê a frente pela vertical", async () => {
    mockAuth = auth({}, { segment: null });
    const tree = await mount();
    expect(flatten(tree.toJSON())).toContain("Sua frente: Personalizados (Aura Studio)");
    tree.unmount();
  });
});
