// ============================================================
// utils/quotePdf.ts — texto do orçamento impresso pelo Caixa.
//
// 23/09/2026 (QA final Matcon): saía "ORCAMENTO", "Valido ate",
// "Unitario", "Este nao e" e o tijolo por milheiro como "1 mlh".
// ============================================================
import { buildQuoteHtml, quantidadeImpressa } from "@/utils/quotePdf";

describe("quantidadeImpressa", () => {
  test("milheiro diz quantas peças são", () => {
    expect(quantidadeImpressa(1, "mlh")).toBe("1 milheiro (1.000 peças)");
    expect(quantidadeImpressa(0.5, "mlh")).toBe("0,5 milheiro (500 peças)");
    expect(quantidadeImpressa(2.5, "mlh")).toBe("2,5 milheiros (2.500 peças)");
    expect(quantidadeImpressa(0.001, "mlh")).toBe("0,001 milheiro (1 peça)");
  });

  test("unidade por extenso e no plural certo; medida não flexiona", () => {
    expect(quantidadeImpressa(2, "sc")).toBe("2 sacos");
    expect(quantidadeImpressa(1, "sc")).toBe("1 saco");
    expect(quantidadeImpressa(12.5, "m²")).toBe("12,5 m²");
    expect(quantidadeImpressa(3, "un")).toBe("3 un");
  });

  test("sem unidade, o número como sempre saiu", () => {
    expect(quantidadeImpressa(10)).toBe("10");
    expect(quantidadeImpressa(10, null)).toBe("10");
  });
});

describe("buildQuoteHtml — acentos e quantidade", () => {
  const html = buildQuoteHtml({
    items: [
      { name: "Tijolo 8 furos", qty: 1, unitPrice: 890, unit: "mlh" },
      { name: "Cimento CP-II 50 kg", qty: 2, unitPrice: 38, unit: "sc" },
    ],
    total: 966,
    companyName: "Depósito",
  });

  test("declara UTF-8 e escreve com acento", () => {
    expect(html).toContain('<meta charset="UTF-8" />');
    expect(html).toContain("ORÇAMENTO");
    expect(html).toContain("Válido até ");
    expect(html).toContain("<th>Preço unitário</th>");
    expect(html).toContain("Orçamento gerado por");
    expect(html).toContain("Este orçamento não é documento fiscal.");
    expect(html).not.toMatch(/ORCAMENTO|Valido ate|Unitario|nao e /);
  });

  test("milheiro e saco por extenso na coluna Quantidade", () => {
    expect(html).toContain("1 milheiro (1.000 peças)");
    expect(html).toContain("2 sacos");
    expect(html).not.toContain("mlh");
  });
});
