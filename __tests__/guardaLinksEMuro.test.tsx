// ============================================================
// AuthGuard (app/_layout.tsx) de verdade, 24/10/2026:
//   tq-91 — link aberto sem sessão é guardado e o login volta para ele;
//   tq-92 — ?empresa= troca a empresa antes da tela;
//   tq-86 — em atraso o muro conta dias (telas no dia 7, Caixa no dia 14).
// Mesmo esqueleto de __tests__/vitrineStudioGuardaPublica.test.tsx.
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
let mockParams: Record<string, any> = {};

jest.mock("expo-router", () => ({
  Slot: () => null,
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSegments: () => mockSegments,
  useGlobalSearchParams: () => mockParams,
}));

const mockSwitch = jest.fn();
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
jest.mock("@/services/api", () => ({ authApi: { me: jest.fn(() => Promise.resolve({ user: {} })) } }));
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
import { guardarDestino, lerDestino, __zerarDestino } from "@/utils/destinoDepoisDoLogin";
import { hojeEmSaoPaulo } from "@/utils/muroDeAssinatura";

const deslogado = () => ({
  token: null, user: null, company: null, isHydrated: true,
  isDemo: false, isStaff: false, trialActive: false, consolidatedView: false,
  hydrate: () => {}, switchCompany: (id: string) => mockSwitch(id),
});
const logado = (company: Record<string, any> = {}) => ({
  ...deslogado(),
  token: "tk",
  user: { email: "dona@loja.com", email_verified: true },
  company: { id: "emp-1", member_role: "owner", billing_status: "active", ...company },
});

async function guarda(segments: string[], url = "/") {
  mockReplace.mockClear();
  mockSegments = segments;
  window.history.replaceState({}, "", url);
  const r = render(<RootLayout />);
  await waitFor(() => {});
  r.unmount();
  return mockReplace.mock.calls.map((c) => c[0]);
}

// Datas relativas ao dia de hoje em São Paulo (o guarda lê o relógio).
function dataRel(dias: number): string {
  const d = new Date(hojeEmSaoPaulo() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
// Em atraso há `n` dias: telas pausam no dia 7, Caixa no dia 14.
const emAtraso = (n: number) => ({
  billing_status: "overdue",
  billing_overdue_since: dataRel(-n),
  billing_pause_screens_on: dataRel(7 - n),
  billing_pause_caixa_on: dataRel(14 - n),
});

beforeEach(() => {
  __zerarDestino();
  mockSwitch.mockReset();
  mockParams = {};
});

describe("tq-91 · link aberto sem sessão", () => {
  test("guarda caminho + query e manda para o login", async () => {
    mockEstado = deslogado();
    expect(await guarda(["crediario"], "/crediario?filtro=atraso")).toEqual(["/(auth)/login"]);
    expect(lerDestino()).toBe("/crediario?filtro=atraso");
  });

  test("depois de entrar, o guarda volta para a tela do link e apaga o destino", async () => {
    guardarDestino("/crediario?filtro=atraso");
    mockEstado = logado();
    expect(await guarda(["(auth)", "login"], "/login")).toEqual(["/crediario?filtro=atraso"]);
    expect(lerDestino()).toBeNull();
  });

  test("sem destino, a casa da vertical de sempre", async () => {
    mockEstado = logado({ vertical_active: "odonto" });
    expect(await guarda(["(auth)", "login"], "/login")).toEqual(["/dental/(clinic)/hoje"]);
  });

  test("Karatê mantém /karate e o destino é apagado", async () => {
    guardarDestino("/financeiro");
    mockEstado = logado({ vertical_active: "karate_dojo" });
    expect(await guarda(["(auth)", "login"], "/login")).toEqual(["/karate"]);
    expect(lerDestino()).toBeNull();
  });

  test("e-mail ainda não confirmado: vai confirmar e o destino espera", async () => {
    guardarDestino("/financeiro");
    mockEstado = { ...logado(), user: { email: "dona@loja.com", email_verified: false } };
    expect(await guarda(["(auth)", "login"], "/login")).toEqual(["/(auth)/verify-email"]);
    expect(lerDestino()).toBe("/financeiro");
  });

  test("tela pública não guarda nada", async () => {
    mockEstado = deslogado();
    expect(await guarda(["invite", "[token]"], "/invite/abc")).toEqual([]);
    expect(lerDestino()).toBeNull();
  });
});

describe("tq-92 · ?empresa= troca a empresa antes da tela", () => {
  test("outra empresa: chama o switch e tira o parâmetro da URL", async () => {
    mockSwitch.mockReturnValue(new Promise(() => {}));
    mockEstado = logado();
    mockParams = { empresa: "emp-2" };
    await guarda(["crediario"], "/crediario?filtro=atraso&empresa=emp-2");
    expect(mockSwitch).toHaveBeenCalledWith("emp-2");
    expect(window.location.pathname + window.location.search).toBe("/crediario?filtro=atraso");
  });

  test("já na empresa do link: não troca", async () => {
    mockEstado = logado();
    mockParams = { empresa: "emp-1" };
    await guarda(["crediario"], "/crediario?empresa=emp-1");
    expect(mockSwitch).not.toHaveBeenCalled();
  });
});

describe("tq-86 · muro em atraso no shell Negócio", () => {
  test.each([0, 6])("dia %i de atraso: nenhuma tela bloqueia", async (n) => {
    mockEstado = logado(emAtraso(n));
    expect(await guarda(["(tabs)", "estoque"], "/estoque")).toEqual([]);
  });

  test.each([7, 13])("dia %i: as outras telas levam ao Caixa; o Caixa fica", async (n) => {
    mockEstado = logado(emAtraso(n));
    expect(await guarda(["(tabs)", "estoque"], "/estoque")).toEqual(["/(tabs)/pdv"]);
    expect(await guarda(["(tabs)", "pdv"], "/pdv")).toEqual([]);
  });

  test.each([14, 15])("dia %i: o Caixa também pausa, vai ao checkout", async (n) => {
    mockEstado = logado(emAtraso(n));
    expect(await guarda(["(tabs)", "pdv"], "/pdv")).toEqual(["/(tabs)/checkout"]);
    expect(await guarda(["(tabs)", "checkout"], "/checkout")).toEqual([]);
  });

  test.each([0, 6, 7, 13, 14, 15])("dia %i sem os campos (backend anterior): como antes", async () => {
    mockEstado = logado({ billing_status: "overdue" });
    expect(await guarda(["(tabs)", "estoque"], "/estoque")).toEqual(["/(tabs)/pdv"]);
    expect(await guarda(["(tabs)", "pdv"], "/pdv")).toEqual([]);
  });

  test("Odonto vai ao checkout no dia 7, não antes", async () => {
    mockEstado = logado({ vertical_active: "odonto", ...emAtraso(6) });
    expect(await guarda(["dental", "(clinic)", "hoje"], "/dental/hoje")).toEqual([]);
    mockEstado = logado({ vertical_active: "odonto", ...emAtraso(7) });
    expect(await guarda(["dental", "(clinic)", "hoje"], "/dental/hoje")).toEqual(["/(tabs)/checkout"]);
  });
});
