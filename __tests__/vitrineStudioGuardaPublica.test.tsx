// ============================================================
// Vitrine Studio · Onda 1B — o guarda de autenticação e as telas da loja
//
// Monta o layout RAIZ de verdade (app/_layout.tsx) sem ninguém logado e
// confere para onde o guarda manda. A vitrine é uma LOJA: quem abre é a
// cliente, que não tem conta. Até a Onda 1B só a home (`/[slug]`) era
// liberada; com as telas aninhadas, abrir o link de um produto mandaria
// a cliente para o login.
// ============================================================
import React from "react";
import { render, waitFor, configure } from "@testing-library/react-native";

// Mesmo ajuste dos outros testes de tela: o jest mapeia react-native para
// react-native-web e a detecção automática de host components quebra.
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
}));

// Sessão hidratada e ninguém logado — o caso da cliente que abre o link.
jest.mock("@/stores/auth", () => {
  const estado = {
    token: null, user: null, company: null, isHydrated: true,
    isDemo: false, isStaff: false, trialActive: false, hydrate: () => {},
  };
  const useAuthStore: any = () => estado;
  useAuthStore.getState = () => estado;
  useAuthStore.setState = () => {};
  return { useAuthStore };
});
jest.mock("@/stores/karateIntro", () => ({
  useKarateIntro: (sel: any) => sel({ pending: false, consume: () => {} }),
}));
jest.mock("@/services/api", () => ({ authApi: { me: jest.fn() } }));
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

import RootLayout from "@/app/_layout";

async function guardaCom(segments: string[]) {
  mockReplace.mockClear();
  mockSegments = segments;
  const r = render(<RootLayout />);
  // O guarda roda em efeito; um ciclo basta para ele decidir.
  await waitFor(() => {});
  r.unmount();
  return mockReplace.mock.calls.map((c) => c[0]);
}

describe("sem login, a vitrine abre inteira", () => {
  test.each([
    [["[slug]"], "home"],
    [["[slug]", "p", "[id]"], "produto"],
    [["[slug]", "c", "[categoria]"], "categoria"],
    [["[slug]", "finalizar"], "checkout"],
    [["[slug]", "orcamento"], "orçamento em lote"],
    [["[slug]", "sacola"], "rota reservada"],
    [["[slug]", "pedido", "[token]"], "rota reservada com token"],
  ])("%j (%s) não manda para o login", async (segments) => {
    expect(await guardaCom(segments as string[])).toEqual([]);
  });
});

describe("o painel continua pedindo login", () => {
  test.each([
    [["studio", "(estudio)"]],
    [["(tabs)"]],
    [["empresas"]],
  ])("%j vai para o login", async (segments) => {
    expect(await guardaCom(segments as string[])).toEqual(["/(auth)/login"]);
  });
});
