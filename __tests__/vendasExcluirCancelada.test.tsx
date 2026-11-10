// ============================================================
// Vendas — "Excluir" na linha da venda cancelada (10/11/2026)
//
// Pedido do Caio: "Linha de venda cancelada pode ser excluída, para não
// poluir a UI." Exclusão lógica no backend (Aura-backend#985). Aqui:
//   1. só a linha cancelada tem o botão (a venda que vale não tem);
//   2. o botão abre a confirmação do app com o texto combinado — nada
//      de confirm() do navegador — e não abre o detalhe da venda;
//   3. confirmar chama o /hide com a empresa dona da venda (consolidado);
//   4. voltar não exclui nada.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

const mockHideSale = jest.fn();
let mockSales: any[] = [];

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/EmptyState", () => ({ EmptyState: "EmptyState" }));
jest.mock("@/components/screens/vendas/SaleDetailModal", () => ({ SaleDetailModal: (p: any) => (p.visible ? "detalhe-aberto" : null) }));
jest.mock("@/components/screens/vendas/FechamentosTab", () => ({ FechamentosTab: "FechamentosTab" }));
jest.mock("@/components/screens/vendas/SalesRanking", () => ({ SalesRanking: "SalesRanking" }));
jest.mock("@/components/screens/vendas/VendasFiltros", () => ({ VendasFiltros: "VendasFiltros" }));
jest.mock("@/components/ScreenHero", () => ({ ScreenHero: "ScreenHero", ScreenTabs: "ScreenTabs" }));
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({}), router: { push: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "comp-1" }, consolidatedView: true }),
}));
jest.mock("@/hooks/useSales", () => ({
  useSalesList: () => ({
    sales: mockSales,
    stats: { total_sales: 2, active_sales: 1, cancelled_sales: 1, revenue: 120, avg_ticket: 120 },
    total: mockSales.length,
    isLoading: false, isFetching: false, error: null, refetch: jest.fn(),
    breakdown: [], companyCount: 2,
  }),
  useHideSale: () => ({ hideSale: mockHideSale, isHiding: false }),
}));

import VendasScreen from "@/app/(tabs)/vendas";

function venda(id: string, status: string, companyId: string) {
  return {
    id, status, type: "sale", total_amount: 80, created_at: "2026-11-10T13:00:00Z",
    customer: { id: "c", name: "Cliente " + id }, seller: { id: null, name: null },
    payment_method: "pix", items_count: 1, company_id: companyId, company_name: "Loja " + companyId,
  };
}

function montar() {
  let tree: any;
  act(() => { tree = renderer.create(<VendasScreen />); });
  return tree;
}

function porTestID(tree: any, id: string) {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
}

function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join(" ");
  const filhos = node.children || (node.props && node.props.children);
  return filhos ? textoDe(filhos) : "";
}

beforeEach(() => {
  mockHideSale.mockReset();
  mockHideSale.mockResolvedValue({ ok: true });
  mockSales = [venda("cancelada-1", "cancelled", "comp-2"), venda("vale-1", "completed", "comp-1")];
});

describe("Vendas — excluir da lista a venda cancelada", () => {
  it("1. só a linha cancelada tem o botão Excluir", () => {
    const tree = montar();
    expect(porTestID(tree, "excluir-venda-cancelada-1").length).toBeGreaterThan(0);
    expect(porTestID(tree, "excluir-venda-vale-1").length).toBe(0);
  });

  it("2. o botão abre a confirmação do app, não o detalhe", () => {
    const tree = montar();
    const btn = porTestID(tree, "excluir-venda-cancelada-1")[0];
    act(() => { btn.props.onPress({ stopPropagation: jest.fn() }); });

    const txt = textoDe(tree.toJSON());
    expect(txt).toContain("Excluir venda cancelada?");
    expect(txt).toContain("A venda cancelada sai da lista. O registro continua guardado para a contabilidade.");
    expect(txt).not.toContain("detalhe-aberto");
    expect(mockHideSale).not.toHaveBeenCalled();
  });

  it("3. confirmar exclui na empresa dona da venda (consolidado)", async () => {
    const tree = montar();
    act(() => { porTestID(tree, "excluir-venda-cancelada-1")[0].props.onPress({ stopPropagation: jest.fn() }); });
    const { ConfirmDialog } = require("@/components/ConfirmDialog");
    const dialog = tree.root.findByType(ConfirmDialog);
    await act(async () => { await dialog.props.onConfirm(); });

    expect(mockHideSale).toHaveBeenCalledTimes(1);
    expect(mockHideSale).toHaveBeenCalledWith({ saleId: "cancelada-1", companyId: "comp-2" });
    expect(textoDe(tree.toJSON())).not.toContain("Excluir venda cancelada?");
  });

  it("4. voltar fecha sem excluir", () => {
    const tree = montar();
    act(() => { porTestID(tree, "excluir-venda-cancelada-1")[0].props.onPress({ stopPropagation: jest.fn() }); });
    const { ConfirmDialog } = require("@/components/ConfirmDialog");
    act(() => { tree.root.findByType(ConfirmDialog).props.onCancel(); });

    expect(mockHideSale).not.toHaveBeenCalled();
    expect(textoDe(tree.toJSON())).not.toContain("Excluir venda cancelada?");
  });
});
