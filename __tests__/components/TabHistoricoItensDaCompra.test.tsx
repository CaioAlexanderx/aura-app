// ============================================================
// Crediário · Histórico — valor dos itens da compra (INC-2026-11-20-01)
//
// A linha do tempo dividia o total do item por 100 (como se viesse em
// centavos). O backend (GET /credit/customers/:cid/history) manda
// sale_items.total_price em reais: R$ 408,00 aparecia como R$ 4,08.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/hooks/useNfseAutomatica", () => ({ useNfseAutomaticaConfig: () => ({ ativa: false, config: null, carregando: false }), useSituacaoNfse: () => ({ situacao: null }) }));
jest.mock("@/components/nfse/NfseDaOrigem", () => ({ NfseDaOrigem: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/crediario/DevolucaoModal", () => ({ DevolucaoModal: () => null }));
jest.mock("@/services/pdvApi", () => ({ pdvApi: { getSale: jest.fn() } }));
jest.mock("@/components/crediario/ficha/EditarPagamentoModal", () => ({ EditarPagamentoModal: () => null }));
jest.mock("@/components/ConfirmGate", () => ({ ConfirmGate: () => null }));
jest.mock("@/services/creditApi", () => ({ creditApi: { undoPayment: jest.fn(), undoTransaction: jest.fn() }, printReceipt: jest.fn() }));

import { TabHistorico } from "@/components/crediario/ficha/TabHistorico";

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("|");
  return flatten(node.children);
}

const COMPRA = {
  id: "c-1", type: "purchase", occurred_at: "2026-11-09T15:00:00Z", amount: 1278, sale_id: "s-1", account_id: null,
  items: [
    { product_name: "mussaman white - lattafa", quantity: 1, unit_price: 408, total: 408 },
    { product_name: "kit haya - lattafa", quantity: 1, unit_price: 450, total: 450 },
    { product_name: "hawas black - rasasi", quantity: 1, unit_price: 420, total: 420 },
  ],
};

it("mostra o total de cada item em reais, como vem do backend", () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<TabHistorico {...({
      histEvents: [COMPRA], histCursor: null, histLoading: false, histLoaded: true,
      loadHistory: jest.fn(), setHistLoaded: jest.fn(), onRefresh: jest.fn(),
      companyId: "empresa-1", customerId: "cli-1", customerName: "Cliente",
    } as any)} />);
  });
  const texto = flatten(tree.toJSON());
  for (const v of ["R$ 408,00", "R$ 450,00", "R$ 420,00"]) expect(texto).toContain(v);
  for (const errado of ["R$ 4,08", "R$ 4,50", "R$ 4,20"]) expect(texto).not.toContain(errado);
});
