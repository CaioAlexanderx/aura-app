// ============================================================
// WhatsApp · Conversas: etiquetas e "É ela".
//
// 1. A lista mostra as etiquetas de cada conversa e filtra por elas.
// 2. Na thread: tocar numa etiqueta aplica/tira; "+ Nova" cria e já aplica;
//    "Editar" mostra o × que apaga a etiqueta da loja.
// 3. "É ela": o servidor sugere o cadastro de mesmo telefone; "É ela" liga,
//    "Não é" esconde, "Desfazer" solta; sem sugestão dá para buscar e escolher.
// 4. Instagram não tem nada disto.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/constants/helpers", () => ({ ...jest.requireActual("@/constants/helpers"), IS_WIDE: true }));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));

const mockHub: Record<string, jest.Mock> = {
  settings: jest.fn(), conversations: jest.fn(), messages: jest.fn(),
  etiquetas: jest.fn(), criarEtiqueta: jest.fn(), apagarEtiqueta: jest.fn(), aplicarEtiqueta: jest.fn(), tirarEtiqueta: jest.fn(),
  clienteDaConversa: jest.fn(), buscarClientes: jest.fn(), ligarCliente: jest.fn(),
};
jest.mock("@/services/hubApi", () => ({
  hubApi: new Proxy({}, { get: (_t, k: string) => (...a: any[]) => (mockHub as any)[k](...a) }),
}));

import { HubView } from "@/components/screens/hub/HubView";
import { mesAno, diaMes } from "@/components/screens/hub/ClienteConversa";

const COMPANY = "645c1325-8865-48be-af6f-430d93fb2b6c";
const ORC = { id: "l1", name: "Orçamento", color: "#f59e0b" };
const PIX = { id: "l2", name: "Esperando Pix", color: "#3b82f6" };
const recente = new Date(Date.now() - 2 * 3600000).toISOString();
const conv = (extra: any = {}) => ({
  id: "conv-1", channel: "whatsapp", external_id: "5511988887777", customer_id: null, customer_name: "AnaPerfil",
  status: "humano", category: null, handoff_reason: null, last_inbound_at: recente, last_message_at: recente,
  last_message_preview: "oi", pending_approvals: 0, labels: [], ...extra,
});
const ANA = {
  id: "c-ana", name: "Ana Paula Ribeiro", phone: "11984221093", email: null, birth_date: "1990-12-12",
  since: "2025-03-10T12:00:00Z", last_purchase_at: "2026-11-02T15:00:00Z", total_spent: 129.9,
};

let qc: QueryClient;
let tree: renderer.ReactTestRenderer | null = null;

beforeEach(() => {
  Object.values(mockHub).forEach((f) => f.mockReset());
  mockAuth = { company: { id: COMPANY, member_role: "owner" }, isStaff: false };
  mockHub.settings.mockResolvedValue({ enabled: false, approval_mode: true, model: null, extra_instructions: null });
  mockHub.conversations.mockResolvedValue({ conversations: [conv({ labels: [ORC] })], counts: [] });
  mockHub.messages.mockResolvedValue({ conversation: conv({ labels: [ORC] }), messages: [], pending_approvals: [] });
  mockHub.etiquetas.mockResolvedValue({ labels: [ORC, PIX] });
  mockHub.clienteDaConversa.mockResolvedValue({ cliente: null, sugestao: null });
  mockHub.aplicarEtiqueta.mockResolvedValue({ ok: true });
  mockHub.tirarEtiqueta.mockResolvedValue({ ok: true });
  mockHub.ligarCliente.mockResolvedValue({ ok: true, customer_id: "c-ana" });
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  if (tree) act(() => { tree!.unmount(); });
  tree = null;
  qc.clear();
});

const flush = async (n = 4) => {
  for (let i = 0; i < n; i++) await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
};
async function montar() {
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><HubView /></QueryClientProvider>);
  });
  await flush();
  return tree!;
}
async function abrirThread() {
  const r = await montar();
  await act(async () => { r.root.findAllByProps({ testID: "hub-conv-conv-1" }, { deep: false })[0].props.onPress(); });
  await flush();
  return r;
}
const porId = (r: renderer.ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id }, { deep: false });
const textoDe = (n: any): string => (typeof n === "string" ? n : Array.isArray(n.children) ? n.children.map(textoDe).join("") : n.children ? textoDe(n.children) : "");
const tudo = (r: renderer.ReactTestRenderer) => textoDe(r.toJSON());
const tocar = async (r: renderer.ReactTestRenderer, id: string) => { await act(async () => { await porId(r, id)[0].props.onPress(); }); await flush(); };

describe("lista", () => {
  it("mostra as etiquetas da conversa e os chips de filtro", async () => {
    const r = await montar();
    expect(tudo(r)).toContain("Orçamento");
    expect(porId(r, "hub-filtro-etiqueta-l1")).toHaveLength(1);
    expect(porId(r, "hub-filtro-etiqueta-l2")).toHaveLength(1);
  });

  it("filtrar por etiqueta pede a lista com label; tocar de novo limpa", async () => {
    const r = await montar();
    await tocar(r, "hub-filtro-etiqueta-l2");
    expect(mockHub.conversations).toHaveBeenLastCalledWith(COMPANY, { label: "l2" });
    await tocar(r, "hub-filtro-etiqueta-l2");
    expect(mockHub.conversations).toHaveBeenLastCalledWith(COMPANY, undefined);
  });

  it("sem etiquetas na loja, a faixa de filtro não aparece", async () => {
    mockHub.etiquetas.mockResolvedValue({ labels: [] });
    const r = await montar();
    expect(porId(r, "hub-filtro-etiquetas")).toHaveLength(0);
  });
});

describe("etiquetas na thread", () => {
  it("aplica a que falta e tira a que já está", async () => {
    const r = await abrirThread();
    await tocar(r, "hub-etiqueta-l2");
    expect(mockHub.aplicarEtiqueta).toHaveBeenCalledWith(COMPANY, "conv-1", "l2");
    await tocar(r, "hub-etiqueta-l1");
    expect(mockHub.tirarEtiqueta).toHaveBeenCalledWith(COMPANY, "conv-1", "l1");
  });

  it("+ Nova cria com a cor escolhida e já aplica na conversa", async () => {
    mockHub.criarEtiqueta.mockResolvedValue({ label: { id: "l3", name: "Crediário", color: "#10b981" } });
    const r = await abrirThread();
    await tocar(r, "hub-etiqueta-nova");
    await act(async () => { porId(r, "hub-etiqueta-nome")[0].props.onChangeText("  Crediário "); });
    await tocar(r, "hub-etiqueta-cor-#10b981");
    await tocar(r, "hub-etiqueta-salvar");
    expect(mockHub.criarEtiqueta).toHaveBeenCalledWith(COMPANY, { name: "Crediário", color: "#10b981" });
    expect(mockHub.aplicarEtiqueta).toHaveBeenCalledWith(COMPANY, "conv-1", "l3");
  });

  it("sem nome o botão de criar fica parado", async () => {
    const r = await abrirThread();
    await tocar(r, "hub-etiqueta-nova");
    expect(porId(r, "hub-etiqueta-salvar")[0].props.disabled).toBe(true);
  });

  it("Editar mostra o × e apaga a etiqueta da loja", async () => {
    mockHub.apagarEtiqueta.mockResolvedValue({ ok: true });
    const r = await abrirThread();
    expect(porId(r, "hub-etiqueta-apagar-l1")).toHaveLength(0);
    await tocar(r, "hub-etiqueta-editar");
    await tocar(r, "hub-etiqueta-apagar-l1");
    expect(mockHub.apagarEtiqueta).toHaveBeenCalledWith(COMPANY, "l1");
  });

  it("o motivo do servidor aparece (ex.: nome repetido)", async () => {
    mockHub.criarEtiqueta.mockRejectedValue(new Error("Você já tem uma etiqueta com esse nome"));
    const r = await abrirThread();
    await tocar(r, "hub-etiqueta-nova");
    await act(async () => { porId(r, "hub-etiqueta-nome")[0].props.onChangeText("Orçamento"); });
    await tocar(r, "hub-etiqueta-salvar");
    expect(tudo(r)).toContain("Você já tem uma etiqueta com esse nome");
  });

  it("Instagram não mostra etiquetas nem cadastro", async () => {
    mockHub.conversations.mockResolvedValue({ conversations: [conv({ channel: "instagram", external_id: "IGSID1" })], counts: [] });
    mockHub.messages.mockResolvedValue({ conversation: conv({ channel: "instagram", external_id: "IGSID1" }), messages: [], pending_approvals: [] });
    const r = await abrirThread();
    expect(porId(r, "hub-etiquetas")).toHaveLength(0);
    expect(mockHub.clienteDaConversa).not.toHaveBeenCalled();
  });
});

describe("É ela", () => {
  it("o servidor sugere o cadastro de mesmo telefone: É ela liga", async () => {
    mockHub.clienteDaConversa.mockResolvedValue({ cliente: null, sugestao: ANA });
    const r = await abrirThread();
    expect(tudo(r)).toContain("Este número é da");
    expect(tudo(r)).toContain("Ana Paula Ribeiro");
    expect(tudo(r)).toContain("cliente desde mar/2025");
    await tocar(r, "hub-cliente-e-ela");
    expect(mockHub.ligarCliente).toHaveBeenCalledWith(COMPANY, "conv-1", "c-ana");
  });

  it("Não é esconde a sugestão sem ligar nada", async () => {
    mockHub.clienteDaConversa.mockResolvedValue({ cliente: null, sugestao: ANA });
    const r = await abrirThread();
    await tocar(r, "hub-cliente-nao-e");
    expect(porId(r, "hub-cliente-sugestao")).toHaveLength(0);
    expect(mockHub.ligarCliente).not.toHaveBeenCalled();
    expect(porId(r, "hub-cliente-sem")).toHaveLength(1);
  });

  it("ligado: mostra o cartão do cliente; Desfazer solta", async () => {
    mockHub.clienteDaConversa.mockResolvedValue({ cliente: ANA, sugestao: null });
    mockHub.messages.mockResolvedValue({ conversation: conv({ customer_id: "c-ana", customer_name: "Ana Paula Ribeiro" }), messages: [], pending_approvals: [] });
    const r = await abrirThread();
    expect(porId(r, "hub-cliente-nome")[0].props.children).toBe("Ana Paula Ribeiro");
    expect(tudo(r)).toContain("(11) 98422-1093");
    expect(tudo(r)).toContain("aniversário 12/12");
    expect(tudo(r)).toContain("última compra 02/11");
    await tocar(r, "hub-cliente-desfazer");
    expect(mockHub.ligarCliente).toHaveBeenCalledWith(COMPANY, "conv-1", null);
  });

  it("sem sugestão: busca por nome e escolhe", async () => {
    mockHub.buscarClientes.mockResolvedValue({ clientes: [{ id: "c-ana", name: "Ana Paula Ribeiro", phone: "11984221093", email: null }] });
    const r = await abrirThread();
    await tocar(r, "hub-cliente-ligar");
    await act(async () => { porId(r, "hub-cliente-busca-input")[0].props.onChangeText("ana"); });
    await flush();
    expect(mockHub.buscarClientes).toHaveBeenCalledWith(COMPANY, "ana");
    await tocar(r, "hub-cliente-achado-c-ana");
    expect(mockHub.ligarCliente).toHaveBeenCalledWith(COMPANY, "conv-1", "c-ana");
  });

  it("nada é buscado com menos de 2 letras", async () => {
    const r = await abrirThread();
    await tocar(r, "hub-cliente-ligar");
    await act(async () => { porId(r, "hub-cliente-busca-input")[0].props.onChangeText("a"); });
    await flush();
    expect(mockHub.buscarClientes).not.toHaveBeenCalled();
  });

  it("o motivo do servidor aparece na tela", async () => {
    mockHub.clienteDaConversa.mockResolvedValue({ cliente: null, sugestao: ANA });
    mockHub.ligarCliente.mockRejectedValue(new Error("Cliente não encontrado nesta loja"));
    const r = await abrirThread();
    await tocar(r, "hub-cliente-e-ela");
    expect(tudo(r)).toContain("Cliente não encontrado nesta loja");
  });
});

describe("formatos", () => {
  it("mesAno e diaMes", () => {
    expect(mesAno("2025-03-10T12:00:00Z")).toBe("mar/2025");
    expect(mesAno(null)).toBe("");
    expect(diaMes("1990-12-12")).toBe("12/12");
    expect(diaMes("lixo")).toBe("");
  });
});
