// ============================================================
// Segundo CNPJ do Negócio a 50% do plano (decisão do Caio, 25/10/2026)
//
//   1. textos puros (utils/valorNovaEmpresa): aviso por plano e frase do
//      valor com a empresa nova, a partir do billing-preview
//   2. o AddCompanyModal busca o billing-preview ao abrir e mostra o valor
//      que ele devolve antes de confirmar
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ addCompany: jest.fn(), switchCompany: jest.fn(), switching: false }),
}));

jest.mock("@/services/api", () => ({
  cnpjApi: { lookup: jest.fn() },
  ApiError: class ApiError extends Error {},
  request: jest.fn(),
}));

// Modal do RNW usa portal: vira passa-adiante quando visível.
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  const ReactReal = jest.requireActual("react");
  return new Proxy(RN, {
    get(target, prop) {
      if (prop === "Modal") {
        return ({ visible, children }: any) =>
          visible ? ReactReal.createElement(ReactReal.Fragment, null, children) : null;
      }
      return target[prop as any];
    },
  });
});

const mockPreview = jest.fn();
jest.mock("@/services/multicnpj", () => {
  const real = jest.requireActual("@/services/multicnpj");
  return {
    ...real,
    userCompaniesApi: { billingPreview: (...a: any[]) => mockPreview(...a) },
  };
});

import { avisoDoPlano, resumoDaNovaEmpresa } from "@/utils/valorNovaEmpresa";
import { AddCompanyModal } from "@/components/AddCompanyModal";

const preview = (over: any = {}, add: any = {}) => ({
  current: {
    primary_id: "p1", plan: "negocio", base_price: 169, extra_unit_price: 84.5, included_in_plan: 1,
    total_companies: 1, extra_cnpjs: 0, extras_value: 0, total_monthly: 169, ...over,
  },
  if_add_one: {
    total_companies: 2, extra_cnpjs: 1, extra_unit_price: 84.5, new_total_monthly: 253.5,
    delta_monthly: 84.5, ajuste_pela_equipe: false, ...add,
  },
  can_add: true,
  block_reason: null,
});

describe("avisoDoPlano", () => {
  test("Negócio: a segunda empresa sai com 50% de desconto", () => {
    expect(avisoDoPlano("negocio")).toBe(
      "No Negócio, a segunda empresa sai com 50% de desconto sobre o seu plano. Mostramos o valor antes de você confirmar."
    );
  });

  test("Expansão mantém a regra dele (2 CNPJs)", () => {
    expect(avisoDoPlano("expansao")).toMatch(/cobre 2 CNPJs/);
  });

  test("sem plano conhecido: frase genérica, sem prometer CNPJ incluído", () => {
    expect(avisoDoPlano(undefined)).not.toMatch(/2 CNPJs|Negócio/);
  });
});

describe("resumoDaNovaEmpresa", () => {
  test("mensal: de R$ 169,00 para R$ 253,50", () => {
    expect(resumoDaNovaEmpresa(preview() as any)).toBe(
      "Com esta empresa, sua mensalidade vai de R$ 169,00 para R$ 253,50 (mais R$ 84,50 por mês)."
    );
  });

  test("anual: de R$ 140,83 para R$ 211,25", () => {
    const p = preview({ total_monthly: 140.83 }, { new_total_monthly: 211.25, delta_monthly: 70.42, extra_unit_price: 70.42 });
    expect(resumoDaNovaEmpresa(p as any)).toBe(
      "Com esta empresa, sua mensalidade vai de R$ 140,83 para R$ 211,25 (mais R$ 70,42 por mês)."
    );
  });

  test("condição especial: valor pela tabela e a equipe confirma", () => {
    const p = preview({ total_monthly: 211.2 }, { new_total_monthly: 281.67, ajuste_pela_equipe: true });
    const t = resumoDaNovaEmpresa(p as any)!;
    expect(t).toMatch(/R\$ 281,67/);
    expect(t).toMatch(/equipe Aura confirma/);
  });

  test("empresa incluída (Expansão com 1, Davi): sem aumento", () => {
    const p = preview({ plan: "expansao", total_monthly: 269 }, { new_total_monthly: 269, delta_monthly: 0, extra_cnpjs: 0 });
    expect(resumoDaNovaEmpresa(p as any)).toBe("Esta empresa está incluída no seu plano: a mensalidade continua R$ 269,00.");
  });

  test("sem preview ou plano que não permite: nada", () => {
    expect(resumoDaNovaEmpresa(null)).toBeNull();
    expect(resumoDaNovaEmpresa({ ...preview(), can_add: false } as any)).toBeNull();
  });
});

function textos(tree: renderer.ReactTestRenderer, testID: string): string {
  const achados = tree.root.findAll((n) => n.props && n.props.testID === testID, { deep: false });
  return achados
    .map((n) => {
      const c = n.props.children;
      return Array.isArray(c) ? c.join("") : String(c);
    })
    .join(" ");
}

describe("AddCompanyModal mostra o valor do billing-preview", () => {
  beforeEach(() => mockPreview.mockReset());

  test("Negócio mensal: aviso dos 50% e o valor que o backend devolveu", async () => {
    mockPreview.mockResolvedValue(preview());
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<AddCompanyModal visible onClose={() => {}} />);
    });
    expect(mockPreview).toHaveBeenCalledTimes(1);
    expect(textos(tree, "aviso-plano-multicnpj")).toMatch(/segunda empresa sai com 50% de desconto/);
    expect(textos(tree, "valor-nova-empresa")).toBe(
      "Com esta empresa, sua mensalidade vai de R$ 169,00 para R$ 253,50 (mais R$ 84,50 por mês)."
    );
  });

  test("preview falhou: aviso genérico, sem valor, e o formulário segue", async () => {
    mockPreview.mockRejectedValue(new Error("rede"));
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<AddCompanyModal visible onClose={() => {}} />);
    });
    expect(textos(tree, "aviso-plano-multicnpj")).toMatch(/valor extra/);
    expect(textos(tree, "valor-nova-empresa")).toBe("");
  });
});
