// ============================================================
// Crediário · Histórico — pagamento com parcelas, Editar e Remover
// (08/10/2026, Looks da Jenny: R$ 200 na ficha da cliente errada e nenhum
// jeito de tirar pela tela).
//
//   - o pagamento mostra, por carnê, as parcelas em que caiu;
//   - com can_edit: "Editar" e "Remover"; Remover pede confirmação e chama
//     DELETE /credit/payments/:id, depois recarrega a linha do tempo;
//   - pagamento antigo (can_edit false): sem botões, com o aviso do suporte;
//   - backend antigo (sem can_edit): tudo como era — só o Recibo.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
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

beforeEach(() => { jest.clearAllMocks(); mockEdicaoAberta = null; });

describe("Histórico — pagamento", () => {
  test("mostra as parcelas por carnê, com o que foi em cada uma", () => {
    const { tree } = montar([PAGAMENTO]);
    const texto = flatten(tree.toJSON());
    expect(texto).toContain("Venda no crediário");
    expect(texto).toContain("Parcela 1/3 · vence 06/08/26 · quitada");
    expect(texto).toContain("conta anterior");
    expect(texto).toContain("Parcela 1/1 · vence 08/10/26 · parcial");
    expect(texto).toContain("R$ 166,00");
    expect(texto).toContain("R$ 34,00");
    tree.unmount();
  });

  test("Remover pede confirmação, chama a API e recarrega a linha do tempo", async () => {
    mockUndoPayment.mockResolvedValue({ undone: true, installments_reopened: 1, new_balance: 687 });
    const { tree, props } = montar([PAGAMENTO]);

    expect(tree.root.findAllByProps({ testID: "gate-confirmar" }).length).toBe(0);
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
    act(() => { botao(tree, "crediario-pagamento-remover-pg-1").props.onPress(); });
    await act(async () => { botao(tree, "gate-confirmar").props.onPress(); });
    expect(toast.error).toHaveBeenCalledWith("Este recebimento nao pode ser desfeito automaticamente.");
    expect(props.loadHistory).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("Editar abre a correção com o pagamento como ele está (valor positivo, dia de SP, cliente da ficha)", () => {
    const { tree } = montar([PAGAMENTO]);
    act(() => { botao(tree, "crediario-pagamento-editar-pg-1").props.onPress(); });
    expect(mockEdicaoAberta).toEqual({
      id: "pg-1", amount: 200, method: "pix", paidAt: "2026-09-26",
      customerId: "cli-errada", customerName: "Maria Eduarda Anastácio",
    });
    tree.unmount();
  });

  test("pagamento antigo (can_edit false): sem Editar/Remover, com o aviso", () => {
    const antigo = { ...PAGAMENTO, id: "pg-velho", payment: { method: "pix", can_edit: false, allocations: [] } };
    const { tree } = montar([antigo]);
    expect(tree.root.findAllByProps({ testID: "crediario-pagamento-editar-pg-velho" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "crediario-pagamento-remover-pg-velho" }).length).toBe(0);
    expect(flatten(tree.toJSON())).toContain("fale com o suporte");
    tree.unmount();
  });

  test("backend antigo (sem can_edit): tudo como era — só o Recibo, sem aviso", () => {
    const legado = { ...PAGAMENTO, id: "pg-legado", payment: { method: "pix" } };
    const { tree } = montar([legado]);
    const texto = flatten(tree.toJSON());
    expect(texto).toContain("Recibo");
    expect(texto).not.toContain("Remover");
    expect(texto).not.toContain("Editar");
    expect(texto).not.toContain("suporte");
    tree.unmount();
  });
});
