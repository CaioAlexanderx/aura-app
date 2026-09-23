// ============================================================
// Matcon M1 — /matcon/entregas: erro ≠ vazio (QA 23/09/2026).
//
// react-query de verdade + matconApi mockado:
//   - a chamada falhou: "Não consegui carregar as entregas." com "Tentar
//     de novo", uma chamada só, nunca "Nenhuma entrega hoje".
//   - vazio de verdade: explica que a entrega nasce da venda (orçamento
//     que virou pedido, ou "Criar entrega" no detalhe da venda).
//   - `?dia=pending` abre em "A entregar" (link do detalhe da
//     venda).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
let mockParams: any = {};
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => mockParams }));
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

const mockListDeliveries = jest.fn();
jest.mock("@/services/matconApi", () => ({
  ...jest.requireActual("@/services/matconApi"),
  matconApi: { listDeliveries: (...a: any[]) => mockListDeliveries(...a) },
}));

import MatconEntregasRoute from "@/app/(tabs)/matcon/entregas";

const RESUMO_ZERO = {
  separating: { count: 0, total: 0 }, ready: { count: 0, total: 0 }, out: { count: 0, total: 0 },
  delivered_today: { count: 0, total: 0 }, pending_orders: 0,
};

function erroDeRede() {
  return Object.assign(new Error("Erro de conexão. Verifique sua internet."), { status: 0, isNetworkError: true, code: "network" });
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
    tree = renderer.create(<QueryClientProvider client={qc}><MatconEntregasRoute /></QueryClientProvider>);
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

beforeEach(() => { mockListDeliveries.mockReset(); mockParams = {}; });

test("sem internet: erro que manda conferir a conexão, com 'Tentar de novo'", async () => {
  mockListDeliveries.mockRejectedValue(erroDeRede());
  const { tree, qc } = await montar();
  await esperar(tree, "matcon-entregas-erro");
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

  const texto = flatten(tree.toJSON());
  expect(texto).toContain("Não consegui carregar as entregas.");
  expect(texto).toContain("internet");
  expect(texto).toContain("Tentar de novo");
  expect(texto).not.toContain("Nenhuma entrega hoje");
  expect(texto).not.toContain("Carregando…");
  expect(mockListDeliveries).toHaveBeenCalledTimes(1);

  mockListDeliveries.mockResolvedValue({ deliveries: [], summary: RESUMO_ZERO });
  const botao = tree.root.findAllByProps({ testID: "matcon-entregas-erro-tentar" }, { deep: false })[0];
  await act(async () => { botao.props.onPress(); });
  await esperar(tree, "matcon-entregas-vazio");
  const depois = flatten(tree.toJSON());
  // Aba padrão desde o QA de 23/09 (backend no ar): "A entregar".
  expect(depois).toContain("Nada para entregar.");
  expect(depois).toContain("orçamento");
  expect(depois).toContain("Criar entrega");

  tree.unmount();
  qc.clear();
});

test("?dia=pending abre em 'A entregar'", async () => {
  mockParams = { dia: "pending" };
  mockListDeliveries.mockResolvedValue({ deliveries: [], summary: RESUMO_ZERO });
  const { tree, qc } = await montar();
  await esperar(tree, "matcon-entregas-vazio");
  expect(mockListDeliveries.mock.calls[0][1]).toMatchObject({ day: "pending" });
  expect(flatten(tree.toJSON())).toContain("Nada para entregar.");

  tree.unmount();
  qc.clear();
});
