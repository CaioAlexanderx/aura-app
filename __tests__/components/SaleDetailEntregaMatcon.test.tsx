// ============================================================
// Matcon M1 — detalhe da venda: "Criar entrega" e "saldo a entregar"
// (QA final 23/09/2026).
//
//   - venda do balcão (has_pending_delivery false) com o Matcon ligado:
//     botão "Criar entrega" (POST .../matcon/deliveries {sale_id}); deu
//     certo → confirmação e o botão vira "Ver entregas"; falhou (404) →
//     frase simples, nunca "Rota nao encontrada".
//   - has_pending_delivery true (o campo do contrato): selo "saldo a
//     entregar" que abre Entregas em "A entregar"; sem botão de
//     criar.
//   - Matcon desligado: nada disso aparece.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/services/api", () => ({ request: jest.fn(), employeesApi: { list: jest.fn() }, BASE_URL: "http://x" }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/components/crediario/DevolucaoModal", () => ({ DevolucaoModal: () => null }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: undefined, isLoading: false }) }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito" } }) }));

let mockPdvSettings: any = { matcon_enabled: true };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));

let mockDetail: any = null;
jest.mock("@/hooks/useSales", () => ({
  useSaleDetail: () => ({ detail: mockDetail, isLoading: false, error: null }),
  useCancelSale: () => ({ cancelSale: jest.fn(), isCancelling: false }),
  useUpdateSaleSeller: () => ({ updateSeller: jest.fn(), isUpdating: false }),
  useEmitNfce: () => ({ emitNfce: jest.fn(), isEmitting: false }),
  useReemitTrocaFiscal: () => ({ reemitTrocaFiscal: jest.fn(), isReemitting: false }),
}));

const mockCreateDelivery = jest.fn();
jest.mock("@/services/matconApi", () => ({
  matconApi: { createDelivery: (...a: any[]) => mockCreateDelivery(...a) },
}));

import { router } from "expo-router";
import { toast } from "@/components/Toast";
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
    items: [{ product_id: "p1", product_name: "Cimento", quantity: 10, unit_price: 38, total: 380 }],
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

beforeEach(() => { jest.clearAllMocks(); mockPdvSettings = { matcon_enabled: true }; });

test("venda do balcão: 'Criar entrega' cria e vira 'Ver entregas'", async () => {
  mockDetail = detalhe({ has_pending_delivery: false });
  mockCreateDelivery.mockResolvedValueOnce({ delivery: { id: "d1" } });
  const tree = montar();
  expect(porId(tree, "venda-criar-entrega").length).toBe(1);

  await act(async () => { await porId(tree, "venda-criar-entrega")[0].props.onPress(); });
  expect(mockCreateDelivery).toHaveBeenCalledWith("empresa-1", { sale_id: "venda-1" });
  expect((toast.success as jest.Mock).mock.calls[0][0]).toContain("Entrega criada");
  expect(porId(tree, "venda-criar-entrega").length).toBe(0);
  expect(porId(tree, "venda-ver-entregas").length).toBe(1);
  tree.unmount();
});

test("criar entrega falhou (404): frase simples, o botão continua", async () => {
  mockDetail = detalhe({ has_pending_delivery: false });
  mockCreateDelivery.mockRejectedValueOnce(Object.assign(new Error("Rota nao encontrada"), { status: 404, data: { error: "Rota nao encontrada" } }));
  const tree = montar();
  await act(async () => { await porId(tree, "venda-criar-entrega")[0].props.onPress(); });
  expect(toast.error).toHaveBeenCalledWith("Não consegui criar a entrega agora. Tente de novo daqui a pouco.");
  expect(porId(tree, "venda-criar-entrega").length).toBe(1);
  tree.unmount();
});

test("has_pending_delivery: selo abre Entregas em 'A entregar', sem 'Criar entrega'", () => {
  mockDetail = detalhe({ has_pending_delivery: true });
  const tree = montar();
  expect(flatten(tree.toJSON())).toContain("saldo a entregar");
  expect(porId(tree, "venda-criar-entrega").length).toBe(0);
  act(() => { porId(tree, "venda-saldo-a-entregar")[0].props.onPress(); });
  expect(router.push).toHaveBeenCalledWith("/matcon/entregas?dia=pending");
  tree.unmount();
});

test("Matcon desligado: nem botão nem selo", () => {
  mockPdvSettings = { matcon_enabled: false };
  mockDetail = detalhe({ has_pending_delivery: true });
  const tree = montar();
  expect(porId(tree, "venda-criar-entrega").length).toBe(0);
  expect(porId(tree, "venda-saldo-a-entregar").length).toBe(0);
  tree.unmount();
});
