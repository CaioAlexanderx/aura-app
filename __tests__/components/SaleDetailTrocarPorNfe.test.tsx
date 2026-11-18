// ============================================================
// Detalhe da venda + "Trocar por NF-e" (17/11/2026)
//   - NFC-e autorizada da venda comum, nota ativa: o bloco aparece na loja
//     DA VENDA (multi-CNPJ); NFC-e cancelada → o assistente da NF-e abre
//   - venda sem NFC-e: a tela de hoje (Emitir NF-e / Emitir NFC-e, sem o bloco)
//   - NF-e de venda e troca: sem o bloco
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
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/services/api", () => ({ request: jest.fn(), BASE_URL: "http://x" }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/components/crediario/DevolucaoModal", () => ({ DevolucaoModal: () => null }));
jest.mock("@/components/nfse/NfseDaOrigem", () => ({ NfseDaOrigem: () => null }));
jest.mock("@/components/nfe55/EventosNfe", () => ({ AcoesDeEventosNfe: () => null }));
// Nota ativa na loja.
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { config: { is_active: true, ambiente: "producao" } }, isLoading: false }) }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1" } }) }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false }) }));
jest.mock("@/services/matconApi", () => ({ matconApi: { createDelivery: jest.fn() } }));
const mockTrocar = jest.fn();
jest.mock("@/components/nfe55/TrocarPorNfe", () => ({ TrocarPorNfe: (p: any) => { mockTrocar(p); return null; } }));
const mockWizard = jest.fn();
jest.mock("@/components/nfe55/Nfe55Wizard", () => ({ Nfe55Wizard: (p: any) => { mockWizard(p); return null; } }));

let mockDetail: any = null;
const mockRefetch = jest.fn();
jest.mock("@/hooks/useSales", () => ({
  useSaleDetail: () => ({ detail: mockDetail, isLoading: false, error: null, refetch: mockRefetch }),
  useCancelSale: () => ({ cancelSale: jest.fn(), isCancelling: false }),
  useEmitNfce: () => ({ emitNfce: jest.fn(), isEmitting: false }),
  useReemitTrocaFiscal: () => ({ reemitTrocaFiscal: jest.fn(), isReemitting: false }),
}));

import { SaleDetailModal } from "@/components/screens/vendas/SaleDetailModal";

const NFCE = { id: "em-1", tipo: "nfce", status: "autorizada", numero: 900, serie: 2, chave_acesso: null, pdf_url: null, qr_code: null, url_consulta: null, error_message: null, created_at: "2026-11-17T18:20:00Z", authorized_at: "2026-11-17T18:21:00Z" };

function detalhe(sale: any = {}, extra: any = {}) {
  return Object.assign({
    sale: Object.assign({
      id: "v1", sale_number: 1042, total_amount: 189.7, discount_amount: 0, payment_method: "pix",
      status: "completed", type: "sale", created_at: "2026-11-17T18:19:00Z", notes: null,
      cash_tendered: null, coupon_code: null, transaction_id: "tx1",
    }, sale),
    customer: null,
    seller: { id: "ana", name: "Ana" },
    items: [{ id: "i1", product_id: "p1", product_name: "Batom", quantity: 1, unit_price: 189.7, discount: 0, total_price: 189.7 }],
    fiscal: [],
    returns: [],
    payments: [{ method: "pix", amount: 189.7 }],
    last_edit: null,
  }, extra);
}

const porId = (tree: renderer.ReactTestRenderer, testID: string) => tree.root.findAllByProps({ testID }, { deep: false });
function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<SaleDetailModal visible saleId="v1" onClose={jest.fn()} companyId="loja-b" companyName="Loja Centro" />); });
  return tree;
}

beforeEach(() => { jest.clearAllMocks(); });

test("NFC-e autorizada: o bloco vem na loja da venda; NFC-e cancelada abre o assistente da NF-e", () => {
  mockDetail = detalhe({}, { fiscal: [NFCE] });
  const tree = montar();
  expect(mockTrocar).toHaveBeenCalled();
  const props = mockTrocar.mock.calls[mockTrocar.mock.calls.length - 1][0];
  expect(props).toMatchObject({ companyId: "loja-b", saleId: "v1", nfceId: "em-1" });
  expect(mockWizard).not.toHaveBeenCalled();

  act(() => { props.onCancelada(); });
  expect(mockRefetch).toHaveBeenCalled();
  expect(mockWizard).toHaveBeenCalled();
  expect(mockWizard.mock.calls[mockWizard.mock.calls.length - 1][0]).toMatchObject({ visible: true, companyId: "loja-b", saleId: "v1", saleNumber: 1042 });
  tree.unmount();
});

test("venda sem NFC-e: a tela de hoje, sem o bloco", () => {
  mockDetail = detalhe();
  const tree = montar();
  expect(mockTrocar).not.toHaveBeenCalled();
  expect(porId(tree, "venda-emitir-nfe")).toHaveLength(1);
  expect(porId(tree, "venda-emitir-nfce")).toHaveLength(1);
  tree.unmount();
});

test("NF-e de venda e troca: sem o bloco", () => {
  mockDetail = detalhe({}, { fiscal: [Object.assign({}, NFCE, { tipo: "nfe" })] });
  let tree = montar();
  expect(mockTrocar).not.toHaveBeenCalled();
  tree.unmount();

  mockDetail = detalhe({ type: "troca" }, { fiscal: [NFCE] });
  tree = montar();
  expect(mockTrocar).not.toHaveBeenCalled();
  tree.unmount();
});
