// ============================================================================
// AURA. — Etiquetas: quantidade padrão por unidade (QA 23/09/2026)
//
// A mudança (padrão vira 1 pra unidade fracionada/milheiro) vale SÓ com
// matcon_enabled ligado — restrição do Caio. Loja sem Matcon (inclusive
// quem vende por kg/L fora do módulo) mantém o padrão de sempre = estoque.
// ============================================================================
import { defaultLabelQty, unitLabelForList } from "@/components/screens/estoque/labels/labelDefaults";

describe("defaultLabelQty", () => {
  test("Matcon ligado + unidade fracionada (m²) — padrão 1, mesmo com estoque alto", () => {
    expect(defaultLabelQty("m²", 110, true)).toBe(1);
  });
  test("Matcon ligado + unidade fracionada em ASCII (m2, m3) — padrão 1", () => {
    expect(defaultLabelQty("m2", 110, true)).toBe(1);
    expect(defaultLabelQty("m3", 40, true)).toBe(1);
  });
  test("Matcon ligado + kg/L/ton — padrão 1", () => {
    expect(defaultLabelQty("kg", 50, true)).toBe(1);
    expect(defaultLabelQty("L", 30, true)).toBe(1);
    expect(defaultLabelQty("ton", 12, true)).toBe(1);
  });
  test("Matcon ligado + milheiro (mlh) — padrão 1", () => {
    expect(defaultLabelQty("mlh", 19.5, true)).toBe(1);
  });
  test("Matcon ligado + unidade normal (un) — padrão é o estoque, como sempre", () => {
    expect(defaultLabelQty("un", 25, true)).toBe(25);
    expect(defaultLabelQty("un", 1, true)).toBe(1);
    expect(defaultLabelQty("un", 0, true)).toBe(1);
  });
  test("Matcon DESLIGADO + unidade fracionada (m², kg, L) — mantém o padrão de sempre (estoque), NÃO vira 1", () => {
    expect(defaultLabelQty("m²", 110, false)).toBe(110);
    expect(defaultLabelQty("kg", 50, false)).toBe(50);
    expect(defaultLabelQty("L", 30, false)).toBe(30);
    expect(defaultLabelQty("mlh", 19.5, false)).toBe(19.5);
  });
  test("Matcon desligado + un — comportamento de sempre", () => {
    expect(defaultLabelQty("un", 7, false)).toBe(7);
    expect(defaultLabelQty("un", 0, false)).toBe(1);
  });
});

describe("unitLabelForList", () => {
  test("usa a unidade do produto", () => {
    expect(unitLabelForList("m²")).toBe("m²");
    expect(unitLabelForList("kg")).toBe("kg");
  });
  test("sem unidade cadastrada, cai em 'un' (compat)", () => {
    expect(unitLabelForList("")).toBe("un");
    expect(unitLabelForList(null)).toBe("un");
    expect(unitLabelForList(undefined)).toBe("un");
  });
});
