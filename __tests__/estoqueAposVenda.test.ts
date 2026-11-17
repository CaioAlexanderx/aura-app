// p-149 (17/11/2026): estoque local depois da venda.
import { QueryClient } from "@tanstack/react-query";
import { baixarEstoqueNoCache, produtosComVarianteVendida } from "@/utils/estoqueAposVenda";

const CATALOGO = {
  products: [
    { id: "p1", name: "Blusa", stock_qty: "5.000", has_variants: false },
    { id: "p2", name: "Tênis", stock_qty: "0", has_variants: true, variants_stock_total: "7" },
    { id: "p3", name: "Piso", stock_qty: 12.5, has_variants: false },
    { id: "p4", name: "Meia", stock_qty: "1", has_variants: false },
  ],
};

describe("baixarEstoqueNoCache", () => {
  test("simples baixa stock_qty; com variante baixa variants_stock_total", () => {
    const novo = baixarEstoqueNoCache(CATALOGO, [
      { product_id: "p1", quantity: 2 },
      { product_id: "p2", variant_id: "v39", quantity: 1 },
      { product_id: "p2", variant_id: "v40", quantity: 2 },
      { product_id: "p3", quantity: 2.25 },
    ]);
    const por = Object.fromEntries(novo.products.map((p: any) => [p.id, p]));
    expect(por.p1.stock_qty).toBe("3");
    expect(por.p2.stock_qty).toBe("0");
    expect(por.p2.variants_stock_total).toBe("4");
    expect(por.p3.stock_qty).toBe(10.25);
    expect(por.p4).toBe(CATALOGO.products[3]); // não vendido: o mesmo objeto
    expect(CATALOGO.products[0].stock_qty).toBe("5.000"); // original intacto
  });
  test("nunca fica negativo (venda sem estoque para em zero)", () => {
    const novo = baixarEstoqueNoCache(CATALOGO, [{ product_id: "p4", quantity: 3 }]);
    expect(novo.products.find((p: any) => p.id === "p4").stock_qty).toBe("0");
  });
  test("formatos rows e array; item sem produto ou quantidade ruim não mexe", () => {
    expect(baixarEstoqueNoCache({ rows: [{ id: "p1", stock_qty: 2 }] }, [{ product_id: "p1", quantity: 1 }]).rows[0].stock_qty).toBe(1);
    expect(baixarEstoqueNoCache([{ id: "p1", stock_qty: 2 }], [{ product_id: "p1", quantity: "1" }])[0].stock_qty).toBe(1);
    expect(baixarEstoqueNoCache(CATALOGO, [{ product_id: null, quantity: 1 }, { product_id: "p1", quantity: 0 }])).toBe(CATALOGO);
    expect(baixarEstoqueNoCache(undefined, [{ product_id: "p1", quantity: 1 }])).toBeUndefined();
  });
  test("produtos com variante vendida (o cache do seletor sai)", () => {
    expect(produtosComVarianteVendida([{ product_id: "p2", variant_id: "v1" }, { product_id: "p1" }, { product_id: "p2", variant_id: "v2" }])).toEqual(["p2"]);
  });
  test("com um QueryClient de verdade: setQueriesData baixa sem recarregar", () => {
    const qc = new QueryClient();
    qc.setQueryData(["products", "co-1"], CATALOGO);
    qc.setQueriesData({ queryKey: ["products", "co-1"] }, (old: any) => baixarEstoqueNoCache(old, [{ product_id: "p1", quantity: 1 }]));
    const d: any = qc.getQueryData(["products", "co-1"]);
    expect(d.products[0].stock_qty).toBe("4");
  });
});
