// ============================================================
// "Chegou mercadoria" · A6: origem "Planilha" (origemPlanilha).
// ============================================================
import { acharColunas, numeroDaPlanilha, itensDaPlanilha, MODELO_DE_ENTRADA } from "@/components/screens/estoque/chegou/origemPlanilha";
import { csvTextToMatrix } from "@/utils/importPlanilha";

test("acha as colunas pelo cabeçalho; código de barras não vira código", () => {
  expect(acharColunas(["Descrição", "Cód. Barras", "Ref", "Qtde", "Valor unitário"])).toEqual({
    nome: "Descrição", barras: "Cód. Barras", codigo: "Ref", quantidade: "Qtde", custo: "Valor unitário",
  });
  expect(acharColunas(["Produto", "Código"])).toEqual({ nome: "Produto", codigo: "Código" });
});

test("números do Excel e do CSV brasileiro", () => {
  expect(numeroDaPlanilha("1.234,56")).toBe(1234.56);
  expect(numeroDaPlanilha("7.44")).toBe(7.44);
  expect(numeroDaPlanilha("R$ 7,44")).toBe(7.44);
  expect(numeroDaPlanilha("")).toBe(0);
  expect(numeroDaPlanilha("abc")).toBe(0);
});

test("linhas viram itens da conferência", () => {
  const r = itensDaPlanilha([
    ["Nome", "Código", "Quantidade", "Custo"],
    ["Esmalte", "7891234567895", "24", "6,00"],
    ["Acetona", "AL-0391", "12", "3,2"],
    ["", "", "", ""],
    ["Sem quantidade", "Z", "", "1"],
  ]);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.itens).toEqual([
    { n: 1, descricao: "Esmalte", codigoFornecedor: "7891234567895", codigoBarras: "7891234567895", ncm: null, quantidade: 24, custoUnitario: 6, total: 144 },
    { n: 2, descricao: "Acetona", codigoFornecedor: "AL-0391", codigoBarras: null, ncm: null, quantidade: 12, custoUnitario: 3.2, total: 38.4 },
    { n: 3, descricao: "Sem quantidade", codigoFornecedor: "Z", codigoBarras: null, ncm: null, quantidade: 0, custoUnitario: 1, total: 0 },
  ]);
});

test("planilha sem nome nem código, ou vazia: ilegível", () => {
  expect(itensDaPlanilha([["Quantidade", "Custo"], ["1", "2"]])).toEqual({ ok: false, motivo: "ilegivel" });
  expect(itensDaPlanilha([])).toEqual({ ok: false, motivo: "ilegivel" });
});

test("o modelo de entrada se lê de volta", () => {
  const r = itensDaPlanilha(csvTextToMatrix(MODELO_DE_ENTRADA.conteudo));
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.itens[0]).toMatchObject({ descricao: "Esmalte cremoso vermelho 8 ml", codigoFornecedor: "AL-0100", codigoBarras: "7891234567895", quantidade: 24, custoUnitario: 6 });
});
