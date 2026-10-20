// 20/10/2026 — decisão do Caio: a logo cadastrada aparece em todos os planos.
// A BrandBanner (cabeçalho do Painel) escondia tudo fora de Negócio, Expansão
// e Personalizado. Agora: com logo, qualquer plano vê a logo; sem logo, fica
// como era (Negócio+ vê a inicial, os outros planos não veem nada).
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));

var mockProfile: { logoUrl: string | null; plan: string; tradeName: string } = {
  logoUrl: null,
  plan: "essencial",
  tradeName: "Finesse Modas",
};
jest.mock("@/hooks/useCompanyProfile", () => ({
  useCompanyProfile: () => ({
    logoUrl: mockProfile.logoUrl,
    plan: mockProfile.plan,
    tradeName: mockProfile.tradeName,
  }),
}));

import { BrandBanner } from "@/components/BrandBanner";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

function montar() {
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(<BrandBanner mode="header" />);
  });
  return t;
}

describe("BrandBanner — logo do lojista sem gate de plano", () => {
  it.each(["essencial", "negocio", "expansao", "personalizado"])(
    "plano %p com logo cadastrada: mostra a logo",
    (plan) => {
      mockProfile = { logoUrl: "https://cdn.aura/logo-finesse.png", plan, tradeName: "Finesse Modas" };
      const t = montar();
      expect(t.root.findByType("img" as any).props.src).toBe("https://cdn.aura/logo-finesse.png");
    },
  );

  it("Essencial sem logo: não mostra nada (igual a antes)", () => {
    mockProfile = { logoUrl: null, plan: "essencial", tradeName: "Finesse Modas" };
    const t = montar();
    expect(t.toJSON()).toBeNull();
  });

  it("Negócio sem logo: mostra a inicial (igual a antes)", () => {
    mockProfile = { logoUrl: null, plan: "negocio", tradeName: "Finesse Modas" };
    const t = montar();
    expect(t.root.findAllByType("img" as any).length).toBe(0);
    expect(flattenText(t.toJSON())).toBe("FM");
  });
});
