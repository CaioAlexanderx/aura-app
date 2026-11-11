// p-108 (entrega C): regras sem React da tela de resultado da conferência.
import {
  podeEditarEstoque, desfazerAte, podeDesfazerAgora, montarTransferencia, rotuloDoMovimentoDeEstoque,
  rotuloDoEscopo, comSinal, somaDasPecas,
} from "@/utils/conferenciaResultado";
import type { ItemDiferenca } from "@/services/conferenciaEstoqueResultadoApi";

function item(p: Partial<ItemDiferenca>): ItemDiferenca {
  return {
    item_id: "i", product_id: "p1", variant_id: null, nome: "Produto", variante: null, codigo: null,
    contado: 0, estoque_no_bipe: 0, estoque_atual: 0, diferenca: 0, estoque_depois: null, custo: null, valor: null, grupo: "batem", ...p,
  };
}

describe("quem edita o estoque", () => {
  it("dono, admin e permissions null editam; consulta nunca; funcionário só com estoque", () => {
    expect(podeEditarEstoque(undefined)).toBe(true);
    expect(podeEditarEstoque({ is_owner: true })).toBe(true);
    expect(podeEditarEstoque({ role: "admin", permissions: { estoque: false } })).toBe(true);
    expect(podeEditarEstoque({ role: "member", permissions: null })).toBe(true);
    expect(podeEditarEstoque({ role: "member", permissions: { estoque: true } })).toBe(true);
    expect(podeEditarEstoque({ role: "member", permissions: { estoque: true, estoque_consulta: true } })).toBe(false);
    expect(podeEditarEstoque({ role: "member", permissions: { pdv: true } })).toBe(false);
  });
});

describe("prazo do desfazer", () => {
  it("usa pode_desfazer_ate; sem ele, aplicada + 7 dias", () => {
    expect(desfazerAte({ pode_desfazer_ate: "2026-11-18T15:00:00.000Z", aplicada_em: null })!.toISOString()).toBe("2026-11-18T15:00:00.000Z");
    expect(desfazerAte({ pode_desfazer_ate: null, aplicada_em: "2026-11-11T10:00:00.000Z" })!.toISOString()).toBe("2026-11-18T10:00:00.000Z");
    expect(desfazerAte({ pode_desfazer_ate: null, aplicada_em: null })).toBeNull();
  });
  it("só aplicada e dentro do prazo", () => {
    const c = { status: "aplicada" as const, pode_desfazer_ate: "2026-11-18T10:00:00.000Z", aplicada_em: null };
    expect(podeDesfazerAgora(c, new Date("2026-11-17T10:00:00.000Z"))).toBe(true);
    expect(podeDesfazerAgora(c, new Date("2026-11-18T10:00:01.000Z"))).toBe(false);
    expect(podeDesfazerAgora({ ...c, status: "desfeita" }, new Date("2026-11-12T10:00:00.000Z"))).toBe(false);
  });
  it("pode_desfazer do servidor vale mais que o relógio do aparelho", () => {
    const c = { status: "aplicada" as const, pode_desfazer_ate: "2026-11-18T10:00:00.000Z", aplicada_em: null };
    expect(podeDesfazerAgora({ ...c, pode_desfazer: false }, new Date("2026-11-12T10:00:00.000Z"))).toBe(false);
    expect(podeDesfazerAgora({ ...c, pode_desfazer: true }, new Date("2026-11-30T10:00:00.000Z"))).toBe(true);
    expect(podeDesfazerAgora({ ...c, status: "desfeita", pode_desfazer: true })).toBe(false);
  });
});

describe("itens escolhidos → TransferirModal", () => {
  it("variantes do mesmo produto viram um produto com grade; sobra já preenchida", () => {
    const r = montarTransferencia([
      item({ product_id: "p1", variant_id: "v1", nome: "Camiseta", diferenca: 2, estoque_atual: 6, grupo: "sobram" }),
      item({ product_id: "p1", variant_id: "v2", nome: "Camiseta", diferenca: -1, estoque_atual: 3, grupo: "faltam" }),
      item({ product_id: "p2", variant_id: null, nome: "Cinto", codigo: "CIN", diferenca: 1.5, estoque_atual: 4, grupo: "sobram", unidade: "m" }),
    ]);
    expect(r.produtos).toEqual([
      { id: "p1", name: "Camiseta", stock: 9, unit: "un", has_variants: true, sku: null },
      { id: "p2", name: "Cinto", stock: 4, unit: "m", has_variants: false, sku: "CIN" },
    ]);
    expect(r.quantidades).toEqual({ "v:p1:v1": "2", "p:p2": "1,5" });
  });
});

describe("rótulo no histórico do produto", () => {
  it("Conferência nº N e Conferência nº N desfeita; outros tipos ficam como estão", () => {
    expect(rotuloDoMovimentoDeEstoque({ reference_type: "stock_count", notes: "Conferência nº 12 · Inventário do mês" })).toBe("Conferência nº 12");
    expect(rotuloDoMovimentoDeEstoque({ reference_type: "stock_count_undo", notes: "Desfeito: conferência nº 12" })).toBe("Conferência nº 12 desfeita");
    expect(rotuloDoMovimentoDeEstoque({ reference_type: "stock_count", stock_count_numero: 4, notes: null })).toBe("Conferência nº 4");
    expect(rotuloDoMovimentoDeEstoque({ reference_type: "stock_count", notes: null })).toBe("Conferência");
    expect(rotuloDoMovimentoDeEstoque({ reference_type: "sale", notes: "Venda nº 3" })).toBeNull();
  });
});

describe("textos", () => {
  it("escopo, sinal e peças", () => {
    expect(rotuloDoEscopo({ tipo: "loja_toda" })).toBe("A loja toda");
    expect(rotuloDoEscopo({ tipo: "com_estoque" })).toBe("Só o que tem estoque");
    expect(rotuloDoEscopo({ tipo: "categoria", category_ids: ["a"], category_names: ["Camisetas"] })).toBe("Camisetas");
    expect(rotuloDoEscopo({ tipo: "categoria", category_ids: ["a", "b"] })).toBe("2 categorias");
    expect(comSinal(2)).toBe("+2");
    expect(comSinal(-3)).toBe("−3");
    expect(comSinal(0)).toBe("0");
    expect(somaDasPecas([item({ diferenca: -2 }), item({ diferenca: -1 })])).toBe(3);
  });
});
