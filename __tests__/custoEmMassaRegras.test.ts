// ============================================================
// Preencher custos em massa: regras da tela (utils/custoEmMassa.ts).
// Regra do Caio: o campo de cada linha manda; os atalhos só preenchem
// campo vazio ou já sugerido (salvo "Trocar também o que eu digitei").
// ============================================================
import {
  aplicarMesmoCusto, aplicarSugestao, contas, custoDaLinha, detalheDaLinha, digitar, etiquetaDaLinha, exemploDoAtalho,
  lerPercentual, lerReais, listaDeNomes, mensagemDaConfirmacao, montarPedido, novaLinha, sugerirCusto,
  type LinhaDeCusto,
} from "@/utils/custoEmMassa";
import type { ProdutoSemCusto } from "@/services/custoEmMassaApi";

function produto(id: string, preco: number | null, extra: Partial<ProdutoSemCusto> = {}): ProdutoSemCusto {
  return {
    product_id: id, nome: "Produto " + id, codigo: null, preco: preco, preco_min: null, preco_max: null,
    variantes: 0, compartilhado: false, lojas: 1, ...extra,
  };
}

describe("lerReais", () => {
  test.each([
    ["27,72", 27.72], ["1.234,56", 1234.56], ["27.5", 27.5], ["27.50", 27.5], ["1.234", 1234],
    ["R$ 10", 10], [" 8 ", 8], ["", null], ["abc", null], ["1,2,3", null],
  ])("%s -> %s", (txt, esperado) => {
    expect(lerReais(txt)).toBe(esperado);
  });
});

describe("sugerirCusto (decisão 2: ao centavo, sem ,90/,99)", () => {
  test("markup 100% e margem 50% dão metade do preço", () => {
    expect(sugerirCusto(59.9, "markup", 100)).toBe(29.95);
    expect(sugerirCusto(59.9, "margem", 50)).toBe(29.95);
  });
  test("49,90 com markup 80% = 27,72 (e não 27,90)", () => {
    expect(sugerirCusto(49.9, "markup", 80)).toBe(27.72);
  });
  test("sem preço ou margem de 100% não sugere", () => {
    expect(sugerirCusto(null, "markup", 100)).toBeNull();
    expect(sugerirCusto(0, "markup", 100)).toBeNull();
    expect(sugerirCusto(10, "margem", 100)).toBeNull();
  });
  test("lerPercentual recusa margem de 100% ou mais", () => {
    expect(lerPercentual("100", "markup")).toBe(100);
    expect(lerPercentual("100", "margem")).toBeNull();
    expect(lerPercentual("37,5", "margem")).toBe(37.5);
    expect(lerPercentual("", "markup")).toBeNull();
  });
  test("o exemplo do painel usa R$ 59,90", () => {
    expect(exemploDoAtalho("markup", "100")).toBe("Custo = preço de venda ÷ (1 + 100%). Quem vende a R$ 59,90 fica com custo de R$ 29,95.");
    expect(exemploDoAtalho("margem", "120")).toBe("A margem precisa ser menor que 100%.");
  });
});

describe("atalho: só sugere, nunca pisa no digitado", () => {
  function linhas(): LinhaDeCusto[] {
    return [
      digitar(novaLinha(produto("a", 39.9)), "18,00"),       // digitado
      novaLinha(produto("b", 49.9)),                          // vazio
      { ...novaLinha(produto("c", 59.9)), valor: "10,00", origem: "sugerido" }, // já sugerido
      novaLinha(produto("d", null)),                          // sem preço
      { ...novaLinha(produto("e", 79.9)), marcada: false },   // desmarcado
    ];
  }
  test("preenche vazio e já sugerido das marcadas; digitado, sem preço e desmarcado ficam", () => {
    const r = aplicarSugestao(linhas(), "markup", 100, false);
    expect(r.sugeridas).toBe(2);
    expect(r.semPreco).toBe(1);
    expect(r.linhas.map((l) => [l.valor, l.origem])).toEqual([
      ["18,00", "digitado"], ["24,95", "sugerido"], ["29,95", "sugerido"], ["", null], ["", null],
    ]);
  });
  test("com Trocar também o que eu digitei, o digitado vira sugerido", () => {
    const r = aplicarSugestao(linhas(), "markup", 100, true);
    expect(r.linhas[0]).toMatchObject({ valor: "19,95", origem: "sugerido" });
  });
  test("mesmo custo segue a mesma regra", () => {
    const r = aplicarMesmoCusto(linhas(), 12.5, false);
    expect(r.preenchidas).toBe(3);
    expect(r.mantidas).toBe(1);
    expect(r.linhas.map((l) => l.origem)).toEqual(["digitado", "mesmo", "mesmo", "mesmo", null]);
    expect(r.linhas[3].valor).toBe("12,50");
  });
  test("contas da barra e do painel", () => {
    const c = contas(linhas(), false);
    expect(c).toEqual({ marcadas: 4, alvoDaSugestao: 2, semPreco: 1, digitadas: 1, prontas: 2 });
    expect(contas(linhas(), true).alvoDaSugestao).toBe(3);
  });
  test("depois de sugerir, o campo continua editável e vira digitado", () => {
    const r = aplicarSugestao(linhas(), "markup", 100, false);
    const editada = digitar(r.linhas[1], "22,00");
    expect(editada.origem).toBe("digitado");
    expect(digitar(editada, "").origem).toBeNull();
  });
});

describe("etiquetas da linha (B, C, G2, G3)", () => {
  test("de onde veio o número, com a margem", () => {
    expect(etiquetaDaLinha(digitar(novaLinha(produto("a", 40)), "18")).texto).toBe("digitado por você · margem 55%");
    expect(etiquetaDaLinha({ ...novaLinha(produto("a", 59.9)), valor: "29,95", origem: "sugerido" }).texto).toBe("sugerido · margem 50% · dá para mudar");
    expect(etiquetaDaLinha({ ...novaLinha(produto("a", 59.9)), valor: "29,95", origem: "mesmo" }).texto).toBe("mesmo custo dos marcados · margem 50%");
  });
  test("sem preço pede o custo à mão; maior que o preço avisa, não bloqueia", () => {
    expect(etiquetaDaLinha(novaLinha(produto("a", null)))).toEqual({ texto: "Sem preço, a Aura não tem de onde sugerir. Digite o custo.", tom: "ambar" });
    const caro = digitar(novaLinha(produto("a", 24.9)), "249,00");
    expect(etiquetaDaLinha(caro)).toEqual({ texto: "Maior que o preço de venda. Confira se não sobrou um zero.", tom: "ambar" });
    expect(custoDaLinha(caro)).toBe(249);
  });
  test("número que não é custo e desmarcado", () => {
    expect(etiquetaDaLinha(digitar(novaLinha(produto("a", 10)), "0")).tom).toBe("ambar");
    expect(etiquetaDaLinha({ ...novaLinha(produto("a", 10)), marcada: false }).texto).toBe("desmarcado: fica como está");
  });
  test("detalhe: faixa de preço das variantes e um custo para todas", () => {
    expect(detalheDaLinha(produto("v", 189.9, { preco_min: 189.9, preco_max: 199.9, variantes: 4 })))
      .toBe("Preço varia de R$ 189,90 a R$ 199,90; a conta usa R$ 189,90 · 4 variantes · um custo para todas");
    expect(detalheDaLinha(produto("k", null))).toBe("Sem preço de venda");
  });
});

describe("pedido e confirmação (D)", () => {
  const ls: LinhaDeCusto[] = [
    digitar(novaLinha(produto("a", 39.9, { nome: "Caneca" })), "19,95"),
    { ...novaLinha(produto("b", 49.9, { nome: "Vela" })), valor: "22,00", origem: "sugerido" },
    { ...novaLinha(produto("c", 89.9, { nome: "Bolsa", compartilhado: true, lojas: 3 })), valor: "44,95", origem: "mesmo" },
    digitar(novaLinha(produto("d", 59.9, { nome: "Camiseta" })), "30"),
    { ...digitar(novaLinha(produto("e", 10)), "5"), marcada: false },
    novaLinha(produto("f", 10)),
  ];
  test("só marcadas com custo; atalho vai quando há sugerido", () => {
    const p = montarPedido(ls, { modo: "markup", percentual: 100 }, "k9");
    expect(p.itens).toEqual([
      { product_id: "a", custo: 19.95, origem: "digitado" },
      { product_id: "b", custo: 22, origem: "sugerido" },
      { product_id: "c", custo: 44.95, origem: "mesmo" },
      { product_id: "d", custo: 30, origem: "digitado" },
    ]);
    expect(p.atalho).toEqual({ modo: "markup", percentual: 100 });
    expect(p.count_id).toBe("k9");
    expect(p.dry_run).toBe(false);
    expect(montarPedido([ls[0]], { modo: "markup", percentual: 100 }, null).atalho).toBeNull();
  });
  test("mensagem: quantos, prévia de 3, quantos ficam e o compartilhado", () => {
    expect(mensagemDaConfirmacao(ls, 6)).toBe(
      "Vamos gravar o custo de 4 produtos. Dá para desfazer por 7 dias.\n\n"
      + "Caneca: sem custo → R$ 19,95\nVela: sem custo → R$ 22,00\nBolsa: sem custo → R$ 44,95\ne mais 1\n\n"
      + "2 produtos ficam sem custo, como estão. 1 é compartilhado com o grupo: o custo vale nas 3 lojas.",
    );
  });
  test("lista de nomes do aviso", () => {
    expect(listaDeNomes(["A", "B"])).toBe("A e B");
    expect(listaDeNomes(["A", "B", "C", "D", "E"])).toBe("A, B, C e mais 2");
  });
});
