// ============================================================
// Matcon M4 — /matcon/compras: erro ≠ vazio (QA 23/09/2026).
//
// Em produção a tela dizia "Nada faltando hoje" com 23 alertas de estoque
// baixo: era o 404 das sugestões tratado como lista vazia. react-query de
// verdade + matconApi mockado:
//   - sugestões falharam: "Não consegui ver o que falta comprar." com
//     "Tentar de novo" — nunca "Nada faltando hoje"; uma chamada só.
//   - lista vazia de verdade: "Nada faltando hoje." explicando de onde vem
//     a sugestão (estoque mínimo, vendas dos últimos 30 dias).
//   - pedidos falharam: o erro aparece em "Pedido enviado".
//   - pedido montado e não enviado (draft): "Continuar pedido" no topo.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));

jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: { matcon_enabled: true }, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito Santa Rita" } }),
}));
jest.mock("@/components/RequireCompanyScope", () => ({
  RequireCompanyScope: ({ children }: any) => children,
}));

const mockSugestoes = jest.fn();
const mockPedidos = jest.fn();
jest.mock("@/services/matconApi", () => ({
  ...jest.requireActual("@/services/matconApi"),
  matconApi: {
    purchaseSuggestions: (...a: any[]) => mockSugestoes(...a),
    listPurchaseOrders: (...a: any[]) => mockPedidos(...a),
  },
}));

import MatconComprasRoute from "@/app/(tabs)/matcon/compras";

const PEDIDOS_VAZIOS = { orders: [], summary: { draft: { count: 0, total: 0 }, sent: { count: 0, total: 0 }, received_7d: { count: 0, total: 0 } } };
const SUGESTOES_VAZIAS = { suggestions: [], summary: { total_est_cost: 0, items_below_min: 0, suppliers: 0 } };

function erro404() {
  return Object.assign(new Error("Rota nao encontrada"), { status: 404, data: { error: "Rota nao encontrada" }, isNetworkError: false });
}
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
    tree = renderer.create(<QueryClientProvider client={qc}><MatconComprasRoute /></QueryClientProvider>);
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

beforeEach(() => { mockSugestoes.mockReset(); mockPedidos.mockReset(); });

test("sugestões falharam: erro com 'Tentar de novo', nunca 'Nada faltando hoje'", async () => {
  mockSugestoes.mockRejectedValue(erro404());
  mockPedidos.mockResolvedValue(PEDIDOS_VAZIOS);
  const { tree, qc } = await montar();
  await esperar(tree, "matcon-compras-erro-sugestao");
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

  const texto = flatten(tree.toJSON());
  expect(texto).toContain("Não consegui ver o que falta comprar.");
  expect(texto).toContain("Tentar de novo");
  expect(texto).not.toContain("Nada faltando hoje");
  expect(texto).not.toContain("Carregando…");
  expect(mockSugestoes).toHaveBeenCalledTimes(1);

  // Tentar de novo → lista vazia de verdade.
  mockSugestoes.mockResolvedValue(SUGESTOES_VAZIAS);
  const botao = tree.root.findAllByProps({ testID: "matcon-compras-erro-sugestao-tentar" }, { deep: false })[0];
  await act(async () => { botao.props.onPress(); });
  await esperar(tree, "matcon-compras-vazio");
  const depois = flatten(tree.toJSON());
  expect(depois).toContain("Nada faltando hoje.");
  expect(depois).toContain("abaixo do mínimo");
  expect(depois).toContain("últimos 30 dias");

  tree.unmount();
  qc.clear();
});

test("pedidos falharam: o erro aparece em 'Pedido enviado'", async () => {
  mockSugestoes.mockResolvedValue(SUGESTOES_VAZIAS);
  mockPedidos.mockRejectedValue(erro404());
  const { tree, qc } = await montar();
  await esperar(tree, "matcon-compras-vazio");

  const estacao = tree.root.findAllByProps({ testID: "matcon-estacao-enviado" }, { deep: false })[0];
  await act(async () => { estacao.props.onPress(); });
  await esperar(tree, "matcon-compras-erro-pedidos");
  const texto = flatten(tree.toJSON());
  expect(texto).toContain("Não consegui carregar os pedidos de compra.");
  expect(texto).not.toContain("Nenhum pedido enviado");

  tree.unmount();
  qc.clear();
});

test("pedido montado e não enviado aparece com 'Continuar pedido'", async () => {
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
  await esperar(tree, "matcon-pedido-rascunho-po-1");
  expect(flatten(tree.toJSON())).toContain("Continuar pedido");
  expect(tree.root.findAllByProps({ testID: "matcon-continuar-pedido-po-1" }).length).toBeGreaterThan(0);

  tree.unmount();
  qc.clear();
});
