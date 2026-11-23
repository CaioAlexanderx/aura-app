// ============================================================
// Vendas › Fechamentos: "Imprimir fechamento" no drawer (23/11/2026)
//
// No consolidado, a linha da Loja B imprime com o detalhe da Loja B (a
// rota da loja da linha) e o cabeçalho da Loja B. A janela abre no clique,
// antes da busca (bloqueio de pop-up); pop-up bloqueado vira aviso gentil.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockHistorico = jest.fn();
const mockSessao = jest.fn();
const mockToastErro = jest.fn();
const LOJA_A = { id: "loja-a", name: "Loja A", trade_name: "Loja A", cnpj: "11.111.111/0001-11" };
const LOJA_B = { id: "loja-b", name: "Loja B", trade_name: "Loja B", cnpj: "22.222.222/0001-22" };

jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  return { ...rn, Modal: ({ visible, children }: any) => (visible ? children : null) };
});
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/EmptyState", () => ({ EmptyState: "EmptyState" }));
jest.mock("@/components/Toast", () => ({ toast: { error: (...a: any[]) => mockToastErro(...a), success: jest.fn() } }));
jest.mock("@/services/caixaApi", () => ({
  caixaApi: {
    historico: (...a: any[]) => mockHistorico(...a),
    sessao: (...a: any[]) => mockSessao(...a),
  },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    company: { id: LOJA_A.id, name: LOJA_A.name, trade_name: LOJA_A.trade_name, cnpj: LOJA_A.cnpj },
    consolidatedView: true,
    availableCompanies: [LOJA_A, LOJA_B],
  }),
}));

import { FechamentosTab } from "@/components/screens/vendas/FechamentosTab";

function sessao(loja: string, id: string, hora: number) {
  return {
    id, opened_at: `2026-11-22T${hora}:00:00.000Z`, closed_at: `2026-11-22T${hora + 1}:00:00.000Z`,
    troco_inicial: 50, status: "fechada", obs_sessao: null,
    opened_by_name: "Operadora " + loja, closed_by_name: null,
    dinheiro_esperado: 150, dinheiro_contado: 150, diferenca: 0,
    total_pix: 200, total_cartao_debito: 0, total_cartao_credito: 0, total_fiado: 0,
    total_dinheiro: 100, total_outros: 0, total_geral: 300, obs_fechamento: null,
  };
}

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><FechamentosTab /></QueryClientProvider>);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree as renderer.ReactTestRenderer;
}

function abrirLinha(tree: renderer.ReactTestRenderer, operadora: string) {
  const linha = tree.root.findAll(
    (n) => typeof n.props?.onPress === "function" && flattenText(n.children).includes(operadora),
    { deep: false },
  )[0];
  act(() => { linha.props.onPress(); });
}

beforeEach(() => {
  mockHistorico.mockReset(); mockSessao.mockReset(); mockToastErro.mockReset();
  mockHistorico.mockImplementation((companyId: string) => Promise.resolve({
    sessoes: companyId === LOJA_B.id ? [sessao("B", "sess-b", 13)] : [sessao("A", "sess-a", 12)],
    total: 1,
  }));
});

test("consolidado: a linha da Loja B imprime com o detalhe e o cabeçalho da Loja B", async () => {
  const escrito: string[] = [];
  const win: any = { document: { open: jest.fn(), write: (h: string) => escrito.push(h), close: jest.fn() } };
  const openSpy = jest.spyOn(window, "open").mockReturnValue(win);
  let responder!: (v: any) => void;
  mockSessao.mockImplementation(() => new Promise((r) => { responder = r; }));

  const tree = await montar();
  abrirLinha(tree, "Operadora B");
  const botao = tree.root.findAll((n) => n.props?.testID === "fechamento-imprimir", { deep: false });
  expect(botao).toHaveLength(1);
  expect(flattenText(botao[0].children)).toContain("Imprimir fechamento");

  act(() => { botao[0].props.onPress(); });
  // A janela abriu no clique, antes de o detalhe chegar.
  expect(openSpy).toHaveBeenCalledTimes(1);
  expect(mockSessao).toHaveBeenCalledWith(LOJA_B.id, "sess-b");

  await act(async () => {
    responder({ sessao: { ...sessao("B", "sess-b", 13), sales_count: 4, total_vendas: 300, trocas: [] } });
  });
  const html = escrito[escrito.length - 1];
  expect(html).toContain("Loja B - CNPJ 22.222.222/0001-22");
  expect(html).toContain("Operadora B");
  expect(html).toContain('<div class="kpi"><div class="l">Vendas</div><div class="v violet">4</div></div>');
  expect(mockToastErro).not.toHaveBeenCalled();
  openSpy.mockRestore();
  tree.unmount();
});

test("pop-up bloqueado: aviso gentil e nenhuma busca", async () => {
  const openSpy = jest.spyOn(window, "open").mockReturnValue(null);
  const tree = await montar();
  abrirLinha(tree, "Operadora A");
  const botao = tree.root.findAll((n) => n.props?.testID === "fechamento-imprimir", { deep: false })[0];
  act(() => { botao.props.onPress(); });
  expect(mockSessao).not.toHaveBeenCalled();
  expect(mockToastErro).toHaveBeenCalledWith(expect.stringContaining("permita as janelas do Aura"));
  openSpy.mockRestore();
  tree.unmount();
});
