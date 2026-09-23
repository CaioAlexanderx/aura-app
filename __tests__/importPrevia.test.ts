// ============================================================
// AURA. — Prévia e relatório da importação de produtos (QA 23/09/2026)
//
// O que estes testes seguram, com a estrutura da planilha real da
// primeira cliente de material de construção:
//   1. 3 linhas de título antes do cabeçalho e uma linha vazia no meio:
//      o `index` do backend vira a linha que o lojista vê no Excel
//      (cabeçalho na 4, primeiro produto na 5, e a linha vazia pula).
//   2. Linha repetida DENTRO da planilha (origem 'lote') não é "já existe
//      na loja" (origem 'banco') — o toast antigo dizia isso para as duas.
//   3. Linha sem preço diz "sem preço de venda" e a linha; preço ilegível
//      diz o valor que veio.
//   4. A amostra só mostra o que entra de fato (o backend manda as 5
//      primeiras válidas, incluindo repetidas).
//   5. O relatório final usa a lista completa da prévia quando o backend
//      corta os erros em 20 na gravação.
//   6. CSV da lista de problemas: linha, nome, motivo, em ordem, com ";".
// ============================================================
import { csvTextToMatrixComLinhas, lerLinhasDaMatriz } from "@/utils/importPlanilha";
import {
  gerarCsvProblemas,
  linhaDoArquivo,
  montarResultadoImport,
  montarResumoImport,
  motivoEmPortugues,
  reais,
  type ContextoLeitura,
  type RespostaImport,
} from "@/utils/importPrevia";

const CABECALHO = ["ITEM", "NOME", "UNID.", "MARCA", "CUSTO", "VALOR DIN", "VALOR CART", "ESTOQUE", "TOTAL VEND/EST", "TOTAL C/E"];

// Linhas do arquivo: 1-3 título, 4 cabeçalho, 5.. produtos, 8 vazia.
const MATRIZ: unknown[][] = [
  ["ATUALIZADO EM: 16/09/2026", "", "", "", "", "", "", "", "", ""],
  ["TABELA DE PREÇO", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", ""],
  CABECALHO,
  [1, "ABRAC TIPO D C/CUNHA 1/2''", "PCT", "DECORLUX", 7.44, 15, 17, 2, 30, 14.88],     // linha 5
  [2, "ABRAC TIPO D C/CUNHA 1/2''", "UN", "DECORLUX", 0.88, 1.5, 1.75, 150, 225, 132],   // linha 6
  [3, "CIMENTO CP II 50KG", "SC", "VOTORAN", 25.5, "", "", 120, "", ""],                  // linha 7 — sem preço
  ["", "", "", "", "", "", "", "", "", ""],                                               // linha 8 — vazia
  [4, "ABRAC TIPO D C/CUNHA 1/2''", "UN", "DECORLUX", 0.88, 1.5, 1.75, 150, 225, 132],   // linha 9 — igual à 6
  [5, "AREIA MEDIA", "M3", "", 80, 95.9, 99.9, 10, "", ""],                               // linha 10 — já existe na loja
  [6, "MANTA ALUMINIZADA 10CM", "RL", "DRYKO", 30, 45, 49.9, 16, "", ""],                 // linha 11
  [7, "TELHA; COLONIAL \"PRIMEIRA\"", "UN", "", 1, "abc", "", 500, "", ""],               // linha 12 — preço ilegível
];

const MAPA = {
  NOME: "name", "UNID.": "unit", MARCA: "brand", CUSTO: "cost_price",
  "VALOR DIN": "price", "VALOR CART": "card_price", ESTOQUE: "stock_qty",
};

function lerPlanilha() {
  const lidas = lerLinhasDaMatriz(MATRIZ);
  const ctx: ContextoLeitura = {
    nomeAba: "relatório geral de custo ",
    abaNaoEaPrimeira: true,
    nomeArquivo: "Relatorio de vendas.xlsx",
    cabecalho: lidas.cabecalho,
    linhas: lidas.linhas,
    linhaCabecalho: lidas.linhaCabecalho,
    rows: lidas.rows,
  };
  return { lidas, ctx };
}

// Resposta do dry_run como o backend (importData.js) monta para essas rows.
function respostaPrevia(rows: Record<string, string>[]): RespostaImport {
  const produto = (i: number, unit: string, brand: string | null, price: number, card: number | null) =>
    ({ name: rows[i]["NOME"], price, card_price: card, unit, brand });
  return {
    total: 7,
    valid: 5,
    error_count: 2,
    errors: [
      { index: 2, error: "Preço de venda inválido ou ausente", row: rows[2] },
      { index: 6, error: "Preço de venda inválido ou ausente", row: rows[6] },
    ],
    suggested_map: MAPA,
    // valid.slice(0, 5): rows 0, 1, 3, 4, 5 (sem as de erro).
    preview: [
      produto(0, "pct", "DECORLUX", 15, 17),
      produto(1, "un", "DECORLUX", 1.5, 1.75),
      produto(3, "un", "DECORLUX", 1.5, 1.75),
      produto(4, "m³", null, 95.9, 99.9),
      produto(5, "rolo", "DRYKO", 45, 49.9),
    ],
    a_importar: 3,
    duplicate_count: 2,
    duplicatas: [
      { index: 3, origem: "lote", criterio: "nome_unidade_marca", duplicata_de: 1, name: rows[3]["NOME"], unit: "un", brand: "DECORLUX", barcode: null },
      { index: 4, origem: "banco", criterio: "nome_unidade_marca", produto_id: "p-9", name: "AREIA MEDIA", unit: "m³", brand: null, barcode: null },
    ],
    unidades_desconhecidas: { total: 0, valores: [] },
  };
}

describe("leitura: linha do arquivo de cada produto", () => {
  it("3 linhas de título + cabeçalho na 4: o primeiro produto é a linha 5, e a linha vazia pula", () => {
    const { lidas } = lerPlanilha();
    expect(lidas.linhaCabecalho).toBe(4);
    expect(lidas.rows).toHaveLength(7);
    expect(lidas.linhas).toEqual([5, 6, 7, 9, 10, 11, 12]);
    expect(lidas.cabecalho).toEqual(CABECALHO);
  });

  it("aba que não começa em A1: a linha soma o início do intervalo", () => {
    const lidas = lerLinhasDaMatriz(MATRIZ, i => 2 + i + 1);
    expect(lidas.linhaCabecalho).toBe(6);
    expect(lidas.linhas[0]).toBe(7);
  });

  it("CSV com linhas vazias: a matriz perde as vazias, mas a linha do arquivo é preservada", () => {
    const { matriz, linhas } = csvTextToMatrixComLinhas("nome;preco\n\nParafuso;0,80\n\n\nArruela;0,20\n");
    expect(matriz).toEqual([["nome", "preco"], ["Parafuso", "0,80"], ["Arruela", "0,20"]]);
    expect(linhas).toEqual([1, 3, 6]);
    const lidas = lerLinhasDaMatriz(matriz, i => linhas[i]);
    expect(lidas.linhas).toEqual([3, 6]);
  });

  it("sem o mapa de linhas, supõe as linhas logo abaixo do cabeçalho", () => {
    expect(linhaDoArquivo(0, [], 4)).toBe(5);
    expect(linhaDoArquivo(10, [5, 6], 4)).toBe(15);
  });
});

describe("montarResumoImport — conferência antes de gravar", () => {
  const { lidas, ctx } = lerPlanilha();
  const resumo = montarResumoImport(respostaPrevia(lidas.rows), ctx);

  it("diz de qual aba lemos (sem o espaço do fim) e quantas linhas", () => {
    expect(resumo.aba).toBe("relatório geral de custo");
    expect(resumo.totalLinhas).toBe(7);
    expect(resumo.linhaCabecalho).toBe(4);
  });

  it("colunas reconhecidas na língua do lojista, e as não usadas", () => {
    const ver = resumo.colunas.map(c => `${c.coluna} → ${c.rotulo}`);
    expect(ver).toEqual([
      "NOME → nome do produto",
      "UNID. → unidade",
      "MARCA → marca",
      "CUSTO → preço de custo",
      "VALOR DIN → preço no dinheiro e PIX",
      "VALOR CART → preço no cartão",
      "ESTOQUE → estoque",
    ]);
    expect(resumo.naoUsadas).toEqual(["ITEM", "TOTAL VEND/EST", "TOTAL C/E"]);
    expect(resumo.faltando).toEqual([]);
  });

  it("quantos entram", () => {
    expect(resumo.aImportar).toBe(3);
  });

  it("repetida na planilha aponta a linha igual — não é 'já existe na loja'", () => {
    expect(resumo.repetidasNaPlanilha).toEqual([
      { linha: 9, nome: "ABRAC TIPO D C/CUNHA 1/2''", motivo: "igual à linha 6 (mesmo nome, unidade e marca)" },
    ]);
    expect(resumo.jaExistem).toEqual([
      { linha: 10, nome: "AREIA MEDIA", motivo: "já existe na sua loja (mesmo nome, unidade e marca)" },
    ]);
  });

  it("linhas com problema: a linha do arquivo e o motivo de balcão", () => {
    expect(resumo.problemas).toEqual([
      { linha: 7, nome: "CIMENTO CP II 50KG", motivo: "sem preço de venda" },
      { linha: 12, nome: "TELHA; COLONIAL \"PRIMEIRA\"", motivo: "preço de venda “abc” não é um valor em reais" },
    ]);
  });

  it("a amostra só traz o que entra (tira a repetida e a que já existe)", () => {
    expect(resumo.amostra.map(a => a.linha)).toEqual([5, 6, 11]);
    expect(resumo.amostra[0]).toEqual({
      linha: 5, nome: "ABRAC TIPO D C/CUNHA 1/2''", preco: "R$ 15,00", precoCartao: "R$ 17,00", unidade: "pacote", marca: "DECORLUX",
    });
    expect(resumo.amostra[2].unidade).toBe("rolo");
  });

  it("guarda o mapa de colunas para a gravação usar o mesmo", () => {
    expect(resumo.mapaColunas).toEqual(MAPA);
  });

  it("avisa quando nenhuma coluna virou preço de venda", () => {
    const semPreco = montarResumoImport({ ...respostaPrevia(lidas.rows), suggested_map: { NOME: "name" } }, ctx);
    expect(semPreco.faltando).toEqual(["o preço de venda"]);
  });

  it("unidades não reconhecidas vêm como estão", () => {
    const r = montarResumoImport({ ...respostaPrevia(lidas.rows), unidades_desconhecidas: { total: 3, valores: ["fd", "gal."] } }, ctx);
    expect(r.unidadesDesconhecidas).toEqual({ total: 3, valores: ["fd", "gal."] });
  });

  it("código de barras repetido tem texto próprio", () => {
    const r = montarResumoImport({
      ...respostaPrevia(lidas.rows),
      duplicatas: [
        { index: 3, origem: "lote", criterio: "codigo_de_barras", duplicata_de: 0, name: "X" },
        { index: 4, origem: "banco", criterio: "codigo_de_barras", produto_id: "p", name: "Y" },
      ],
    }, ctx);
    expect(r.repetidasNaPlanilha[0].motivo).toBe("mesmo código de barras da linha 5");
    expect(r.jaExistem[0].motivo).toBe("já existe na sua loja um produto com esse código de barras");
  });
});

describe("montarResultadoImport — relatório depois de gravar", () => {
  const { lidas, ctx } = lerPlanilha();
  const previa = montarResumoImport(respostaPrevia(lidas.rows), ctx);

  it("quantos entraram, repetidas e problemas, com as mesmas listas", () => {
    const resp: RespostaImport = {
      saved: 3, duplicates_skipped: 2, error_count: 2,
      errors: respostaPrevia(lidas.rows).errors,
      duplicatas: respostaPrevia(lidas.rows).duplicatas,
      unidades_desconhecidas: { total: 0, valores: [] },
    };
    const r = montarResultadoImport(resp, previa, ctx);
    expect(r.gravados).toBe(3);
    expect(r.repetidasNaPlanilha.map(l => l.linha)).toEqual([9]);
    expect(r.jaExistem.map(l => l.linha)).toEqual([10]);
    expect(r.problemas.map(l => l.linha)).toEqual([7, 12]);
    expect(r.precoCartaoIgnorado).toBe(false);
  });

  it("o backend corta os erros em 20 na gravação: com a contagem batendo, usa a lista completa da prévia", () => {
    const muitos = Array.from({ length: 25 }, (_, i) => ({ linha: 100 + i, nome: `P${i}`, motivo: "sem preço de venda" }));
    const previaGrande = { ...previa, problemas: muitos };
    const r = montarResultadoImport({ saved: 1, error_count: 25, errors: [{ index: 0, error: "Preço de venda inválido ou ausente" }] }, previaGrande, ctx);
    expect(r.problemas).toHaveLength(25);
  });
});

describe("gerarCsvProblemas", () => {
  it("linha, produto e motivo, em ordem de linha, com ';' e aspas escapadas", () => {
    const { lidas, ctx } = lerPlanilha();
    const resumo = montarResumoImport(respostaPrevia(lidas.rows), ctx);
    const csv = gerarCsvProblemas(resumo);
    expect(csv.split("\r\n")).toEqual([
      "Linha;Produto;Motivo",
      "7;CIMENTO CP II 50KG;sem preço de venda",
      "9;ABRAC TIPO D C/CUNHA 1/2'';repetida na planilha: igual à linha 6 (mesmo nome, unidade e marca)",
      "10;AREIA MEDIA;já existe na sua loja (mesmo nome, unidade e marca)",
      "12;\"TELHA; COLONIAL \"\"PRIMEIRA\"\"\";preço de venda “abc” não é um valor em reais",
      "",
    ]);
  });
});

describe("textos", () => {
  it("motivo sem nome", () => {
    expect(motivoEmPortugues("Nome do produto obrigatório")).toBe("sem nome do produto");
  });
  it("reais com milhar e vírgula", () => {
    expect(reais(1234.5)).toBe("R$ 1.234,50");
    expect(reais(null)).toBe("—");
  });
});
