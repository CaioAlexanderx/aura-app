// ============================================================
// Detalhe da venda — 2ª via do cupom não fiscal (14/11/2026).
//
// O botão de reimprimir o cupom só aparecia em venda no crediário; venda
// comum (dinheiro, Pix, cartão) não tinha como sair de novo. Agora toda
// venda não cancelada tem "Imprimir cupom" (mesma rota do PDV,
// /print/receipt/:saleId/preview). Troca e devolução ficam de fora.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
// 09/11/2026: o detalhe virou ResponsiveSheet (Modal do RN = portal no web).
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
  SHEET_NARROW_BP: 500,
}));
jest.mock("@/components/screens/vendas/EditarVendaModal", () => ({ EditarVendaModal: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/services/api", () => ({ request: jest.fn(), employeesApi: { list: jest.fn() }, BASE_URL: "http://x" }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/components/crediario/DevolucaoModal", () => ({ DevolucaoModal: () => null }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: undefined, isLoading: false }) }));
jest.mock("@/stores/auth", () => {
  const useAuthStore: any = () => ({ company: { id: "empresa-1", name: "Depósito" } });
  useAuthStore.getState = () => ({ token: "tk" });
  return { useAuthStore };
});

let mockPdvSettings: any = { matcon_enabled: false };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));

let mockDetail: any = null;
jest.mock("@/hooks/useSales", () => ({
  useSaleDetail: () => ({ detail: mockDetail, isLoading: false, error: null }),
  useCancelSale: () => ({ cancelSale: jest.fn(), isCancelling: false }),
  useEmitNfce: () => ({ emitNfce: jest.fn(), isEmitting: false }),
  useReemitTrocaFiscal: () => ({ reemitTrocaFiscal: jest.fn(), isReemitting: false }),
}));

const mockCreateDelivery = jest.fn();
jest.mock("@/services/matconApi", () => ({
  matconApi: { createDelivery: (...a: any[]) => mockCreateDelivery(...a) },
}));

import { openPrintWindow } from "@/services/printWindow";
import { SaleDetailModal } from "@/components/screens/vendas/SaleDetailModal";

function detalhe(saleExtra: any = {}) {
  return {
    sale: {
      id: "venda-1", sale_number: 1204, total_amount: 380, discount_amount: 0, payment_method: "pix",
      status: "completed", type: "sale", created_at: "2026-09-23T10:00:00Z", notes: null,
      cash_tendered: null, coupon_code: null, transaction_id: null, ...saleExtra,
    },
    customer: null,
    seller: { id: null, name: null },
    items: [{ product_id: "p1", product_name: "Camiseta", quantity: 1, unit_price: 380, total: 380 }],
    fiscal: [],
    returns: [],
  };
}

function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<SaleDetailModal visible saleId="venda-1" onClose={jest.fn()} companyId="empresa-1" />);
  });
  return tree;
}
function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}
const porId = (tree: renderer.ReactTestRenderer, testID: string) => tree.root.findAllByProps({ testID }, { deep: false });

beforeEach(() => { jest.clearAllMocks(); });

const botao = (tree: renderer.ReactTestRenderer) => porId(tree, "venda-imprimir-cupom");

test("venda comum (Pix): tem 'Imprimir cupom' e ele pede o cupom da venda", async () => {
  mockDetail = detalhe({ payment_method: "pix" });
  (openPrintWindow as jest.Mock).mockResolvedValueOnce("ok");
  const tree = montar();
  expect(botao(tree).length).toBe(1);
  expect(flatten(tree.toJSON())).toContain("Imprimir cupom");
  await act(async () => { await botao(tree)[0].props.onPress(); });
  expect(openPrintWindow).toHaveBeenCalledTimes(1);
  tree.unmount();
});

test("venda no crediário continua com o botão", () => {
  mockDetail = detalhe({ payment_method: "crediario" });
  const tree = montar();
  expect(botao(tree).length).toBe(1);
  tree.unmount();
});

test("venda cancelada, troca e devolução não mostram o cupom de venda", () => {
  for (const extra of [{ status: "cancelled" }, { type: "troca" }, { type: "devolucao" }]) {
    mockDetail = detalhe(extra);
    const tree = montar();
    expect(botao(tree).length).toBe(0);
    tree.unmount();
  }
});
