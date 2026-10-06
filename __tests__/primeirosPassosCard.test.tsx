// ============================================================
// Primeiros passos da frente (05/10/2026) — cartão do Painel.
// react-query de verdade; API, auth, módulos visíveis e router mockados.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }), router: { push: jest.fn() } }));

let mockVisible = new Set<string>();
jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => mockVisible }));

let mockAuth: any = {};
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => (typeof sel === "function" ? sel(mockAuth) : mockAuth),
}));

const mockGet = jest.fn();
const mockDismiss = jest.fn();
jest.mock("@/services/primeirosPassosApi", () => ({
  ...jest.requireActual("@/services/primeirosPassosApi"),
  primeirosPassosApi: { get: (...a: any[]) => mockGet(...a), dismiss: (...a: any[]) => mockDismiss(...a) },
}));

import { PrimeirosPassosCard } from "@/components/onboarding/PrimeirosPassosCard";
import { usePendingTour } from "@/stores/pendingTour";

const TODOS = ["painel", "estoque", "pdv", "clientes", "configuracoes", "os", "onboarding.primeiros_passos",
  "otica.laboratorio", "otica.receitas", "otica.config"];

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}
const byId = (tree: renderer.ReactTestRenderer, id: string) => tree.root.findAllByProps({ testID: id }, { deep: false });

function setAuth(over: any = {}) {
  mockAuth = {
    token: "t",
    user: { name: "Marina Souza" },
    company: { id: "c1", segment: "varejo" },
    consolidatedView: false,
    refreshMe: jest.fn(() => Promise.resolve()),
    ...over,
  };
}

async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><PrimeirosPassosCard /></QueryClientProvider>);
  });
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

beforeEach(() => {
  mockVisible = new Set(TODOS);
  mockGet.mockReset(); mockDismiss.mockReset(); mockPush.mockReset();
  usePendingTour.getState().clear();
  setAuth();
});

describe("PrimeirosPassosCard", () => {
  it("varejo: boas-vindas, título da frente e os três passos, sem linha Pronto", async () => {
    mockGet.mockResolvedValue({ segment: "varejo", dismissed: false, steps: [
      { key: "produtos_cadastrados", done: false }, { key: "primeira_venda", done: false }, { key: "cliente_cadastrado", done: false },
    ] });
    const tree = await mount();
    const txt = flatten(tree.toJSON());
    expect(txt).toContain("Bem-vindo(a), Marina");
    expect(txt).toContain("Sua Aura já abre como loja.");
    expect(txt).toContain("Cadastre seus produtos");
    expect(txt).toContain("Faça a primeira venda");
    expect(txt).toContain("Cadastre um cliente");
    expect(txt).toContain("Pular e ir pro Painel");
    expect(byId(tree, "primeiros-passos-pronto")).toHaveLength(0);
    expect(mockGet).toHaveBeenCalledWith("c1");
    tree.unmount();
  });

  it("ótica: linha Pronto e passo feito com check e riscado", async () => {
    setAuth({ company: { id: "c2", segment: "otica" } });
    mockGet.mockResolvedValue({ segment: "otica", dismissed: false, steps: [
      { key: "laboratorio_cadastrado", done: true }, { key: "primeira_receita", done: false }, { key: "primeiro_pedido_de_lente", done: false },
    ] });
    const tree = await mount();
    const txt = flatten(tree.toJSON());
    expect(txt).toContain("Sua Aura já abre como ótica.");
    expect(txt).toContain("Laboratório e Receitas já estão no seu menu.");
    expect(txt).toContain("✓");
    const titulo = byId(tree, "primeiros-passos-laboratorio_cadastrado-titulo")[0];
    const estilo = [].concat(titulo.props.style).filter(Boolean);
    expect(estilo.some((st: any) => st && st.textDecorationLine === "line-through")).toBe(true);
    const aberto = byId(tree, "primeiros-passos-primeira_receita-titulo")[0];
    expect([].concat(aberto.props.style).filter(Boolean).some((st: any) => st && st.textDecorationLine === "line-through")).toBe(false);
    tree.unmount();
  });

  it("ótica sem Receitas no plano: o passo e a linha Pronto somem", async () => {
    mockVisible = new Set(TODOS.filter((m) => m !== "otica.receitas" && m !== "otica.laboratorio"));
    setAuth({ company: { id: "c2", segment: "otica" } });
    mockGet.mockResolvedValue({ segment: "otica", dismissed: false, steps: [
      { key: "laboratorio_cadastrado", done: false }, { key: "primeira_receita", done: false }, { key: "primeiro_pedido_de_lente", done: false },
    ] });
    const tree = await mount();
    const txt = flatten(tree.toJSON());
    expect(txt).toContain("Cadastre um laboratório parceiro");
    expect(txt).not.toContain("Lance a primeira receita");
    expect(txt).not.toContain("Pronto:");
    tree.unmount();
  });

  it("tocar num passo grava o tour pendente e navega para a tela alvo", async () => {
    mockGet.mockResolvedValue({ segment: "varejo", dismissed: false, steps: [{ key: "produtos_cadastrados", done: false }] });
    const tree = await mount();
    await act(async () => { byId(tree, "primeiros-passos-produtos_cadastrados")[0].props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/estoque");
    const p = usePendingTour.getState().pending!;
    expect(p.path).toBe("/estoque");
    expect(p.step.targetSelectors).toEqual(['[data-tour="estoque.novo_produto"]']);
    tree.unmount();
  });

  it("Pular chama o dismiss e o cartão some", async () => {
    mockGet.mockResolvedValue({ segment: "varejo", dismissed: false, steps: [{ key: "produtos_cadastrados", done: false }] });
    mockDismiss.mockResolvedValue({ dismissed: true, dismissed_at: "2026-10-05T12:00:00Z" });
    const tree = await mount();
    await act(async () => { byId(tree, "primeiros-passos-pular")[0].props.onPress(); });
    await act(async () => { await Promise.resolve(); });
    expect(mockDismiss).toHaveBeenCalledWith("c1");
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  it("não aparece quando dispensado ou com tudo feito", async () => {
    mockGet.mockResolvedValue({ segment: "varejo", dismissed: true, steps: [{ key: "produtos_cadastrados", done: false }] });
    let tree = await mount();
    expect(tree.toJSON()).toBeNull();
    tree.unmount();

    mockGet.mockResolvedValue({ segment: "varejo", dismissed: false, steps: [
      { key: "produtos_cadastrados", done: true }, { key: "primeira_venda", done: true }, { key: "cliente_cadastrado", done: true },
    ] });
    tree = await mount();
    expect(tree.toJSON()).toBeNull();
    tree.unmount();
  });

  it("não aparece na visão consolidada nem busca os passos", async () => {
    setAuth({ consolidatedView: true, company: null });
    const tree = await mount();
    expect(tree.toJSON()).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("conta antiga sem frente (segment NULL) e membro sem permissão não veem", async () => {
    setAuth({ company: { id: "c1", segment: null } });
    let tree = await mount();
    expect(tree.toJSON()).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
    tree.unmount();

    setAuth();
    mockVisible = new Set(TODOS.filter((m) => m !== "onboarding.primeiros_passos"));
    tree = await mount();
    expect(tree.toJSON()).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
    tree.unmount();
  });
});
