// useDentalPersona importa stores/auth, que importa expo-secure-store —
// e expo-modules-core não carrega sob Jest. Mock necessário mesmo só
// testando as funções puras (detectDentalPersona / isSoloDentistManager),
// porque o import do módulo já dispara a cadeia.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import { detectDentalPersona, isSoloDentistManager } from "@/hooks/useDentalPersona";

describe("isSoloDentistManager", () => {
  test("gestor com exatamente 1 dentista ativo é dentista solo", () => {
    expect(isSoloDentistManager("gestor", 1)).toBe(true);
  });

  test("gestor com 2+ dentistas ativos mantém visão de gestor", () => {
    expect(isSoloDentistManager("gestor", 2)).toBe(false);
    expect(isSoloDentistManager("gestor", 3)).toBe(false);
  });

  test("gestor sem nenhum dentista ativo cadastrado não é solo", () => {
    expect(isSoloDentistManager("gestor", 0)).toBe(false);
  });

  test("persona dentista não é afetada pela regra (painel já é dela por padrão)", () => {
    expect(isSoloDentistManager("dentista", 1)).toBe(false);
  });

  test("persona recepção nunca é solo dentist", () => {
    expect(isSoloDentistManager("recepcao", 1)).toBe(false);
  });
});

describe("detectDentalPersona (regressão — não deve quebrar com a nova regra)", () => {
  test("owner sem role vira gestor", () => {
    expect(detectDentalPersona(null)).toBe("gestor");
  });

  test("role recepcao mantém recepcao", () => {
    expect(detectDentalPersona("recepcao")).toBe("recepcao");
  });

  test("role dentista mantém dentista", () => {
    expect(detectDentalPersona("dentista")).toBe("dentista");
  });
});
