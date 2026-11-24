// ============================================================
// Vendas › Fechamentos: reimprimir o relatório de um fechamento (23/11/2026)
//
//   1. o relatório reimpresso a partir do detalhe da sessão é o MESMO que o
//      Caixa abriu no fim do fechamento (mesmos dados, mesmo HTML), com e
//      sem troca;
//   2. backend sem os campos do relatório: sai o relatório com o que o
//      snapshot tem (Vendas 0, Vendas do período = entradas);
//   3. imprimirFechamento abre a janela no clique, antes da busca, escreve
//      "Preparando…" e depois o relatório; erro vira aviso; pop-up
//      bloqueado devolve false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ user: { id: "u1", name: "Dona Lúcia" }, isStaff: true, company: { id: "empresa-1", member_role: "owner" } }),
}));
jest.mock("@/services/api", () => ({ employeesApi: { list: jest.fn() } }));
const mockOpenPdf = jest.fn();
jest.mock("@/utils/cashClosePdf", () => {
  const real = jest.requireActual("@/utils/cashClosePdf");
  return { ...real, openCashClosePdf: (...a: any[]) => mockOpenPdf(...a) };
});
const mockFechar = jest.fn();
jest.mock("@/services/caixaApi", () => ({
  caixaApi: {
    abrir: jest.fn(), fechar: (...a: any[]) => mockFechar(...a),
    movimentos: { list: jest.fn(), registrar: jest.fn(), remover: jest.fn() },
  },
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isFetching: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { OpenCloseCashModal } from "@/components/screens/pdv/OpenCloseCashModal";
import { buildCashClosePdfHtml } from "@/utils/cashClosePdf";
import {
  dadosDoFechamentoReimpresso, imprimirFechamento, TEXTO_ERRO, TEXTO_PREPARANDO,
} from "@/utils/fechamentoReimpresso";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

const SESSAO_ID = "ab12cd34-0000-4000-8000-000000000001";
const ABRIU = "2026-11-22T12:00:00.000Z";
const FECHOU = "2026-11-22T21:30:00.000Z";

const TROCA = {
  id: "t1", created_at: "2026-11-22T15:10:00.000Z", tipo: "troca" as const,
  devolvidos: [{ product_name_snapshot: "Blusa (Azul · M)", quantity: 1, unit_price: 89.9 }],
  levados: [{ product_name: "Blusa (Preta · M)", quantity: 1, unit_price: 99.9, total_price: 99.9 }],
  recebido: { total: 10, metodos: [{ method: "pix", amount: 10 }] },
  devolvido_cliente: { total: 0, metodos: [] },
  credito_carteira: 0,
};
const RESUMO = { quantidade: 1, pecas_devolvidas: 89.9, pecas_levadas: 99.9, diferenca_recebida: 10, devolvido_cliente: 0 };

/** O que o /fechar devolveu no dia (strings, como o pg manda numeric). */
function fechamentoDoDia(comTroca: boolean) {
  return {
    id: "f1", sessao_id: SESSAO_ID, closed_at: FECHOU, sessao_label: "#AB12C",
    dinheiro_esperado: "330.00", dinheiro_contado: "325.00", diferenca: "-5.00",
    total_pix: "480.50", total_cartao_debito: "120.00", total_cartao_credito: "990.00",
    total_fiado: "60.00", total_dinheiro: "250.00", total_outros: "0.00", total_geral: "1900.50",
    observacao: "troco dado a mais", sales_count: 9, new_customers_count: 2, total_vendas: 1890.5,
    total_devolucoes: 0, total_sangrias: 50, total_suprimentos: 30,
    trocas: comTroca ? [TROCA] : [], trocas_resumo: comTroca ? RESUMO : { ...RESUMO, quantidade: 0 },
  };
}

/** O mesmo fechamento como o GET /caixa/sessao/:id devolve hoje. */
function detalheDaSessao(comTroca: boolean) {
  const f = fechamentoDoDia(comTroca);
  return {
    id: SESSAO_ID, company_id: "empresa-1", status: "fechada" as const,
    opened_at: ABRIU, closed_at: FECHOU, troco_inicial: 100,
    obs_sessao: null, opened_by_name: "Dona Lúcia", closed_by_name: "Dona Lúcia",
    dinheiro_esperado: 330, dinheiro_contado: 325, diferenca: -5,
    total_pix: 480.5, total_cartao_debito: 120, total_cartao_credito: 990,
    total_fiado: 60, total_dinheiro: 250, total_outros: 0, total_geral: 1900.5,
    obs_fechamento: f.observacao, total_sangrias: 50, total_suprimentos: 30,
    sessao_label: f.sessao_label, sales_count: f.sales_count, new_customers_count: f.new_customers_count,
    total_vendas: f.total_vendas, total_devolucoes: f.total_devolucoes,
    trocas: f.trocas, trocas_resumo: f.trocas_resumo,
  };
}

/** Fecha o caixa no modal do Caixa e devolve o que foi para o relatório. */
async function relatorioDoDia(comTroca: boolean) {
  mockOpenPdf.mockReset();
  mockFechar.mockResolvedValue({ fechamento: fechamentoDoDia(comTroca) });
  const sessao = {
    id: SESSAO_ID, opened_at: ABRIU, troco_inicial: 100,
    opened_by: { id: "u1", name: "Dona Lúcia" },
    totais_ao_vivo: { pix: 480.5, cartao_debito: 120, cartao_credito: 990, dinheiro: 250, fiado: 60, outros: 0, geral: 1900.5 },
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <OpenCloseCashModal visible companyId="empresa-1" companyName="Doce Encanto" companyCnpj="12.345.678/0001-90"
        sessaoAtiva={sessao as any} onClose={jest.fn()} onSuccess={jest.fn()} />
    );
  });
  const input = tree.root.findAll((n) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function")[0];
  act(() => { input.props.onChangeText("325,00"); });
  const botao = (txt: string) => tree.root.findAll((n) => typeof n.props?.onPress === "function" && flattenText(n.children).includes(txt), { deep: false });
  act(() => { botao("Avancar")[0].props.onPress(); });
  act(() => { botao("Avancar")[0].props.onPress(); });
  await act(async () => { botao("Selar caixa")[0].props.onPress(); });
  act(() => { botao("Baixar PDF de fechamento")[0].props.onPress(); });
  tree.unmount();
  expect(mockOpenPdf).toHaveBeenCalledTimes(1);
  return mockOpenPdf.mock.calls[0][0];
}

const LOJA = { companyName: "Doce Encanto", companyCnpj: "12.345.678/0001-90" };

describe("relatório reimpresso = relatório do dia", () => {
  test.each([[false], [true]])("com troca: %s", async (comTroca) => {
    const dia = await relatorioDoDia(comTroca);
    const reimpresso = dadosDoFechamentoReimpresso(detalheDaSessao(comTroca), LOJA);
    expect(reimpresso).toEqual(dia);
    expect(buildCashClosePdfHtml(reimpresso)).toBe(buildCashClosePdfHtml(dia));
  });

  test("backend sem os campos do relatório: o que o snapshot tem", () => {
    const d: any = detalheDaSessao(false);
    ["sessao_label", "sales_count", "new_customers_count", "total_vendas", "total_devolucoes", "trocas", "trocas_resumo"]
      .forEach((k) => delete d[k]);
    const r = dadosDoFechamentoReimpresso(d, LOJA);
    expect(r.sessaoLabel).toBe("#AB12C");
    expect(r.salesCount).toBe(0);
    expect(r.grossRevenue).toBe(1900.5);
    expect(r.entradasTotal).toBe(1900.5);
    expect(r.paymentMix.map((p) => p.label)).toEqual(["Pix", "Crédito", "Débito", "Dinheiro", "Fiado"]);
    expect(buildCashClosePdfHtml(r)).toContain("Fechamento de caixa");
  });
});

describe("imprimirFechamento", () => {
  function janela() {
    const escrito: string[] = [];
    const doc = { open: jest.fn(), write: jest.fn((h: string) => escrito.push(h)), close: jest.fn() };
    return { win: { document: doc } as any, escrito };
  }
  let openSpy: jest.SpyInstance;
  afterEach(() => { openSpy && openSpy.mockRestore(); });

  test("abre a janela no clique, antes da busca, e escreve o relatório quando chega", async () => {
    const { win, escrito } = janela();
    openSpy = jest.spyOn(window, "open").mockReturnValue(win);
    let responder!: (v: any) => void;
    const buscar = jest.fn(() => new Promise<any>((r) => { responder = r; }));

    expect(imprimirFechamento(buscar, LOJA)).toBe(true);
    expect(openSpy).toHaveBeenCalledWith("", "_blank");
    expect(escrito[0]).toContain(TEXTO_PREPARANDO);

    await act(async () => { responder(detalheDaSessao(true)); });
    expect(escrito[1]).toBe(buildCashClosePdfHtml(dadosDoFechamentoReimpresso(detalheDaSessao(true), LOJA)));
    expect(escrito[1]).toContain("Trocas e devoluções da sessão (1)");
  });

  test("a busca falha: aviso gentil na janela e onErro", async () => {
    const { win, escrito } = janela();
    openSpy = jest.spyOn(window, "open").mockReturnValue(win);
    const onErro = jest.fn();
    imprimirFechamento(() => Promise.reject(new Error("rede")), LOJA, onErro);
    await act(async () => { await Promise.resolve(); });
    expect(escrito[escrito.length - 1]).toContain(TEXTO_ERRO);
    expect(onErro).toHaveBeenCalled();
  });

  test("pop-up bloqueado: devolve false e não busca", () => {
    openSpy = jest.spyOn(window, "open").mockReturnValue(null);
    const buscar = jest.fn();
    expect(imprimirFechamento(buscar as any, LOJA)).toBe(false);
    expect(buscar).not.toHaveBeenCalled();
  });
});
