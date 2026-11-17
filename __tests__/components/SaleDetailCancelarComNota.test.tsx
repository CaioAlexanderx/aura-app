// ============================================================
// Cancelar venda com nota autorizada (17/11/2026, b-troca-prazo-nfce)
//
// Antes: cancelar a venda não cancelava a NFC-e nem avisava. Agora:
//   - dentro do prazo: "Cancelar a nota junto" (marcado) e o cancel leva
//     cancelarNota: true; desmarcado, só a venda;
//   - fora do prazo: aviso gentil e o caminho (devolução no Caixa); o
//     cancel não pede a nota;
//   - o resultado da nota (result.nota) vira aviso.
// Nada fiscal real: o hook de cancelar é mock.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
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
jest.mock("@/components/nfse/NfseDaOrigem", () => ({ NfseDaOrigem: () => null }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: undefined, isLoading: false }) }));
jest.mock("@/stores/auth", () => {
  const useAuthStore: any = () => ({ company: { id: "empresa-1", name: "Loja" } });
  useAuthStore.getState = () => ({ token: "tk" });
  return { useAuthStore };
});
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: { matcon_enabled: false }, isLoading: false, error: null, invalidate: jest.fn() }),
}));

let mockDetail: any = null;
const mockCancelSale = jest.fn();
jest.mock("@/hooks/useSales", () => ({
  useSaleDetail: () => ({ detail: mockDetail, isLoading: false, error: null }),
  useCancelSale: () => ({ cancelSale: (...a: any[]) => mockCancelSale(...a), isCancelling: false }),
  useEmitNfce: () => ({ emitNfce: jest.fn(), isEmitting: false }),
  useReemitTrocaFiscal: () => ({ reemitTrocaFiscal: jest.fn(), isReemitting: false }),
}));
jest.mock("@/services/matconApi", () => ({ matconApi: { createDelivery: jest.fn() } }));

import { router } from "expo-router";
import { toast } from "@/components/Toast";
import { SaleDetailModal } from "@/components/screens/vendas/SaleDetailModal";

const minAtras = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const emMin = (m: number) => new Date(Date.now() + m * 60000).toISOString();

function detalhe(nota: any) {
  return {
    sale: {
      id: "venda-1", sale_number: 1204, total_amount: 380, discount_amount: 0, payment_method: "pix",
      status: "completed", type: "sale", created_at: minAtras(15), notes: null,
      cash_tendered: null, coupon_code: null, transaction_id: null,
    },
    customer: null,
    seller: { id: null, name: null },
    items: [{ product_id: "p1", product_name: "Camiseta", quantity: 1, unit_price: 380, total_price: 380 }],
    fiscal: nota ? [nota] : [],
    returns: [],
  };
}
const notaDentro = () => ({ id: "nota-1", tipo: "nfce", status: "autorizada", numero: 900, authorized_at: minAtras(10),
  cancelamento: { uf: "SP", prazo_minutos: 30, ate: emMin(20), dentro: true } });
const notaFora = () => ({ id: "nota-1", tipo: "nfce", status: "autorizada", numero: 900, authorized_at: minAtras(120),
  cancelamento: { uf: "SP", prazo_minutos: 30, ate: minAtras(90), dentro: false } });

function montar(onClose = jest.fn()) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<SaleDetailModal visible saleId="venda-1" onClose={onClose} companyId="empresa-1" />);
  });
  return tree;
}
const porId = (tree: renderer.ReactTestRenderer, testID: string) => tree.root.findAllByProps({ testID }, { deep: false });
function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}
function abrirConfirmacao(tree: renderer.ReactTestRenderer) {
  act(() => { porId(tree, "venda-cancelar")[0].props.onPress(); });
}
async function confirmar(tree: renderer.ReactTestRenderer) {
  await act(async () => { await porId(tree, "venda-cancelar-confirmar")[0].props.onPress(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCancelSale.mockResolvedValue({ ok: true, sale_id: "venda-1", type: "sale", items_returned: 1, refunded_amount: 380, nota: null });
});

test("dentro do prazo: oferece cancelar a nota junto (marcado) e o cancel pede a nota", async () => {
  mockDetail = detalhe(notaDentro());
  mockCancelSale.mockResolvedValue({ ok: true, type: "sale", items_returned: 1, refunded_amount: 380,
    nota: { id: "nota-1", tipo: "nfce", numero: 900, situacao: "cancelada", mensagem: "A NFC-e nº 900 também foi cancelada na SEFAZ." } });
  const tree = montar();
  abrirConfirmacao(tree);
  expect(porId(tree, "venda-cancelar-nota-dentro")).toHaveLength(1);
  expect(porId(tree, "venda-cancelar-nota-junto")[0].props.accessibilityState).toEqual({ checked: true });
  expect(flatten(tree.toJSON())).toContain("Sim, cancelar venda e nota");
  await confirmar(tree);
  expect(mockCancelSale).toHaveBeenCalledWith({ saleId: "venda-1", reason: "", cancelarNota: true });
  expect(toast.success).toHaveBeenCalledWith("A NFC-e nº 900 também foi cancelada na SEFAZ.");
  tree.unmount();
});

test("dentro do prazo, desmarcado: cancela só a venda", async () => {
  mockDetail = detalhe(notaDentro());
  const tree = montar();
  abrirConfirmacao(tree);
  act(() => { porId(tree, "venda-cancelar-nota-junto")[0].props.onPress(); });
  expect(flatten(tree.toJSON())).toContain("Sim, cancelar só a venda");
  await confirmar(tree);
  expect(mockCancelSale).toHaveBeenCalledWith({ saleId: "venda-1", reason: "", cancelarNota: false });
  tree.unmount();
});

test("fora do prazo: aviso gentil com o caminho da devolução; o cancel não pede a nota", async () => {
  mockDetail = detalhe(notaFora());
  mockCancelSale.mockResolvedValue({ ok: true, type: "sale", items_returned: 1, refunded_amount: 380,
    nota: { id: "nota-1", tipo: "nfce", numero: 900, situacao: "fora_do_prazo", caminho: "devolucao", mensagem: "A NFC-e nº 900 já passou do prazo." } });
  const tree = montar();
  abrirConfirmacao(tree);
  expect(porId(tree, "venda-cancelar-nota-junto")).toHaveLength(0);
  const texto = flatten(tree.toJSON());
  expect(texto).toContain("continua valendo");
  expect(texto).toContain("NF-e de devolução");
  expect(texto).toContain("Sim, cancelar só a venda");
  await confirmar(tree);
  expect(mockCancelSale).toHaveBeenCalledWith({ saleId: "venda-1", reason: "", cancelarNota: false });
  expect(toast.info).toHaveBeenCalledWith("A NFC-e nº 900 já passou do prazo.");
  tree.unmount();
});

test("fora do prazo: o botão leva para a devolução no Caixa", () => {
  mockDetail = detalhe(notaFora());
  const onClose = jest.fn();
  const tree = montar(onClose);
  abrirConfirmacao(tree);
  act(() => { porId(tree, "venda-ir-devolucao")[0].props.onPress(); });
  expect(onClose).toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith("/pdv?troca=1");
  tree.unmount();
});

test("SEFAZ não cancelou: aviso de erro gentil, a venda já cancelada", async () => {
  mockDetail = detalhe(notaDentro());
  mockCancelSale.mockResolvedValue({ ok: true, type: "sale", items_returned: 1, refunded_amount: 380,
    nota: { id: "nota-1", tipo: "nfce", numero: 900, situacao: "nao_cancelada", mensagem: "A nota continua autorizada." } });
  const tree = montar();
  abrirConfirmacao(tree);
  await confirmar(tree);
  expect(toast.success).toHaveBeenCalledTimes(1); // só o da venda
  expect(toast.error).toHaveBeenCalledWith("A nota continua autorizada.");
  tree.unmount();
});

test("venda sem nota: confirmação como antes", async () => {
  mockDetail = detalhe(null);
  const tree = montar();
  abrirConfirmacao(tree);
  expect(porId(tree, "venda-cancelar-nota-dentro")).toHaveLength(0);
  expect(porId(tree, "venda-cancelar-nota-fora")).toHaveLength(0);
  expect(flatten(tree.toJSON())).toContain("Sim, cancelar venda");
  await confirmar(tree);
  expect(mockCancelSale).toHaveBeenCalledWith({ saleId: "venda-1", reason: "", cancelarNota: false });
  tree.unmount();
});
