// 28/09/2026 — Qbonita: 54 de 55 produtos com custo zero. O card "Valor em
// estoque" (Σ estoque × custo) mostrava R$ 250 num estoque de R$ 20.785 a
// preço de venda. O resumo passa a trazer os dois valores e quantos produtos
// estão sem custo.
import { resumoValorEstoque, legendaValorEstoque } from "@/utils/valorEstoque";

const fmt = (n: number) => "R$ " + n.toFixed(2).replace(".", ",");

describe("resumoValorEstoque", () => {
  it("soma a custo e a preço de venda e conta os produtos sem custo", () => {
    const r = resumoValorEstoque([
      { stock: 2, cost: 125, price: 199 },
      { stock: 3, cost: 0, price: 89 },
      { stock: 1, cost: 0, price: 150 },
    ]);
    expect(r.custo).toBe(250);
    expect(r.venda).toBe(2 * 199 + 3 * 89 + 150);
    expect(r.semCusto).toBe(2);
  });

  it("produto sem peças não conta como 'sem custo' nem entra nas somas", () => {
    const r = resumoValorEstoque([{ stock: 0, cost: 0, price: 50 }]);
    expect(r).toEqual({ custo: 0, venda: 0, semCusto: 0 });
  });

  it("estoque negativo não abate o valor, e serviço fica de fora", () => {
    const r = resumoValorEstoque([
      { stock: -2, cost: 10, price: 20 },
      { stock: 5, cost: 0, price: 80, unit: "srv" },
      { stock: 1, cost: 10, price: 20 },
    ]);
    expect(r).toEqual({ custo: 10, venda: 20, semCusto: 0 });
  });
});

describe("legendaValorEstoque", () => {
  it("todos com custo: só o valor de venda", () => {
    expect(legendaValorEstoque({ custo: 10, venda: 20, semCusto: 0 }, fmt)).toBe("R$ 20,00 a preço de venda");
  });

  it("com produtos sem custo: avisa quantos", () => {
    expect(legendaValorEstoque({ custo: 250, venda: 20785, semCusto: 54 }, fmt))
      .toBe("R$ 20785,00 a preço de venda · 54 produtos sem custo");
    expect(legendaValorEstoque({ custo: 0, venda: 10, semCusto: 1 }, fmt)).toMatch(/1 produto sem custo$/);
  });

  it("respeita a máscara de valores ocultos (o fmt vem de fora)", () => {
    expect(legendaValorEstoque({ custo: 0, venda: 10, semCusto: 0 }, () => "R$ •••")).toBe("R$ ••• a preço de venda");
  });
});
