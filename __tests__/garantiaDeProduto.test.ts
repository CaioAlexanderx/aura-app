// Garantia de produto no PDV: rascunho (por chave do carrinho) e helpers.
jest.mock("@/stores/auth", () => ({ useAuthStore: { getState: () => ({ token: null }) } }));
jest.mock("@/services/api", () => ({ request: jest.fn(), BASE_URL: "" }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));

import { useWarrantyDraft, diasValidos } from "@/stores/warrantyDraft";
import { prazoLabel, dataBR, decomporChave } from "@/services/warrantiesApi";

describe("rascunho da garantia", () => {
  beforeEach(() => useWarrantyDraft.getState().reset());

  test("guarda dias por chave e remove ao zerar", () => {
    const s = useWarrantyDraft.getState();
    s.setDays("p1", 90);
    s.setDays("p2__v1", 365);
    expect(useWarrantyDraft.getState().days).toEqual({ p1: 90, p2__v1: 365 });
    useWarrantyDraft.getState().setDays("p1", 0);
    expect(useWarrantyDraft.getState().days).toEqual({ p2__v1: 365 });
  });

  test("item removido do carrinho não deixa garantia fantasma", () => {
    expect(diasValidos({ a: 30, b: 90 }, ["b"])).toEqual({ b: 90 });
    expect(diasValidos({ a: 30 }, [])).toEqual({});
  });

  test("reset limpa tudo", () => {
    const s = useWarrantyDraft.getState();
    s.setOn(true); s.openModal(); s.setDays("a", 10);
    useWarrantyDraft.getState().reset();
    expect(useWarrantyDraft.getState()).toMatchObject({ on: false, modalOpen: false, days: {} });
  });
});

describe("helpers", () => {
  test("prazo", () => {
    expect(prazoLabel(365)).toBe("1 ano");
    expect(prazoLabel(90)).toBe("3 meses");
    expect(prazoLabel(45)).toBe("45 dias");
  });
  test("data BR sem deslocar o dia", () => {
    expect(dataBR("2026-09-30")).toBe("30/09/2026");
    expect(dataBR(null)).toBe("");
  });
  test("chave do carrinho com e sem variação", () => {
    expect(decomporChave("abc")).toEqual({ pid: "abc", vid: null });
    expect(decomporChave("abc__v9")).toEqual({ pid: "abc", vid: "v9" });
  });
});
