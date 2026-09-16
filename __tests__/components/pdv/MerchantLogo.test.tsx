// Fase 0 · I0.3 — a logo do lojista some do painel roxo de 200px e abre o
// cabeçalho (48px) e o carrinho vazio (120px). Sem logo (ou plano sem
// direito a ela), cai no tile violeta com a inicial da loja — nunca a logo
// da Aura.
import React from "react";
import renderer, { act } from "react-test-renderer";

var mockProfile: { logoUrl: string | null; plan: string; tradeName: string } = {
  logoUrl: null,
  plan: "negocio",
  tradeName: "Finesse",
};
jest.mock("@/hooks/useCompanyProfile", () => ({
  useCompanyProfile: () => ({
    logoUrl: mockProfile.logoUrl,
    plan: mockProfile.plan,
    tradeName: mockProfile.tradeName,
  }),
}));

var mockCompanyLogo: string | null = null;
jest.mock("@/stores/auth", () => ({
  useAuthStore: (selector: any) => {
    var state = { companyLogo: mockCompanyLogo };
    return typeof selector === "function" ? selector(state) : state;
  },
}));

import { MerchantLogo, podeMostrarLogo, initialDaLoja } from "@/components/screens/pdv/MerchantLogo";

// React quebra texto interpolado em nós separados — achatamos a árvore
// RENDERIZADA (toJSON, já mapeada pro DOM via react-native-web). Mesmo
// padrão de __tests__/financeiroResumoHero.test.tsx.
function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

beforeEach(() => {
  mockProfile = { logoUrl: null, plan: "negocio", tradeName: "Finesse" };
  mockCompanyLogo = null;
});

describe("podeMostrarLogo / initialDaLoja", () => {
  it("planos com direito à logo: negocio, expansao, personalizado", () => {
    expect(podeMostrarLogo("negocio")).toBe(true);
    expect(podeMostrarLogo("expansao")).toBe(true);
    expect(podeMostrarLogo("personalizado")).toBe(true);
  });

  it("planos sem direito à logo (ex.: essencial) caem pro tile", () => {
    expect(podeMostrarLogo("essencial")).toBe(false);
    expect(podeMostrarLogo(null)).toBe(false);
  });

  it("inicial da loja: primeira letra maiúscula; sem nome, 'L' de loja (nunca 'A')", () => {
    expect(initialDaLoja("Finesse")).toBe("F");
    expect(initialDaLoja("bella moda")).toBe("B");
    expect(initialDaLoja("")).toBe("L");
    expect(initialDaLoja(null)).toBe("L");
  });
});

describe("MerchantLogo — cabeçalho (size 48) e carrinho vazio (size 120)", () => {
  it("com logo cadastrada e plano habilitado: renderiza a imagem inteira (contain), não corta", () => {
    mockProfile = { logoUrl: "https://cdn.aura/logo-finesse.png", plan: "negocio", tradeName: "Finesse" };
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<MerchantLogo size={48} />);
    });
    const img = t.root.findByType("img" as any);
    expect(img.props.src).toBe("https://cdn.aura/logo-finesse.png");
    expect(img.props.style.height).toBe(48);
    expect(img.props.style.objectFit).toBe("contain");
    expect(img.props.alt).toContain("Finesse");
  });

  it("no carrinho vazio a logo é grande (120) e discreta (dim)", () => {
    mockProfile = { logoUrl: "https://cdn.aura/logo-finesse.png", plan: "negocio", tradeName: "Finesse" };
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<MerchantLogo size={120} dim />);
    });
    const img = t.root.findByType("img" as any);
    expect(img.props.style.height).toBe(120);
  });

  it("sem logo cadastrada: cai no tile violeta com a inicial da loja", () => {
    mockProfile = { logoUrl: null, plan: "negocio", tradeName: "Finesse" };
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<MerchantLogo size={48} />);
    });
    expect(t.root.findAllByType("img" as any).length).toBe(0);
    expect(flattenText(t.toJSON())).toBe("F");
  });

  it("plano sem direito à logo: mesmo com logoUrl no profile, mostra o tile (gate de plano)", () => {
    mockProfile = { logoUrl: "https://cdn.aura/logo-finesse.png", plan: "essencial", tradeName: "Finesse" };
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<MerchantLogo size={48} />);
    });
    expect(t.root.findAllByType("img" as any).length).toBe(0);
  });

  it("fallback: sem logoUrl no profile mas com companyLogo no auth store, ainda mostra a imagem", () => {
    mockProfile = { logoUrl: null, plan: "negocio", tradeName: "Finesse" };
    mockCompanyLogo = "https://cdn.aura/fallback-logo.png";
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<MerchantLogo size={48} />);
    });
    const img = t.root.findByType("img" as any);
    expect(img.props.src).toBe("https://cdn.aura/fallback-logo.png");
  });

  it("nunca é a logo da Aura: sem nada cadastrado, é o tile com a inicial, não uma marca fixa", () => {
    mockProfile = { logoUrl: null, plan: "negocio", tradeName: "" };
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<MerchantLogo size={48} />);
    });
    expect(flattenText(t.toJSON())).toBe("L");
    expect(t.root.findAllByType("img" as any).length).toBe(0);
  });
});
