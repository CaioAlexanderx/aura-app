// Seletor do nº de parcelas do crediário no PDV (15/09/2026).
// A grade de 500 botões virou dropdown; estas funções geram as opções.
import { buildInstallmentOptions, clampInstallments } from "../utils/installmentOptions";

const brl = (v: number) => "R$ " + v.toFixed(2).replace(".", ",");

describe("buildInstallmentOptions", () => {
  it("gera uma opção por parcela até o teto, com o valor de cada uma", () => {
    const opts = buildInstallmentOptions(12, 100, brl);
    expect(opts).toHaveLength(12);
    expect(opts[0]).toEqual({ value: 1, label: "1x de R$ 100,00" });
    expect(opts[2]).toEqual({ value: 3, label: "3x de R$ 33,33" });
    expect(opts[11]).toEqual({ value: 12, label: "12x de R$ 8,33" });
  });

  it("sem total mostra só a quantidade", () => {
    const opts = buildInstallmentOptions(3, 0, brl);
    expect(opts.map((o) => o.label)).toEqual(["1x", "2x", "3x"]);
  });

  it("aguenta o teto padrão de 500 parcelas", () => {
    const opts = buildInstallmentOptions(500, 1000, brl);
    expect(opts).toHaveLength(500);
    expect(opts[499]).toEqual({ value: 500, label: "500x de R$ 2,00" });
  });

  it("teto inválido ainda oferece 1x", () => {
    expect(buildInstallmentOptions(0, 50, brl)).toEqual([{ value: 1, label: "1x de R$ 50,00" }]);
    expect(buildInstallmentOptions(NaN, 50, brl)).toHaveLength(1);
  });
});

describe("clampInstallments", () => {
  it("aceita o valor do select dentro do teto", () => {
    expect(clampInstallments("7", 12)).toBe(7);
    expect(clampInstallments(12, 12)).toBe(12);
  });

  it("corta no teto da loja", () => {
    expect(clampInstallments("999", 500)).toBe(500);
    expect(clampInstallments("24", 12)).toBe(12);
  });

  it("vazio, zero ou lixo viram 1", () => {
    expect(clampInstallments("", 12)).toBe(1);
    expect(clampInstallments("0", 12)).toBe(1);
    expect(clampInstallments("abc", 12)).toBe(1);
    expect(clampInstallments(undefined, 12)).toBe(1);
  });

  it("ignora o que não é dígito, como o campo numérico já fazia", () => {
    expect(clampInstallments("6x", 12)).toBe(6);
  });
});
