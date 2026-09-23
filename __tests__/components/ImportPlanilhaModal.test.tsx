// ============================================================
// Estoque · Importar planilha — conferência, relatório e botão "Importar"
// (QA 23/09/2026).
//
//   1. Conferência: aba lida, colunas → o que viram, quantos entram,
//      repetidas na planilha x já existentes, linhas com problema com a
//      linha do arquivo, e "Importar N produtos" / "Cancelar". Nada chama
//      a gravação sem o toque em Importar.
//   2. Enquanto lê (planilha grande): carregando, sem botão de importar.
//   3. Gravando: Cancelar e Importar travados.
//   4. Relatório: quantos entraram, fica aberto até Fechar, e oferece
//      "Baixar lista de problemas".
//   5. Lista longa: rolagem própria e "Mostrando 50 de N".
//   6. Barra do Estoque: um botão "Importar" com as duas origens
//      explicadas; toque abre e fecha (sem hover).
//
// Mocks do padrão do repo (expo-font, FpktLogo); testID + deep:false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
// Portal do react-dom não roda no react-test-renderer: aqui ele só passa adiante.
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ children, active }: any) => (active ? children : null),
}));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ImportPlanilhaModal } from "@/components/screens/estoque/ImportPlanilhaModal";
import { ImportarMenu } from "@/components/screens/estoque/ImportarMenu";
import type { ResumoImport, ResultadoImport, LinhaForaDaImportacao } from "@/utils/importPrevia";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function textoDe(tree: renderer.ReactTestRenderer, id: string): string {
  const nos = porTestID(tree, id);
  expect(nos.length).toBeGreaterThan(0);
  return nos.map(n => flattenText(n.children)).join("");
}

const RESUMO: ResumoImport = {
  aba: "relatório geral de custo",
  nomeArquivo: "Relatorio.xlsx",
  linhaCabecalho: 4,
  totalLinhas: 7,
  colunas: [
    { coluna: "NOME", campo: "name", rotulo: "nome do produto" },
    { coluna: "VALOR DIN", campo: "price", rotulo: "preço no dinheiro e PIX" },
    { coluna: "VALOR CART", campo: "card_price", rotulo: "preço no cartão" },
    { coluna: "UNID.", campo: "unit", rotulo: "unidade" },
    { coluna: "MARCA", campo: "brand", rotulo: "marca" },
  ],
  naoUsadas: ["ITEM", "TOTAL VEND/EST", "TOTAL C/E"],
  faltando: [],
  aImportar: 3,
  amostra: [
    { linha: 5, nome: "ABRAC TIPO D C/CUNHA 1/2''", preco: "R$ 15,00", precoCartao: "R$ 17,00", unidade: "pacote", marca: "DECORLUX" },
  ],
  repetidasNaPlanilha: [{ linha: 9, nome: "ABRAC TIPO D C/CUNHA 1/2''", motivo: "igual à linha 6 (mesmo nome, unidade e marca)" }],
  jaExistem: [{ linha: 10, nome: "AREIA MEDIA", motivo: "já existe na sua loja (mesmo nome, unidade e marca)" }],
  problemas: [{ linha: 7, nome: "CIMENTO CP II 50KG", motivo: "sem preço de venda" }],
  unidadesDesconhecidas: { total: 0, valores: [] },
  mapaColunas: { NOME: "name", "VALOR DIN": "price" },
};

function montar(extra: Partial<React.ComponentProps<typeof ImportPlanilhaModal>> = {}) {
  const props = {
    fase: "conferindo" as const,
    resumo: RESUMO,
    resultado: null,
    erro: null,
    nomeArquivo: "Relatorio.xlsx",
    onImportar: jest.fn(),
    onFechar: jest.fn(),
    onBaixarProblemas: jest.fn(),
    ...extra,
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<ImportPlanilhaModal {...props} />); });
  return { tree, props };
}

describe("conferência antes de gravar", () => {
  test("mostra a aba, as colunas, quantos entram e o que fica de fora", () => {
    const { tree, props } = montar();
    expect(textoDe(tree, "import-origem")).toContain("Lemos a aba “relatório geral de custo”");
    expect(textoDe(tree, "import-origem")).toContain("7 linhas de produto");
    const colunas = textoDe(tree, "import-colunas");
    expect(colunas).toContain("VALOR DIN  →  preço no dinheiro e PIX");
    expect(colunas).toContain("VALOR CART  →  preço no cartão");
    expect(textoDe(tree, "import-nao-usadas")).toBe("Não usadas: ITEM, TOTAL VEND/EST, TOTAL C/E");
    expect(textoDe(tree, "import-n-entram")).toBe("3produtos vão entrar");
    expect(textoDe(tree, "import-n-repetidas")).toBe("2repetidas não vão entrar");
    expect(textoDe(tree, "import-n-problemas")).toBe("1linha com problema");
    expect(textoDe(tree, "import-repetidas-planilha")).toContain("1 linha repetida na planilha");
    expect(textoDe(tree, "import-repetidas-planilha")).toContain("Linha 9");
    expect(textoDe(tree, "import-repetidas-planilha")).toContain("igual à linha 6");
    expect(textoDe(tree, "import-ja-existem")).toContain("1 produto já existe na sua loja");
    expect(textoDe(tree, "import-problemas")).toContain("Linha 7");
    expect(textoDe(tree, "import-problemas")).toContain("sem preço de venda");
    expect(textoDe(tree, "import-amostra")).toContain("R$ 17,00");
    expect(textoDe(tree, "import-rodape")).toBe("Nada foi gravado ainda");
    // Nada de jargão na tela.
    const tudo = flattenText(tree.toJSON());
    expect(tudo).not.toMatch(/dry.?run|TSV|\blote\b|EAN/i);
    expect(props.onImportar).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("Importar N produtos grava; Cancelar fecha sem gravar", () => {
    const { tree, props } = montar();
    const confirmar = porTestID(tree, "import-confirmar")[0];
    expect(flattenText(confirmar.children)).toBe("Importar 3 produtos");
    act(() => { porTestID(tree, "import-cancelar")[0].props.onPress(); });
    expect(props.onFechar).toHaveBeenCalledTimes(1);
    expect(props.onImportar).not.toHaveBeenCalled();
    act(() => { confirmar.props.onPress(); });
    expect(props.onImportar).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("sem nada para entrar, o botão não grava", () => {
    const { tree, props } = montar({ resumo: { ...RESUMO, aImportar: 0 } });
    const confirmar = porTestID(tree, "import-confirmar")[0];
    expect(flattenText(confirmar.children)).toBe("Nenhum produto para importar");
    expect(confirmar.props.disabled).toBe(true);
    expect(confirmar.props.onPress).toBeUndefined();
    expect(props.onImportar).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("unidades não reconhecidas e coluna de preço faltando aparecem", () => {
    const { tree } = montar({ resumo: { ...RESUMO, faltando: ["o preço de venda"], unidadesDesconhecidas: { total: 4, valores: ["fd"] } } });
    expect(textoDe(tree, "import-unidades")).toContain("“fd” (4 linhas)");
    expect(textoDe(tree, "import-faltando")).toContain("Não achamos a coluna com o preço de venda");
    tree.unmount();
  });

  test("erro na gravação aparece na conferência para tentar de novo", () => {
    const { tree } = montar({ erro: "Não conseguimos gravar os produtos." });
    expect(textoDe(tree, "import-erro")).toContain("Não conseguimos gravar");
    tree.unmount();
  });
});

describe("lendo e gravando", () => {
  test("lendo a planilha: carregando, sem botão de importar", () => {
    const { tree } = montar({ fase: "lendo", resumo: null });
    expect(porTestID(tree, "import-lendo")).toHaveLength(1);
    expect(textoDe(tree, "import-lendo")).toContain("“Relatorio.xlsx”");
    expect(porTestID(tree, "import-confirmar")).toHaveLength(0);
    expect(porTestID(tree, "import-cancelar")).toHaveLength(1);
    tree.unmount();
  });

  test("gravando: nada de cancelar nem fechar no X", () => {
    const { tree, props } = montar({ fase: "gravando" });
    const cancelar = porTestID(tree, "import-cancelar")[0];
    expect(cancelar.props.disabled).toBe(true);
    expect(cancelar.props.onPress).toBeUndefined();
    expect(porTestID(tree, "import-fechar-x")).toHaveLength(0);
    expect(porTestID(tree, "import-confirmar")[0].props.disabled).toBe(true);
    expect(textoDe(tree, "import-rodape")).toBe("Importando 3 produtos…");
    expect(props.onFechar).not.toHaveBeenCalled();
    tree.unmount();
  });
});

describe("relatório depois de gravar", () => {
  const RESULTADO: ResultadoImport = {
    gravados: 3,
    totalLinhas: 7,
    repetidasNaPlanilha: RESUMO.repetidasNaPlanilha,
    jaExistem: RESUMO.jaExistem,
    problemas: RESUMO.problemas,
    unidadesDesconhecidas: { total: 0, valores: [] },
    precoCartaoIgnorado: false,
  };

  test("quantos entraram, as listas, e baixar a lista de problemas", () => {
    const { tree, props } = montar({ fase: "pronto", resultado: RESULTADO });
    expect(textoDe(tree, "import-n-entraram")).toBe("3produtos entraram");
    expect(textoDe(tree, "import-n-repetidas")).toBe("2repetidas ficaram de fora");
    expect(textoDe(tree, "import-problemas")).toContain("Linha 7");
    expect(porTestID(tree, "import-confirmar")).toHaveLength(0);
    act(() => { porTestID(tree, "import-baixar-problemas")[0].props.onPress(); });
    expect(props.onBaixarProblemas).toHaveBeenCalledTimes(1);
    act(() => { porTestID(tree, "import-fechar")[0].props.onPress(); });
    expect(props.onFechar).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("tudo entrou: sem botão de baixar", () => {
    const { tree } = montar({
      fase: "pronto",
      resultado: { ...RESULTADO, repetidasNaPlanilha: [], jaExistem: [], problemas: [] },
    });
    expect(porTestID(tree, "import-baixar-problemas")).toHaveLength(0);
    expect(porTestID(tree, "import-problemas")).toHaveLength(0);
    tree.unmount();
  });
});

describe("lista longa (planilha de 2.000 linhas)", () => {
  test("rolagem própria, 50 por vez, com a contagem", () => {
    const muitas: LinhaForaDaImportacao[] = Array.from({ length: 312 }, (_, i) => ({ linha: 10 + i, nome: `Produto ${i}`, motivo: "sem preço de venda" }));
    const { tree } = montar({ resumo: { ...RESUMO, problemas: muitas } });
    expect(textoDe(tree, "import-problemas-conta")).toBe("Mostrando 50 de 312");
    expect(textoDe(tree, "import-problemas")).not.toContain("Produto 50");
    act(() => { porTestID(tree, "import-problemas-mais")[0].props.onPress(); });
    expect(textoDe(tree, "import-problemas-conta")).toBe("Mostrando 100 de 312");
    expect(textoDe(tree, "import-problemas")).toContain("Produto 99");
    tree.unmount();
  });
});

describe("barra do Estoque — botão Importar", () => {
  test("um botão, menu com as duas origens explicadas; toque abre, escolhe e fecha", () => {
    const onNota = jest.fn();
    const onPlanilha = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<ImportarMenu onNota={onNota} onPlanilha={onPlanilha} />); });
    expect(textoDe(tree, "importar-botao")).toBe("Importar");
    expect(porTestID(tree, "importar-menu")).toHaveLength(0);

    act(() => { porTestID(tree, "importar-botao")[0].props.onPress(); });
    const nota = textoDe(tree, "importar-opcao-nota");
    expect(nota).toContain("Nota do fornecedor (XML/DANFE)");
    expect(nota).toContain("Cadastra e dá entrada no estoque a partir da nota");
    const planilha = textoDe(tree, "importar-opcao-planilha");
    expect(planilha).toContain("Planilha (Excel ou CSV)");
    expect(planilha).toContain("Cadastra vários produtos de uma vez");

    act(() => { porTestID(tree, "importar-opcao-planilha")[0].props.onPress(); });
    expect(onPlanilha).toHaveBeenCalledTimes(1);
    expect(porTestID(tree, "importar-menu")).toHaveLength(0);

    // Tocar fora fecha sem escolher.
    act(() => { porTestID(tree, "importar-botao")[0].props.onPress(); });
    act(() => { porTestID(tree, "importar-menu-fundo")[0].props.onPress(); });
    expect(porTestID(tree, "importar-menu")).toHaveLength(0);

    act(() => { porTestID(tree, "importar-botao")[0].props.onPress(); });
    act(() => { porTestID(tree, "importar-opcao-nota")[0].props.onPress(); });
    expect(onNota).toHaveBeenCalledTimes(1);
    expect(onPlanilha).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("tela estreita: só o ícone", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<ImportarMenu onNota={jest.fn()} onPlanilha={jest.fn()} compacto />); });
    expect(textoDe(tree, "importar-botao")).toBe("");
    tree.unmount();
  });
});
