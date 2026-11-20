// ============================================================
// "Em quais lojas o lote entra" (20/11/2026, A2 · D14, mockup d).
//
//   1. regras puras: corpo só com 2 ou mais lojas, estoque_em, textos;
//   2. D9 nos pedidos: sem a escolha, batch-create e stock-receipts saem
//      com o corpo de hoje, byte a byte; com ela, `lojas` (e estoque_em);
//      em stock-receipts, `lojas` só na parte que tem produto novo;
//   3. planilha: o card, a pergunta do estoque, o rodapé e o botão
//      "Importar nas 2 lojas"; sem o campo, o modal de hoje; resultado
//      "Em cada loja";
//   4. Chegou: a opção só com produto novo.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/WebPortal", () => ({
  WebPortal: ({ children, active }: any) => (active ? children : null),
}));
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ImportPlanilhaModal } from "@/components/screens/estoque/ImportPlanilhaModal";
import { LojasDoChegou } from "@/components/screens/estoque/LojasDoLote";
import { productsBatchApi } from "@/services/productsBatchApi";
import { montarCorpos, type ItemDaEntrada } from "@/components/screens/estoque/chegou/gravarEntrada";
import {
  campoDeLojas, corpoDasLojasDoLote, rodapeDoLote, textoPorLoja, textoDaLojaNoChegou, porLojaDaResposta,
  primeiroErroDaLoja, toastDaLojaComErro,
} from "@/components/screens/estoque/item-form/lojasDoCadastro";
import type { LojasDoLote } from "@/hooks/useLojasDoLote";
import type { ResumoImport } from "@/utils/importPrevia";

const MATRIZ = { company_id: "matriz", nome: "Matriz", ativa: true };
const FILIAL = { company_id: "filial", nome: "Filial Centro", ativa: false };
const CAMPO = campoDeLojas({ estoque_unico: false, lojas: [MATRIZ, FILIAL] }, "matriz");

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
function porTestID(tree: any, id: string): any {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false })[0];
}

function lojasFake(marcadas: string[], estoqueEm = "matriz", campo = CAMPO): LojasDoLote {
  const escolhidas = campo.lojas.filter((l) => marcadas.indexOf(String(l.company_id)) >= 0);
  return {
    campo, ativaId: "matriz", marcadas, escolhidas, estoqueEm,
    alternar: jest.fn(), escolherEstoque: jest.fn(),
    corpo: (comEstoque: boolean) => corpoDasLojasDoLote(campo, marcadas.filter((m) => m !== "matriz"), "matriz", estoqueEm, comEstoque),
  };
}

beforeEach(() => { mockRequest.mockReset().mockResolvedValue({ created: [], total_created: 0, total_requested: 0, duplicates: 0, errors: [] }); });

// ── 1. regras ─────────────────────────────────────────────────
describe("regras do lote", () => {
  test("corpo só com 2 ou mais lojas; a origem primeiro; estoque_em cai na ativa se não for escolhida", () => {
    expect(corpoDasLojasDoLote(CAMPO, [], "matriz", null, true)).toBeNull();
    expect(corpoDasLojasDoLote(campoDeLojas(null, "matriz"), ["filial"], "matriz", null, true)).toBeNull();
    expect(corpoDasLojasDoLote(CAMPO, ["filial"], "matriz", "filial", true)).toEqual({ lojas: ["matriz", "filial"], estoque_em: "filial" });
    expect(corpoDasLojasDoLote(CAMPO, ["filial"], "matriz", "outra", true)).toEqual({ lojas: ["matriz", "filial"], estoque_em: "matriz" });
    expect(corpoDasLojasDoLote(CAMPO, ["filial"], "matriz", "filial", false)).toEqual({ lojas: ["matriz", "filial"] });
    const unico = campoDeLojas({ estoque_unico: true, lojas: [MATRIZ, FILIAL] }, "matriz");
    expect(corpoDasLojasDoLote(unico, ["filial"], "matriz", null, true)).toBeNull();
  });

  test("textos do mockup", () => {
    expect(rodapeDoLote(48, 2, "Matriz")).toEqual({ antes: "48 produtos em ", forte: "2 lojas", depois: ". Estoque na Matriz." });
    expect(textoDaLojaNoChegou(6, "Filial Centro")).toBe("Cadastrar os 6 produtos novos também na Filial Centro");
    expect(textoPorLoja({ company_id: "f", nome: "F", criados: 46, ja_existiam: 2, erros: [{ message: "x" }] })).toBe("46 criados · 2 já existiam · 1 com erro");
    expect(porLojaDaResposta({})).toEqual([]);
  });

  test("loja com erro no lote: a contagem e o motivo do primeiro erro, como o servidor mandou", () => {
    const p = porLojaDaResposta({ por_loja: [{
      company_id: "filial", nome: "Filial Centro", criados: 46, ja_existiam: 0,
      erros: [{ message: "O código 7891234567895 já está no produto \"Vestido linho bege\" desta loja." }, { message: "outro" }],
    }] })[0];
    expect(primeiroErroDaLoja(p)).toBe("O código 7891234567895 já está no produto \"Vestido linho bege\" desta loja.");
    expect(toastDaLojaComErro(p)).toBe("Filial Centro: 46 criados · 2 com erro" + ". O código 7891234567895 já está no produto \"Vestido linho bege\" desta loja.");
    // Formatos aceitos: texto puro, { erro: { message } } e { error }; sem motivo, só a contagem.
    expect(primeiroErroDaLoja({ ...p, erros: ["Limite do plano"] })).toBe("Limite do plano");
    expect(primeiroErroDaLoja({ ...p, erros: [{ erro: { message: "Sem acesso" } } as any] })).toBe("Sem acesso");
    expect(primeiroErroDaLoja({ ...p, erros: [{ error: "Falhou" }] })).toBe("Falhou");
    expect(toastDaLojaComErro({ ...p, erros: [{}] as any })).toBe("Filial Centro: 46 criados · 1 com erro");
  });

  test("relatório da planilha mostra o motivo do primeiro erro da loja", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(
        <ImportPlanilhaModal
          fase="pronto" resumo={RESUMO} erro={null} nomeArquivo="a.xlsx"
          resultado={{ ...RESUMO, gravados: 46 } as any}
          onImportar={jest.fn()} onFechar={jest.fn()} onBaixarProblemas={jest.fn()}
          porLoja={[{ company_id: "filial", nome: "Filial Centro", criados: 46, ja_existiam: 0, erros: [{ message: "Limite do plano da Filial." }] }]}
        />
      );
    });
    expect(texto(porTestID(tree, "import-por-loja"))).toContain("Filial Centro  ·  46 criados · 1 com erro. Limite do plano da Filial.");
    tree.unmount();
  });
});

// ── 2. corpos dos pedidos ─────────────────────────────────────
describe("D9 — o pedido de hoje sem a escolha", () => {
  const P = [{ name: "Blusa", price: 79.9, stock_qty: 8 }];

  test("batch-create: sem lojas, o corpo é { products }; com lojas, junta lojas e estoque_em", async () => {
    await productsBatchApi.batchCreate("matriz", P as any);
    expect(mockRequest.mock.calls[0][1].body).toEqual({ products: P });
    await productsBatchApi.batchCreate("matriz", P as any, null);
    expect(mockRequest.mock.calls[1][1].body).toEqual({ products: P });
    await productsBatchApi.batchCreate("matriz", P as any, { lojas: ["matriz", "filial"], estoque_em: "matriz" });
    expect(mockRequest.mock.calls[2][1].body).toEqual({ products: P, lojas: ["matriz", "filial"], estoque_em: "matriz" });
  });

  const novo: ItemDaEntrada = { n: 1, descricao: "Blusa", produtoId: null, novo: { name: "Blusa", price: 79.9 }, quantidade: 3, variantes: null, codigoDaVariante: null, custo: null, codigoFornecedor: null };
  const existente: ItemDaEntrada = { ...novo, n: 2, produtoId: "p1", novo: null };
  const cab = { chave: "k", origem: "nota" as const, fornecedorId: null, numeroDaNota: null, chaveDaNota: null, usarMedio: false };

  test("stock-receipts: sem lojas (ou com 1), corpo idêntico; com 2, só na parte com produto novo", () => {
    const hoje = montarCorpos([novo, existente], cab);
    expect(montarCorpos([novo, existente], { ...cab, lojas: null })).toEqual(hoje);
    expect(montarCorpos([novo, existente], { ...cab, lojas: ["matriz"] })).toEqual(hoje);
    expect(Object.keys(hoje[0].corpo)).not.toContain("lojas");
    const com = montarCorpos([novo, existente], { ...cab, lojas: ["matriz", "filial"] });
    expect(com[0].corpo.lojas).toEqual(["matriz", "filial"]);
    const { lojas: _l, ...resto } = com[0].corpo;
    expect(resto).toEqual(hoje[0].corpo);
    // Parte só com produto que já existe: nada de lojas.
    const partes = montarCorpos([existente, novo], { ...cab, lojas: ["matriz", "filial"] }, 1);
    expect(partes[0].corpo.lojas).toBeUndefined();
    expect(partes[1].corpo.lojas).toEqual(["matriz", "filial"]);
  });
});

// ── 3. planilha ───────────────────────────────────────────────
const RESUMO: ResumoImport = {
  aba: null as any, nomeArquivo: "a.xlsx", linhaCabecalho: 1, totalLinhas: 48,
  colunas: [{ coluna: "NOME", campo: "name", rotulo: "nome do produto" }],
  naoUsadas: [], faltando: [], aImportar: 48, amostra: [],
  repetidasNaPlanilha: [], jaExistem: [], problemas: [],
  unidadesDesconhecidas: { total: 0, valores: [] }, mapaColunas: {},
} as any;

function montarPlanilha(extra: any = {}) {
  let tree: any;
  act(() => {
    tree = renderer.create(
      <ImportPlanilhaModal
        fase="conferindo" resumo={RESUMO} resultado={null} erro={null} nomeArquivo="a.xlsx"
        onImportar={jest.fn()} onFechar={jest.fn()} onBaixarProblemas={jest.fn()}
        {...extra}
      />
    );
  });
  return tree;
}

describe("planilha", () => {
  test("sem o campo: o modal de hoje", () => {
    const tree = montarPlanilha({ lojas: lojasFake(["matriz"], "matriz", campoDeLojas(null, "matriz")) });
    expect(porTestID(tree, "lote-lojas")).toBeUndefined();
    expect(texto(porTestID(tree, "import-rodape"))).toBe("Nada foi gravado ainda");
    expect(texto(porTestID(tree, "import-confirmar"))).toContain("Importar 48 produtos");
    tree.unmount();
  });

  test("só a ativa marcada: o card aparece, rodapé e botão de hoje", () => {
    const tree = montarPlanilha({ lojas: lojasFake(["matriz"]) });
    expect(texto(porTestID(tree, "lote-lojas"))).toContain("Em quais lojas estes 48 produtos entram?");
    expect(porTestID(tree, "lote-estoque-em")).toBeUndefined();
    expect(texto(porTestID(tree, "import-confirmar"))).toContain("Importar 48 produtos");
    tree.unmount();
  });

  test("duas lojas: pergunta do estoque, rodapé e 'Importar nas 2 lojas'", () => {
    const tree = montarPlanilha({ lojas: lojasFake(["matriz", "filial"]) });
    const t = texto(porTestID(tree, "lote-estoque-em"));
    expect(t).toContain("O estoque da planilha entra em qual loja?");
    expect(t).toContain("A outra loja recebe os produtos com estoque 0. Depois, use \"Transferir\" para mandar as peças.");
    expect(texto(porTestID(tree, "import-rodape"))).toBe("48 produtos em 2 lojas. Estoque na Matriz.");
    expect(texto(porTestID(tree, "import-confirmar"))).toContain("Importar nas 2 lojas");
    tree.unmount();
  });

  test("estoque único: só o aviso", () => {
    const unico = campoDeLojas({ estoque_unico: true, lojas: [MATRIZ, FILIAL] }, "matriz");
    const tree = montarPlanilha({ lojas: lojasFake(["matriz"], "matriz", unico) });
    expect(texto(porTestID(tree, "lote-lojas-estoque-unico"))).toContain("As suas lojas usam um estoque só. Este produto aparece em todas.");
    expect(texto(porTestID(tree, "import-confirmar"))).toContain("Importar 48 produtos");
    tree.unmount();
  });
});

// ── 4. Chegou ─────────────────────────────────────────────────
describe("Chegou mercadoria", () => {
  test("com produto novo: aviso da entrada e a opção da outra loja, sem estoque", () => {
    let tree: any;
    act(() => { tree = renderer.create(<LojasDoChegou lojas={lojasFake(["matriz"])} nNovos={6} />); });
    const t = texto(porTestID(tree, "chegou-lojas"));
    expect(t).toContain("A entrada é na Matriz, onde a mercadoria chegou. 6 produtos são novos.");
    expect(t).toContain("Cadastrar os 6 produtos novos também na Filial Centro");
    expect(t).toContain("Sem estoque. O custo e o fornecedor ficam na Matriz.");
    tree.unmount();
  });

  test("sem produto novo, ou sem o campo: nada", () => {
    let tree: any;
    act(() => { tree = renderer.create(<LojasDoChegou lojas={lojasFake(["matriz"])} nNovos={0} />); });
    expect(tree.toJSON()).toBeNull();
    act(() => { tree.update(<LojasDoChegou lojas={lojasFake(["matriz"], "matriz", campoDeLojas(null, "matriz"))} nNovos={3} />); });
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });
});
