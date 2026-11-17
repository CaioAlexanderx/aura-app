// ============================================================
// p-189 (17/11/2026) — casa no Negócio
//
//   1. regra pura (utils/personalizados): com a trava desligada a decisão
//      é a de sempre (só vertical_active === "studio")
//   2. AuthGuard de verdade (app/_layout.tsx, mesmo esqueleto de
//      linkDoAssentoMuro): trava desligada = igual a hoje; trava ligada =
//      a empresa com a casa ligada abre no Negócio mesmo com um
//      vertical_active = "studio" guardado
//   3. Gestão Aura: o interruptor só existe com a trava e para a equipe;
//      com a trava desligada não chama o backend
// ============================================================
import React from "react";
import { render, waitFor, configure, fireEvent, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);

const mockReplace = jest.fn();
let mockSegments: string[] = [];

jest.mock("expo-router", () => ({
  Slot: () => null,
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSegments: () => mockSegments,
  useGlobalSearchParams: () => ({}),
}));

let mockEstado: any = {};
jest.mock("@/stores/auth", () => {
  const useAuthStore: any = (sel?: (s: any) => any) => (sel ? sel(mockEstado) : mockEstado);
  useAuthStore.getState = () => mockEstado;
  useAuthStore.setState = () => {};
  return { useAuthStore };
});
jest.mock("@/stores/karateIntro", () => ({
  useKarateIntro: (sel: any) => sel({ pending: false, consume: () => {} }),
}));
const mockCasaGet = jest.fn();
const mockCasaSet = jest.fn();
jest.mock("@/services/api", () => ({
  authApi: { me: jest.fn(() => Promise.resolve({ user: {} })) },
  adminApi: {
    casaNegocio: (...a: any[]) => mockCasaGet(...a),
    setCasaNegocio: (...a: any[]) => mockCasaSet(...a),
  },
}));
jest.mock("@/utils/micrositeBootstrap", () => ({}));
jest.mock("@/utils/microsite", () => ({
  isMicrositeHost: () => false, getMicrositeSlug: () => null, micrositeTargetPath: () => "/",
}));
jest.mock("@/utils/verifyLinkStatus", () => ({ setVerifyLinkError: () => {} }));
jest.mock("@/services/offlineSync", () => ({ startAutoSync: () => {} }));
jest.mock("@/components/ErrorBoundary", () => ({ ErrorBoundary: ({ children }: any) => children }));
jest.mock("@/components/LGPDConsent", () => ({ LGPDConsent: () => null }));
jest.mock("@/contexts/StudioThemeMode", () => ({ StudioThemeProvider: ({ children }: any) => children }));
jest.mock("@/components/UpdateBanner", () => ({ UpdateBanner: () => null }));
jest.mock("@/components/GlobalOverlays", () => ({ GlobalOverlays: () => null }));
jest.mock("@/components/karate/KarateLoginTransition", () => ({ KarateLoginTransition: () => null }));
jest.mock("@/hooks/useRegistroDeTelas", () => ({ useRegistroDeTelas: () => {} }));
jest.mock("@/hooks/useRevalidarMe", () => ({ useRevalidarMe: () => {} }));
jest.mock("@/components/Toast", () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }));

// A trava real é false. Para o AuthGuard, o teste liga e desliga a trava
// passando-a para a mesma função que o _layout chama.
let mockLiberado = false;
jest.mock("@/utils/personalizados", () => {
  const real = jest.requireActual("@/utils/personalizados");
  return { ...real, vaiParaOStudio: (c: any) => real.vaiParaOStudio(c, mockLiberado) };
});

import RootLayout from "@/app/_layout";
import { CasaNegocioSection } from "@/components/admin/CasaNegocioSection";
import { __zerarDestino } from "@/utils/destinoDepoisDoLogin";

const real = jest.requireActual("@/utils/personalizados");

const logado = (company: Record<string, any> = {}) => ({
  token: "tk", user: { email: "dona@loja.com", email_verified: true },
  company: { id: "emp-1", member_role: "owner", billing_status: "active", ...company },
  isHydrated: true, isDemo: false, isStaff: false, trialActive: false, consolidatedView: false,
  hydrate: () => {}, switchCompany: () => {},
});

async function guarda(segments: string[]) {
  mockReplace.mockClear();
  mockSegments = segments;
  window.history.replaceState({}, "", "/");
  const r = render(<RootLayout />);
  await waitFor(() => {});
  r.unmount();
  return mockReplace.mock.calls.map((c) => c[0]);
}

beforeEach(() => { __zerarDestino(); mockLiberado = false; });

// ── 1. regra pura ─────────────────────────────────────────────────
describe("1. regra pura", () => {
  test("a trava está desligada no código", () => {
    expect(real.PERSONALIZADOS_LIBERADO).toBe(false);
  });

  const empresas: any[] = [
    null, undefined, {},
    { vertical_active: "studio" },
    { vertical_active: "studio", casa_negocio: true },
    { vertical_active: "studio", casa_negocio: false },
    { vertical_active: null, casa_negocio: true },
    { vertical_active: "food", casa_negocio: true },
    { vertical_active: "studio", casa_negocio: "true" },
  ];

  test("trava desligada: vaiParaOStudio é exatamente vertical_active === 'studio'; casa nunca conta", () => {
    for (const c of empresas) {
      expect([JSON.stringify(c), real.vaiParaOStudio(c)]).toEqual([JSON.stringify(c), (c as any)?.vertical_active === "studio"]);
      expect(real.casaNoNegocio(c)).toBe(false);
      expect(real.vaiParaOStudio(c, false)).toBe((c as any)?.vertical_active === "studio");
    }
  });

  test("trava ligada: casa ligada tira do Studio; só o true literal conta", () => {
    expect(real.vaiParaOStudio({ vertical_active: "studio", casa_negocio: true }, true)).toBe(false);
    expect(real.vaiParaOStudio({ vertical_active: "studio", casa_negocio: false }, true)).toBe(true);
    expect(real.vaiParaOStudio({ vertical_active: "studio", casa_negocio: "true" }, true)).toBe(true);
    expect(real.vaiParaOStudio({ vertical_active: null, casa_negocio: true }, true)).toBe(false);
    expect(real.casaNoNegocio({ casa_negocio: true }, true)).toBe(true);
  });
});

// ── 2. AuthGuard ──────────────────────────────────────────────────
describe("2. AuthGuard (app/_layout.tsx)", () => {
  test("trava desligada: igual a hoje, a casa no /me não muda nada", async () => {
    mockEstado = logado({ vertical_active: "studio", casa_negocio: true });
    expect(await guarda(["(tabs)", "index"])).toEqual(["/studio/(estudio)"]);
    expect(await guarda(["(auth)", "login"])).toEqual(["/studio/(estudio)"]);
    mockEstado = logado({ vertical_active: "studio" });
    expect(await guarda(["(tabs)", "index"])).toEqual(["/studio/(estudio)"]);
    mockEstado = logado({ vertical_active: null });
    expect(await guarda(["(tabs)", "index"])).toEqual([]);
  });

  test("trava ligada + casa ligada: fica no Negócio, mesmo com vertical Studio guardada", async () => {
    mockLiberado = true;
    mockEstado = logado({ vertical_active: "studio", casa_negocio: true });
    expect(await guarda(["(tabs)", "index"])).toEqual([]);
    expect(await guarda(["(auth)", "login"])).toEqual(["/(tabs)"]);
    mockEstado = logado({ vertical_active: null, casa_negocio: true });
    expect(await guarda(["(tabs)", "index"])).toEqual([]);
  });

  test("trava ligada + casa desligada: o Studio de sempre", async () => {
    mockLiberado = true;
    mockEstado = logado({ vertical_active: "studio" });
    expect(await guarda(["(tabs)", "index"])).toEqual(["/studio/(estudio)"]);
    expect(await guarda(["(auth)", "login"])).toEqual(["/studio/(estudio)"]);
  });
});

// ── 3. Gestão Aura ───────────────────────────────────────────────
describe("3. Gestão Aura · Casa no Negócio", () => {
  function montar(el: React.ReactElement) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
  }
  const ESTADO = {
    company_id: "emp-9", casa_negocio: false, casa_negocio_em: null, vertical_active: "studio",
    studio_enabled: true, personalizados_ativado_em: null,
    pode_ligar: true, motivo_ligar: null, pode_desligar: false, motivo_desligar: "ja_desligada",
  };
  beforeEach(() => { mockCasaGet.mockReset(); mockCasaSet.mockReset(); });

  // Sob react-native-web o testID não chega ao getByTestId: lê pelos textos.
  test("trava desligada (padrão): nada aparece e o backend não é chamado, nem para a equipe", async () => {
    mockEstado = { ...logado(), isStaff: true };
    const r = montar(<CasaNegocioSection companyId="emp-9" />);
    await waitFor(() => {});
    expect(r.queryByText("Casa no Negócio")).toBeNull();
    expect(mockCasaGet).not.toHaveBeenCalled();
  });

  test("trava ligada, fora da equipe: nada aparece", async () => {
    mockEstado = { ...logado(), isStaff: false };
    const r = montar(<CasaNegocioSection companyId="emp-9" liberado />);
    await waitFor(() => {});
    expect(r.queryByText("Casa no Negócio")).toBeNull();
    expect(mockCasaGet).not.toHaveBeenCalled();
  });

  test("trava ligada, equipe: mostra o estado, pede confirmação e liga", async () => {
    mockEstado = { ...logado(), isStaff: true };
    mockCasaGet.mockResolvedValue(ESTADO);
    mockCasaSet.mockResolvedValue({
      changed: true,
      estado: { ...ESTADO, casa_negocio: true, vertical_active: null, casa_negocio_em: "2026-12-01T12:00:00.000Z",
        personalizados_ativado_em: "2026-05-22T10:00:00.000Z", pode_ligar: false, motivo_ligar: "ja_ligada", pode_desligar: true, motivo_desligar: null },
    });
    const r = montar(<CasaNegocioSection companyId="emp-9" liberado />);
    await waitFor(() => expect(r.getByText("Ligar a casa no Negócio")).toBeTruthy());
    expect(r.getByText("Studio")).toBeTruthy();
    expect(r.getByText("ligada")).toBeTruthy();

    await act(async () => { fireEvent.press(r.getByText("Ligar a casa no Negócio")); });
    expect(mockCasaSet).not.toHaveBeenCalled(); // 1º toque só pede confirmação
    expect(r.getByText("Cancelar")).toBeTruthy();

    await act(async () => { fireEvent.press(r.getByText("Confirmar: ligar a casa no negócio")); });
    await waitFor(() => expect(mockCasaSet).toHaveBeenCalledWith("emp-9", true));
    await waitFor(() => expect(r.getByText("Voltar para o Studio")).toBeTruthy());
    expect(r.getByText("Negócio")).toBeTruthy();
    expect(r.getByText("22/05/2026")).toBeTruthy();
  });

  test("não dá para ligar: mostra o motivo e o botão não chama o backend", async () => {
    mockEstado = { ...logado(), isStaff: true };
    mockCasaGet.mockResolvedValue({ ...ESTADO, vertical_active: null, pode_ligar: false, motivo_ligar: "nao_esta_no_studio" });
    const r = montar(<CasaNegocioSection companyId="emp-9" liberado />);
    await waitFor(() => expect(r.getByText("Só empresa que está no Studio (vertical Studio) muda de casa.")).toBeTruthy());
    await act(async () => { fireEvent.press(r.getByText("Ligar a casa no Negócio")); });
    await act(async () => { fireEvent.press(r.getByText("Ligar a casa no Negócio")); });
    expect(mockCasaSet).not.toHaveBeenCalled();
  });
});
