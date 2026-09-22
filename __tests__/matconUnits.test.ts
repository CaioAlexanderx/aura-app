// ============================================================
// utils/matconUnits.ts — fracionamento dirigido pela unidade (22/09/2026,
// docs/matcon-faseamento-po-ux.md secao 2). Funcoes puras, sem mock
// necessario.
//
// O teste que mais importa aqui e o de "nao vaza": com o toggle desligado,
// unitsForProduct devolve a MESMA referencia de UNITS (nao uma copia) —
// e o jeito de garantir que nenhuma loja sem Matcon é afetada.
// ============================================================
import { UNITS } from "@/components/screens/estoque/types";
import {
  MATCON_UNITS,
  FRACTIONAL_UNITS,
  isFractionalUnit,
  unitsForProduct,
  parseQtyInput,
  fmtQty,
  toPackages,
} from "@/utils/matconUnits";

describe("isFractionalUnit", () => {
  test("unidades fracionaveis (case-insensitive, com espaco)", () => {
    expect(isFractionalUnit("m")).toBe(true);
    expect(isFractionalUnit("m²")).toBe(true);
    expect(isFractionalUnit("m³")).toBe(true);
    expect(isFractionalUnit("kg")).toBe(true);
    expect(isFractionalUnit("KG")).toBe(true);
    expect(isFractionalUnit(" L ")).toBe(true);
    expect(isFractionalUnit("ml")).toBe(true);
    expect(isFractionalUnit("Ton")).toBe(true);
  });

  test("unidades inteiras ficam de fora", () => {
    expect(isFractionalUnit("un")).toBe(false);
    expect(isFractionalUnit("sc")).toBe(false);
    expect(isFractionalUnit("cx")).toBe(false);
    expect(isFractionalUnit("pç")).toBe(false);
  });

  test("undefined/vazio -> false", () => {
    expect(isFractionalUnit(undefined)).toBe(false);
    expect(isFractionalUnit(null)).toBe(false);
    expect(isFractionalUnit("")).toBe(false);
    expect(isFractionalUnit("   ")).toBe(false);
  });
});

describe("parseQtyInput", () => {
  test("decimal BR simples", () => {
    expect(parseQtyInput("12,5")).toBe(12.5);
  });

  test("decimal solto (ponto)", () => {
    expect(parseQtyInput("12.5")).toBe(12.5);
  });

  test("milhar + decimal BR", () => {
    expect(parseQtyInput("1.200,5")).toBe(1200.5);
  });

  test("inteiro puro", () => {
    expect(parseQtyInput("12")).toBe(12);
  });

  test("espacos nas pontas são ignorados", () => {
    expect(parseQtyInput("  12,5  ")).toBe(12.5);
  });

  test("arredonda pra no maximo 3 casas decimais", () => {
    expect(parseQtyInput("1,23456")).toBe(1.235);
  });

  test("lixo -> null", () => {
    expect(parseQtyInput("abc")).toBeNull();
  });

  test("vazio -> null", () => {
    expect(parseQtyInput("")).toBeNull();
    expect(parseQtyInput("   ")).toBeNull();
  });

  test("negativo -> null", () => {
    expect(parseQtyInput("-5")).toBeNull();
  });

  test("zero -> null", () => {
    expect(parseQtyInput("0")).toBeNull();
    expect(parseQtyInput("0,0")).toBeNull();
  });
});

describe("fmtQty", () => {
  test("inteiro sem decimais", () => {
    expect(fmtQty(1200)).toBe("1.200");
  });

  test("fracionado sem zero a direita", () => {
    expect(fmtQty(12.5)).toBe("12,5");
    expect(fmtQty(0.75)).toBe("0,75");
  });

  test("com unidade, sufixa com espaço", () => {
    expect(fmtQty(12.5, "m²")).toBe("12,5 m²");
  });
});

describe("toPackages", () => {
  test("12,5 m² em caixas de 2,32 m²", () => {
    expect(toPackages(12.5, 2.32)).toEqual({ packages: 6, covered: 13.92, leftover: 1.42 });
  });

  test("caso exato: 4,64 / 2,32 -> 2 caixas, sobra 0", () => {
    expect(toPackages(4.64, 2.32)).toEqual({ packages: 2, covered: 4.64, leftover: 0 });
  });

  test("borda: qty levemente acima de N caixas não pode arredondar pra baixo (sobra negativa)", () => {
    // 2,3201 / 2,32 = 1,00004... -- precisa de 2 caixas, nunca 1 (senão o
    // cliente levaria menos material do que pediu).
    expect(toPackages(2.3201, 2.32)).toEqual({ packages: 2, covered: 4.64, leftover: 2.32 });
  });

  test("factor <= 0 -> tudo zerado, sem dividir por zero", () => {
    expect(toPackages(10, 0)).toEqual({ packages: 0, covered: 0, leftover: 0 });
    expect(toPackages(10, -1)).toEqual({ packages: 0, covered: 0, leftover: 0 });
  });
});

describe("unitsForProduct: contrato de zero impacto", () => {
  test("toggle off -> mesma referência de UNITS (não uma cópia)", () => {
    expect(unitsForProduct(false)).toBe(UNITS);
  });

  test("toggle on -> começa com os 9 de UNITS e termina com MATCON_UNITS", () => {
    const result = unitsForProduct(true);
    expect(result.slice(0, UNITS.length)).toEqual(UNITS);
    expect(result.slice(UNITS.length)).toEqual(MATCON_UNITS);
  });

  test("UNITS tem exatamente 9 unidades hoje", () => {
    expect(UNITS.length).toBe(9);
  });

  test("FRACTIONAL_UNITS cobre as unidades fracionaveis do doc", () => {
    expect(Array.from(FRACTIONAL_UNITS).sort()).toEqual(
      ["m", "m²", "m³", "kg", "g", "L", "ml", "ton"].sort()
    );
  });
});
