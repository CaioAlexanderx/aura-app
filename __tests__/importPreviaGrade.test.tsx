// ============================================================
// AURA. — Prévia da importação com grade (b-import-grade, 17/11/2026)
//
// A planilha-modelo da Aura traz uma linha por cor/tamanho, com o mesmo
// nome e SKU. O backend agora grava UM produto com as variações e manda,
// no dry_run, `grade` (modelos, variações, itens) e `avisos_grade`. A
// prévia mostra "N modelos com M variações" antes de gravar.
//
// O que estes testes seguram:
//   1. montarResumoImport traduz grade e avisos (linhas do arquivo, não
//      índice de rows); sem grade, nada muda (grade null).
//   2. A conferência mostra o bloco "1 modelo com 3 variações" e os avisos.
//   3. Limite do plano: aviso e botão Importar travado.
//   4. Relatório final cita os modelos com grade.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ children, active }: any) => (active ? children : null),
}));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ImportPlanilhaModal } from "@/components/screens/estoque/ImportPlanilhaModal";
import {
  montarResultadoImport,
  montarResumoImport,
  textoDasLinhas,
  tituloDaGrade,
  type ContextoLeitura,
  type RespostaImport,
} from "@/utils/importPrevia";

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

// Planilha-modelo: cabeçalho na linha 1, produtos da 2 em diante.
const CAB = ["nome do produto", "preco de venda (r$)", "sku / codigo interno", "tamanho"];
const ROWS = [
  { "nome do produto": "Calça Wide Leg", "preco de venda (r$)": "189,90", "sku / codigo interno": "CWL-01", tamanho: "36" },
  { "nome do produto": "Calça Wide Leg", "preco de venda (r$)": "189,90", "sku / codigo interno": "CWL-01", tamanho: "38" },
  { "nome do produto": "Calça Wide Leg", "preco de venda (r$)": "199,90", "sku / codigo interno": "CWL-01", tamanho: "40" },
  { "nome do produto": "Boné", "preco de venda (r$)": "49,90", "sku / codigo interno": "BON-1", tamanho: "" },
];
const CTX: ContextoLeitura = {
  nomeArquivo: "modelo-importacao-produtos.xlsx",
  cabecalho: CAB,
  linhas: [2, 3, 4, 5],
  linhaCabecalho: 1,
  rows: ROWS,
};
const MAPA = { "nome do produto": "name", "preco de venda (r$)": "price", "sku / codigo interno": "sku", tamanho: "size" };

const PREVIA: RespostaImport = {
  total: 4, valid: 4, error_count: 0, errors: [], suggested_map: MAPA,
  preview: [
    { name: "Calça Wide Leg", price: 189.9, unit: "un" },
    { name: "Calça Wide Leg", price: 189.9, unit: "un" },
    { name: "Calça Wide Leg", price: 199.9, unit: "un" },
    { name: "Boné", price: 49.9, unit: "un" },
  ],
  a_importar: 2, duplicate_count: 0, duplicatas: [],
  unidades_desconhecidas: { total: 0, valores: [] },
  grade: {
    modelos: 1, variacoes: 3, linhas: 3,
    itens: [{ nome: "Calça Wide Leg", sku: "CWL-01", estoque: 6, variacoes: 3, cores: [], tamanhos: ["36", "38", "40"], linhas: [0, 1, 2] }],
  },
  avisos_grade: [{
    tipo: "preco_diferente", modelo: "Calça Wide Leg", sku: "CWL-01", linhas: [0, 1, 2],
    mensagem: "Calça Wide Leg: linhas com preços diferentes. O produto fica com R$ 189,90 e as variações de outro preço ficam com preço próprio.",
  }],
};

describe("montarResumoImport com grade", () => {
  test("resume modelos, variações e avisos com as linhas do arquivo", () => {
    const r = montarResumoImport(PREVIA, CTX);
    expect(r.aImportar).toBe(2);
    expect(r.grade).toEqual({
      modelos: 1,
      variacoes: 3,
      itens: [{ nome: "Calça Wide Leg", variacoes: 3, detalhe: "tamanhos 36, 38, 40 · 6 peças", linhas: "linhas 2 a 4" }],
      avisos: [{ mensagem: PREVIA.avisos_grade![0].mensagem, linhas: "linhas 2 a 4" }],
    });
    expect(r.limitePlano).toBeNull();
  });

  test("sem grade na resposta, grade fica null (planilha simples igual a antes)", () => {
    const { grade, avisos_grade, ...semGrade } = PREVIA;
    void grade; void avisos_grade;
    const r = montarResumoImport({ ...semGrade, a_importar: 4 }, CTX);
    expect(r.grade).toBeNull();
    expect(r.aImportar).toBe(4);
  });

  test("textos", () => {
    expect(tituloDaGrade({ modelos: 1, variacoes: 3 })).toBe("1 modelo com 3 variações");
    expect(tituloDaGrade({ modelos: 12, variacoes: 1 })).toBe("12 modelos com 1 variação");
    expect(textoDasLinhas([0], CTX)).toBe("linha 2");
    expect(textoDasLinhas([0, 2, 3], CTX)).toBe("linhas 2, 4 e 5");
    expect(textoDasLinhas([], CTX)).toBe("");
  });

  test("relatório final guarda a grade gravada", () => {
    const previa = montarResumoImport(PREVIA, CTX);
    const r = montarResultadoImport({ saved: 2, error_count: 0, errors: [], duplicatas: [], grade: { modelos: 1, variacoes: 3 } }, previa, CTX);
    expect(r.gravados).toBe(2);
    expect(r.grade).toEqual({ modelos: 1, variacoes: 3 });
    expect(montarResultadoImport({ saved: 4, error_count: 0, errors: [] }, previa, CTX).grade).toBeNull();
  });
});

function montar(extra: Partial<React.ComponentProps<typeof ImportPlanilhaModal>> = {}) {
  const props = {
    fase: "conferindo" as const,
    resumo: montarResumoImport(PREVIA, CTX),
    resultado: null,
    erro: null,
    nomeArquivo: "modelo-importacao-produtos.xlsx",
    onImportar: jest.fn(),
    onFechar: jest.fn(),
    onBaixarProblemas: jest.fn(),
    ...extra,
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<ImportPlanilhaModal {...props} />); });
  return { tree, props };
}

describe("conferência com grade", () => {
  test('mostra "1 modelo com 3 variações" e o aviso de preço antes de gravar', () => {
    const { tree, props } = montar();
    const grade = textoDe(tree, "import-grade");
    expect(grade).toContain("1 modelo com 3 variações");
    expect(grade).toContain("Calça Wide Leg");
    expect(grade).toContain("tamanhos 36, 38, 40");
    expect(grade).toContain("linhas 2 a 4");
    expect(textoDe(tree, "import-avisos-grade")).toContain("preços diferentes");
    expect(textoDe(tree, "import-n-entram")).toBe("2produtos vão entrar");
    expect(flattenText(porTestID(tree, "import-confirmar")[0].children)).toBe("Importar 2 produtos");
    const tudo = flattenText(tree.toJSON());
    // a coluna da planilha pode se chamar "sku"; o texto da tela, não
    expect(tudo).not.toMatch(/dry.?run|\blote\b|EAN|price_override/i);
    expect(props.onImportar).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("planilha simples não mostra o bloco da grade", () => {
    const { grade, avisos_grade, ...semGrade } = PREVIA;
    void grade; void avisos_grade;
    const { tree } = montar({ resumo: montarResumoImport({ ...semGrade, a_importar: 4 }, CTX) });
    expect(porTestID(tree, "import-grade")).toHaveLength(0);
    expect(porTestID(tree, "import-avisos-grade")).toHaveLength(0);
    tree.unmount();
  });

  test("passa do limite do plano: aviso e Importar travado", () => {
    const resumo = montarResumoImport({ ...PREVIA, limite_plano: { limite: 2000, atual: 1999, a_importar: 2, disponivel: 1 } }, CTX);
    const { tree, props } = montar({ resumo });
    const aviso = textoDe(tree, "import-limite-plano");
    expect(aviso).toContain("O plano permite 2.000 produtos");
    expect(aviso).toContain("cabem 1");
    expect(aviso).not.toMatch(/upgrade|assine|mude de plano/i);
    const confirmar = porTestID(tree, "import-confirmar")[0];
    expect(confirmar.props.disabled).toBe(true);
    expect(confirmar.props.onPress).toBeUndefined();
    expect(props.onImportar).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("relatório final cita os modelos com grade", () => {
    const resumo = montarResumoImport(PREVIA, CTX);
    const resultado = montarResultadoImport({ saved: 2, error_count: 0, errors: [], duplicatas: [], grade: { modelos: 1, variacoes: 3 } }, resumo, CTX);
    const { tree } = montar({ fase: "pronto" as const, resultado });
    expect(textoDe(tree, "import-grade-gravada")).toContain("1 modelo com 3 variações");
    tree.unmount();
  });
});
