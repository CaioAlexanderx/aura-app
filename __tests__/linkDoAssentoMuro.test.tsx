// ============================================================
// p-105 (11/11/2026) — o link do assento no muro de assinatura
// (AuthGuard de app/_layout.tsx, de verdade). Mesmo esqueleto de
// __tests__/guardaLinksEMuro.test.tsx.
//
//   em dia            → fica em /black-friday#assento (a página rola);
//   sem assinatura    → checkout com o Negócio marcado e a frase do assento;
//   em atraso         → checkout com a frase da mensalidade (link da cobrança);
//   Studio/Odonto/Food→ como estão;
//   sem a âncora      → o muro de sempre (Caixa).
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


describe("p-105 · link do assento no muro", () => {
  test("assinante em dia: fica na página, nada redireciona", async () => {
    mockEstado = logado();
    expect(await guarda(["(tabs)", "black-friday"], "/black-friday#assento")).toEqual([]);
    expect(await guarda(["(tabs)", "black-friday"], "/black-friday?secao=assento")).toEqual([]);
  });

  test("em teste: fica na página (o cartão explica e leva aos planos)", async () => {
    mockEstado = { ...logado({ billing_status: "trial" }), trialActive: true };
    expect(await guarda(["(tabs)", "black-friday"], "/black-friday#assento")).toEqual([]);
  });

  test.each(["/black-friday#assento", "/black-friday?secao=assento"])(
    "teste vencido (%s): checkout com o Negócio marcado, nunca a Expansão", async (url) => {
      mockEstado = logado({ billing_status: "inactive", plan: "expansao" });
      expect(await guarda(["(tabs)", "black-friday"], url)).toEqual(["/(tabs)/checkout?plan=negocio&de=assento"]);
    });

  test("assinatura cancelada: o mesmo destino", async () => {
    mockEstado = logado({ billing_status: "cancelled", plan: "essencial" });
    expect(await guarda(["(tabs)", "black-friday"], "/black-friday#assento")).toEqual(["/(tabs)/checkout?plan=negocio&de=assento"]);
  });

  test.each([7, 14])("em atraso (dia %i): checkout com a frase da mensalidade, sem trocar o plano", async (n) => {
    mockEstado = logado({ plan: "expansao", ...emAtraso(n) });
    expect(await guarda(["(tabs)", "black-friday"], "/black-friday#assento")).toEqual(["/(tabs)/checkout?de=assento"]);
  });

  test("em atraso antes do dia 7: nada bloqueia, fica na página", async () => {
    mockEstado = logado(emAtraso(3));
    expect(await guarda(["(tabs)", "black-friday"], "/black-friday#assento")).toEqual([]);
  });

  test("sem a âncora do assento: o muro de sempre (Caixa)", async () => {
    mockEstado = logado({ billing_status: "inactive" });
    expect(await guarda(["(tabs)", "black-friday"], "/black-friday")).toEqual(["/(tabs)/pdv"]);
    expect(await guarda(["(tabs)", "black-friday"], "/black-friday#vale-troca")).toEqual(["/(tabs)/pdv"]);
  });

  test.each([
    ["studio", "/studio/(estudio)"],
    ["odonto", "/dental/(clinic)/hoje"],
    ["food", "/food/(salao)/mesas"],
  ])("%s: fica como está (vai à casa da vertical, sem o destino do assento)", async (vertical, casa) => {
    mockEstado = logado({ billing_status: "inactive", vertical_active: vertical });
    const destinos = await guarda(["(tabs)", "black-friday"], "/black-friday#assento");
    expect(destinos).toEqual([casa]);
    expect(destinos.join(" ")).not.toContain("de=assento");
  });
});
