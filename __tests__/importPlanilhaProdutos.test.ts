// ============================================================
// AURA. — Import de planilha do Estoque (Excel/CSV)
//
// O que estes testes provam:
//   1. Planilha real da primeira cliente de material de construção:
//      3 linhas de título antes do cabeçalho ("ATUALIZADO EM: …",
//      "TABELA DE PREÇO", linha vazia) — o cabeçalho está na 4ª linha,
//      não na 1ª. detectHeaderRowIndex acha a linha certa e
//      rowsFromMatrix não inventa colunas a partir do título.
//   2. Número vindo do xlsx (raw:true, tipo JS number) vira string
//      ("7.44"), não "7,44" formatado errado nem "[object Object]".
//   3. CSV comum (cabeçalho já na linha 1) continua funcionando —
//      mesmo código de detecção, comportamento de sempre preservado.
//   4. Linhas totalmente vazias no meio da planilha são ignoradas, e
//      uma linha sem valor na coluna NOME também não vira produto.
//   5. Os campos novos e opcionais do backend (unidades_desconhecidas,
//      duplicates, suggested_map) só aparecem no resumo quando vêm —
//      nada quebra na ausência deles.
// ============================================================
import {
  buildImportExtras,
  csvTextToMatrix,
  describeSuggestedMap,
  detectHeaderRowIndex,
  escolherAba,
  isLikelyHeaderRow,
  rowsFromMatrix,
  type AbaPlanilha,
} from "@/utils/importPlanilha";

describe("detectHeaderRowIndex", () => {
  it("acha o cabeçalho na 4ª linha quando há 3 linhas de título acima (planilha da Matcon)", () => {
    const matrix = [
      ["ATUALIZADO EM: 20/09/2026"],
      ["TABELA DE PREÇO"],
      [],
      ["ITEM", "NOME", "UNID.", "MARCA", "CUSTO", "VALOR DIN", "VALOR CART", "ESTOQUE", "TOTAL VEND/EST", "TOTAL C/E"],
      ["1", "Cimento CP II 50kg", "SC", "Votoran", 25.5, 27.9, 29.9, 120, "3348", "3600"],
    ];
    expect(detectHeaderRowIndex(matrix)).toBe(3);
  });

  it("cai na linha 0 quando nenhuma das 10 primeiras linhas parece cabeçalho de produto (planilha sem coluna de nome)", () => {
    const matrix = [
      ["tipo", "valor", "data", "forma_pagamento"],
      ["saida", "150,00", "01/09/2026", "pix"],
    ];
    expect(detectHeaderRowIndex(matrix)).toBe(0);
  });

  it("mantém o comportamento de hoje: CSV comum com cabeçalho já na linha 1", () => {
    const matrix = [
      ["nome", "preco", "estoque"],
      ["Parafuso 6mm", "0,80", "500"],
    ];
    expect(detectHeaderRowIndex(matrix)).toBe(0);
  });

  it("uma linha de título sozinha (1 célula) não passa no critério de 3 células de texto", () => {
    expect(isLikelyHeaderRow(["TABELA DE PREÇO"])).toBe(false);
  });

  it("uma linha vazia não passa no critério", () => {
    expect(isLikelyHeaderRow([])).toBe(false);
    expect(isLikelyHeaderRow(["", "", ""])).toBe(false);
  });
});

describe("rowsFromMatrix — planilha xlsx (Matcon)", () => {
  const matrix = [
    ["ATUALIZADO EM: 20/09/2026"],
    ["TABELA DE PREÇO"],
    [],
    ["ITEM", "NOME", "UNID.", "MARCA", "CUSTO", "VALOR DIN", "VALOR CART", "ESTOQUE", "TOTAL VEND/EST", "TOTAL C/E"],
    ["1", "Cimento CP II 50kg", "SC", "Votoran", 25.5, 27.9, 29.9, 120, "3348", "3600"],
    [],
    ["2", "", "SC", "Nacional", 20, 22, 24, 30, "", ""],
    ["3", "Areia média m³", "M3", "", 80, 95.9, 99.9, 10, "959", "999"],
  ];

  it("ignora as 3 linhas de título e usa a linha do cabeçalho de verdade", () => {
    const rows = rowsFromMatrix(matrix);
    expect(rows).toHaveLength(2);
  });

  it("converte número do xlsx (raw:true) em string, no formato que o parseBRL do backend entende", () => {
    const rows = rowsFromMatrix(matrix);
    const cimento = rows.find(r => r["NOME"] === "Cimento CP II 50kg")!;
    expect(cimento["CUSTO"]).toBe("25.5");
    expect(cimento["VALOR DIN"]).toBe("27.9");
    expect(cimento["VALOR CART"]).toBe("29.9");
    expect(cimento["ESTOQUE"]).toBe("120");
  });

  it("ignora a linha totalmente vazia e a linha sem valor na coluna NOME", () => {
    const rows = rowsFromMatrix(matrix);
    expect(rows.some(r => r["ITEM"] === "2")).toBe(false); // NOME vazio
    expect(rows.map(r => r["ITEM"])).toEqual(["1", "3"]);
  });

  it("mantém colunas sem uso de UNID./MARCA quando vazias, mas não derruba a linha", () => {
    const rows = rowsFromMatrix(matrix);
    const areia = rows.find(r => r["NOME"] === "Areia média m³")!;
    expect(areia["MARCA"]).toBe("");
    expect(areia["CUSTO"]).toBe("80");
  });
});

describe("rowsFromMatrix — CSV comum", () => {
  it("processa csv com cabeçalho na linha 1 e ignora linha vazia no meio", () => {
    const matrix = csvTextToMatrix("nome,preco,estoque\nParafuso 6mm,0.80,500\n\nArruela,0.20,1000\n");
    const rows = rowsFromMatrix(matrix);
    expect(rows).toEqual([
      { nome: "Parafuso 6mm", preco: "0.80", estoque: "500" },
      { nome: "Arruela", preco: "0.20", estoque: "1000" },
    ]);
  });

  it("detecta separador ; quando a linha de cabeçalho usa ponto e vírgula", () => {
    const matrix = csvTextToMatrix("nome;preco;estoque\nCabo 2,5mm;12,90;40\n");
    const rows = rowsFromMatrix(matrix);
    expect(rows).toEqual([{ nome: "Cabo 2,5mm", preco: "12,90", estoque: "40" }]);
  });
});

describe("escolherAba — planilha com abas de gráfico antes dos dados", () => {
  // Planilha real de uma cliente: 3 abas, nesta ordem — "Gráf1" (ref
  // A1:H1, 1 linha [1,1,1,1,1,1,1,1]), "Gráf2" (só números, sem
  // cabeçalho nenhum) e "relatório geral de custo " (nome com espaço
  // no fim, como veio da cliente) com os dados de verdade: 3 linhas de
  // título + cabeçalho no índice 3. Ler sempre SheetNames[0] pegava
  // "Gráf1" e não importava nada.
  const grafico1: AbaPlanilha = { nome: "Gráf1", matriz: [[1, 1, 1, 1, 1, 1, 1, 1]] };
  const grafico2: AbaPlanilha = {
    nome: "Gráf2",
    matriz: Array.from({ length: 50 }, (_, i) => [i, i * 2, i * 3]),
  };
  const dados: AbaPlanilha = {
    nome: "relatório geral de custo ",
    matriz: [
      ["ATUALIZADO EM: 20/09/2026"],
      ["TABELA DE PREÇO"],
      [],
      ["ITEM", "NOME", "UNID.", "MARCA", "CUSTO", "VALOR DIN", "VALOR CART", "ESTOQUE", "TOTAL VEND/EST", "TOTAL C/E"],
      ["1", "ABRAC TIPO D C/CUNHA 1/2''", "UN", "", 2, 3.5, 3.9, 100, "350", "390"],
    ],
  };

  it("pula as abas de gráfico e escolhe a aba com o cabeçalho de verdade", () => {
    const escolhida = escolherAba([grafico1, grafico2, dados]);
    expect(escolhida?.nome).toBe("relatório geral de custo ");
  });

  it("a ordem das abas não importa — acha a mesma independente de onde ela está na lista", () => {
    const escolhida = escolherAba([grafico2, dados, grafico1]);
    expect(escolhida?.nome).toBe("relatório geral de custo ");
  });

  it("rowsFromMatrix na aba escolhida traz os produtos, não os números do gráfico", () => {
    const escolhida = escolherAba([grafico1, grafico2, dados])!;
    const rows = rowsFromMatrix(escolhida.matriz);
    expect(rows).toHaveLength(1);
    expect(rows[0]["NOME"]).toBe("ABRAC TIPO D C/CUNHA 1/2''");
  });

  it("sem nenhuma aba com cabeçalho detectável, cai pra aba com mais linhas não vazias (não a de gráfico com 1 linha)", () => {
    const semCabecalho1: AbaPlanilha = { nome: "A", matriz: [["x"]] };
    const semCabecalho2: AbaPlanilha = { nome: "B", matriz: [["1", "2"], ["3", "4"], ["5", "6"]] };
    const escolhida = escolherAba([semCabecalho1, semCabecalho2]);
    expect(escolhida?.nome).toBe("B");
  });

  it("lista vazia devolve null", () => {
    expect(escolherAba([])).toBeNull();
  });
});

describe("buildImportExtras — campos opcionais do backend", () => {
  it("não mostra nada quando o backend ainda não manda os campos novos", () => {
    expect(buildImportExtras({ saved: 5, duplicates_skipped: 1 })).toEqual([]);
  });

  it("mostra unidades desconhecidas quando vêm", () => {
    const extras = buildImportExtras({ unidades_desconhecidas: ["SC", "FD"] });
    expect(extras).toContain("Unidades que não reconhecemos: SC, FD");
  });

  it("mostra quantas linhas repetidas não vão entrar, já existentes na loja", () => {
    const extras = buildImportExtras({ duplicates: [{ nome: "Cimento" }, { nome: "Areia" }] });
    expect(extras).toContain("2 produtos já existem na sua loja e não vão entrar");
  });

  it("mostra 1 produto no singular", () => {
    const extras = buildImportExtras({ duplicates: [{ nome: "Cimento" }] });
    expect(extras).toContain("1 produto já existe na sua loja e não vai entrar");
  });

  it("traduz o suggested_map em português de lojista, separando reconhecidas de não usadas", () => {
    const { recognized, ignored } = describeSuggestedMap({
      NOME: "nome",
      "VALOR DIN": "preco_dinheiro",
      "VALOR CART": "preco_cartao",
      MARCA: "marca",
      "TOTAL C/E": null,
    });
    expect(recognized).toEqual([
      "NOME → nome do produto",
      "VALOR DIN → preço no dinheiro",
      "VALOR CART → preço no cartão",
      "MARCA → marca",
    ]);
    expect(ignored).toEqual(["TOTAL C/E"]);
  });
});
