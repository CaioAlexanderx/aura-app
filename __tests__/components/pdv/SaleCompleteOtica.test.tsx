// ============================================================
// Tela final da venda × Ótica (hotfix 24/11/2026). A tela final passa à
// nota dos produtos se a loja tem Ótica (pdv_settings.otica_enabled) e o
// cliente do cadastro da venda (sale.customerId). Sem ótica: otica=false.
// Mocks do padrão do repo (expo-font, FpktLogo); dados fictícios.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, token: "t", isDemo: false }),
}));
jest.mock("@/services/api", () => ({ BASE_URL: "http://api" }));
jest.mock("@/components/screens/pdv/OsActions", () => ({ OsActions: () => null }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/utils/clipboard", () => ({ copyText: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
const mockNota = jest.fn();
jest.mock("@/components/nfe55/NotaDeProdutosDaVenda", () => ({
  NotaDeProdutosDaVenda: (p: any) => { mockNota(p); return null; },
}));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import type { SaleResult } from "@/hooks/useCart";

const VENDA: SaleResult = {
  id: "venda-otica-1",
  saleNumber: 42,
  total: 300,
  payment: "pix",
  items: [{ productId: "armacao", name: "Armação", price: 300, qty: 1 }],
  date: "24/11/2026",
  customerId: "cli-1",
  customerName: "Ana Exemplo",
} as SaleResult;

function montar(pdvSettings: any, sale: SaleResult = VENDA) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <SaleComplete sale={sale} onNewSale={jest.fn()} pdvSettings={pdvSettings} notaAtiva />
      </QueryClientProvider>,
    );
  });
  return mockNota.mock.calls[mockNota.mock.calls.length - 1][0];
}

beforeEach(() => jest.clearAllMocks());

describe("tela final · ótica na nota dos produtos", () => {
  it("ótica ligada: passa otica e o cliente da venda", () => {
    const p = montar({ otica_enabled: true });
    expect(p).toEqual(expect.objectContaining({ otica: true, customerId: "cli-1", saleId: "venda-otica-1", companyId: "empresa-1" }));
  });

  it("sem ótica: otica=false (a nota não pergunta nada à prévia)", () => {
    expect(montar({ otica_enabled: false }).otica).toBe(false);
    expect(montar(null).otica).toBe(false);
  });

  it("venda sem cliente: customerId nulo", () => {
    const p = montar({ otica_enabled: true }, { ...VENDA, customerId: undefined });
    expect(p.customerId).toBeNull();
  });
});
