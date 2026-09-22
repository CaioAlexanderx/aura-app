// ============================================================
// Matcon M2 — o botão "Emitir NF-e" no card de /matcon/entregas
// (22/09/2026, docs/CONTRACT_MATCON.md §M2).
//
// Mesmo padrão de mocks de __tests__/components/EntregasMatcon.test.tsx:
// nada de rede real, só os hooks que a tela usa. A folha "Emitir NF-e"
// (EmitirNfeEntregaSheet) só monta quando o vendedor toca no botão — os
// três casos abaixo nunca chegam a tocar, então não precisam mockar
// useProducts nem useMutation.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));

let mockPdvSettings: any = { matcon_enabled: true };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));

jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito Santa Rita" } }),
}));

let mockData: any = { deliveries: [], summary: null };
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mockData, isLoading: false, isFetching: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock("@/components/RequireCompanyScope", () => ({
  RequireCompanyScope: ({ children }: any) => children,
}));

import MatconEntregasRoute from "@/app/(tabs)/matcon/entregas";

function baseDelivery(over: any) {
  return {
    id: "entrega-1",
    sale_id: "venda-1",
    sale_number: 1204,
    sequence: 1,
    stage: "ready",
    scheduled_for: "2020-01-01",
    delivered_by: null,
    customer_name: "Marlene Souza",
    customer_phone: "(11) 98765-4321",
    address: "Rua das Acácias, 233",
    total: 1220.58,
    has_pending: false,
    public_token: "tok",
    items: [
      {
        sale_item_id: "item-1", product_id: "p-cimento", unit_price: 32.9,
        name: "Cimento CP-II 50 kg", unit: "sc", quantity: 10, sold_quantity: 10, delivered_before: 0,
      },
    ],
    created_at: "2026-09-22T09:00:00Z",
    ...over,
  };
}

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}

function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<MatconEntregasRoute />); });
  return tree;
}

function comEntrega(delivery: any) {
  mockData = {
    deliveries: [delivery],
    summary: {
      separating: { count: 0, total: 0 },
      ready: { count: 1, total: 1220.58 },
      out: { count: 0, total: 0 },
      delivered_today: { count: 0, total: 0 },
      pending_orders: 0,
    },
  };
}

describe("/matcon/entregas — botão Emitir NF-e (Matcon M2)", () => {
  test("entrega 'ready' sem nota mostra o botão 'Emitir NF-e'", () => {
    comEntrega(baseDelivery({ stage: "ready" }));
    const tree = montar();
    const texto = flatten(tree.toJSON());

    expect(tree.root.findAllByProps({ testID: "matcon-emitir-nfe-entrega-1" }).length).toBeGreaterThan(0);
    expect(texto).toContain("Emitir NF-e");
    expect(tree.root.findAllByProps({ testID: "matcon-selo-nfe-entrega-1" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "matcon-ver-danfe-entrega-1" }).length).toBe(0);

    tree.unmount();
  });

  test("entrega 'out' sem nota também mostra o botão 'Emitir NF-e'", () => {
    comEntrega(baseDelivery({ stage: "out" }));
    const tree = montar();

    expect(tree.root.findAllByProps({ testID: "matcon-emitir-nfe-entrega-1" }).length).toBeGreaterThan(0);

    tree.unmount();
  });

  test("entrega com nfe_emission_id autorizada mostra o selo e 'Ver DANFE', sem o botão de emitir", () => {
    comEntrega(baseDelivery({
      stage: "ready",
      nfe_emission_id: "nfe-1",
      nfe_number: 1204,
      nfe_status: "autorizada",
      danfe_url: "https://exemplo.com/danfe/1204",
    }));
    const tree = montar();
    const texto = flatten(tree.toJSON());

    expect(tree.root.findAllByProps({ testID: "matcon-selo-nfe-entrega-1" }).length).toBeGreaterThan(0);
    expect(texto).toContain("NF-E #1204");
    expect(texto).toContain("AUTORIZADA");
    expect(tree.root.findAllByProps({ testID: "matcon-ver-danfe-entrega-1" }).length).toBeGreaterThan(0);
    expect(texto).toContain("Ver DANFE");
    expect(tree.root.findAllByProps({ testID: "matcon-emitir-nfe-entrega-1" }).length).toBe(0);

    tree.unmount();
  });

  test("entrega com nota rejeitada mostra o motivo em português e 'Tentar de novo'", () => {
    comEntrega(baseDelivery({
      stage: "ready",
      nfe_emission_id: "nfe-1",
      nfe_number: 1204,
      nfe_status: "rejeitada",
    }));
    const tree = montar();
    const texto = flatten(tree.toJSON());

    expect(texto).toContain("recusada");
    expect(texto).toContain("Tentar de novo");
    expect(tree.root.findAllByProps({ testID: "matcon-emitir-nfe-entrega-1" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "matcon-ver-danfe-entrega-1" }).length).toBe(0);

    tree.unmount();
  });

  test("entrega 'separating' não mostra o botão de emitir (material ainda não conferido)", () => {
    comEntrega(baseDelivery({ stage: "separating" }));
    const tree = montar();

    expect(tree.root.findAllByProps({ testID: "matcon-emitir-nfe-entrega-1" }).length).toBe(0);

    tree.unmount();
  });
});
