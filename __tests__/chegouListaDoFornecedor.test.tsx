// ============================================================
// "Chegou mercadoria", Fase 4 (F1, F2):
//   - o wizard aberto com `inicio` (tela de Fornecedores): passo 2 com o
//     fornecedor; Planilha marcada; Novo fornecedor preenchido;
//   - a planilha SEM quantidade (pendência 7): só liga os produtos ao
//     fornecedor com o custo dela, sem mexer no estoque. Regras puras
//     (chegouRegras, origemPlanilha, ligarAoFornecedor) e o fluxo na tela.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ children, visible }: any) => (visible ? children : null) }));
jest.mock("@/hooks/useAtalhosDoCaixa", () => ({ dialogoAbertoNaTela: () => false }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/components/screens/estoque/DanfeImportModal", () => ({ DanfeImportModal: () => null }));
let mockMatriz: unknown[][] = [];
jest.mock("@/hooks/useServerImport", () => ({
  lerArquivoPlanilha: jest.fn(async () => ({ matrix: mockMatriz, linhaDoArquivo: (i: number) => i + 1 })),
}));
const mockDarEntrada = jest.fn();
jest.mock("@/services/estoqueEntradasApi", () => ({
  estoqueEntradasApi: { darEntrada: (...a: any[]) => mockDarEntrada(...a), notaJaLancada: jest.fn(), codigosDoFornecedor: jest.fn() },
}));
let mockQueries: Record<string, any> = {};
const mockInvalidate = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey, enabled }: any) =>
    enabled === false ? { data: undefined, isLoading: false, isError: false } : (mockQueries[queryKey[0]] || { data: undefined, isLoading: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
const mockLinkItems = jest.fn();
jest.mock("@/services/suppliersApi", () => ({
  suppliersApi: { list: jest.fn(), lookupCnpj: jest.fn(), create: jest.fn(), linkItems: (...a: any[]) => mockLinkItems(...a) },
}));
const mockBatchCreate = jest.fn();
jest.mock("@/services/productsBatchApi", () => ({
  productsBatchApi: { batchCreate: (...a: any[]) => mockBatchCreate(...a) },
}));
jest.mock("@/components/screens/estoque/chegou/escolherArquivo", () => ({
  ACEITA_NOTA: ".xml",
  escolherArquivo: jest.fn(async () => ({ name: "lista-alfa.xlsx" })),
  lerTextoDoArquivo: jest.fn(async () => ""),
}));

import { ChegouMercadoriaModal } from "@/components/screens/estoque/chegou/ChegouMercadoriaModal";
import {
  conferirLinha, indexarProdutos, marcarRepetidasDaLista, itensParaLigar, resumirConferencia,
  type ItemParaConferir,
} from "@/components/screens/estoque/chegou/chegouRegras";
import { itensDaPlanilha } from "@/components/screens/estoque/chegou/origemPlanilha";
import { ligarListaAoFornecedor } from "@/components/screens/estoque/chegou/ligarAoFornecedor";
import { PRODUTOS_CONFERENCIA } from "./fixtures/chegouNotas";

const ALFA = {
  id: "f-alfa", company_id: "c1", name: "Distribuidora Alfa", cnpj: "11222333000181", contact_name: "Marcos",
  phone: null, email: null, notes: null, is_active: true, product_count: 38,
};

// Lista do fornecedor sem quantidade: esmalte (código de barras), acetona
// (código do fornecedor), base (nova), esmalte de novo (repetido).
const LISTA = [
  ["Nome", "Código", "Código de barras", "Custo"],
  ["Esmalte vermelho", "AL-0100", "7891234567895", "5,90"],
  ["Acetona 100 ml", "AL-0391", "", "3,20"],
  ["Base fortalecedora 10 ml", "AL-1120", "", "7,40"],
  ["Esmalte cremoso vermelho (cx)", "AL-0101", "7891234567895", "5,50"],
];

function porId(tree: any, id: string): any[] {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}
const tem = (tree: any, id: string) => porId(tree, id).length > 0;
const texto = (tree: any) => JSON.stringify(tree.toJSON());
/** Os textos dentro de um nó (o quadrinho do resumo). */
function textosDe(no: any): string {
  if (typeof no === "string") return no;
  return (no.children || []).map(textosDe).join("|");
}
const tile = (tree: any, id: string) => textosDe(porId(tree, id)[0]);
async function tocar(tree: any, id: string) {
  const no = porId(tree, id)[0];
  if (!no) throw new Error("não achei " + id);
  await act(async () => { no.props.onPress(); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
}
async function digitar(tree: any, id: string, valor: string) {
  const no = porId(tree, id)[0];
  if (!no) throw new Error("não achei " + id);
  await act(async () => { no.props.onChangeText(valor); });
}
async function montar(props: Record<string, unknown> = {}) {
  let tree: any;
  await act(async () => {
    tree = renderer.create(
      <ChegouMercadoriaModal visible companyId="c1" lojaNome="Flor de Maio · Centro" products={PRODUTOS_CONFERENCIA} semCusto={false} onClose={jest.fn()} {...props} />,
    );
  });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return tree;
}

beforeEach(() => {
  mockQueries = {
    suppliers: { data: { suppliers: [ALFA], total: 1 }, isLoading: false, isError: false },
    "supplier-codes": { data: { supplier_id: "f-alfa", items: [], map: { "AL-0391": "p-acetona" } }, isLoading: false },
  };
  mockMatriz = LISTA;
  mockLinkItems.mockReset();
  mockBatchCreate.mockReset();
  mockDarEntrada.mockReset();
  mockInvalidate.mockReset();
  (global as any).innerWidth = 1280;
});

// ── Regras puras ────────────────────────────────────────────────────
describe("regras do modo só ligar", () => {
  const indice = indexarProdutos(PRODUTOS_CONFERENCIA);
  const item = (n: number, extra: Partial<ItemParaConferir>): ItemParaConferir => ({
    n, descricao: "x", codigoFornecedor: null, codigoBarras: null, ncm: null, quantidade: 0, custoUnitario: 0, total: 0, ...extra,
  });

  test("a planilha diz quando não tem a coluna de quantidade", () => {
    const sem = itensDaPlanilha(LISTA);
    const com = itensDaPlanilha([["Nome", "Quantidade", "Custo"], ["Acetona 100 ml", "3", "3,20"]]);
    expect(sem.ok && sem.semQuantidade).toBe(true);
    expect(com.ok && com.semQuantidade).toBe(false);
  });

  test("sem quantidade a linha não é erro; com a regra de sempre, é", () => {
    const it = item(1, { descricao: "Acetona 100 ml", custoUnitario: 3.2 });
    expect(conferirLinha(it, { indice, codigos: null, semCusto: false }).estado).toBe("erro");
    const l = conferirLinha(it, { indice, codigos: null, semCusto: false, soLigar: true });
    expect(l).toMatchObject({ estado: "pronta", entra: true, falta: false, quantidade: 0, previa: null });
    expect(l.produto!.id).toBe("p-acetona");
  });

  test("produto de cores e tamanhos liga sem pedir a grade", () => {
    const comGrade = indexarProdutos([{ ...PRODUTOS_CONFERENCIA[1], has_variants: true }]);
    const l = conferirLinha(item(1, { descricao: "Acetona 100 ml", custoUnitario: 3 }), { indice: comGrade, codigos: null, semCusto: false, soLigar: true });
    expect(l.estado).toBe("pronta");
  });

  test("custo bem acima do de costume pergunta (\"Confere?\"), sem travar", () => {
    const l = conferirLinha(item(1, { descricao: "Acetona 100 ml", custoUnitario: 9 }), { indice, codigos: null, semCusto: false, soLigar: true });
    expect(l).toMatchObject({ estado: "confere", entra: true, falta: false });
  });

  test("o mesmo produto em duas linhas: vale a primeira, a outra fica de fora e diz qual", () => {
    const linhas = [
      item(1, { descricao: "Acetona 100 ml" }),
      item(2, { descricao: "Lixa de unha (pacote com 12)" }),
      item(3, { descricao: "x", codigoFornecedor: "AL-0391" }),
    ].map((i) => conferirLinha(i, { indice, codigos: { "AL-0391": "p-acetona" }, semCusto: false, soLigar: true }));
    const marcadas = marcarRepetidasDaLista(linhas);
    expect(marcadas.map((l) => l.estado)).toEqual(["pronta", "pronta", "erro"]);
    expect(marcadas[2]).toMatchObject({ entra: false, falta: false, repetidaDe: 1 });
    expect(resumirConferencia(marcadas, null)).toMatchObject({ entram: 2, falta: 0, podeDarEntrada: true });
  });

  test("itensParaLigar: custo e código de cada um; novo com preço, custo e código; quem não vê custo não manda custo", () => {
    const linhas = [
      conferirLinha(item(1, { descricao: "Acetona 100 ml", custoUnitario: 3.2, codigoFornecedor: " AL-0391 " }), { indice, codigos: null, semCusto: false, soLigar: true }),
      conferirLinha(item(2, { descricao: "Base", custoUnitario: 7.4, codigoFornecedor: "AL-1120", codigoBarras: "7890000000024" }), {
        indice, codigos: null, semCusto: false, soLigar: true, decisao: { tipo: "novo", nome: "Base fortalecedora", preco: 14.8, categoria: "Unhas" },
      }),
      conferirLinha(item(3, { descricao: "Sem par" }), { indice, codigos: null, semCusto: false, soLigar: true }),
      conferirLinha(item(4, { descricao: "Lixa de unha (pacote com 12)" }), { indice, codigos: null, semCusto: false, soLigar: true }),
    ];
    expect(itensParaLigar(linhas, false)).toEqual({
      existentes: [
        { n: 1, product_id: "p-acetona", cost: 3.2, supplier_code: "AL-0391" },
        { n: 4, product_id: "p-lixa" },
      ],
      novos: [{ n: 2, name: "Base fortalecedora", price: 14.8, cost_price: 7.4, category: "Unhas", barcode: "7890000000024", supplier_code: "AL-1120" }],
    });
    const semCusto = itensParaLigar(linhas, true);
    expect(semCusto.existentes[0]).toEqual({ n: 1, product_id: "p-acetona", supplier_code: "AL-0391" });
    expect(semCusto.novos[0].cost_price).toBeUndefined();
  });
});

describe("ligarListaAoFornecedor", () => {
  const existentes = [{ n: 1, product_id: "p-acetona", cost: 3.2, supplier_code: "AL-0391" }];
  const novos = [{ n: 2, name: "Base", price: 14.8, cost_price: 7.4, supplier_code: "AL-1120" }];

  test("cadastra os novos com estoque 0 e liga todos com o custo e o código de cada um", async () => {
    const criar = jest.fn(async () => ({ created: [{ id: "p-base", name: "Base" }] }));
    const ligar = jest.fn(async () => ({ linked: 2, not_found: [] }));
    const r = await ligarListaAoFornecedor({ existentes, novos }, { criar, ligar });
    expect(criar).toHaveBeenCalledWith([{ name: "Base", price: 14.8, stock_qty: 0, cost_price: 7.4 }]);
    expect(ligar).toHaveBeenCalledWith([
      { product_id: "p-acetona", cost: 3.2, supplier_code: "AL-0391" },
      { product_id: "p-base", cost: 7.4, supplier_code: "AL-1120" },
    ]);
    expect(r).toMatchObject({ ok: true, criados: { 2: "p-base" }, jaTinha: 1, cadastrados: 1, ligados: 2, naoAchados: [] });
  });

  test("ligar falhou: tentar de novo não cadastra em dobro", async () => {
    const criar = jest.fn(async () => ({ created: [{ id: "p-base", name: "Base" }] }));
    const ligar = jest.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ linked: 2, not_found: [] });
    const r1 = await ligarListaAoFornecedor({ existentes, novos }, { criar, ligar });
    expect(r1).toMatchObject({ ok: false, etapa: "ligar", criados: { 2: "p-base" } });
    const r2 = await ligarListaAoFornecedor({ existentes, novos, criadosAntes: r1.criados }, { criar, ligar });
    expect(criar).toHaveBeenCalledTimes(1);
    expect(r2.ok).toBe(true);
  });

  test("cadastrar falhou: nada é ligado", async () => {
    const criar = jest.fn(async () => { throw Object.assign(new Error("limite"), { status: 403 }); });
    const ligar = jest.fn();
    const r = await ligarListaAoFornecedor({ existentes, novos }, { criar, ligar });
    expect(r).toMatchObject({ ok: false, etapa: "cadastrar" });
    expect(ligar).not.toHaveBeenCalled();
  });

  test("divide acima de 1.000 itens por chamada", async () => {
    const muitos = Array.from({ length: 1001 }, (_, i) => ({ n: i + 1, product_id: "p" + i }));
    const ligar = jest.fn(async (items: any[]) => ({ linked: items.length, not_found: [] }));
    const r = await ligarListaAoFornecedor({ existentes: muitos, novos: [] }, { criar: jest.fn(), ligar });
    expect(ligar.mock.calls.map((c: any[]) => c[0].length)).toEqual([1000, 1]);
    expect(r).toMatchObject({ ok: true, ligados: 1001 });
  });
});

// ── O wizard aberto pela tela de Fornecedores ───────────────────────
describe("inicio: aberto pela tela de Fornecedores", () => {
  test("fornecedor: abre no passo 2 com ele escolhido; Voltar leva ao passo 1", async () => {
    const tree = await montar({ inicio: { tipo: "fornecedor", fornecedor: ALFA } });
    expect(tem(tree, "chegou-passo-2")).toBe(true);
    expect(texto(tree)).toContain("Fornecedor · Distribuidora Alfa");
    expect(porId(tree, "chegou-origem-planilha")[0].props.accessibilityState).toBeUndefined();
    await tocar(tree, "chegou-voltar");
    expect(texto(tree)).toContain("Quem mandou a mercadoria?");
  });

  test("lista: Planilha marcada, com a dica do modo só ligar", async () => {
    const tree = await montar({ inicio: { tipo: "fornecedor", fornecedor: ALFA, planilha: true } });
    expect(porId(tree, "chegou-origem-planilha")[0].props.accessibilityState).toEqual({ selected: true });
    expect(tem(tree, "chegou-origem-planilha-dica")).toBe(true);
  });

  test("fornecedor só da nota: passo 1 com o Novo fornecedor preenchido", async () => {
    const tree = await montar({ inicio: { tipo: "novo_fornecedor", inicial: { name: "Gama", cnpj: "23456789000101", phone: "", contact_name: "", email: "", notes: "" } } });
    expect(tem(tree, "chegou-voltar-lista")).toBe(true);
    expect(texto(tree)).toContain("23.456.789/0001-01");
  });
});

describe("planilha sem quantidade: só ligar", () => {
  async function irAConferencia() {
    const tree = await montar({ inicio: { tipo: "fornecedor", fornecedor: ALFA, planilha: true } });
    await tocar(tree, "chegou-origem-planilha-botao");
    await tocar(tree, "chegou-continuar");
    return tree;
  }

  test("faixa, contagens do mockup e o botão \"Ligar n produtos à [fornecedor]\" travado enquanto falta decidir", async () => {
    const tree = await irAConferencia();
    expect(tem(tree, "chegou-so-ligar")).toBe(true);
    const t = texto(tree);
    expect(t).toContain("A planilha não tem quantidade. Os produtos ficam ligados à Distribuidora Alfa com o custo dela; o estoque não muda.");
    expect(t).not.toContain("Estoque e custo médio");
    expect(t).not.toContain("Usar o custo médio");
    expect(tem(tree, "chegou-dar-entrada")).toBe(false);
    const botao = porId(tree, "chegou-ligar-lista")[0];
    expect(botao.props.disabled).toBe(true);
    // 2 achados (esmalte e acetona), 1 sem par (base), 1 repetido (esmalte)
    expect(tile(tree, "chegou-resumo-achados")).toMatch(/(^|\|)2(\||$)/);
    expect(tile(tree, "chegou-resumo-falta")).toMatch(/(^|\|)1(\||$)/);
    expect(tile(tree, "chegou-resumo-problema")).toMatch(/(^|\|)1(\||$)/);
    expect(t).toContain("Este produto já está na linha 1 da lista.");
    expect(t).toContain("Ligar 2 produtos à Distribuidora Alfa");
  });

  test("cadastrar a base, ligar os três com o custo de cada um, sem entrada no estoque, e o Pronto da lista", async () => {
    const tree = await irAConferencia();
    await tocar(tree, "chegou-linha-3-novo");
    await digitar(tree, "chegou-linha-3-novo-preco", "1480");
    expect(texto(tree)).toContain("Vai ser cadastrado como produto novo, com estoque zero e custo R$ 7,40.");
    mockBatchCreate.mockResolvedValue({ created: [{ id: "p-base", name: "Base fortalecedora 10 ml" }], total_created: 1 });
    mockLinkItems.mockResolvedValue({ updated: 3, unlink: false, is_main: false, linked: 3, not_found: [] });
    expect(texto(tree)).toContain("Ligar 3 produtos à Distribuidora Alfa");
    await tocar(tree, "chegou-ligar-lista");

    expect(mockDarEntrada).not.toHaveBeenCalled();
    expect(mockBatchCreate).toHaveBeenCalledWith("c1", [{ name: "Base fortalecedora 10 ml", price: 14.8, stock_qty: 0, cost_price: 7.4 }]);
    expect(mockLinkItems).toHaveBeenCalledWith("c1", "f-alfa", [
      { product_id: "p-esmalte", cost: 5.9, supplier_code: "AL-0100" },
      { product_id: "p-acetona", cost: 3.2, supplier_code: "AL-0391" },
      { product_id: "p-base", cost: 7.4, supplier_code: "AL-1120" },
    ], false);
    expect(tem(tree, "chegou-pronto-lista")).toBe(true);
    const t = texto(tree);
    expect(t).toContain("Os produtos ficaram ligados à Distribuidora Alfa");
    expect(t).toContain("2 que você já tinha e 1 cadastrado agora");
    expect(t).toContain("O estoque não mudou.");
  });

  test("planilha COM quantidade segue a entrada de sempre (sem o modo só ligar)", async () => {
    mockMatriz = [["Nome", "Quantidade", "Custo"], ["Acetona 100 ml", "3", "3,20"]];
    const tree = await irAConferencia();
    expect(tem(tree, "chegou-so-ligar")).toBe(false);
    expect(tem(tree, "chegou-ligar-lista")).toBe(false);
    expect(tem(tree, "chegou-dar-entrada")).toBe(true);
  });

  test("sem fornecedor, a planilha sem quantidade não liga nada (linhas com quantidade zero, como antes)", async () => {
    const tree = await montar();
    await tocar(tree, "chegou-sem-fornecedor");
    await tocar(tree, "chegou-origem-planilha-botao");
    await tocar(tree, "chegou-continuar");
    expect(tem(tree, "chegou-so-ligar")).toBe(false);
    expect(tem(tree, "chegou-linha-1-erro")).toBe(true);
  });
});
