// Crediário no Financeiro.
//
// Há clientes que vendem quase exclusivamente no crediário — para eles, essa é
// A fonte de receita do negócio. Antes destas correções ela aparecia com o
// nome de plano de contas do backend ("Crediario - Recebido", sem acento),
// picada em três fatias, e ficava invisível no filtro por categoria porque a
// lista de categorias era fechada e não a incluía.

import { INCOME_CATS } from "@/components/screens/financeiro/types";

describe("INCOME_CATS — lançamento manual", () => {
  it("oferece Crediário para quem recebe fiado sem venda vinculada", () => {
    // O caso que motivou: recebimento de parcela no balcão, lançado à mão,
    // sem produto associado. Antes só restava "Outros".
    expect(INCOME_CATS).toContain("Crediário");
  });

  it("mantém as categorias que já existiam", () => {
    ["Vendas", "Servicos", "Outros", "Investimentos"].forEach(function (c) {
      expect(INCOME_CATS).toContain(c);
    });
  });

  it("não tem categoria duplicada", () => {
    expect(new Set(INCOME_CATS).size).toBe(INCOME_CATS.length);
  });
});

// A normalização vive dentro do TabReceitas; replicada aqui como contrato.
// Se a regra mudar lá, este teste precisa mudar junto — de propósito.
function prettyIncomeCategory(raw: string): string {
  var c = (raw || "").trim();
  if (/^crediario/i.test(c)) {
    if (/encargo|juro|multa/i.test(c)) return "Crediário (juros e multa)";
    return "Crediário";
  }
  return c || "Outros";
}

describe("rótulo de categoria em 'De onde vem seu dinheiro'", () => {
  it("traduz as categorias que o backend grava", () => {
    // Strings reais, tiradas de src/routes/ do aura-backend.
    expect(prettyIncomeCategory("Crediario - Recebido")).toBe("Crediário");
    expect(prettyIncomeCategory("Crediario - A Receber")).toBe("Crediário");
    expect(prettyIncomeCategory("Crediario")).toBe("Crediário");
  });

  it("soma as fatias de crediário num rótulo só", () => {
    var vindas = ["Crediario - Recebido", "Crediario - A Receber", "Crediario"];
    var rotulos = new Set(vindas.map(prettyIncomeCategory));
    expect(rotulos.size).toBe(1);
  });

  it("separa juros e multa da venda — é receita de outra natureza", () => {
    expect(prettyIncomeCategory("Crediario - Encargos")).toBe("Crediário (juros e multa)");
    expect(prettyIncomeCategory("Crediario - Encargos por atraso")).toBe("Crediário (juros e multa)");
  });

  it("não mexe nas outras categorias", () => {
    expect(prettyIncomeCategory("Vendas")).toBe("Vendas");
    expect(prettyIncomeCategory("Servicos")).toBe("Servicos");
  });

  it("cai em Outros quando vem vazio", () => {
    expect(prettyIncomeCategory("")).toBe("Outros");
    expect(prettyIncomeCategory("   ")).toBe("Outros");
  });
});

// Mesma lógica do presentCats do TabLancamentos.
function presentCats(categorias: string[], ordem: string[]): string[] {
  var set = new Set(categorias);
  var conhecidas = ordem.filter(function (c) { return set.has(c); });
  var resto = Array.from(set)
    .filter(function (c) { return ordem.indexOf(c) === -1; })
    .sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
  return conhecidas.concat(resto);
}

describe("filtro por categoria em Lançamentos", () => {
  var ORDEM = ["Vendas", "Servicos", "Crediário", "Fornecedores", "Outros"];

  it("não esconde categoria que o app não conhece", () => {
    // O bug: a lista era fechada, então 'Crediario - Recebido' — gravada pelo
    // backend — nunca virava chip, e o filtro não alcançava o faturamento de
    // quem vende no crediário.
    var chips = presentCats(["Vendas", "Crediario - Recebido", "Crediario - Encargos"], ORDEM);
    expect(chips).toContain("Crediario - Recebido");
    expect(chips).toContain("Crediario - Encargos");
  });

  it("põe as conhecidas primeiro, na ordem definida", () => {
    var chips = presentCats(["Outros", "Vendas", "Servicos"], ORDEM);
    expect(chips).toEqual(["Vendas", "Servicos", "Outros"]);
  });

  it("ordena alfabeticamente as desconhecidas, depois das conhecidas", () => {
    var chips = presentCats(["Zebra", "Vendas", "Abacaxi"], ORDEM);
    expect(chips).toEqual(["Vendas", "Abacaxi", "Zebra"]);
  });

  it("só oferece categoria que existe nos dados", () => {
    var chips = presentCats(["Vendas"], ORDEM);
    expect(chips).toEqual(["Vendas"]);
  });
});
