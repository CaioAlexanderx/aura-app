// ============================================================
// /matcon/entregas — aba "A entregar" (QA 23/09/2026, backend no ar).
//
// A 1ª entrega nasce para daqui a 2 dias (prazo padrão) e não aparecia em
// nenhuma aba: o cabeçalho dizia "1 separando" e a lista "Nenhuma entrega
// hoje". Cobre:
//   - a aba padrão (e primeira) é "A entregar", que pede `day=pending` e
//     mostra a entrega de daqui a 2 dias;
//   - Hoje vazio diz quantas entregas estão marcadas para os próximos dias
//     e o botão volta para "A entregar";
//   - `?dia=pending` (selo do detalhe da venda) cai em "A entregar".
// Mesmo padrão de mocks de EntregasMatcon.test.tsx, com o useQuery
// respondendo pela chave (o 3º elemento é o filtro de dia).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
let mockParams: any = {};
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));

jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: { matcon_enabled: true }, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito Santa Rita" } }),
}));

// A resposta depende do dia pedido: "pending" tem a entrega nova; os
// outros filtros voltam vazios (a entrega é para daqui a 2 dias).
let mockPorDia: Record<string, any> = {};
const mockChaves: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: any) => {
    mockChaves.push({ key: opts.queryKey, enabled: opts.enabled });
    const dia = opts.queryKey[2];
    return { data: opts.enabled === false ? undefined : mockPorDia[dia], isLoading: false, isFetching: false };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock("@/components/RequireCompanyScope", () => ({
  RequireCompanyScope: ({ children }: any) => children,
}));
jest.mock("@/components/matcon/EmitirNfeEntregaSheet", () => ({ EmitirNfeEntregaSheet: () => null }));

import MatconEntregasRoute from "@/app/(tabs)/matcon/entregas";

function isoDaquiA(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

const ENTREGA_NOVA = {
  id: "entrega-nova",
  sale_id: "venda-1",
  sale_number: 1,
  sequence: 1,
  stage: "separating",
  scheduled_for: isoDaquiA(2),
  delivered_by: null,
  customer_name: "Marlene Souza",
  total: 979.9,
  has_pending: true,
  public_token: "tok",
  items: [{ sale_item_id: "i1", product_id: "p1", unit_price: 890, name: "Tijolo baiano", unit: "mlh", quantity: 1, sold_quantity: 1, delivered_before: 0 }],
  created_at: "2026-09-23T12:00:00Z",
};

const RESUMO = {
  separating: { count: 1, total: 979.9 },
  ready: { count: 0, total: 0 },
  out: { count: 0, total: 0 },
  delivered_today: { count: 0, total: 0 },
  pending_orders: 1,
};

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}

function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}

beforeEach(() => {
  mockParams = {};
  mockChaves.length = 0;
  mockPorDia = {
    pending: { deliveries: [ENTREGA_NOVA], summary: RESUMO },
    today: { deliveries: [], summary: RESUMO },
    tomorrow: { deliveries: [], summary: RESUMO },
    late: { deliveries: [], summary: RESUMO },
  };
});

describe("/matcon/entregas — A entregar", () => {
  test("abre em 'A entregar' (1º chip), pede day=pending e mostra a entrega de daqui a 2 dias", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<MatconEntregasRoute />); });

    // Primeira chamada da tela: o filtro de dia é "pending".
    expect(mockChaves[0].key[2]).toBe("pending");

    const chips = tree.root.findAll((n) => typeof n.props?.testID === "string" && n.props.testID.startsWith("matcon-chip-"), { deep: false });
    expect(chips[0].props.testID).toBe("matcon-chip-pending");
    expect(flatten(chips[0].children)).toBe("A entregar");

    expect(porTestID(tree, "matcon-entrega-entrega-nova").length).toBeGreaterThan(0);
    expect(porTestID(tree, "matcon-entregas-vazio").length).toBe(0);
    const texto = flatten(tree.toJSON());
    expect(texto).not.toContain("Nenhuma entrega hoje");
    expect(texto).toContain("1 pedido a entregar");
    tree.unmount();
  });

  test("Hoje vazio conta as entregas dos próximos dias e volta para 'A entregar'", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<MatconEntregasRoute />); });
    act(() => { porTestID(tree, "matcon-chip-today")[0].props.onPress(); });

    const vazio = porTestID(tree, "matcon-entregas-vazio");
    expect(vazio.length).toBeGreaterThan(0);
    const texto = flatten(vazio[0].children);
    expect(texto).toContain("Nenhuma entrega hoje.");
    expect(texto).toContain("1 entrega marcada");
    expect(texto).toContain("próximos dias");

    act(() => { porTestID(tree, "matcon-vazio-ir-a-entregar")[0].props.onPress(); });
    expect(porTestID(tree, "matcon-entrega-entrega-nova").length).toBeGreaterThan(0);
    tree.unmount();
  });

  test("?dia=pending (selo do detalhe da venda) abre em 'A entregar'", () => {
    mockParams = { dia: "pending" };
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<MatconEntregasRoute />); });
    expect(mockChaves[0].key[2]).toBe("pending");
    tree.unmount();
  });
});
