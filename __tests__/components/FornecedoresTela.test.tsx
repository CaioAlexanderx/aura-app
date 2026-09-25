// ============================================================
// /fornecedores (25/09/2026) — a antiga /matcon/compras virou parte
// desta tela, organizada por fornecedor.
//
// Herda o que __tests__/components/ComprasMatcon.test.tsx travava (frase
// da sugestão, "já pedido no C-0001", pedido novo só com o resto) e
// acrescenta:
//   · sem Matcon: só a lista/cadastro, nada de reposição;
//   · Matcon ligado sem o módulo no plano: idem;
//   · sugestão de fornecedor cadastrado casa pelo CNPJ (um cartão só);
//   · fornecedor que só existe na nota aparece com "Cadastrar";
//   · o pedido usa o WhatsApp do cadastro quando a nota não trouxe.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, Redirect: () => null }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: () => null }));
jest.mock("@/components/RequireCompanyScope", () => ({ RequireCompanyScope: ({ children }: any) => children }));

let mockPdvSettings: any = { matcon_enabled: false };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));
let mockModulos = new Set<string>(["estoque", "matcon.compras"]);
jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => mockModulos }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "GF Amorim" } }),
}));

let mockSuppliers: any = { suppliers: [], total: 0 };
let mockSuggestions: any = null;
let mockOrders: any = null;
jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey, enabled }: { queryKey: any[]; enabled?: boolean }) => {
    if (enabled === false) return { data: undefined, isLoading: false, isError: false };
    const data = queryKey[0] === "suppliers" ? mockSuppliers
      : queryKey[0] === "matcon-purchase-suggestions" ? mockSuggestions
      : queryKey[0] === "matcon-purchase-orders" ? mockOrders
      : undefined;
    return { data, isLoading: false, isError: false, refetch: jest.fn() };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

import FornecedoresRoute from "@/app/(tabs)/fornecedores";

const CNPJ = "11111111000111";
const CIMENTOS = {
  id: "sup-1", company_id: "empresa-1", name: "Cimentos Ipê Distribuidora", cnpj: CNPJ,
  contact_name: "Marcos", phone: "11940028922", email: null, notes: null, is_active: true, product_count: 12,
};
const SUGESTAO_CIMENTO = {
  product_id: "prod-cimento", name: "Cimento CP-II 50 kg", unit: "sc", stock: 12, min_stock: 40, weekly_sales: 18,
  suggested_qty: 60, est_cost: 1974, supplier_name: "Cimentos Ipe Distribuidora", supplier_cnpj: "11.111.111/0001-11",
  supplier_phone: null, days_to_stockout: null,
};
const SEM_PEDIDOS = { orders: [], summary: { draft: { count: 0, total: 0 }, sent: { count: 0, total: 0 }, received_7d: { count: 0, total: 0 } } };

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}
const porTestId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });

function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<FornecedoresRoute />); });
  return tree;
}

beforeEach(() => {
  mockPdvSettings = { matcon_enabled: false };
  mockModulos = new Set(["estoque", "matcon.compras"]);
  mockSuppliers = { suppliers: [], total: 0 };
  mockSuggestions = null;
  mockOrders = null;
});

describe("/fornecedores — sem Matcon", () => {
  test("sem nenhum fornecedor: convite para cadastrar o primeiro", () => {
    const t = montar();
    expect(porTestId(t, "fornecedores-vazio").length).toBe(1);
    expect(flatten(t.toJSON())).toContain("Cadastre seus fornecedores");
    expect(porTestId(t, "fornecedores-vazio-novo").length).toBe(1);
    t.unmount();
  });

  test("lista o cadastro com contato, sem nada de reposição", () => {
    mockSuppliers = { suppliers: [CIMENTOS], total: 1 };
    const t = montar();
    const texto = flatten(t.toJSON());
    expect(texto).toContain("Cimentos Ipê Distribuidora");
    expect(texto).toContain("Marcos · (11) 94002-8922 · 12 produtos");
    expect(porTestId(t, "fornecedor-whatsapp-sup-1").length).toBe(1);
    expect(porTestId(t, "fornecedor-montar-sup-1").length).toBe(0);
    t.unmount();
  });

  test("Matcon ligado mas fora do plano: continua sem reposição", () => {
    mockPdvSettings = { matcon_enabled: true };
    mockModulos = new Set(["estoque"]);
    mockSuppliers = { suppliers: [CIMENTOS], total: 1 };
    mockSuggestions = { suggestions: [SUGESTAO_CIMENTO], summary: { total_est_cost: 1974, items_below_min: 1, suppliers: 1 } };
    mockOrders = SEM_PEDIDOS;
    const t = montar();
    expect(flatten(t.toJSON())).not.toContain("sugerimos 60 sc");
    t.unmount();
  });
});

describe("/fornecedores — com Matcon", () => {
  beforeEach(() => { mockPdvSettings = { matcon_enabled: true }; mockOrders = SEM_PEDIDOS; });

  test("sugestão do fornecedor cadastrado casa pelo CNPJ: um cartão só, com a reposição", () => {
    mockSuppliers = { suppliers: [CIMENTOS], total: 1 };
    mockSuggestions = { suggestions: [SUGESTAO_CIMENTO], summary: { total_est_cost: 1974, items_below_min: 1, suppliers: 1 } };
    const t = montar();
    const texto = flatten(t.toJSON());
    expect(texto).toContain("tem 12 sc, mínimo 40, vende 18/semana → sugerimos 60 sc (~R$ 1.974)");
    expect(porTestId(t, "fornecedor-montar-sup-1").length).toBe(1);
    expect(texto).not.toContain("da nota, sem cadastro");
    expect(porTestId(t, "fornecedores-lista")[0].children.length).toBe(1);
    t.unmount();
  });

  test("fornecedor que só existe na nota aparece com Cadastrar", () => {
    mockSuggestions = { suggestions: [{ ...SUGESTAO_CIMENTO, supplier_name: "Tintas Sol", supplier_cnpj: "22222222000122" }], summary: { total_est_cost: 1974, items_below_min: 1, suppliers: 1 } };
    const t = montar();
    expect(flatten(t.toJSON())).toContain("da nota, sem cadastro");
    expect(porTestId(t, "fornecedor-cadastrar-nota:22222222000122").length).toBe(1);
    t.unmount();
  });

  test("item já pedido: a linha avisa e o pedido novo leva só o resto, com o WhatsApp do cadastro", async () => {
    const { request } = require("@/services/api");
    const ARGAMASSA = { ...SUGESTAO_CIMENTO, product_id: "prod-argamassa", name: "Argamassa AC-III 20 kg", suggested_qty: 80, est_cost: 1512 };
    mockSuppliers = { suppliers: [CIMENTOS], total: 1 };
    mockSuggestions = { suggestions: [SUGESTAO_CIMENTO, ARGAMASSA], summary: { total_est_cost: 3486, items_below_min: 2, suppliers: 1 } };
    mockOrders = {
      orders: [{
        id: "pedido-1", number: "C-0001", status: "sent", supplier_name: "Cimentos Ipê Distribuidora", supplier_cnpj: CNPJ,
        items: [{ product_id: "prod-cimento", name: "Cimento CP-II 50 kg", unit: "sc", quantity: 60, unit_cost_est: 32.9, received_qty: 0 }],
        total_est: 1974, sent_at: "2026-09-22T10:00:00Z", created_at: "2026-09-22T09:00:00Z",
      }],
      summary: { draft: { count: 0, total: 0 }, sent: { count: 1, total: 1974 }, received_7d: { count: 0, total: 0 } },
    };
    (request as jest.Mock).mockResolvedValue({ order: { id: "novo", number: "C-0002", status: "draft", items: [], total_est: 0, created_at: "" } });

    const t = montar();
    const texto = flatten(t.toJSON());
    expect(texto).toContain("já pedido no C-0001, chega em breve");
    expect(texto).toContain("sugerimos 80 sc");
    expect(texto).toContain("Pedido #C-0001 a caminho");

    const botao = porTestId(t, "fornecedor-montar-sup-1")[0];
    await act(async () => { botao.props.onPress(); });
    const chamada = (request as jest.Mock).mock.calls.find((c: any[]) => String(c[0]).endsWith("/matcon/purchase-orders") && c[1]?.method === "POST");
    expect(chamada).toBeTruthy();
    expect(chamada[1].body.items).toEqual([{ product_id: "prod-argamassa", quantity: 80 }]);
    expect(chamada[1].body.supplier_phone).toBe("11940028922");
    expect(chamada[1].body.supplier_name).toBe("Cimentos Ipê Distribuidora");
    t.unmount();
  });
});
