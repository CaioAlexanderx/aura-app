// ============================================================
// /fornecedores: erro ≠ vazio (25/09/2026).
//
// Porta de __tests__/components/ComprasMatconErro.test.tsx (QA 23/09: a
// antiga Compras dizia "Nada faltando hoje" quando era um 404). A regra
// continua, agora na tela de Fornecedores, com react-query de verdade:
//   - reposição falhou: aviso com "Tentar de novo", os fornecedores
//     continuam na tela, e UMA chamada só (sem retry por cima do client);
//   - fornecedores falharam: bloco de erro, nunca o convite "Cadastre
//     seus fornecedores";
//   - pedido montado e não enviado: "Continuar pedido" no cartão.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}), Redirect: () => null }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: () => null }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: { matcon_enabled: true }, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => new Set(["estoque", "matcon.compras"]) }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito Santa Rita" } }) }));
jest.mock("@/components/RequireCompanyScope", () => ({ RequireCompanyScope: ({ children }: any) => children }));

const mockSugestoes = jest.fn();
const mockPedidos = jest.fn();
const mockFornecedores = jest.fn();
jest.mock("@/services/matconApi", () => ({
  ...jest.requireActual("@/services/matconApi"),
  matconApi: {
    purchaseSuggestions: (...a: any[]) => mockSugestoes(...a),
    listPurchaseOrders: (...a: any[]) => mockPedidos(...a),
  },
}));
jest.mock("@/services/suppliersApi", () => ({ suppliersApi: { list: (...a: any[]) => mockFornecedores(...a) } }));

import FornecedoresRoute from "@/app/(tabs)/fornecedores";

const PEDIDOS_VAZIOS = { orders: [], summary: { draft: { count: 0, total: 0 }, sent: { count: 0, total: 0 }, received_7d: { count: 0, total: 0 } } };
const SUGESTOES_VAZIAS = { suggestions: [], summary: { total_est_cost: 0, items_below_min: 0, suppliers: 0 } };
const UM_FORNECEDOR = { suppliers: [{ id: "s1", company_id: "empresa-1", name: "Cimentos Ipê", cnpj: null, contact_name: null, phone: null, email: null, notes: null, is_active: true, product_count: 0 }], total: 1 };

const erro404 = () => Object.assign(new Error("Rota nao encontrada"), { status: 404, data: { error: "Rota nao encontrada" }, isNetworkError: false });
function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}
async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><FornecedoresRoute /></QueryClientProvider>);
  });
  return { tree, qc };
}
async function esperar(tree: renderer.ReactTestRenderer, testID: string) {
  for (let i = 0; i < 50; i++) {
    if (tree.root.findAllByProps({ testID }).length > 0) return;
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  }
  throw new Error("não apareceu: " + testID);
}

beforeEach(() => { mockSugestoes.mockReset(); mockPedidos.mockReset(); mockFornecedores.mockReset(); });

test("reposição falhou: aviso com 'Tentar de novo', fornecedores continuam, uma chamada só", async () => {
  mockFornecedores.mockResolvedValue(UM_FORNECEDOR);
  mockSugestoes.mockRejectedValue(erro404());
  mockPedidos.mockResolvedValue(PEDIDOS_VAZIOS);
  const { tree, qc } = await montar();
  await esperar(tree, "fornecedores-aviso-matcon");
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

  const texto = flatten(tree.toJSON());
  expect(texto).toContain("Não consegui carregar a reposição agora");
  expect(texto).toContain("Cimentos Ipê");
  expect(mockSugestoes).toHaveBeenCalledTimes(1);

  mockSugestoes.mockResolvedValue(SUGESTOES_VAZIAS);
  const botao = tree.root.findAllByProps({ testID: "fornecedores-aviso-matcon-tentar" }, { deep: false })[0];
  await act(async () => { botao.props.onPress(); });
  for (let i = 0; i < 50 && tree.root.findAllByProps({ testID: "fornecedores-aviso-matcon" }).length > 0; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  }
  expect(tree.root.findAllByProps({ testID: "fornecedores-aviso-matcon" }).length).toBe(0);

  tree.unmount();
  qc.clear();
});

test("fornecedores falharam: bloco de erro, nunca o convite de cadastrar o primeiro", async () => {
  mockFornecedores.mockRejectedValue(erro404());
  mockSugestoes.mockResolvedValue(SUGESTOES_VAZIAS);
  mockPedidos.mockResolvedValue(PEDIDOS_VAZIOS);
  const { tree, qc } = await montar();
  await esperar(tree, "fornecedores-erro");
  const texto = flatten(tree.toJSON());
  expect(texto).toContain("Não consegui carregar os fornecedores.");
  expect(texto).not.toContain("Cadastre seus fornecedores");
  expect(mockFornecedores).toHaveBeenCalledTimes(1);
  tree.unmount();
  qc.clear();
});

test("pedido montado e não enviado aparece com 'Continuar pedido'", async () => {
  mockFornecedores.mockResolvedValue(UM_FORNECEDOR);
  mockSugestoes.mockResolvedValue(SUGESTOES_VAZIAS);
  mockPedidos.mockResolvedValue({
    ...PEDIDOS_VAZIOS,
    orders: [{
      id: "po-1", number: "C-0042", status: "draft", supplier_name: "Cimentos Ipê", supplier_cnpj: null,
      items: [{ product_id: "p1", name: "Cimento", unit: "sc", quantity: 60, unit_cost_est: 32.9, received_qty: 0 }],
      total_est: 1974, created_at: "2026-09-23T10:00:00Z",
    }],
  });
  const { tree, qc } = await montar();
  await esperar(tree, "fornecedor-continuar-s1");
  expect(flatten(tree.toJSON())).toContain("Pedido #C-0042 montado, falta enviar");
  tree.unmount();
  qc.clear();
});
