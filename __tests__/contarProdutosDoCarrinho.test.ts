import { contarProdutosDoCarrinho } from "@/utils/contarProdutosDoCarrinho";

describe("contarProdutosDoCarrinho", () => {
  test("carrinho vazio = 0", () => {
    expect(contarProdutosDoCarrinho([])).toBe(0);
  });
  test("sem unidade (nulo, indefinido, vazio) soma a quantidade", () => {
    expect(contarProdutosDoCarrinho([{ qty: 3 }, { qty: 2, unit: null }, { qty: 1, unit: "" }, { qty: 4, unit: "  " }])).toBe(10);
  });
  test("unidades de peça, em qualquer caixa, somam a quantidade", () => {
    for (const u of ["un", "UN", "Und", "unid", "pc", "pç", "peca", "Peça"]) {
      expect(contarProdutosDoCarrinho([{ qty: 3, unit: u }])).toBe(3);
    }
  });
  test("m², kg, milheiro, saco e caixa contam 1 por linha", () => {
    expect(contarProdutosDoCarrinho([
      { qty: 10, unit: "m²" }, { qty: 2.5, unit: "kg" }, { qty: 0.5, unit: "mlh" },
      { qty: 20, unit: "sc" }, { qty: 6, unit: "cx" }, { qty: 3, unit: "m³" },
    ])).toBe(6);
  });
  test("quantidade fracionária sem unidade conta 1", () => {
    expect(contarProdutosDoCarrinho([{ qty: 1.5 }])).toBe(1);
  });
  test("mistura: peças somam, o resto conta 1", () => {
    expect(contarProdutosDoCarrinho([{ qty: 3 }, { qty: 2, unit: "un" }, { qty: 10, unit: "m²" }])).toBe(6);
  });
});
