// ============================================================
// Configurações › Políticas do Caixa › "Sua frente" (07/10/2026)
// O cliente (dono/admin) troca a própria frente: seta na linha, quadros,
// confirmação, PATCH /companies/:id/segment, invalidação e refreshMe.
// Membro comum não vê a seta; Essencial não vê Personalizados; staff segue
// com os switches.
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
jest.mock("@/components/screens/configuracoes/WarrantyTermsEditor", () => ({ WarrantyTermsEditor: () => null }));
jest.mock("@/components/screens/configuracoes/CardFeeSection", () => ({ CardFeeSection: () => null }));
jest.mock("@/components/screens/configuracoes/CardPriceSection", () => ({ CardPriceSection: () => null }));

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

import { PdvSettingsCard } from "@/components/screens/configuracoes/PdvSettingsCard";
import { toast } from "@/components/Toast";
import { router } from "expo-router";

const mockRouter = router as unknown as { push: jest.Mock; replace: jest.Mock };

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  // JSON do renderer (children) ou elemento React vindo de props (props.children)
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
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><PdvSettingsCard /></QueryClientProvider>); });
  await flush();
  return tree;
}

function auth(extra: any = {}, company: any = {}) {
  return {
    token: "t", isStaff: false,
    refreshMe: jest.fn(() => Promise.resolve()),
    updateCompany: jest.fn(),
    ...extra,
    company: { id: "c1", plan: "negocio", segment: "otica", member_role: "owner", vertical_active: null, ...company },
  };
}
const ok = (segment: string, flags: any = {}, vertical_active: string | null = null) => ({
  segment, segment_source: "user", vertical_active,
  flags: { matcon_enabled: false, otica_enabled: false, os_enabled: false, studio_enabled: false, ...flags },
});
const invalidou = (key: string) => invalidateSpy.mock.calls.some(([arg]: any[]) => arg?.queryKey?.[0] === key);

beforeEach(() => {
  mockRequest.mockReset();
  mockInvalidate.mockReset();
  mockRouter.push.mockReset(); mockRouter.replace.mockReset();
  (toast.error as jest.Mock).mockReset();
  (toast.success as jest.Mock).mockReset();
  mockAuth = auth();
  mockSettings = { otica_enabled: true, os_enabled: false, matcon_enabled: false };
});

describe("Sua frente — dono da conta", () => {
  it("vê a seta com rótulo de acessibilidade; os quadros só abrem ao tocar", async () => {
    const tree = await mount();
    const seta = byId(tree, "pdv-settings-frente-trocar");
    expect(seta).toHaveLength(1);
    expect(seta[0].props.accessibilityRole).toBe("button");
    expect(seta[0].props.accessibilityLabel).toBe("Mudar a frente da loja");
    expect(byId(tree, "pdv-settings-frente-opcoes")).toHaveLength(0);
    const txt = flatten(tree.toJSON());
    expect(txt).toContain("Sua frente: Ótica");
    expect(txt).not.toContain("fale com a gente");

    await press(tree, "pdv-settings-frente-trocar");
    for (const k of ["varejo", "matcon", "otica", "assistencia", "studio", "outro"]) {
      expect(byId(tree, "pdv-settings-frente-opcao-" + k)).toHaveLength(1);
    }
    expect(byId(tree, "pdv-settings-frente-extra-os")).toHaveLength(1);
    // a frente atual vem marcada e o botão fica desabilitado enquanto for ela
    expect(byId(tree, "pdv-settings-frente-opcao-otica")[0].props.accessibilityState).toEqual({ selected: true });
    const salvar = byId(tree, "pdv-settings-frente-salvar")[0];
    expect(salvar.props.disabled).toBe(true);
    expect(flatten(salvar.props.children)).toBe("Trocar para Ótica");
    // plano stale no JWT: abrir revalida o /auth/me
    expect(mockAuth.refreshMe).toHaveBeenCalledTimes(1);
    // tocar de novo recolhe
    await press(tree, "pdv-settings-frente-trocar");
    expect(byId(tree, "pdv-settings-frente-opcoes")).toHaveLength(0);
    tree.unmount();
  });

  it("escolher outra e confirmar chama a API com { segment, extras } e invalida pdv-settings e first-steps", async () => {
    mockRequest.mockResolvedValue(ok("matcon", { matcon_enabled: true, os_enabled: true }));
    const tree = await mount();
    await press(tree, "pdv-settings-frente-trocar");
    await press(tree, "pdv-settings-frente-opcao-matcon");
    await press(tree, "pdv-settings-frente-extra-os");
    const salvar = byId(tree, "pdv-settings-frente-salvar")[0];
    expect(salvar.props.disabled).toBe(false);
    expect(flatten(salvar.props.children)).toBe("Trocar para Material de construção");

    // nada é chamado antes da confirmação
    await press(tree, "pdv-settings-frente-salvar");
    expect(mockRequest).not.toHaveBeenCalled();
    expect(flatten(byId(tree, "pdv-settings-frente-confirmacao")[0].props.children))
      .toContain("Sua Aura passa a abrir como Material de construção. O que a frente anterior ligava fica desligado.");

    await press(tree, "pdv-settings-frente-confirmar");
    await flush();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith("/companies/c1/segment", { method: "PATCH", body: { segment: "matcon", extras: ["os"] }, retry: 0 });
    expect(mockInvalidate).toHaveBeenCalled();
    expect(invalidou("pdv-settings")).toBe(true);
    expect(invalidou("first-steps")).toBe(true);
    expect(mockAuth.updateCompany).toHaveBeenCalledWith({ segment: "matcon", vertical_active: null });
    expect(mockAuth.refreshMe).toHaveBeenCalledTimes(2); // ao abrir + depois de trocar
    expect(toast.success).toHaveBeenCalledWith("Frente trocada: Material de construção");
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(byId(tree, "pdv-settings-frente-opcoes")).toHaveLength(0);
    tree.unmount();
  });

  it("sem o extra marcado manda extras [] (desliga a Ordem de Serviço)", async () => {
    mockSettings = { otica_enabled: true, os_enabled: true };
    mockRequest.mockResolvedValue(ok("varejo"));
    const tree = await mount();
    await press(tree, "pdv-settings-frente-trocar");
    expect(byId(tree, "pdv-settings-frente-extra-os")[0].props.accessibilityState).toEqual({ checked: true });
    await press(tree, "pdv-settings-frente-extra-os");
    await press(tree, "pdv-settings-frente-opcao-varejo");
    await press(tree, "pdv-settings-frente-salvar");
    await press(tree, "pdv-settings-frente-confirmar");
    await flush();
    expect(mockRequest.mock.calls[0][1].body).toEqual({ segment: "varejo", extras: [] });
    tree.unmount();
  });

  it("cancelar a confirmação não chama a API", async () => {
    const tree = await mount();
    await press(tree, "pdv-settings-frente-trocar");
    await press(tree, "pdv-settings-frente-opcao-matcon");
    await press(tree, "pdv-settings-frente-salvar");
    await press(tree, "pdv-settings-frente-cancelar");
    expect(byId(tree, "pdv-settings-frente-confirmacao")).toHaveLength(0);
    expect(mockRequest).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("trocar para Studio avisa na confirmação e redireciona para /studio", async () => {
    mockRequest.mockResolvedValue(ok("studio", { studio_enabled: true }, "studio"));
    const tree = await mount();
    await press(tree, "pdv-settings-frente-trocar");
    await press(tree, "pdv-settings-frente-opcao-studio");
    await press(tree, "pdv-settings-frente-salvar");
    expect(flatten(byId(tree, "pdv-settings-frente-confirmacao")[0].props.children)).toContain("Você vai para o Aura Studio.");
    await press(tree, "pdv-settings-frente-confirmar");
    await flush();
    expect(mockAuth.updateCompany).toHaveBeenCalledWith({ segment: "studio", vertical_active: "studio" });
    expect(mockRouter.replace).toHaveBeenCalledWith("/studio");
    tree.unmount();
  });

  it("Essencial não mostra Personalizados (nem desabilitado)", async () => {
    mockAuth = auth({}, { plan: "essencial" });
    const tree = await mount();
    await press(tree, "pdv-settings-frente-trocar");
    expect(byId(tree, "pdv-settings-frente-opcao-studio")).toHaveLength(0);
    expect(byId(tree, "pdv-settings-frente-opcao-matcon")).toHaveLength(1);
    expect(flatten(tree.toJSON())).not.toContain("Personalizados");
    tree.unmount();
  });

  it.each([
    [{ status: 409, data: { code: "STUDIO_PLAN_REQUIRED", error: "x" } }, "Studio exige plano Negócio ou superior"],
    [{ status: 403, data: { error: "Permissão insuficiente" } }, "Só o dono da conta muda a frente"],
    [{ status: 500, data: { error: "boom interno" } }, "Não deu pra trocar a frente. Tente de novo."],
  ])("erro %j vira a mensagem certa", async (err, msg) => {
    mockRequest.mockRejectedValue(Object.assign(new Error("x"), err));
    const tree = await mount();
    await press(tree, "pdv-settings-frente-trocar");
    await press(tree, "pdv-settings-frente-opcao-matcon");
    await press(tree, "pdv-settings-frente-salvar");
    await press(tree, "pdv-settings-frente-confirmar");
    await flush();
    expect(flatten(byId(tree, "pdv-settings-frente-erro")[0].props.children)).toBe(msg);
    expect(toast.error).toHaveBeenCalledWith(msg);
    expect(mockAuth.updateCompany).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
    // a grade continua aberta pra tentar de novo
    expect(byId(tree, "pdv-settings-frente-opcoes")).toHaveLength(1);
    tree.unmount();
  });

  it("admin da empresa também vê a seta", async () => {
    mockAuth = auth({}, { member_role: "admin" });
    const tree = await mount();
    expect(byId(tree, "pdv-settings-frente-trocar")).toHaveLength(1);
    tree.unmount();
  });
});

describe("Sua frente — quem não troca", () => {
  it("membro comum lê a linha, sem seta e sem quadros", async () => {
    mockAuth = auth({}, { member_role: "Vendedor" });
    const tree = await mount();
    expect(byId(tree, "pdv-settings-frente-trocar")).toHaveLength(0);
    expect(byId(tree, "pdv-settings-frente-opcoes")).toHaveLength(0);
    const txt = flatten(tree.toJSON());
    expect(txt).toContain("Sua frente: Ótica");
    expect(txt).toContain("Ligado: Ótica");
    tree.unmount();
  });

  it("staff continua vendo os três switches (e a seta)", async () => {
    mockAuth = auth({ isStaff: true }, { segment: "varejo", member_role: "Vendedor" });
    mockSettings = {};
    const tree = await mount();
    expect(byId(tree, "pdv-settings-otica")).toHaveLength(1);
    expect(byId(tree, "pdv-settings-matcon")).toHaveLength(1);
    expect(byId(tree, "pdv-settings-os")).toHaveLength(1);
    expect(byId(tree, "pdv-settings-frente-trocar")).toHaveLength(1);
    tree.unmount();
  });

  it("cliente dono segue sem os switches de staff", async () => {
    const tree = await mount();
    expect(byId(tree, "pdv-settings-otica")).toHaveLength(0);
    expect(byId(tree, "pdv-settings-matcon")).toHaveLength(0);
    expect(byId(tree, "pdv-settings-os")).toHaveLength(0);
    tree.unmount();
  });
});
