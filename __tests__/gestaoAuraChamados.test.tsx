// Gestão Aura › Chamados: a tela de suporte entra no hub e o link do aviso
// (/gestao-aura?chamado=<id>) abre a conversa daquele chamado.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));
jest.mock("@/components/HoverCard", () => ({ HoverCard: "HoverCard" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

let mockStaff = true;
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ token: "t", isStaff: mockStaff, isDemo: false }),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: any = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

import GestaoAuraScreen from "@/app/(tabs)/gestao-aura";
import GestaoAuraChamadosScreen from "@/app/(tabs)/gestao-aura-chamados";

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

const ID = "11111111-2222-4333-8444-555555555555";
const LISTA = {
  tickets: [{
    id: ID, company_name: "Loja Aurora", subject: "Não consigo imprimir", category: "suporte", status: "aberto",
    updated_at: "2026-10-25T12:00:00Z", last_message: "Socorro", last_sender: "client", user_name: "Ana", user_email: "ana@x.com",
  }],
  summary: { aberto: 1, em_andamento: 0, respondido: 0, fechado: 0 },
  domain_requests_pending: 0,
};
const DETALHE = {
  ticket: { id: ID, company_name: "Loja Aurora", user_name: "Ana", subject: "Não consigo imprimir", status: "aberto" },
  messages: [{ id: "m1", sender_role: "client", sender_name: "Ana", message: "A etiqueta sai em branco", created_at: "2026-10-25T12:00:00Z" }],
};

const paths = () => mockRequest.mock.calls.map((c) => c[0]);

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockRequest.mockReset();
  mockRequest.mockImplementation((p: string) => {
    if (p.startsWith("/admin/tickets?")) return Promise.resolve(LISTA);
    if (p === "/admin/tickets/" + ID) return Promise.resolve(DETALHE);
    if (p === "/admin/tickets/" + ID + "/messages") return Promise.resolve({ message: {} });
    if (p.startsWith("/admin/tickets/")) return Promise.reject(new Error("404"));
    if (p === "/admin/metrics/overview") return Promise.resolve({
      clients: { total: 20, paying: 8, trial: 0, overdue: 0, new_this_month: 4 },
      mrr: { total: 2400, growth_pct: 5 }, churn: { rate_pct: 1 }, margin: { pct: 70 },
    });
    if (p === "/admin/leads/stats") return Promise.resolve({ total: 5, contacted_total: 2, converted_total: 1, overdue: 0, with_phone: 4 });
    return Promise.resolve({});
  });
  mockParams = {};
  mockStaff = true;
});

describe("Hub da Gestão Aura", () => {
  it("tem o cartão Chamados, que abre a tela nova", async () => {
    const tree = await mount(<GestaoAuraScreen />);
    expect(text(tree)).toContain("Chamados");
    expect(byId(tree, "secao-chamados")).toHaveLength(1);
    await act(async () => { byId(tree, "secao-chamados")[0].props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/gestao-aura-chamados");
    expect(mockReplace).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("?chamado=<id> leva direto para a tela de Chamados com o id", async () => {
    mockParams = { chamado: ID };
    const tree = await mount(<GestaoAuraScreen />);
    expect(mockReplace).toHaveBeenCalledWith("/gestao-aura-chamados?chamado=" + ID);
    tree.unmount();
  });

  it("quem não é da equipe não é redirecionado", async () => {
    mockParams = { chamado: ID };
    mockStaff = false;
    const tree = await mount(<GestaoAuraScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(text(tree)).toContain("Acesso restrito");
    tree.unmount();
  });
});

describe("Tela de Chamados", () => {
  it("lista os chamados nas rotas reais, sem abrir nenhum", async () => {
    const tree = await mount(<GestaoAuraChamadosScreen />);
    expect(paths()).toEqual(["/admin/tickets?"]);
    expect(text(tree)).toContain("Loja Aurora");
    expect(byId(tree, "chamado-resposta")).toHaveLength(0);
    tree.unmount();
  });

  it("?chamado=<id> abre a conversa e responder usa a rota de mensagens", async () => {
    mockParams = { chamado: ID };
    const tree = await mount(<GestaoAuraChamadosScreen />);
    expect(paths()).toContain("/admin/tickets/" + ID);
    expect(text(tree)).toContain("A etiqueta sai em branco");
    await act(async () => { byId(tree, "chamado-resposta")[0].props.onChangeText("Vou olhar agora"); });
    await act(async () => { byId(tree, "chamado-enviar")[0].props.onPress(); });
    expect(mockRequest).toHaveBeenCalledWith("/admin/tickets/" + ID + "/messages", { method: "POST", body: { message: "Vou olhar agora" } });
    tree.unmount();
  });

  it("id que não existe mostra aviso em vez de painel vazio", async () => {
    mockParams = { chamado: "nao-existe" };
    const tree = await mount(<GestaoAuraChamadosScreen />);
    expect(byId(tree, "chamado-nao-encontrado")).toHaveLength(1);
    tree.unmount();
  });

  it("fora da equipe não renderiza nem busca", async () => {
    mockStaff = false;
    const tree = await mount(<GestaoAuraChamadosScreen />);
    expect(tree.toJSON()).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
    tree.unmount();
  });
});
