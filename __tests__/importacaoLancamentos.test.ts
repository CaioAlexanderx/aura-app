// Importar lançamentos (tq-102): motivo por linha, contagem por motivo e o
// aviso gentil quando a planilha parece de crediário.
import {
  pareceCrediario, resumoDosMotivos, textoDaImportacao, motivoEmPortugues,
  TEXTO_PARECE_CREDIARIO, COLUNAS_DO_MODELO, LINHAS_DO_MODELO,
} from "@/utils/importacaoLancamentos";

describe("pareceCrediario", () => {
  it("cabeçalho de carnê sem Tipo", () => {
    expect(pareceCrediario(["cliente", "parcela", "vencimento", "saldo devedor"])).toBe(true);
    expect(pareceCrediario(["Cliente", "Nº Parcela", "Valor"])).toBe(true);
    expect(pareceCrediario(["nome do cliente", "em aberto", "crediário"])).toBe(true);
  });
  it("planilha de lançamentos não é confundida", () => {
    expect(pareceCrediario(["tipo", "valor", "data", "descricao"])).toBe(false);
    expect(pareceCrediario(["cliente", "parcela", "tipo"])).toBe(false);
    expect(pareceCrediario(["data", "descricao", "valor"])).toBe(false);
    expect(pareceCrediario(["cliente", "valor"])).toBe(false); // um sinal só
    expect(pareceCrediario([])).toBe(false);
  });
});

describe("resumoDosMotivos", () => {
  it("uma frase por motivo, do mais comum ao menos comum, com milhar", () => {
    expect(resumoDosMotivos({ data_invalida: 2, tipo_invalido: 3687, erro_ao_salvar: 1 })).toEqual([
      "3.687 linhas sem entrada ou saída (coluna Tipo, com receita ou despesa)",
      "2 linhas com data que não deu para entender",
      "1 linha que não conseguimos salvar",
    ]);
  });
  it("sem motivos ou código desconhecido, nada", () => {
    expect(resumoDosMotivos(undefined)).toEqual([]);
    expect(resumoDosMotivos({})).toEqual([]);
    expect(resumoDosMotivos({ outro: 4 })).toEqual([]);
  });
});

describe("motivoEmPortugues", () => {
  it("traduz as quatro mensagens do backend", () => {
    expect(motivoEmPortugues("Linha 3: tipo invalido '' (use 'income' ou 'expense')", 3)).toBe("Linha 3: falta dizer se é receita ou despesa (coluna Tipo)");
    expect(motivoEmPortugues("Linha 4: valor invalido 'abc'", 4)).toBe("Linha 4: o valor não deu para entender");
    expect(motivoEmPortugues("Linha 5: descricao obrigatoria", 5)).toBe("Linha 5: falta a descrição");
    expect(motivoEmPortugues("Linha 6: data invalida 'x' (use YYYY-MM-DD ou DD/MM/YYYY)", 6)).toContain("a data não deu para entender");
  });
  it("mensagem desconhecida fica como veio", () => {
    expect(motivoEmPortugues("Linha 1: coisa nova", 1)).toBe("Linha 1: coisa nova");
  });
});

describe("textoDaImportacao com cabeçalho", () => {
  const crediario = ["cliente", "parcela", "vencimento", "saldo"];
  const dado = { saved: 0, error_count: 3687, reasons: { tipo_invalido: 3687 }, errors: [{ index: 0, errors: ["Linha 1: tipo invalido ''"] }] };

  it("nada entrou e parece crediário: aviso gentil, sem lista de erros, com convite", () => {
    const t = textoDaImportacao(dado, crediario);
    expect(t.parecePlanilhaDeCrediario).toBe(true);
    expect(t.titulo).toBe("Parece uma planilha de crediário");
    expect(t.resumo).toBe(TEXTO_PARECE_CREDIARIO);
    expect(t.motivos).toEqual([]);
    expect(t.resumoDosMotivos).toEqual([]);
    expect(t.oferecerAjuda).toBe(true);
    expect(t.oferecerModelo).toBe(false);
  });

  it("nada entrou e não parece crediário: motivos contados e o modelo", () => {
    const t = textoDaImportacao(dado, ["nome", "quanto", "quando"]);
    expect(t.parecePlanilhaDeCrediario).toBe(false);
    expect(t.resumoDosMotivos[0]).toContain("3.687 linhas sem entrada ou saída");
    expect(t.motivos).toEqual(["Linha 1: falta dizer se é receita ou despesa (coluna Tipo)"]);
    expect(t.oferecerModelo).toBe(true);
  });

  it("entrou parte: os motivos contam as linhas de fora; cabeçalho de crediário não muda o aviso", () => {
    const t = textoDaImportacao({ saved: 10, error_count: 2, reasons: { valor_invalido: 2 }, errors: [] }, crediario);
    expect(t.parecePlanilhaDeCrediario).toBe(false);
    expect(t.resumoDosMotivos).toEqual(["2 linhas com valor que não deu para entender"]);
    expect(t.oferecerModelo).toBe(false);
  });

  it("tudo certo: sem nada extra", () => {
    const t = textoDaImportacao({ saved: 5, error_count: 0, reasons: {} }, ["tipo", "valor"]);
    expect(t.resumoDosMotivos).toEqual([]);
    expect(t.oferecerAjuda).toBe(false);
    expect(t.oferecerModelo).toBe(false);
  });

  it("a resposta de um backend antigo (sem reasons) segue funcionando", () => {
    const t = textoDaImportacao({ saved: 0, error_count: 2, errors: [] }, []);
    expect(t.resumoDosMotivos).toEqual([]);
    expect(t.oferecerAjuda).toBe(true);
  });
});

describe("planilha de exemplo", () => {
  it("usa só colunas que o importador entende e linhas do tamanho do cabeçalho", () => {
    expect(COLUNAS_DO_MODELO).toEqual(["tipo", "valor", "data", "descricao", "categoria"]);
    LINHAS_DO_MODELO.forEach((l) => expect(l).toHaveLength(COLUNAS_DO_MODELO.length));
  });
});
