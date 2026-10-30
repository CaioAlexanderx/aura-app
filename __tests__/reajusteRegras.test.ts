// ============================================================
// Reajuste de preço em lote (p-52): contas de exibição e validação.
// A conta do preço novo é do servidor; aqui só o que o app mostra e o
// que a pessoa digitou (limites iguais aos do backend #939).
// ============================================================
import {
  lerNumero, erroDoValor, montarPedido, contarSemCusto, brl, margemTxt, variacaoTxt, exemploTerminacao,
  itensDoFiltro, produtosQueMudam, produtosDeFora, produtosAbaixoDoCusto, margemMediaTxt, nomeDoItem, motivoDeFora,
  usaDirecao, usaCusto, plural,
} from "@/components/screens/estoque/reajuste/reajusteRegras";
import type { ItemReajuste, RespostaReajuste } from "@/services/priceAdjustmentsApi";

function item(extra: Partial<ItemReajuste>): ItemReajuste {
  return {
    product_id: "p1", variant_id: null, name: "Vestido midi floral", variant_label: null, sku: null,
    cost_price: 92, price_before: 189.9, price_after: 208.9, change_abs: 19, change_pct: 0.1001,
    margin_before: 0.5155, margin_after: 0.5596, card_price_mode: "auto", card_price_before: null, card_price_after: null,
    below_cost: false, group_shared: false, owner_company_id: "c1", owner_is_other: false, status: "change", skip_reason: null,
    ...extra,
  };
}

describe("valor digitado", () => {
  it("aceita vírgula e ponto", () => {
    expect(lerNumero("10,5")).toBe(10.5);
    expect(lerNumero("10.5")).toBe(10.5);
    expect(lerNumero(" 1.234,56 ")).toBe(1234.56);
    expect(lerNumero("")).toBeNaN();
    expect(lerNumero("abc")).toBeNaN();
    expect(lerNumero("-3")).toBeNaN();
  });

  it("limites por modo, iguais aos do backend", () => {
    expect(erroDoValor("percent", "up", "")).toBe("Digite um valor.");
    expect(erroDoValor("percent", "up", "0")).toMatch(/maior que zero/);
    expect(erroDoValor("percent", "up", "10")).toBeNull();
    expect(erroDoValor("percent", "up", "1000")).toBeNull();
    expect(erroDoValor("percent", "up", "1001")).toMatch(/1\.000%/);
    expect(erroDoValor("percent", "down", "99,9")).toBeNull();
    expect(erroDoValor("percent", "down", "100")).toMatch(/menos de 100%/);
    expect(erroDoValor("fixed", "down", "100000")).toBeNull();
    expect(erroDoValor("fixed", "up", "100000,01")).toMatch(/100\.000/);
    expect(erroDoValor("markup", "up", "10000")).toBeNull();
    expect(erroDoValor("markup", "up", "10001")).toMatch(/10\.000%/);
    expect(erroDoValor("margin", "up", "99")).toBeNull();
    expect(erroDoValor("margin", "up", "100")).toMatch(/menor que 100%/);
  });

  it("monta o pedido: direção só em percentual e valor fixo", () => {
    expect(montarPedido(["a"], "percent", "down", "10,5", "90")).toEqual({ product_ids: ["a"], mode: "percent", direction: "down", value: 10.5, rounding: "90" });
    expect(montarPedido(["a"], "margin", "down", "40", "none")).toEqual({ product_ids: ["a"], mode: "margin", value: 40, rounding: "none" });
    expect(usaDirecao("fixed")).toBe(true);
    expect(usaDirecao("markup")).toBe(false);
    expect(usaCusto("markup")).toBe(true);
    expect(usaCusto("percent")).toBe(false);
  });

  it("sem custo = vazio ou zero (mesma regra do backend)", () => {
    expect(contarSemCusto([{ cost: 0 }, { cost: null }, { cost: 10 }, {}])).toBe(3);
  });
});

describe("formatos", () => {
  it("reais, margem e variação", () => {
    expect(brl(1234.5)).toBe("R$ 1.234,50");
    expect(brl(53.2)).toBe("R$ 53,20");
    expect(brl(null)).toBe("—");
    expect(margemTxt(0.5155)).toBe("52%");
    expect(margemTxt(null)).toBe("sem custo");
    expect(margemTxt(-0.08)).toBe("-8%");
    expect(variacaoTxt(0.1001)).toBe("+10,0%");
    expect(variacaoTxt(-0.0532)).toBe("-5,3%");
    expect(variacaoTxt(0)).toBe("0,0%");
    expect(variacaoTxt(null)).toBe("—");
    expect(plural(1, "produto", "produtos")).toBe("1 produto");
    expect(plural(1200, "produto", "produtos")).toBe("1.200 produtos");
  });

  it("exemplo da terminação sempre para cima", () => {
    expect(exemploTerminacao("none")).toBeNull();
    expect(exemploTerminacao("90")).toMatch(/R\$ 53,20 vira R\$ 53,90/);
    expect(exemploTerminacao("99")).toMatch(/R\$ 53,99/);
    expect(exemploTerminacao("00")).toMatch(/R\$ 54,00/);
  });
});

describe("prévia", () => {
  var items: ItemReajuste[] = [
    item({ product_id: "p1" }),
    item({ product_id: "p1", variant_id: "v1", variant_label: "P / Azul" }),
    item({ product_id: "p2", status: "skipped", skip_reason: "no_cost", cost_price: null, price_after: null, margin_before: null, margin_after: null }),
    item({ product_id: "p3", below_cost: true, price_after: 80 }),
    item({ product_id: "p4", status: "unchanged" }),
  ];

  it("conta produtos, não linhas (variante conta no produto)", () => {
    expect(produtosQueMudam(items)).toEqual(["p1", "p3"]);
    expect(produtosDeFora(items)).toEqual(["p2"]);
    expect(produtosAbaixoDoCusto(items)).toEqual(["p3"]);
  });

  it("filtros da lista", () => {
    expect(itensDoFiltro(items, "todos")).toHaveLength(5);
    expect(itensDoFiltro(items, "fora").map(i => i.product_id)).toEqual(["p2"]);
    expect(itensDoFiltro(items, "abaixo").map(i => i.product_id)).toEqual(["p3"]);
  });

  it("nome, motivo e margem média", () => {
    expect(nomeDoItem(items[1])).toBe("Vestido midi floral · P / Azul");
    expect(motivoDeFora(items[2])).toBe("fora: sem custo");
    expect(motivoDeFora(item({ status: "skipped", skip_reason: "not_positive" }))).toBe("fora: ficaria sem preço");
    expect(motivoDeFora(items[0])).toBeNull();
    var r = { summary: { margin_avg_before: 0.4812, margin_avg_after: 0.5291 } } as RespostaReajuste;
    expect(margemMediaTxt(r)).toBe("48% → 53%");
    expect(margemMediaTxt({ summary: { margin_avg_before: null, margin_avg_after: null } } as RespostaReajuste)).toBeNull();
  });
});
