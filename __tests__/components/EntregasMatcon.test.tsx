// ============================================================
// Matcon M1 — /matcon/entregas (22/09/2026).
//
// Mesmo padrão de mocks de __tests__/components/CartPanelMatcon.test.tsx
// (usePdvSettings) somado ao de __tests__/ordemDeServico.test.tsx
// (useAuthStore + @tanstack/react-query sem rede): a tela lê o toggle do
// PDV, a empresa ativa e a lista de entregas — nada disso precisa de
// network real neste teste.
//
// Cobre:
//   - toggle OFF: a tela é só o recado curto "ligue Materiais de
//     construção", sem esteira (mesmo contrato de /matcon/orcamentos).
//   - toggle ON com 1 entrega em "saiu" (out), com um item parcial
//     (6 de 10 sc): o card mostra o progresso do item, o botão "Entrega
//     parcial" (só existe nesta estação) e o botão principal da próxima
//     etapa, "Marcar como entregue" — sempre visível, sem hover
//     (CLAUDE.md regra 7).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));

// pdv_settings controlável por teste — mesmo padrão de CartPanelMatcon.test.tsx.
let mockPdvSettings: any = { matcon_enabled: false };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));

jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito Santa Rita" } }),
}));

// react-query: entrega o resultado da esteira sem rede (padrão de
// __tests__/ordemDeServico.test.tsx).
let mockData: any = { deliveries: [], summary: null };
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mockData, isLoading: false, isFetching: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock("@/components/RequireCompanyScope", () => ({
  RequireCompanyScope: ({ children }: any) => children,
}));

import MatconEntregasRoute from "@/app/(tabs)/matcon/entregas";

const ENTREGA_SAIU = {
  id: "entrega-1",
  sale_id: "venda-1",
  sale_number: 1204,
  sequence: 1,
  stage: "out",
  scheduled_for: "2020-01-01",
  delivered_by: null,
  customer_name: "Marlene Souza",
  customer_phone: "(11) 98765-4321",
  address: "Rua das Acácias, 233",
  total: 1093.21,
  has_pending: true,
  public_token: "tok",
  items: [
    {
      sale_item_id: "item-1",
      name: "Cimento CP-II 50 kg",
      unit: "sc",
      quantity: 4,
      sold_quantity: 10,
      delivered_before: 6,
    },
  ],
  out_at: "2026-09-22T16:40:00.000Z",
  created_at: "2026-09-22T09:00:00Z",
};

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

describe("/matcon/entregas — toggle desligado", () => {
  test("mostra o recado para ligar Materiais de construção, sem esteira", () => {
    mockPdvSettings = { matcon_enabled: false };
    const tree = montar();
    const texto = flatten(tree.toJSON());

    expect(tree.root.findAllByProps({ testID: "matcon-entregas-desligado" }).length).toBeGreaterThan(0);
    expect(texto).toContain("Ligue");
    expect(texto).toContain("Materiais de construção");
    expect(tree.root.findAllByProps({ testID: "matcon-esteira-entregas" }).length).toBe(0);

    tree.unmount();
  });
});

describe("/matcon/entregas — toggle ligado, entrega em rota (saiu)", () => {
  test("mostra o progresso do item, 'Entrega parcial' e 'Marcar como entregue'", () => {
    mockPdvSettings = { matcon_enabled: true };
    mockData = {
      deliveries: [ENTREGA_SAIU],
      summary: {
        separating: { count: 5, total: 21400 },
        ready: { count: 3, total: 12900 },
        out: { count: 2, total: 8200 },
        delivered_today: { count: 6, total: 19740 },
        pending_orders: 3,
      },
    };
    const tree = montar();
    const texto = flatten(tree.toJSON());

    expect(tree.root.findAllByProps({ testID: "matcon-entregas-desligado" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "matcon-esteira-entregas" }).length).toBeGreaterThan(0);
    expect(texto).toContain("6 de 10 sc");
    expect(texto).toContain("Entrega parcial");
    expect(texto).toContain("Marcar como entregue");

    // Regra 7 do CLAUDE.md: as ações vivem no bloco de ações do card,
    // sempre renderizado — nunca atrás de hover.
    expect(tree.root.findAllByProps({ testID: "matcon-entrega-entrega-1-acoes" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "matcon-parcial-entrega-1" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "matcon-avancar-entrega-1" }).length).toBeGreaterThan(0);

    tree.unmount();
  });
});
