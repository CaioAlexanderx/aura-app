// ============================================================
// Equipe Aura só pelo is_staff do backend (utils/equipeAura)
//
// O domínio do e-mail não faz ninguém pular a confirmação do e-mail, o
// checkout ou o muro da assinatura. Quem tem is_staff = true continua
// pulando, como antes.
//   1. ehEquipeAura: só is_staff === true;
//   2. stores/auth: login e /auth/me calculam isStaff só pelo is_staff;
//   3. AuthGuard (app/_layout.tsx) de verdade: verificação e checkout.
// ============================================================
import React from "react";
import { render, waitFor, configure } from "@testing-library/react-native";

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
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
const mockMe = jest.fn();
const mockLogin = jest.fn();
jest.mock("@/services/api", () => ({
  authApi: { me: (...a: any[]) => mockMe(...a), login: (...a: any[]) => mockLogin(...a) },
  setTokenGetter: jest.fn(),
  setOnUnauthorized: jest.fn(),
}));
jest.mock("@/services/multicnpj", () => ({
  authMulticnpjApi: { companies: jest.fn(() => Promise.resolve({ companies: [] })) },
  userCompaniesApi: {},
}));
jest.mock("@/stores/karateIntro", () => ({
  useKarateIntro: (sel: any) => sel({ pending: false, consume: () => {} }),
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
jest.mock("@/components/Toast", () => ({ toast: { info: jest.fn() } }));

import RootLayout from "@/app/_layout";
import { useAuthStore, __zerarControleDoMe } from "@/stores/auth";
import { ehEquipeAura } from "@/utils/equipeAura";
import { __zerarDestino } from "@/utils/destinoDepoisDoLogin";

const EMAIL_DOMINIO = "pessoa@getaura.com.br";
const EMPRESA = { id: "emp-1", plan: "negocio", member_role: "owner", billing_status: "active" };
const SEM_ASSINATURA = { ...EMPRESA, billing_status: "pending", trial_ends_at: "2020-01-01T00:00:00Z" };

// Estado do store como o login/me o deixa, a partir do usuário que o backend devolve.
function estadoDoStore(user: Record<string, any>, company: Record<string, any> = EMPRESA) {
  return {
    token: "tk", user, company, isHydrated: true, isDemo: false,
    isStaff: ehEquipeAura(user), trialActive: false, consolidatedView: false,
    hydrate: () => {}, switchCompany: () => {}, refreshMe: () => Promise.resolve(),
  };
}

async function guarda(estado: any, segments: string[], url = "/") {
  useAuthStore.setState(estado, false);
  mockReplace.mockClear();
  mockSegments = segments;
  window.history.replaceState({}, "", url);
  const r = render(<RootLayout />);
  await waitFor(() => {});
  r.unmount();
  return mockReplace.mock.calls.map((c) => c[0]);
}

beforeEach(() => {
  __zerarDestino();
  __zerarControleDoMe();
  mockMe.mockReset();
  mockLogin.mockReset();
  window.localStorage.clear();
});

describe("ehEquipeAura", () => {
  test("só is_staff === true; o domínio do e-mail não conta", () => {
    expect(ehEquipeAura({ email: EMAIL_DOMINIO })).toBe(false);
    expect(ehEquipeAura({ email: EMAIL_DOMINIO, is_staff: false })).toBe(false);
    expect(ehEquipeAura({ email: EMAIL_DOMINIO, is_staff: "true" })).toBe(false);
    expect(ehEquipeAura({ email: "dona@loja.com", is_staff: true })).toBe(true);
    expect(ehEquipeAura(null)).toBe(false);
    expect(ehEquipeAura(undefined)).toBe(false);
  });
});

describe("stores/auth: isStaff vem do is_staff", () => {
  const me = (user: Record<string, any>) => ({ user, company: EMPRESA, consolidated_view: false, company_count: 1 });

  test("login com e-mail do domínio sem is_staff: isStaff false", async () => {
    mockLogin.mockResolvedValue({ token: "tk", user: { id: "u1", email: EMAIL_DOMINIO, email_verified: true }, company: EMPRESA });
    await useAuthStore.getState().login(EMAIL_DOMINIO, "senha");
    expect(useAuthStore.getState().isStaff).toBe(false);
  });

  test("login com is_staff true: isStaff true", async () => {
    mockLogin.mockResolvedValue({ token: "tk", user: { id: "u1", email: EMAIL_DOMINIO, is_staff: true, email_verified: true }, company: EMPRESA });
    await useAuthStore.getState().login(EMAIL_DOMINIO, "senha");
    expect(useAuthStore.getState().isStaff).toBe(true);
  });

  test("/auth/me (refreshMe) com e-mail do domínio sem is_staff: isStaff false; com is_staff: true", async () => {
    useAuthStore.setState({ token: "tk-me-1", isStaff: true } as any);
    mockMe.mockResolvedValueOnce(me({ id: "u1", email: EMAIL_DOMINIO, is_staff: false }));
    await useAuthStore.getState().refreshMe();
    expect(useAuthStore.getState().isStaff).toBe(false);

    __zerarControleDoMe();
    useAuthStore.setState({ token: "tk-me-2" } as any);
    mockMe.mockResolvedValueOnce(me({ id: "u1", email: EMAIL_DOMINIO, is_staff: true }));
    await useAuthStore.getState().refreshMe();
    expect(useAuthStore.getState().isStaff).toBe(true);
  });
});

describe("AuthGuard: confirmação do e-mail", () => {
  test("e-mail do domínio sem is_staff, não confirmado: vai confirmar o e-mail", async () => {
    const estado = estadoDoStore({ email: EMAIL_DOMINIO, email_verified: false });
    expect(await guarda(estado, ["(tabs)", "estoque"], "/estoque")).toEqual(["/(auth)/verify-email"]);
  });

  test("e-mail do domínio sem is_staff, na tela de confirmar: fica nela", async () => {
    const estado = estadoDoStore({ email: EMAIL_DOMINIO, email_verified: false });
    expect(await guarda(estado, ["(auth)", "verify-email"], "/verify-email")).toEqual([]);
  });

  test("is_staff true, não confirmado: segue pulando a confirmação", async () => {
    const estado = estadoDoStore({ email: EMAIL_DOMINIO, email_verified: false, is_staff: true });
    expect(await guarda(estado, ["(tabs)", "estoque"], "/estoque")).not.toContain("/(auth)/verify-email");
  });
});

describe("AuthGuard: checkout sem assinatura", () => {
  test("e-mail do domínio sem is_staff, sem assinatura: o muro vale (Caixa no shell Negócio)", async () => {
    const estado = estadoDoStore({ email: EMAIL_DOMINIO, email_verified: true }, SEM_ASSINATURA);
    expect(await guarda(estado, ["(tabs)", "estoque"], "/estoque")).toEqual(["/(tabs)/pdv"]);
  });

  test("e-mail do domínio sem is_staff, Odonto sem assinatura: vai ao checkout", async () => {
    const estado = estadoDoStore({ email: EMAIL_DOMINIO, email_verified: true }, { ...SEM_ASSINATURA, vertical_active: "odonto" });
    expect(await guarda(estado, ["dental", "(clinic)", "hoje"], "/dental/hoje")).toEqual(["/(tabs)/checkout"]);
  });

  test("is_staff true, sem assinatura: segue sem muro nem checkout", async () => {
    const estado = estadoDoStore({ email: EMAIL_DOMINIO, email_verified: true, is_staff: true }, SEM_ASSINATURA);
    expect(await guarda(estado, ["(tabs)", "estoque"], "/estoque")).toEqual([]);
    const odonto = estadoDoStore({ email: EMAIL_DOMINIO, email_verified: true, is_staff: true }, { ...SEM_ASSINATURA, vertical_active: "odonto" });
    expect(await guarda(odonto, ["dental", "(clinic)", "hoje"], "/dental/hoje")).toEqual([]);
  });
});
