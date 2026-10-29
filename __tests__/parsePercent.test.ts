// ============================================================
// Leitura de percentual/decimal no formato brasileiro.
// Incidente 29/10/2026: "11,52" na taxa da maquininha gravou 100%.
// ============================================================
import { parseDecimalBR, parsePercent, formatPercent, formatDecimalBR } from "@/utils/parsePercent";

describe("parsePercent", () => {
  it.each([
    ["11,52", 11.52],
    ["11.52", 11.52],
    ["2", 2],
    [" 2 ", 2],
    ["2%", 2],
    ["2,5 %", 2.5],
    [",5", 0.5],
    [".5", 0.5],
    ["0", 0],
  ])("%j -> %d", (entrada, esperado) => {
    expect(parsePercent(entrada)).toBe(esperado);
  });

  it("trava em 100 e em 0", () => {
    expect(parsePercent("150")).toBe(100);
    expect(parsePercent("100,01")).toBe(100);
    expect(parsePercent("100")).toBe(100);
  });

  it("1.234,5 é milhar com decimal: passa de 100 e trava, nunca vira 12345 nem 1234.5 solto", () => {
    expect(parseDecimalBR("1.234,5")).toBe(1234.5);
    expect(parsePercent("1.234,5")).toBe(100);
  });

  it("vazio e lixo viram 0", () => {
    expect(parsePercent("")).toBe(0);
    expect(parsePercent("   ")).toBe(0);
    expect(parsePercent("abc")).toBe(0);
    expect(parsePercent("1a2")).toBe(0);
    expect(parsePercent("-5")).toBe(0);
    expect(parsePercent("1,2,3")).toBe(0);
    expect(parsePercent(",")).toBe(0);
    expect(parsePercent(null)).toBe(0);
    expect(parsePercent(undefined)).toBe(0);
  });

  it("arredonda em 2 casas", () => {
    expect(parsePercent("11,5249")).toBe(11.52);
    expect(parsePercent("11,525")).toBe(11.53);
  });

  it("respeita o teto informado (taxa de serviço vai até 30)", () => {
    expect(parsePercent("12,5", 30)).toBe(12.5);
    expect(parsePercent("45", 30)).toBe(30);
    expect(parsePercent("30,01", 30)).toBe(30);
  });
});

describe("parseDecimalBR", () => {
  it("valores em reais", () => {
    expect(parseDecimalBR("10,50")).toBe(10.5);
    expect(parseDecimalBR("10.50")).toBe(10.5);
    expect(parseDecimalBR("1.234,56")).toBe(1234.56);
    expect(parseDecimalBR("1.234.567")).toBe(1234567);
    expect(parseDecimalBR("150")).toBe(150);
  });

  it("não trava em 100 e devolve null no que não é número", () => {
    expect(parseDecimalBR("250,75")).toBe(250.75);
    expect(parseDecimalBR("")).toBeNull();
    expect(parseDecimalBR("abc")).toBeNull();
    expect(parseDecimalBR("R$ 5")).toBeNull();
  });
});

describe("formatPercent", () => {
  it("mostra com vírgula e sem zeros sobrando", () => {
    expect(formatPercent(11.52)).toBe("11,52");
    expect(formatPercent("11.52")).toBe("11,52");
    expect(formatPercent(2)).toBe("2");
    expect(formatPercent(2.5)).toBe("2,5");
    expect(formatDecimalBR(0)).toBe("0");
  });

  it("vazio e inválido ficam em branco", () => {
    expect(formatPercent(null)).toBe("");
    expect(formatPercent(undefined)).toBe("");
    expect(formatPercent("")).toBe("");
    expect(formatPercent("x")).toBe("");
  });

  it("ida e volta: o que é mostrado é lido igual", () => {
    expect(parsePercent(formatPercent(11.52))).toBe(11.52);
  });
});
