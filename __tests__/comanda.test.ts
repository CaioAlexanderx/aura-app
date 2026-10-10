// Comandas do Caixa (09/10/2026, adega do Luis Henrique): as contas puras.
import {
  numeroDaComanda, itensParaAComanda, linhasParaOCarrinho, taxaDeServico, htmlDoConsumo,
  lerComandaEnabled, ehIdDeCatalogo, chaveDaTaxa, type Comanda,
} from "../utils/comanda";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const V1 = "33333333-3333-4333-8333-333333333333";

const COMANDA: Comanda = {
  id: "c-12", number: 12, status: "open", opened_at: "2026-10-09T22:00:00Z",
  items_count: 4, subtotal: 111.5,
  items: [
    { id: "i1", product_id: P1, variant_id: null, name: "Copão Gin", unit: "un", quantity: 1, unit_price: 25, total: 25 },
    { id: "i2", product_id: P2, variant_id: V1, name: "Cerveja (600 ml)", unit: null, quantity: 2, unit_price: 12, total: 24 },
    { id: "i3", product_id: P1, variant_id: null, name: "Copão Gin", unit: "un", quantity: 2, unit_price: 25, total: 50 },
    { id: "i4", product_id: null, variant_id: null, name: "Gelo avulso", unit: null, quantity: 1, unit_price: 12.5, total: 12.5 },
  ],
};

describe("numeroDaComanda", () => {
  it("aceita o que está no cartão, com zero à esquerda e espaço", () => {
    expect(numeroDaComanda("12")).toBe(12);
    expect(numeroDaComanda(" 012 ")).toBe(12);
    expect(numeroDaComanda(9999)).toBe(9999);
  });
  it("recusa vazio, zero, letra, decimal e acima de 9999", () => {
    for (const v of ["", "0", "abc", "1.5", "12a", "10000", null, undefined]) expect(numeroDaComanda(v as any)).toBeNull();
  });
});

describe("lerComandaEnabled / ehIdDeCatalogo", () => {
  it("só true liga", () => {
    expect(lerComandaEnabled({ comanda_enabled: true })).toBe(true);
    expect(lerComandaEnabled({ comanda_enabled: "true" })).toBe(false);
    expect(lerComandaEnabled({})).toBe(false);
    expect(lerComandaEnabled(null)).toBe(false);
  });
  it("chave sintética do carrinho não é id de catálogo", () => {
    expect(ehIdDeCatalogo(P1)).toBe(true);
    expect(ehIdDeCatalogo("comanda-taxa-c-12")).toBe(false);
    expect(ehIdDeCatalogo("orcamento-x-0")).toBe(false);
    expect(ehIdDeCatalogo(null)).toBe(false);
  });
});

describe("itensParaAComanda", () => {
  it("separa produto e variação da chave do carrinho e leva nome, preço e quantidade", () => {
    expect(itensParaAComanda([
      { productId: P1, name: "Copão Gin", price: 25, qty: 2, unit: "un" },
      { productId: P2 + "__" + V1, name: "Cerveja (600 ml)", price: 12, qty: 1 },
    ])).toEqual([
      { product_id: P1, variant_id: null, name: "Copão Gin", unit: "un", quantity: 2, unit_price: 25 },
      { product_id: P2, variant_id: V1, name: "Cerveja (600 ml)", unit: null, quantity: 1, unit_price: 12 },
    ]);
  });
  it("com o preço no cartão ligado, vai o preço do dinheiro (o pagamento se decide no fechamento)", () => {
    expect(itensParaAComanda([{ productId: P1, name: "Gin", price: 27.5, cashPrice: 25, qty: 1 }])[0].unit_price).toBe(25);
  });
  it("item sem cadastro vai sem product_id; quantidade zero não vai", () => {
    expect(itensParaAComanda([
      { productId: "avulso-1", name: "Gelo", price: 5, qty: 1 },
      { productId: P1, name: "Zerado", price: 5, qty: 0 },
    ])).toEqual([{ product_id: null, variant_id: null, name: "Gelo", unit: null, quantity: 1, unit_price: 5 }]);
  });
});

describe("taxaDeServico", () => {
  it("10% do consumo, arredondado em centavos", () => {
    expect(taxaDeServico(111.5, 10)).toBe(11.15);
    expect(taxaDeServico(33.33, 10)).toBe(3.33);
    expect(taxaDeServico(100, 0)).toBe(0);
  });
});

describe("linhasParaOCarrinho", () => {
  it("soma o mesmo produto lançado duas vezes e mantém a chave que a venda entende", () => {
    const linhas = linhasParaOCarrinho(COMANDA);
    expect(linhas).toEqual([
      { key: P1, name: "Copão Gin", price: 25, qty: 3, unit: "un" },
      { key: P2 + "__" + V1, name: "Cerveja (600 ml)", price: 12, qty: 2 },
      { key: "comanda-c-12-i4", name: "Gelo avulso", price: 12.5, qty: 1 },
    ]);
    // a conta do carrinho fecha com o subtotal da comanda
    expect(linhas.reduce((s, l) => s + l.price * l.qty, 0)).toBe(111.5);
  });

  it("com a taxa: uma linha a mais, sem produto, com o valor dos 10%", () => {
    const linhas = linhasParaOCarrinho(COMANDA, 10);
    expect(linhas[linhas.length - 1]).toEqual({ key: chaveDaTaxa("c-12"), name: "Taxa de serviço (10%)", price: 11.15, qty: 1 });
    expect(ehIdDeCatalogo(linhas[linhas.length - 1].key)).toBe(false);
  });

  it("mesmo produto com preço diferente fica em linha própria (não cobra tudo pelo último preço)", () => {
    const c: Comanda = { ...COMANDA, subtotal: 45, items: [
      { id: "a", product_id: P1, variant_id: null, name: "Copão Gin", unit: null, quantity: 1, unit_price: 25, total: 25 },
      { id: "b", product_id: P1, variant_id: null, name: "Copão Gin", unit: null, quantity: 1, unit_price: 20, total: 20 },
    ] };
    const linhas = linhasParaOCarrinho(c);
    expect(linhas.map((l) => [l.price, l.qty])).toEqual([[25, 1], [20, 1]]);
    expect(linhas[0].key).toBe(P1);
    expect(linhas[1].key).not.toBe(P1);
    expect(linhas[1].key).not.toContain("__");
  });
});

describe("htmlDoConsumo", () => {
  it("lista o consumo, a taxa e o total, e escapa o nome", () => {
    const c: Comanda = { ...COMANDA, items: [{ ...COMANDA.items[0], name: "Copão <b>Gin</b>" }], subtotal: 25 };
    const html = htmlDoConsumo({ comanda: c, loja: "Adega do Luis", taxaPct: 10, agora: new Date("2026-10-10T02:30:00Z") });
    expect(html).toContain("COMANDA 12");
    expect(html).toContain("Adega do Luis");
    expect(html).toContain("09/10/2026");
    expect(html).toContain("Copão &lt;b&gt;Gin&lt;/b&gt;");
    expect(html).toContain("Taxa de serviço (10%)");
    expect(html).toContain("R$ 27,50");
    expect(html).toContain("Não é documento fiscal");
  });
  it("sem taxa não imprime a linha da taxa", () => {
    const html = htmlDoConsumo({ comanda: COMANDA, loja: "Adega", taxaPct: 0 });
    expect(html).not.toContain("Taxa de serviço");
    expect(html).toContain("R$ 111,50");
  });
});
