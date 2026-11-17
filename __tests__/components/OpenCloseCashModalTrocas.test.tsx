// ============================================================
// Caixa — modal do caixa (OpenCloseCashModal): trocas no fechamento
// (16/11/2026, mockup docs/mockups/fechamento-trocas.html).
//
//   1. fechamento com troca: a tela de resultado mostra a conta Vendas →
//      Entradas e a lista das trocas; o PDF recebe as trocas;
//   2. sem troca (trocas: []) ou backend antigo (sem o campo): a tela de
//      resultado é a de sempre.
// react-query mockado: useQuery devolve o que o teste define.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ user: { id: "u1", name: "Dona Fixture" }, isStaff: true, company: { id: "empresa-1", member_role: "owner" } }),
}));
jest.mock("@/services/api", () => ({ employeesApi: { list: jest.fn() } }));

const mockOpenPdf = jest.fn();
jest.mock("@/utils/cashClosePdf", () => ({ openCashClosePdf: (...a: any[]) => mockOpenPdf(...a) }));

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
function apertar(tree: renderer.ReactTestRenderer, texto: string) {
  const alvo = tree.root.findAll(
    (n) => n.props && typeof n.props.onPress === "function" && flattenText(n.children).indexOf(texto) >= 0,
  );
  if (!alvo.length) throw new Error("botão não achado: " + texto);
  return alvo[alvo.length - 1].props.onPress();
}

const SESSAO = {
  id: "sessao-1", opened_at: "2026-11-14T12:02:00Z", troco_inicial: 100,
  opened_by: { id: "u1", name: "Dona Fixture" },
  totais_ao_vivo: { pix: 0, cartao_debito: 0, cartao_credito: 0, dinheiro: 250, fiado: 0, outros: 0, geral: 250 },
};

const FECHAMENTO_BASE = {
  id: "f1", sessao_id: "sessao-1", closed_at: "2026-11-14T22:10:00Z", sessao_label: "#00412",
  dinheiro_esperado: 350, dinheiro_contado: 350, diferenca: 0,
  total_pix: 2988.38, total_cartao_debito: 1754.1, total_cartao_credito: 4630.1, total_fiado: 0,
  total_dinheiro: 1212.4, total_outros: 0, total_geral: 10584.98,
  observacao: null, sales_count: 43, new_customers_count: 4, total_vendas: 10525.08, total_devolucoes: 0,
};

const TROCA = {
  id: "t1", created_at: "2026-11-14T15:33:00.000Z", tipo: "troca",
  devolvidos: [{ product_name_snapshot: "Conjunto de linho (Azul · M)", quantity: 1, unit_price: 139.9 }],
  levados: [
    { product_name: "Blusa com strass", quantity: 1, unit_price: 79.9, total_price: 79.9 },
    { product_name: "Blusa casual", quantity: 1, unit_price: 119.9, total_price: 119.9 },
  ],
  recebido: { total: 59.9, metodos: [{ method: "debito", amount: 59.9 }] },
  devolvido_cliente: { total: 0, metodos: [] },
  credito_carteira: 0,
};
const RESUMO = { quantidade: 1, pecas_devolvidas: 139.9, pecas_levadas: 199.8, diferenca_recebida: 59.9, devolvido_cliente: 0 };

async function fecharCom(fechamento: any) {
  mockFechar.mockResolvedValue({ fechamento });
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <OpenCloseCashModal visible companyId="empresa-1" companyName="Loja de Moda" companyCnpj={null}
        sessaoAtiva={SESSAO as any} onClose={jest.fn()} onSuccess={jest.fn()} />
    );
  });
  const input = tree.root.findAll((n) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function")[0];
  act(() => { input.props.onChangeText("350"); });
  act(() => { apertar(tree, "Avancar"); }); // contagem → observação
  act(() => { apertar(tree, "Avancar"); }); // observação → revisar
  await act(async () => { await apertar(tree, "Fechar caixa"); });
  expect(flattenText(tree.toJSON() as any)).toContain("Caixa fechado com sucesso");
  return tree;
}

beforeEach(() => { mockFechar.mockReset(); mockOpenPdf.mockReset(); });

test("1. com troca: a conta Vendas → Entradas e a lista aparecem, e vão para o PDF", async () => {
  const tree = await fecharCom({ ...FECHAMENTO_BASE, trocas: [TROCA], trocas_resumo: RESUMO });

  const conta = flattenText(porTestID(tree, "fechamento-conta")[0].children);
  expect(conta).toBe(
    "Vendas do períodoR$ 10525,08" +
    "+ Diferença paga em trocas · 1 trocaR$ 59,90" +
    "= Entradas no caixaR$ 10584,98"
  );
  expect(flattenText(porTestID(tree, "fechamento-trocas")[0].children)).toBe("Trocas e devoluções da sessão (1)");
  const bloco = flattenText(porTestID(tree, "fechamento-troca-t1")[0].children);
  expect(bloco).toContain("Troca12:33");
  expect(bloco).toContain("DevolveuConjunto de linho (Azul · M)R$ 139,90");
  expect(bloco).toContain("LevouBlusa com strassR$ 79,90Blusa casualR$ 119,90");
  expect(bloco).toContain("Cliente pagou a diferença no débito+ R$ 59,90");
  const tudo = flattenText(tree.toJSON() as any);
  expect(tudo).toContain("Peças devolvidasR$ 139,90");
  expect(tudo).toContain("Diferença recebidaR$ 59,90");

  act(() => { apertar(tree, "Baixar PDF de fechamento"); });
  expect(mockOpenPdf).toHaveBeenCalledTimes(1);
  expect(mockOpenPdf.mock.calls[0][0]).toMatchObject({ trocas: [TROCA], trocasResumo: RESUMO, grossRevenue: 10525.08, entradasTotal: 10584.98 });
  tree.unmount();
});

test.each([
  ["sessão sem troca (trocas: [])", { trocas: [], trocas_resumo: { ...RESUMO, quantidade: 0, pecas_devolvidas: 0, pecas_levadas: 0, diferenca_recebida: 0 } }],
  ["backend antigo (sem o campo)", {}],
])("2. %s: a tela de resultado é a de sempre", async (_nome, extra) => {
  const tree = await fecharCom({ ...FECHAMENTO_BASE, ...extra });
  expect(porTestID(tree, "fechamento-conta")).toHaveLength(0);
  expect(porTestID(tree, "fechamento-trocas")).toHaveLength(0);
  const tudo = flattenText(tree.toJSON() as any);
  expect(tudo).toContain("Vendas do períodoR$ 10525,08");
  expect(tudo).toContain("Entradas no caixaR$ 10584,98");
  expect(tudo).not.toContain("Diferença paga em trocas");
  expect(tudo).not.toContain("Trocas e devoluções");
  tree.unmount();
});
