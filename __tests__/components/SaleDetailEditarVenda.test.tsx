// ============================================================
// Detalhe da venda com "Editar venda" (09/11/2026, mockup aprovado)
//
//   - venda normal: "Editar venda" é a ação principal e abre a edição;
//     "Cancelar venda" é o texto à esquerda; não existe mais "Editar
//     lancamento" a partir da venda
//   - pagamento dividido e entrada + crediário aparecem em pílulas
//   - "Editada em dd/mm por Fulano" quando a venda foi editada
//   - troca, devolução e cancelada: sem "Editar venda" (como hoje)
//   - rótulo "Vendedor(a)" e "Sem cliente / Venda no balcão"
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
const mockEditar = jest.fn();
jest.mock("@/components/screens/vendas/EditarVendaModal", () => ({
  EditarVendaModal: (p: any) => { mockEditar(p); return null; },
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/services/api", () => ({ request: jest.fn(), BASE_URL: "http://x" }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/components/crediario/DevolucaoModal", () => ({ DevolucaoModal: () => null }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: undefined, isLoading: false }) }));
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
      cash_tendered: null, coupon_code: null, transaction_id: "tx1",
    }, sale),
    customer: null,
    seller: { id: "ana", name: "Ana" },
    items: [{ id: "i1", product_id: "p1", product_name: "Batom", quantity: 1, unit_price: 189.7, discount: 0, total_price: 189.7 }],
    fiscal: [],
    returns: [],
    payments: [{ method: "dinheiro", amount: 100 }, { method: "pix", amount: 89.7 }],
    last_edit: null,
  }, extra);
}

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (tree: renderer.ReactTestRenderer, testID: string) => tree.root.findAllByProps({ testID }, { deep: false });
function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<SaleDetailModal visible saleId="v1" onClose={jest.fn()} companyId="loja-b" companyName="Loja Centro" />); });
  return tree;
}

beforeEach(() => { jest.clearAllMocks(); });

test("venda normal: Editar venda abre a edição na empresa da venda; sem Editar lancamento", () => {
  mockDetail = detalhe();
  const tree = montar();
  const tudo = texto(tree.toJSON());
  expect(tudo).toContain("Venda #1042");
  expect(tudo).toContain("Loja Centro");
  expect(tudo).toContain("Dinheiro · R$ 100,00");
  expect(tudo).toContain("Pix · R$ 89,70");
  expect(tudo).toContain("Vendedor(a)");
  expect(tudo).toContain("Sem cliente");
  expect(tudo).toContain("Venda no balcão");
  expect(tudo).not.toMatch(/Editar lan[cç]amento/);
  expect(texto(porId(tree, "venda-cancelar")[0])).toContain("Cancelar venda");

  act(() => { porId(tree, "venda-editar")[0].props.onPress(); });
  expect(mockEditar).toHaveBeenCalled();
  const props = mockEditar.mock.calls[mockEditar.mock.calls.length - 1][0];
  expect(props).toMatchObject({ visible: true, saleId: "v1", companyId: "loja-b" });
  tree.unmount();
});

test("entrada + crediário em pílulas e selo Crediário", () => {
  mockDetail = detalhe({ payment_method: "pix" }, {
    customer: { id: "c", name: "Cliente Exemplo", phone: "(11) 98765-4321", email: null },
    payments: [{ method: "pix", amount: 50 }, { method: "crediario", amount: 139.7, installments: 2 }],
  });
  const tree = montar();
  const tudo = texto(tree.toJSON());
  expect(tudo).toContain("Entrada Pix · R$ 50,00");
  expect(tudo).toContain("Crediário 2x · R$ 139,70");
  expect(tudo).toContain("(11) 9····-··21");
  expect(tudo).not.toContain("98765");
  tree.unmount();
});

test("Editada em dd/mm por Fulano", () => {
  mockDetail = detalhe({}, { last_edit: { id: "e", by_name: "Ana", at: "2026-11-08T15:00:00Z" } });
  const tree = montar();
  expect(texto(porId(tree, "venda-editada")[0])).toContain("Editada em 08/11 por Ana");
  tree.unmount();
});

test.each([
  ["troca", { type: "troca" }],
  ["devolução", { type: "devolucao" }],
  ["cancelada", { status: "cancelled", cancelled_at: "2026-11-07T21:31:00Z" }],
])("%s: sem Editar venda", (_n, sale) => {
  mockDetail = detalhe(sale as any, { troca: null, devolucao: null });
  const tree = montar();
  expect(porId(tree, "venda-editar").length).toBe(0);
  tree.unmount();
});
