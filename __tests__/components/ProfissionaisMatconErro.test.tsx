// ============================================================
// Matcon M3 — /matcon/profissionais: erro ≠ vazio (QA 23/09/2026).
//
// react-query de verdade + matconApi mockado:
//   - a chamada falhou: "Não consegui carregar os profissionais
//     parceiros." com "Tentar de novo", uma chamada só, nunca "Nenhum
//     parceiro ainda".
//   - vazio de verdade: nomeia o botão exato da ficha ("Marcar como
//     parceiro") e leva até Clientes.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/utils/whatsapp", () => ({ openWhatsApp: jest.fn(() => true) }));

jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: { matcon_enabled: true, matcon_club_enabled: true }, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito Santa Rita" } }),
}));
jest.mock("@/components/RequireCompanyScope", () => ({
  RequireCompanyScope: ({ children }: any) => children,
}));

const mockListProfessionals = jest.fn();
jest.mock("@/services/matconApi", () => ({
  ...jest.requireActual("@/services/matconApi"),
  matconApi: { listProfessionals: (...a: any[]) => mockListProfessionals(...a) },
}));

import { router } from "expo-router";
import MatconProfissionaisRoute from "@/app/(tabs)/matcon/profissionais";

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
    tree = renderer.create(<QueryClientProvider client={qc}><MatconProfissionaisRoute /></QueryClientProvider>);
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

beforeEach(() => { mockListProfessionals.mockReset(); (router.push as jest.Mock).mockClear(); });

test("a chamada falhou: erro com 'Tentar de novo'; depois, o vazio de verdade", async () => {
  mockListProfessionals.mockRejectedValue(erro404());
  const { tree, qc } = await montar();
  await esperar(tree, "matcon-profissionais-erro");
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

  const texto = flatten(tree.toJSON());
  expect(texto).toContain("Não consegui carregar os profissionais parceiros.");
  expect(texto).toContain("Tentar de novo");
  expect(texto).not.toContain("Nenhum parceiro ainda");
  expect(texto).not.toContain("Carregando…");
  expect(texto).not.toContain("Rota nao encontrada");
  expect(mockListProfessionals).toHaveBeenCalledTimes(1);

  mockListProfessionals.mockResolvedValue({ professionals: [], summary: { referred_total_month: 0, active_count: 0, pending_redeems: 0 } });
  const botao = tree.root.findAllByProps({ testID: "matcon-profissionais-erro-tentar" }, { deep: false })[0];
  await act(async () => { botao.props.onPress(); });
  await esperar(tree, "matcon-profissionais-vazio");

  const depois = flatten(tree.toJSON());
  expect(depois).toContain("Nenhum parceiro ainda.");
  expect(depois).toContain("Marcar como parceiro");
  // A estação de dinheiro mostra o valor, não um "–" eterno.
  expect(depois).toContain("R$ 0");

  const irClientes = tree.root.findAllByProps({ testID: "matcon-prof-vazio-ir-clientes" }, { deep: false })[0];
  act(() => { irClientes.props.onPress(); });
  expect(router.push).toHaveBeenCalledWith("/clientes");

  tree.unmount();
  qc.clear();
});
