// Gestão Aura › Ferramentas: SLA, Consultorias e Pipeline de onboarding saíram
// da tela de Operações e ficam num grupo recolhido do hub (13/10/2026).
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));
jest.mock("@/components/HoverCard", () => ({ HoverCard: "HoverCard" }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ token: "t", isStaff: true, isDemo: false }),
}));

const mockPush = jest.fn();
let mockParams: any = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

import GestaoAuraScreen from "@/app/(tabs)/gestao-aura";
import GestaoAuraOperacoesScreen from "@/app/(tabs)/gestao-aura-operacoes";
import { OperacoesAdmin } from "@/components/admin/OperacoesAdmin";
import {
  FERRAMENTAS, FERRAMENTAS_STORAGE_KEY, ferramentaRoute, loadFerramentasAberto, saveFerramentasAberto,
} from "@/components/admin/ferramentas";

const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());
const byId = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAllByProps({ testID: id }, { deep: false });

async function mount(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
  });
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

const paths = () => mockRequest.mock.calls.map((c) => c[0]);

const OVERVIEW = {
  clients: { total: 20, paying: 8, trial: 3, overdue: 1, new_this_month: 4 },
  mrr: { total: 2400, growth_pct: 5 }, churn: { rate_pct: 1 }, margin: { pct: 70 },
};
const LEADS = { total: 5, contacted_total: 2, converted_total: 1, overdue: 0, with_phone: 4 };
const SLA = { total_tickets: 2, open: 1, in_progress: 0, resolved: 1, avg_first_response_hours: 1, avg_resolution_hours: 5, sla_met: true };
const CONSULT_VAZIA = { total: 0, total_hours: 0, total_revenue: 0, consultations: [] };
const PIPELINE = {
  total: 10,
  stages: [{ key: "cadastro", label: "Cadastrado", count: 10, clients: [{ id: "1", name: "Loja A" }] }],
};
const RESPOSTAS: Record<string, any> = {
  "/admin/metrics/overview": OVERVIEW,
  "/admin/leads/stats": LEADS,
  "/admin/metrics/sla": SLA,
  "/admin/consultations": CONSULT_VAZIA,
  "/admin/onboarding/pipeline": PIPELINE,
  "/admin/team": { team: [] },
};

beforeEach(() => {
  mockPush.mockReset();
  mockRequest.mockReset();
  mockRequest.mockImplementation((p: string) => Promise.resolve(RESPOSTAS[p] || {}));
  mockParams = {};
  window.localStorage.clear();
});

describe("Ferramentas no hub da Gestão Aura", () => {
  it("aparece recolhida, no fim da lista, sem mostrar os cartões", async () => {
    const tree = await mount(<GestaoAuraScreen />);
    expect(byId(tree, "ferramentas-toggle")).toHaveLength(1);
    expect(byId(tree, "ferramentas-lista")).toHaveLength(0);
    for (const f of FERRAMENTAS) expect(byId(tree, "ferramenta-card-" + f.key)).toHaveLength(0);
    const out = text(tree);
    expect(out).toContain("Ferramentas");
    expect(out).toContain("3 telas escondidas");
    // o grupo é o último bloco do hub, depois da grade de seções
    expect(out.indexOf("Aura Notas")).toBeLessThan(out.indexOf("Ferramentas"));
    expect(byId(tree, "ferramentas-toggle")[0].props.accessibilityState).toEqual({ expanded: false });
    tree.unmount();
  });

  it("um toque abre e mostra os 3 cartões, cada um com o porquê", async () => {
    const tree = await mount(<GestaoAuraScreen />);
    await act(async () => { byId(tree, "ferramentas-toggle")[0].props.onPress(); });
    expect(byId(tree, "ferramentas-lista")).toHaveLength(1);
    expect(FERRAMENTAS.map((f) => f.key)).toEqual(["sla", "consultorias", "pipeline"]);
    for (const f of FERRAMENTAS) expect(byId(tree, "ferramenta-card-" + f.key)).toHaveLength(1);
    const out = text(tree);
    expect(out).toContain("SLA de suporte");
    expect(out).toContain("Consultorias");
    expect(out).toContain("Pipeline de onboarding");
    expect(out).toContain("O suporte acontece no WhatsApp");
    expect(byId(tree, "ferramentas-toggle")[0].props.accessibilityState).toEqual({ expanded: true });
    tree.unmount();
  });

  it("cada cartão abre a tela de Operações já na ferramenta certa", async () => {
    const tree = await mount(<GestaoAuraScreen />);
    await act(async () => { byId(tree, "ferramentas-toggle")[0].props.onPress(); });
    await act(async () => { byId(tree, "ferramenta-card-sla")[0].props.onPress(); });
    await act(async () => { byId(tree, "ferramenta-card-pipeline")[0].props.onPress(); });
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual([
      "/gestao-aura-operacoes?ferramenta=sla",
      "/gestao-aura-operacoes?ferramenta=pipeline",
    ]);
    expect(ferramentaRoute("consultorias")).toBe("/gestao-aura-operacoes?ferramenta=consultorias");
    tree.unmount();
  });

  it("lembra o estado no dispositivo: abre, fecha, e um novo mount respeita", async () => {
    let tree = await mount(<GestaoAuraScreen />);
    await act(async () => { byId(tree, "ferramentas-toggle")[0].props.onPress(); });
    expect(window.localStorage.getItem(FERRAMENTAS_STORAGE_KEY)).toBe("1");
    tree.unmount();

    tree = await mount(<GestaoAuraScreen />);
    expect(byId(tree, "ferramentas-lista")).toHaveLength(1);
    await act(async () => { byId(tree, "ferramentas-toggle")[0].props.onPress(); });
    expect(byId(tree, "ferramentas-lista")).toHaveLength(0);
    expect(window.localStorage.getItem(FERRAMENTAS_STORAGE_KEY)).toBeNull();
    tree.unmount();

    tree = await mount(<GestaoAuraScreen />);
    expect(byId(tree, "ferramentas-lista")).toHaveLength(0);
    tree.unmount();
  });

  it("o cartão Operações não promete mais onboarding, SLA e consultorias", async () => {
    const tree = await mount(<GestaoAuraScreen />);
    const out = text(tree);
    expect(out).toContain("Equipe Aura — quem tem acesso");
    expect(out).not.toContain("SLA de suporte e consultorias");
    tree.unmount();
  });
});

describe("ferramentas.ts — armazenamento", () => {
  it("sem nada salvo começa recolhido; salvar/limpar é simétrico", () => {
    expect(loadFerramentasAberto()).toBe(false);
    saveFerramentasAberto(true);
    expect(loadFerramentasAberto()).toBe(true);
    saveFerramentasAberto(false);
    expect(loadFerramentasAberto()).toBe(false);
  });

  it("storage que explode não derruba a tela", () => {
    const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(loadFerramentasAberto()).toBe(false);
    expect(() => saveFerramentasAberto(true)).not.toThrow();
    get.mockRestore(); set.mockRestore();
  });
});

describe("Operações sem as telas mortas", () => {
  it("na tela principal só tem a Equipe — nada de SLA, Consultorias ou Pipeline, e nenhuma consulta delas", async () => {
    const tree = await mount(<OperacoesAdmin />);
    const out = text(tree);
    expect(out).not.toContain("SLA de suporte");
    expect(out).not.toContain("Consultorias");
    expect(out).not.toContain("Pipeline");
    expect(byId(tree, "ferramenta-sla")).toHaveLength(0);
    expect(byId(tree, "ferramenta-consultorias")).toHaveLength(0);
    expect(byId(tree, "ferramenta-pipeline")).toHaveLength(0);
    expect(paths()).not.toContain("/admin/onboarding/pipeline");
    expect(paths()).not.toContain("/admin/metrics/sla");
    expect(paths()).not.toContain("/admin/consultations");
    tree.unmount();
  });

  it("a tela da rota sem parâmetro é 'Operações / Equipe Aura'", async () => {
    const tree = await mount(<GestaoAuraOperacoesScreen />);
    const out = text(tree);
    expect(out).toContain("Operações");
    expect(out).toContain("Equipe Aura");
    expect(out).not.toContain("Ferramentas");
    tree.unmount();
  });

  it("?ferramenta=sla abre o SLA, com o porquê, e só consulta o SLA", async () => {
    mockParams = { ferramenta: "sla" };
    const tree = await mount(<GestaoAuraOperacoesScreen />);
    expect(byId(tree, "ferramenta-sla")).toHaveLength(1);
    const out = text(tree);
    expect(out).toContain("SLA de suporte");
    expect(out).toContain("Tempo médio 1a resposta");
    expect(out).toContain("O suporte acontece no WhatsApp");
    expect(out).toContain("Central de Comando › Ferramentas");
    expect(paths()).toEqual(["/admin/metrics/sla"]);
    tree.unmount();
  });

  it("?ferramenta=consultorias e ?ferramenta=pipeline abrem as suas telas", async () => {
    const consult = await mount(<OperacoesAdmin ferramenta="consultorias" />);
    expect(byId(consult, "ferramenta-consultorias")).toHaveLength(1);
    expect(text(consult)).toContain("Nenhuma consultoria registrada");
    expect(paths()).toEqual(["/admin/consultations"]);
    consult.unmount();

    mockRequest.mockClear();
    const pipe = await mount(<OperacoesAdmin ferramenta="pipeline" />);
    expect(byId(pipe, "ferramenta-pipeline")).toHaveLength(1);
    expect(text(pipe)).toContain("Cadastrado");
    expect(text(pipe)).toContain("Loja A");
    expect(paths()).toEqual(["/admin/onboarding/pipeline"]);
    pipe.unmount();
  });

  it("parâmetro desconhecido cai na Equipe, sem consultas", async () => {
    mockParams = { ferramenta: "qualquer" };
    const tree = await mount(<GestaoAuraOperacoesScreen />);
    expect(text(tree)).toContain("Equipe Aura");
    expect(paths()).not.toContain("/admin/metrics/sla");
    tree.unmount();
  });
});
