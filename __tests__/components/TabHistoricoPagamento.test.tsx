// ============================================================
// Crediário · Histórico — pagamento com parcelas, Editar e Remover
// (08/10/2026, Looks da Jenny: R$ 200 na ficha da cliente errada e nenhum
// jeito de tirar pela tela).
//
//   - o pagamento mostra, por carnê, as parcelas em que caiu;
//   - com can_edit: "Corrigir" e "Remover" no "⋯" (23/11/2026, F1 da ficha);
//     Remover pede confirmação e chama DELETE /credit/payments/:id, depois
//     recarrega as Movimentações;
//   - pagamento antigo (can_edit false): sem "⋯", com o aviso;
//   - backend antigo (sem can_edit): tudo como era — só o Recibo.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
// 10/11/2026: loja sem a NFS-e automática (a tela fica a de sempre).
jest.mock("@/hooks/useNfseAutomatica", () => ({ useNfseAutomaticaConfig: () => ({ ativa: false, config: null, carregando: false }), useSituacaoNfse: () => ({ situacao: null }) }));
jest.mock("@/components/nfse/NfseDaOrigem", () => ({ NfseDaOrigem: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/crediario/DevolucaoModal", () => ({ DevolucaoModal: () => null }));
jest.mock("@/services/pdvApi", () => ({ pdvApi: { getSale: jest.fn() } }));
// O modal de edição tem teste próprio de regra (utils/crediarioPagamento);
// aqui só interessa COM O QUE ele é aberto.
let mockEdicaoAberta: any = null;
jest.mock("@/components/crediario/ficha/EditarPagamentoModal", () => ({
  EditarPagamentoModal: (p: any) => { mockEdicaoAberta = p.visible ? p.pagamento : null; return null; },
}));
jest.mock("@/components/ConfirmGate", () => ({
  ConfirmGate: (p: any) => {
    const { Text, Pressable } = require("react-native");
    if (!p.visible) return null;
    return (
      <Pressable testID="gate-confirmar" onPress={p.onConfirm}><Text>{p.message}</Text></Pressable>
    );
  },
}));
const mockUndoPayment = jest.fn();
jest.mock("@/services/creditApi", () => ({
  creditApi: { undoPayment: (...a: any[]) => mockUndoPayment(...a), undoTransaction: jest.fn() },
  printReceipt: jest.fn(),
}));

import { toast } from "@/components/Toast";
import { TabHistorico } from "@/components/crediario/ficha/TabHistorico";

const PAGAMENTO = {
  id: "pg-1", type: "payment", occurred_at: "2026-09-26T15:00:00Z", amount: -200, sale_id: null, account_id: null,
  payment: {
    method: "pix", can_edit: true,
    allocations: [
      { installment_id: "i1", number: 1, total_installments: 3, due_date: "2026-08-06", account_id: null, account_name: null, from_sale: true, principal_paid: 166, charges_paid: 0, status_after: "paid" },
      { installment_id: "i2", number: 1, total_installments: 1, due_date: "2026-10-08", account_id: "acc", account_name: "conta anterior", from_sale: false, principal_paid: 34, charges_paid: 0, status_after: "overdue" },
    ],
  },
};

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}

function montar(events: any[], extra: Record<string, any> = {}) {
  const props = {
    histEvents: events, histCursor: null, histLoading: false, histLoaded: true,
    loadHistory: jest.fn(), setHistLoaded: jest.fn(), onRefresh: jest.fn(),
    companyId: "empresa-1", customerId: "cli-errada", customerName: "Maria Eduarda Anastácio",
    ...extra,
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<TabHistorico {...(props as any)} />); });
  return { tree, props };
}

const botao = (tree: renderer.ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID }, { deep: false })[0];
/** Abre o "⋯" do pagamento (Corrigir e Remover moram nele). */
const abrirMais = (tree: renderer.ReactTestRenderer, id: string) =>
  act(() => { botao(tree, `crediario-mov-mais-${id}`).props.onPress(); });

beforeEach(() => { jest.clearAllMocks(); mockEdicaoAberta = null; });

describe("Histórico — pagamento", () => {
  test("mostra as parcelas por carnê, com o que foi em cada uma", () => {
    const { tree } = montar([PAGAMENTO]);
    const texto = flatten(tree.toJSON());
    expect(texto).toContain("Pagou no Pix");
    expect(texto).toContain("− R$ 200,00");
    expect(texto).toContain("Para onde foi o dinheiro · Compras sem carnê");
    expect(texto).toContain("Parcela 1 de 3 · paga inteira");
    expect(texto).toContain("Para onde foi o dinheiro · conta anterior");
    // QA P2: o valor aparece uma vez só, à direita
    expect(texto).toContain("Parcela 1 de 1 · abateu");
    expect(texto).not.toContain("abateu R$ 34,00");
    // a parcela não veio entre as abertas da ficha: não afirma que foi paga
    expect(texto).toContain("já não está em aberto");
    expect(texto).toContain("R$ 166,00");
    expect(texto).toContain("R$ 34,00");
    tree.unmount();
  });

  test("Remover pede confirmação, chama a API e recarrega a linha do tempo", async () => {
    mockUndoPayment.mockResolvedValue({ undone: true, installments_reopened: 1, new_balance: 687 });
    const { tree, props } = montar([PAGAMENTO]);

    expect(tree.root.findAllByProps({ testID: "gate-confirmar" }).length).toBe(0);
    // Remover fica no "⋯": fechado, não está na tela
    expect(tree.root.findAllByProps({ testID: "crediario-pagamento-remover-pg-1" }).length).toBe(0);
    abrirMais(tree, "pg-1");
    expect(flatten(tree.toJSON())).toContain("Corrigir este pagamento");
    act(() => { botao(tree, "crediario-pagamento-remover-pg-1").props.onPress(); });
    expect(mockUndoPayment).not.toHaveBeenCalled();
    expect(flatten(tree.toJSON())).toContain("Remover o pagamento de R$ 200,00?");

    await act(async () => { botao(tree, "gate-confirmar").props.onPress(); });

    expect(mockUndoPayment).toHaveBeenCalledWith("empresa-1", "pg-1");
    expect(toast.success).toHaveBeenCalledWith("Pagamento removido. 1 parcela voltou a ficar em aberto.");
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
    expect(props.setHistLoaded).toHaveBeenCalledWith(false);
    expect(props.loadHistory).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  test("falhou ao remover: mostra o motivo do servidor e não recarrega", async () => {
    mockUndoPayment.mockRejectedValue({ data: { error: "Este recebimento nao pode ser desfeito automaticamente." } });
    const { tree, props } = montar([PAGAMENTO]);
    abrirMais(tree, "pg-1");
    act(() => { botao(tree, "crediario-pagamento-remover-pg-1").props.onPress(); });
    await act(async () => { botao(tree, "gate-confirmar").props.onPress(); });
    expect(toast.error).toHaveBeenCalledWith("Este recebimento nao pode ser desfeito automaticamente.");
    expect(props.loadHistory).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("Corrigir abre a correção com o pagamento como ele está (valor positivo, dia de SP, cliente da ficha)", () => {
    const { tree } = montar([PAGAMENTO]);
    abrirMais(tree, "pg-1");
    act(() => { botao(tree, "crediario-pagamento-editar-pg-1").props.onPress(); });
    expect(mockEdicaoAberta).toEqual({
      id: "pg-1", amount: 200, method: "pix", paidAt: "2026-09-26",
      customerId: "cli-errada", customerName: "Maria Eduarda Anastácio",
    });
    tree.unmount();
  });

  test("pagamento antigo (can_edit false): sem Corrigir/Remover, com o aviso", () => {
    const antigo = { ...PAGAMENTO, id: "pg-velho", payment: { method: "pix", can_edit: false, allocations: [] } };
    const { tree } = montar([antigo]);
    expect(tree.root.findAllByProps({ testID: "crediario-mov-mais-pg-velho" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "crediario-pagamento-editar-pg-velho" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "crediario-pagamento-remover-pg-velho" }).length).toBe(0);
    expect(flatten(tree.toJSON())).toContain("Para corrigir ou remover, fale com a gente.");
    tree.unmount();
  });

  test("backend antigo (sem can_edit): tudo como era — só o Recibo, sem aviso", () => {
    const legado = { ...PAGAMENTO, id: "pg-legado", payment: { method: "pix" } };
    const { tree } = montar([legado]);
    const texto = flatten(tree.toJSON());
    expect(texto).toContain("Recibo");
    expect(tree.root.findAllByProps({ testID: "crediario-mov-mais-pg-legado" }).length).toBe(0);
    expect(texto).not.toContain("Remover");
    expect(texto).not.toContain("Corrigir");
    expect(texto).not.toContain("fale com a gente");
    tree.unmount();
  });

  test("hoje faltam: a parcela paga em parte mostra o que ainda falta, das abertas da ficha", () => {
    const { tree } = montar([PAGAMENTO], {
      openInst: [{ id: "i2", due_date: "2026-10-08", amount_due: 50, covered_amount: 34, remaining: 16 }],
    });
    expect(flatten(tree.toJSON())).toContain("venceu 08/10 · hoje faltam R$ 16,00");
    tree.unmount();
  });
});

describe("Movimentações — compra e lançamento", () => {
  const COMPRA = {
    id: "cp-1", type: "purchase", occurred_at: "2026-10-19T15:00:00Z", amount: 616, sale_id: "venda-1", account_id: "c",
    items: [{ product_name: "Vestido midi floral", quantity: 1, unit_price: 289, total: 289 }],
  };
  const MANUAL = {
    id: "md-1", type: "manual_debit", occurred_at: "2026-07-15T15:00:00Z", amount: 45, sale_id: null, account_id: null,
    meta: { notes: "conta anterior" },
  };

  test("mês como cabeçalho, verbo, sinal e uma ação à vista", () => {
    const { tree } = montar([PAGAMENTO, COMPRA, MANUAL]);
    const texto = flatten(tree.toJSON());
    expect(texto).toContain("Movimentações");
    expect(texto).toContain("Setembro de 2026");
    expect(texto).toContain("Outubro de 2026");
    expect(texto).toContain("Julho de 2026");
    expect(texto).toContain("Comprou");
    expect(texto).toContain("+ R$ 616,00");
    expect(texto).toContain("1× Vestido midi floral");
    expect(texto).toContain("Devolver itens");
    expect(texto).toContain("Valor lançado à mão pela loja");
    expect(texto).toContain("“conta anterior”");
    // sem legenda de cores nem Atualizar
    expect(texto).not.toContain("débito/ajuste");
    expect(texto).not.toContain("Atualizar");
    // a compra não tem "⋯"; o lançamento manual tem, com o Excluir dentro
    expect(tree.root.findAllByProps({ testID: "crediario-mov-mais-cp-1" }).length).toBe(0);
    expect(texto).not.toContain("Excluir este lançamento");
    abrirMais(tree, "md-1");
    expect(flatten(tree.toJSON())).toContain("Excluir este lançamento");
    tree.unmount();
  });
});
