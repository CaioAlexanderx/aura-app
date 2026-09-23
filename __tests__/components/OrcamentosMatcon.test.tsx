// ============================================================
// Matcon M1 — /matcon/orcamentos: carregando, erro e vazio (QA 23/09/2026).
//
// react-query DE VERDADE (QueryClientProvider) com matconApi mockado — o
// que se testa aqui é justamente o estado da query:
//   - a chamada falhou (404 "Rota nao encontrada", como em produção em
//     23/09): bloco "Não consegui carregar os orçamentos." com "Tentar de
//     novo"; nada de "Nenhum orçamento ainda", nada de "Carregando…" preso;
//     UMA chamada só (o QueryClient do teste pede 3 tentativas — a tela
//     tem de desligar isso).
//   - "Tentar de novo" chama de novo e, com a lista vazia, mostra o vazio
//     verdadeiro, que nomeia o botão real do Caixa: "Orçamento".
//   - orçamento vencido (`expired`): "Refazer com preço de hoje", sem
//     "Virar pedido" (contrato: vencido ≠ perdido).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/utils/whatsapp", () => ({ openWhatsApp: jest.fn(() => true) }));

let mockPdvSettings: any = { matcon_enabled: true };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Depósito Santa Rita" } }),
}));
jest.mock("@/components/RequireCompanyScope", () => ({
  RequireCompanyScope: ({ children }: any) => children,
}));

const mockListQuotes = jest.fn();
jest.mock("@/services/matconApi", () => ({
  ...jest.requireActual("@/services/matconApi"),
  matconApi: { listQuotes: (...a: any[]) => mockListQuotes(...a) },
}));

import MatconOrcamentosRoute from "@/app/(tabs)/matcon/orcamentos";

const RESUMO_ZERO = {
  open: { count: 0, total: 0 }, expiring: { count: 0, total: 0 },
  approved: { count: 0, total: 0 }, lost: { count: 0, total: 0 },
};

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
  // retry: 3 de propósito — é o padrão do app (app/_layout.tsx usa o
  // QueryClient sem opções). A tela tem de desligar.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}><MatconOrcamentosRoute /></QueryClientProvider>,
    );
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

beforeEach(() => { mockListQuotes.mockReset(); mockPdvSettings = { matcon_enabled: true }; });

describe("/matcon/orcamentos — a chamada falhou", () => {
  test("mostra o erro com 'Tentar de novo', uma chamada só, e nunca o vazio", async () => {
    mockListQuotes.mockRejectedValue(erro404());
    const { tree, qc } = await montar();
    await esperar(tree, "matcon-orcamentos-erro");
    // Dá tempo a qualquer nova tentativa escondida.
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

    const texto = flatten(tree.toJSON());
    expect(texto).toContain("Não consegui carregar os orçamentos.");
    expect(texto).toContain("Tentar de novo");
    expect(texto).not.toContain("Nenhum orçamento ainda");
    expect(texto).not.toContain("Carregando…");
    expect(texto).not.toContain("Rota nao encontrada");
    expect(mockListQuotes).toHaveBeenCalledTimes(1);

    tree.unmount();
    qc.clear();
  });

  test("'Tentar de novo' chama de novo; com a lista vazia, o vazio fala do botão 'Orçamento'", async () => {
    mockListQuotes
      .mockRejectedValueOnce(erro404())
      .mockResolvedValue({ quotes: [], summary: RESUMO_ZERO });
    const { tree, qc } = await montar();
    await esperar(tree, "matcon-orcamentos-erro");

    const botao = tree.root.findAllByProps({ testID: "matcon-orcamentos-erro-tentar" }, { deep: false })[0];
    await act(async () => { botao.props.onPress(); });
    await esperar(tree, "matcon-orcamentos-vazio");

    const texto = flatten(tree.toJSON());
    expect(mockListQuotes).toHaveBeenCalledTimes(2);
    expect(texto).toContain("Nenhum orçamento ainda.");
    expect(texto).toContain("toque em Orçamento");
    expect(texto).not.toContain("Salvar orçamento");
    expect(texto).not.toContain("Não consegui carregar");
    // Com o resumo, o subtítulo deixa de dizer "Carregando…".
    expect(texto).not.toContain("Carregando…");

    tree.unmount();
    qc.clear();
  });
});

describe("/matcon/orcamentos — orçamento vencido", () => {
  test("vencido mostra 'Refazer com preço de hoje' e não 'Virar pedido'", async () => {
    mockListQuotes.mockResolvedValue({
      quotes: [{
        id: "q1", number: 7, status: "expired", customer_id: null, customer_name: "Seu Nivaldo",
        valid_until: "2020-01-01", public_token: "t", items: [], subtotal: 100, discount: 0, total: 100,
        created_at: "2019-12-20T10:00:00Z",
      }],
      summary: RESUMO_ZERO,
    });
    const { tree, qc } = await montar();
    await esperar(tree, "matcon-lista-orcamentos");

    expect(tree.root.findAllByProps({ testID: "matcon-refazer-7" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "matcon-converter-7" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "matcon-whats-7" }).length).toBe(0);

    tree.unmount();
    qc.clear();
  });
});
