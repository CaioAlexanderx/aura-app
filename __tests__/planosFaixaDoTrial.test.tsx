// tq-43 (26/10/2026): a faixa do teste na tela de Planos usa o mesmo
// avisoDoTrial do banner. Antes da primeira venda nunca mostra o teto (15).
import React from "react";
import renderer, { act } from "react-test-renderer";
import fs from "fs";
import path from "path";

let mockCompany: any = null;
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel: (s: any) => any) => sel({ company: mockCompany }),
}));

import { FaixaDoTrial } from "@/components/billing/FaixaDoTrial";

function bloco(extra: Record<string, unknown> = {}) {
  return {
    mode: "primeira_venda", ends_at: "2026-11-09T03:00:00.000Z", started_by_sale_at: null,
    dias_restantes: 15, teto_em: "2026-11-09T03:00:00.000Z", aguardando_primeira_venda: true,
    dias_apos_primeira_venda: 7, ...extra,
  };
}

function textos(diasRestantes: number) {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<FaixaDoTrial diasRestantes={diasRestantes} />); });
  const txt = (id: string) => {
    const n = t.root.find((x) => x.props.testID === id && typeof x.type !== "string");
    return [].concat(n.props.children).join("");
  };
  return { titulo: txt("planos-faixa-trial-titulo"), corpo: txt("planos-faixa-trial-corpo") };
}

describe("FaixaDoTrial (tela de Planos)", () => {
  it("antes da primeira venda: 7 dias, sem o teto de 15", () => {
    mockCompany = { plan: "negocio", trial: bloco() };
    const { titulo, corpo } = textos(15);
    expect(titulo).toBe("Teste grátis de 7 dias");
    expect(corpo).toBe("Os 7 dias começam na sua primeira venda no Caixa.");
    expect(titulo + corpo).not.toMatch(/15/);
  });

  it("depois da primeira venda: contador com os dias do servidor", () => {
    mockCompany = {
      plan: "negocio",
      trial: bloco({ aguardando_primeira_venda: false, started_by_sale_at: "2026-10-24T15:00:00Z", dias_restantes: 5 }),
    };
    const { titulo, corpo } = textos(12);
    expect(titulo).toBe("Teste grátis · 5 dias restantes");
    expect(corpo).toBe("Seus 7 dias começaram na sua primeira venda. Plano Negócio.");
  });

  it("backend sem o bloco trial: conta pelo billing-status, como antes", () => {
    mockCompany = { plan: "essencial" };
    expect(textos(4).titulo).toBe("Teste grátis · 4 dias restantes");
  });

  it("a tela de Planos não escreve mais o contador próprio", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "app/(tabs)/planos.tsx"), "utf8");
    expect(src).not.toMatch(/Período de teste/);
    expect(src).toMatch(/<FaixaDoTrial diasRestantes=\{trialDays\} \/>/);
  });
});
