// "Olho" que oculta valores financeiros no Painel, Crediário e Estoque
// (17/09/2026). Regra de máscara + estado compartilhado + preferência lembrada.
import { ocultarMoeda, MASCARA_MOEDA, lerPreferencia, gravarPreferencia, CHAVE_STORAGE } from "@/utils/valoresOcultos";

describe("ocultarMoeda", () => {
  it("troca o valor pela máscara quando ocultos", () => {
    expect(ocultarMoeda("R$ 674,60", true)).toBe(MASCARA_MOEDA);
    expect(MASCARA_MOEDA).not.toMatch(/\d/);
  });

  it("devolve o texto intacto quando visíveis", () => {
    expect(ocultarMoeda("R$ 674,60", false)).toBe("R$ 674,60");
  });
});

describe("preferência no aparelho", () => {
  beforeEach(() => { localStorage.clear(); });

  it("padrão é valores visíveis", () => {
    expect(lerPreferencia()).toBe(false);
  });

  it("grava e lê de volta; mostrar de novo apaga a chave", () => {
    gravarPreferencia(true);
    expect(localStorage.getItem(CHAVE_STORAGE)).toBe("1");
    expect(lerPreferencia()).toBe(true);
    gravarPreferencia(false);
    expect(localStorage.getItem(CHAVE_STORAGE)).toBeNull();
    expect(lerPreferencia()).toBe(false);
  });

  it("storage bloqueado não quebra a tela", () => {
    const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    try {
      expect(lerPreferencia()).toBe(false);
      expect(() => gravarPreferencia(true)).not.toThrow();
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});

describe("estado compartilhado entre as telas", () => {
  beforeEach(() => { localStorage.clear(); jest.resetModules(); });

  it("alternar vira o estado e lembra no aparelho", () => {
    const { useValoresOcultosStore } = require("@/stores/valoresOcultos");
    expect(useValoresOcultosStore.getState().ocultos).toBe(false);
    useValoresOcultosStore.getState().alternar();
    expect(useValoresOcultosStore.getState().ocultos).toBe(true);
    expect(localStorage.getItem(CHAVE_STORAGE)).toBe("1");
    useValoresOcultosStore.getState().alternar();
    expect(useValoresOcultosStore.getState().ocultos).toBe(false);
  });

  it("abre já oculto se a preferência ficou gravada", () => {
    localStorage.setItem(CHAVE_STORAGE, "1");
    const { useValoresOcultosStore } = require("@/stores/valoresOcultos");
    expect(useValoresOcultosStore.getState().ocultos).toBe(true);
  });
});
