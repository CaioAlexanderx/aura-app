// ============================================================
// "Fazer a primeira venda" no Painel de conta nova (19/10/2026, card tq-32).
//
// Botão principal do estado vazio de conta nova. Aparece em conta sem venda,
// some depois da primeira venda (company.trial.started_by_sale_at, app#1065)
// e leva ao cadastro do primeiro produto + Caixa (sem produto) ou direto ao
// Caixa (com produto) — a mesma função do Continuar do check-in (tq-31).
// ============================================================
import fs from "fs";
import path from "path";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: (...a: any[]) => mockPush(...a), replace: jest.fn() }),
  router: { push: (...a: any[]) => mockPush(...a) },
}));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) { return typeof selector === "function" ? selector(mockAuth) : mockAuth; },
    { getState: () => mockAuth },
  ),
}));

let mockModulos: Set<string> = new Set();
jest.mock("@/hooks/useVisibleModules", () => {
  const real = jest.requireActual("@/hooks/useVisibleModules");
  return { ...real, useVisibleModules: () => mockModulos };
});

// Sem histórico: o estado vazio é o de conta nova.
let mockHistorico: any = { data: null, isLoading: false };
jest.mock("@/hooks/useFinancialComparative", () => ({ useFinancialComparative: () => mockHistorico }));

let mockTemProduto: boolean | null = false;
const mockGarantir = jest.fn();
jest.mock("@/hooks/useTemProduto", () => ({
  temProdutoQueryKey: (cid: any) => ["tem-produto", cid || null],
  useTemProduto: (_cid: any, enabled: boolean) => ({ data: enabled ? mockTemProduto : undefined }),
  garantirTemProduto: (...a: any[]) => mockGarantir(...a),
}));

import { DashboardEmptyState } from "@/components/screens/dashboard/DashboardEmptyState";
import { TEXTO_PRIMEIRA_VENDA } from "@/components/screens/dashboard/EmptyDashboard";
import { mostrarPrimeiraVenda } from "@/hooks/usePrimeiraVenda";

const SEM_VENDA = { mode: "primeira_venda", started_by_sale_at: null, aguardando_primeira_venda: true, dias_restantes: 14 };
const COM_VENDA = { mode: "primeira_venda", started_by_sale_at: "2026-10-18T15:00:00Z", aguardando_primeira_venda: false, dias_restantes: 7 };

function resetar() {
  mockPush.mockReset();
  mockGarantir.mockReset();
  mockGarantir.mockResolvedValue(false);
  mockTemProduto = false;
  mockHistorico = { data: null, isLoading: false };
  mockModulos = new Set(["painel", "pdv", "estoque", "financeiro", "clientes"]);
  mockAuth = {
    token: "t", isDemo: false, consolidatedView: false,
    company: { id: "loja-1", name: "Loja", plan: "essencial", trial: SEM_VENDA },
  };
}

async function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={client}>
        <DashboardEmptyState name="Lu" data={{}} onPress={jest.fn()} />
      </QueryClientProvider>,
    );
  });
  return tree;
}
const botao = (t: any) => t.root.findAll((n: any) => n.props && n.props.testID === "painel-primeira-venda", { deep: false });

describe("o botão no Painel de conta nova", () => {
  beforeEach(resetar);

  test("aparece em conta sem venda, como botão principal acima dos outros três", async () => {
    const tree = await montar();
    expect(botao(tree).length).toBeGreaterThan(0);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain(TEXTO_PRIMEIRA_VENDA);
    const iVenda = json.indexOf(TEXTO_PRIMEIRA_VENDA);
    ["Lançar receita", "Cadastrar produto", "Cadastrar cliente"].forEach((t) => {
      expect(json).toContain(t);
      expect(json.indexOf(t)).toBeGreaterThan(iVenda);
    });
    tree.unmount();
  });

  test("some depois da primeira venda; os outros três continuam", async () => {
    mockAuth.company.trial = COM_VENDA;
    const tree = await montar();
    expect(botao(tree).length).toBe(0);
    expect(JSON.stringify(tree.toJSON())).toContain("Cadastrar produto");
    tree.unmount();
  });

  test("sem produto: cadastro do primeiro produto e depois o Caixa", async () => {
    const tree = await montar();
    await act(async () => { await botao(tree)[0].props.onPress(); });
    await act(async () => { await Promise.resolve(); });
    expect(mockPush).toHaveBeenCalledWith("/estoque?novo=produto&depois=pdv");
    tree.unmount();
  });

  test("com produto: direto ao Caixa", async () => {
    mockTemProduto = true;
    const tree = await montar();
    await act(async () => { await botao(tree)[0].props.onPress(); });
    await act(async () => { await Promise.resolve(); });
    expect(mockPush).toHaveBeenCalledWith("/pdv");
    expect(mockGarantir).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("contagem ainda sem resposta: busca no toque e decide", async () => {
    mockTemProduto = null;
    mockGarantir.mockResolvedValue(true);
    const tree = await montar();
    await act(async () => { await botao(tree)[0].props.onPress(); });
    await act(async () => { await Promise.resolve(); });
    expect(mockGarantir).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/pdv");
    tree.unmount();
  });

  test("mês novo de conta com histórico: nem o estado de conta nova nem o botão", async () => {
    mockHistorico = { data: { previous: { totals: { income: 500, expenses: 0, net: 500 } } }, isLoading: false };
    const tree = await montar();
    expect(botao(tree).length).toBe(0);
    tree.unmount();
  });
});

describe("quando o botão aparece (regra pura)", () => {
  const base = { temEmpresa: true, consolidado: false, isDemo: false, caixaVisivel: true, trial: SEM_VENDA };

  test("sem venda: aparece; com venda: some", () => {
    expect(mostrarPrimeiraVenda(base)).toBe(true);
    expect(mostrarPrimeiraVenda({ ...base, trial: COM_VENDA })).toBe(false);
  });

  test("modo fixo ou sem bloco do trial: aparece (o estado vazio decide)", () => {
    expect(mostrarPrimeiraVenda({ ...base, trial: { mode: "fixo" } })).toBe(true);
    expect(mostrarPrimeiraVenda({ ...base, trial: undefined })).toBe(true);
  });

  test("consolidado, demo, sem empresa ou sem Caixa no plano: some", () => {
    expect(mostrarPrimeiraVenda({ ...base, consolidado: true })).toBe(false);
    expect(mostrarPrimeiraVenda({ ...base, isDemo: true })).toBe(false);
    expect(mostrarPrimeiraVenda({ ...base, temEmpresa: false })).toBe(false);
    expect(mostrarPrimeiraVenda({ ...base, caixaVisivel: false })).toBe(false);
  });
});

describe("fonte", () => {
  test("o destino é a mesma função do Continuar do check-in", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "hooks/usePrimeiraVenda.ts"), "utf8");
    expect(src).toContain('import { destinoDaPrimeiraVenda } from "@/utils/checkinDestino";');
    expect(src).toContain("vendeuNoTrial(lerTrial(args.trial))");
  });
});
