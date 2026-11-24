// ============================================================
// Hotfix 20/11/2026 — "Editar produtos" no detalhe da venda
//
// O redesenho de 09/11 (PR #1199) tirou o único caminho para remover ou
// adicionar produto numa venda feita. Volta como ação secundária que abre só
// a lista de produtos do Financeiro (SaleDetailsSection), sem o
// TransactionModal.
//   - venda comum com lançamento: botão aparece e abre a lista com o txId certo
//   - troca, devolução, cancelada, sem lançamento: sem botão
//   - venda de outra empresa (consolidado): sem botão
//   - fechar a folha invalida a venda (lista e detalhe mostram o novo total)
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
  SHEET_NARROW_BP: 500,
}));
jest.mock("@/components/Button", () => {
  const R = require("react");
  return { Button: (p: any) => R.createElement("Button", p, p.title) };
});
jest.mock("@/components/screens/vendas/EditarVendaModal", () => ({ EditarVendaModal: () => null }));
const mockSecao = jest.fn();
jest.mock("@/components/screens/financeiro/SaleDetailsSection", () => ({
  SaleDetailsSection: (p: any) => { mockSecao(p); return null; },
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/services/api", () => ({ request: jest.fn(), BASE_URL: "http://x" }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/components/crediario/DevolucaoModal", () => ({ DevolucaoModal: () => null }));
const mockInvalidate = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1" } }) }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false }) }));
jest.mock("@/services/matconApi", () => ({ matconApi: { createDelivery: jest.fn() } }));

let mockDetail: any = null;
jest.mock("@/hooks/useSales", () => ({
  useSaleDetail: () => ({ detail: mockDetail, isLoading: false, error: null }),
  useCancelSale: () => ({ cancelSale: jest.fn(), isCancelling: false }),
  useEmitNfce: () => ({ emitNfce: jest.fn(), isEmitting: false }),
  useReemitTrocaFiscal: () => ({ reemitTrocaFiscal: jest.fn(), isReemitting: false }),
}));

import { SaleDetailModal } from "@/components/screens/vendas/SaleDetailModal";

function detalhe(sale: any = {}, extra: any = {}) {
  return Object.assign({
    sale: Object.assign({
      id: "v1", sale_number: 1042, total_amount: 189.7, discount_amount: 0, payment_method: "dinheiro",
      status: "completed", type: "sale", created_at: "2026-11-07T18:42:00Z", notes: null,
      cash_tendered: null, coupon_code: null, transaction_id: "tx-77",
    }, sale),
    customer: null,
    seller: { id: "ana", name: "Ana" },
    items: [{ id: "i1", product_id: "p1", product_name: "Batom", quantity: 1, unit_price: 189.7, discount: 0, total_price: 189.7 }],
    fiscal: [],
    returns: [],
    payments: [{ method: "dinheiro", amount: 189.7 }],
    last_edit: null,
    troca: null,
    devolucao: null,
  }, extra);
}

const porId = (tree: renderer.ReactTestRenderer, testID: string) => tree.root.findAllByProps({ testID }, { deep: false });
function montar(props: any = {}) {
  let tree!: renderer.ReactTestRenderer;
  const onClose = jest.fn();
  act(() => { tree = renderer.create(<SaleDetailModal visible saleId="v1" onClose={onClose} {...props} />); });
  return { tree, onClose };
}

beforeEach(() => { jest.clearAllMocks(); });

test("venda comum com lançamento: Editar produtos abre a lista com o txId da venda", () => {
  mockDetail = detalhe();
  const { tree } = montar();
  const botao = porId(tree, "venda-editar-produtos");
  expect(botao.length).toBe(1);
  expect(botao[0].props.title).toBe("Editar produtos");
  expect(porId(tree, "venda-editar-produtos-sheet").length).toBe(0);
  expect(mockSecao).not.toHaveBeenCalled();

  act(() => { botao[0].props.onPress(); });
  expect(porId(tree, "venda-editar-produtos-sheet").length).toBe(1);
  expect(mockSecao).toHaveBeenCalled();
  const props = mockSecao.mock.calls[mockSecao.mock.calls.length - 1][0];
  expect(props).toMatchObject({ txId: "tx-77", somenteProdutos: true });
  tree.unmount();
});

test("fechar a folha invalida a venda e volta ao detalhe", () => {
  mockDetail = detalhe();
  const { tree, onClose } = montar();
  act(() => { porId(tree, "venda-editar-produtos")[0].props.onPress(); });
  act(() => { porId(tree, "venda-editar-produtos-fechar")[0].props.onPress(); });
  expect(porId(tree, "venda-editar-produtos-sheet").length).toBe(0);
  const chaves = mockInvalidate.mock.calls.map(function(c) { return c[0].queryKey[0]; });
  expect(chaves).toEqual(expect.arrayContaining(["sales-list", "sale-detail", "transaction-sale-details"]));
  expect(onClose).not.toHaveBeenCalled();
  tree.unmount();
});

test("venda cancelada por inteiro ou ida para a Troca: fecha a folha e o detalhe", () => {
  mockDetail = detalhe();
  const { tree, onClose } = montar();
  act(() => { porId(tree, "venda-editar-produtos")[0].props.onPress(); });
  const props = mockSecao.mock.calls[mockSecao.mock.calls.length - 1][0];
  act(() => { props.onClose(); });
  expect(onClose).toHaveBeenCalled();
  expect(mockInvalidate).toHaveBeenCalled();
  tree.unmount();
});

test("venda da empresa ativa aberta pelo consolidado: botão aparece", () => {
  mockDetail = detalhe();
  const { tree } = montar({ companyId: "empresa-1", companyName: "Loja Centro" });
  expect(porId(tree, "venda-editar-produtos").length).toBe(1);
  tree.unmount();
});

test.each([
  ["troca", { type: "troca" }, {}],
  ["devolução", { type: "devolucao" }, {}],
  ["cancelada", { status: "cancelled", cancelled_at: "2026-11-07T21:31:00Z" }, {}],
  ["sem lançamento", { transaction_id: null }, {}],
  ["de outra empresa (consolidado)", {}, { companyId: "loja-b", companyName: "Loja B" }],
])("%s: sem Editar produtos", (_n, sale, props) => {
  mockDetail = detalhe(sale as any);
  const { tree } = montar(props);
  expect(porId(tree, "venda-editar-produtos").length).toBe(0);
  expect(mockSecao).not.toHaveBeenCalled();
  tree.unmount();
});
