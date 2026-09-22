// ============================================================
// Matcon M4 — /matcon/compras (22/09/2026).
//
// Mesmo padrão de mocks de __tests__/components/EntregasMatcon.test.tsx
// (usePdvSettings + useAuthStore + @tanstack/react-query sem rede): a tela
// lê o toggle do PDV, a empresa ativa e as sugestões/pedidos de compra —
// nada disso precisa de network real neste teste.
//
// Cobre:
//   - toggle OFF: a tela é só o recado curto "ligue Materiais de
//     construção", sem esteira (mesmo contrato das outras duas telas).
//   - toggle ON com 1 sugestão: o card mostra o fornecedor, a frase da
//     sugestão e os dois botões sempre visíveis ("Ver itens" e "Montar
//     pedido" — regra 7 do CLAUDE.md, sem hover).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));

// pdv_settings controlável por teste — mesmo padrão de EntregasMatcon.test.tsx.
let mockPdvSettings: any = { matcon_enabled: false };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));

jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito Santa Rita" } }),
}));

// react-query: entrega o resultado das duas queries sem rede (padrão de
// __tests__/ordemDeServico.test.tsx). A tela faz duas useQuery — uma para
// sugestões, outra para pedidos — nesta ordem.
let mockSuggestions: any = { suggestions: [], summary: { total_est_cost: 0, items_below_min: 0, suppliers: 0 } };
let mockOrders: any = { orders: [], summary: { draft: { count: 0, total: 0 }, sent: { count: 0, total: 0 }, received_7d: { count: 0, total: 0 } } };
jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: any[] }) =>
    queryKey[0] === "matcon-purchase-suggestions"
      ? { data: mockSuggestions, isLoading: false, isFetching: false }
      : { data: mockOrders, isLoading: false, isFetching: false },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock("@/components/RequireCompanyScope", () => ({
  RequireCompanyScope: ({ children }: any) => children,
}));

import MatconComprasRoute from "@/app/(tabs)/matcon/compras";

const SUGESTAO_CIMENTO = {
  product_id: "prod-cimento",
  name: "Cimento CP-II 50 kg",
  unit: "sc",
  stock: 12,
  min_stock: 40,
  weekly_sales: 18,
  suggested_qty: 60,
  est_cost: 1974,
  supplier_name: "Cimentos Ipê Distribuidora",
  supplier_cnpj: "11.111.111/0001-11",
  supplier_phone: "(11) 4002-8922",
  days_to_stockout: null,
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
  act(() => { tree = renderer.create(<MatconComprasRoute />); });
  return tree;
}

describe("/matcon/compras — toggle desligado", () => {
  test("mostra o recado para ligar Materiais de construção, sem esteira", () => {
    mockPdvSettings = { matcon_enabled: false };
    const tree = montar();
    const texto = flatten(tree.toJSON());

    expect(tree.root.findAllByProps({ testID: "matcon-compras-desligado" }).length).toBeGreaterThan(0);
    expect(texto).toContain("Ligue");
    expect(texto).toContain("Materiais de construção");
    expect(tree.root.findAllByProps({ testID: "matcon-esteira-compras" }).length).toBe(0);

    tree.unmount();
  });
});

describe("/matcon/compras — toggle ligado, 1 sugestão", () => {
  test("mostra o fornecedor, a frase da sugestão e os dois botões", () => {
    mockPdvSettings = { matcon_enabled: true };
    mockSuggestions = {
      suggestions: [SUGESTAO_CIMENTO],
      summary: { total_est_cost: 1974, items_below_min: 1, suppliers: 1 },
    };
    mockOrders = {
      orders: [],
      summary: { draft: { count: 0, total: 0 }, sent: { count: 0, total: 0 }, received_7d: { count: 0, total: 0 } },
    };

    const tree = montar();
    const texto = flatten(tree.toJSON());

    expect(tree.root.findAllByProps({ testID: "matcon-compras-desligado" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "matcon-esteira-compras" }).length).toBeGreaterThan(0);

    expect(texto).toContain("Cimentos Ipê Distribuidora");
    expect(texto).toContain("tem 12 sc, mínimo 40, vende 18/semana → sugerimos 60 sc (~R$ 1.974)");

    // Regra 7 do CLAUDE.md: as ações vivem no bloco de ações do card,
    // sempre renderizado — nunca atrás de hover.
    const key = SUGESTAO_CIMENTO.supplier_cnpj;
    expect(tree.root.findAllByProps({ testID: `matcon-montar-pedido-${key}` }).length).toBeGreaterThan(0);
    expect(texto).toContain("Montar pedido");
    // Um único item no fornecedor: nada oculto, então "Ver itens" nem aparece.
    expect(tree.root.findAllByProps({ testID: `matcon-ver-itens-${key}` }).length).toBe(0);

    tree.unmount();
  });

  test("mais de 2 itens do fornecedor: 'Ver itens' aparece e expande as linhas ocultas", () => {
    mockPdvSettings = { matcon_enabled: true };
    mockSuggestions = {
      suggestions: [
        SUGESTAO_CIMENTO,
        { ...SUGESTAO_CIMENTO, product_id: "prod-2", name: "Argamassa AC-III 20 kg", est_cost: 1512 },
        { ...SUGESTAO_CIMENTO, product_id: "prod-3", name: "Cal hidratada CH-III 20 kg", est_cost: 390 },
      ],
      summary: { total_est_cost: 3876, items_below_min: 3, suppliers: 1 },
    };
    mockOrders = {
      orders: [],
      summary: { draft: { count: 0, total: 0 }, sent: { count: 0, total: 0 }, received_7d: { count: 0, total: 0 } },
    };

    const tree = montar();
    let texto = flatten(tree.toJSON());
    const key = SUGESTAO_CIMENTO.supplier_cnpj;

    expect(texto).toContain("mais 1 item deste fornecedor");
    expect(texto).not.toContain("Cal hidratada CH-III 20 kg");

    act(() => {
      tree.root.findByProps({ testID: `matcon-ver-itens-${key}` }).props.onPress();
    });
    texto = flatten(tree.toJSON());
    expect(texto).toContain("Cal hidratada CH-III 20 kg");

    tree.unmount();
  });
});
