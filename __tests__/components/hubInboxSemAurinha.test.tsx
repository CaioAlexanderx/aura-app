// ============================================================
// Hub: inbox com a Aurinha desligada e autor de cada fala (fase 1 do
// WhatsApp da Aura: a equipe lê e responde, a Aurinha não fala).
//
// 1. enabled=false: a lista de conversas carrega e a thread abre e
//    responde; o convite "Ativar a Aurinha" é secundário e só aparece para
//    dono/admin; nada de "IA atendendo" nem "Devolver à Aurinha".
// 2. Autor pelo `author` do backend: cliente → nome ou telefone do contato,
//    humano (inclui o eco do celular, sem source_type) → EQUIPE,
//    aurinha → AURINHA. Sem `author` (Instagram), o critério antigo.
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

const mockHub = {
  settings: jest.fn(),
  conversations: jest.fn(),
  messages: jest.fn(),
  saveSettings: jest.fn(),
  reply: jest.fn(),
  assume: jest.fn(),
};
// A fábrica roda antes do `const mockHub` (imports sobem): cada função
// procura o mock na hora da chamada.
jest.mock("@/services/hubApi", () => ({
  hubApi: new Proxy({}, { get: (_t, k: string) => (...a: any[]) => (mockHub as any)[k](...a) }),
}));

import { HubView } from "@/components/screens/hub/HubView";
import { rotuloDoAutor, nomeDoContato } from "@/components/screens/hub/types";

const COMPANY = "645c1325-8865-48be-af6f-430d93fb2b6c";
const CONV = {
  id: "conv-1", channel: "whatsapp", external_id: "5511988887777", customer_id: null, customer_name: null,
  status: "ia", category: null, handoff_reason: null, last_inbound_at: new Date().toISOString(),
  last_message_at: new Date().toISOString(), last_message_preview: "Oi, preciso de ajuda", pending_approvals: 0,
};
const MSGS = [
  { id: "m1", direction: "inbound", content: "Oi, preciso de ajuda", author: "cliente", source_type: null, created_at: "2026-11-26T12:00:00Z" },
  { id: "m2", direction: "outbound", content: "Oi! Já te ajudo", author: "humano", source_type: null, created_at: "2026-11-26T12:01:00Z" },
  { id: "m3", direction: "outbound", content: "Anotei sua mensagem", author: "aurinha", source_type: "aurinha", created_at: "2026-11-26T12:02:00Z" },
];

let qc: QueryClient;
let tree: renderer.ReactTestRenderer | null = null;

beforeEach(() => {
  Object.values(mockHub).forEach((f) => f.mockReset());
  mockAuth = { company: { id: COMPANY, member_role: "owner" }, isStaff: false };
  mockHub.settings.mockResolvedValue({ enabled: false, approval_mode: true, model: null, extra_instructions: null });
  mockHub.conversations.mockResolvedValue({ conversations: [CONV], counts: [{ channel: "whatsapp", status: "ia", n: 1 }] });
  mockHub.messages.mockResolvedValue({ conversation: CONV, messages: MSGS, pending_approvals: [] });
  mockHub.reply.mockResolvedValue({ ok: true });
  mockHub.assume.mockResolvedValue({ ok: true });
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
const porId = (r: renderer.ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id }, { deep: false });
const temTexto = (r: renderer.ReactTestRenderer, t: string) =>
  r.root.findAll((n) => n.props && n.props.children === t).length > 0;

describe("HubView com a Aurinha desligada", () => {
  it("carrega o inbox: lista de conversas, sem o card de ativação no lugar", async () => {
    const r = await montar();
    expect(mockHub.conversations).toHaveBeenCalledWith(COMPANY, undefined);
    expect(porId(r, "hub-conv-conv-1")).toHaveLength(1);
    expect(porId(r, "hub-convite-aurinha")).toHaveLength(0);
    // a conversa não aparece como "IA atendendo" e o filtro some
    expect(temTexto(r, "IA atendendo")).toBe(false);
  });

  it("abre a thread e responde", async () => {
    const r = await montar();
    await act(async () => { porId(r, "hub-conv-conv-1")[0].props.onPress(); });
    await flush();
    expect(mockHub.messages).toHaveBeenCalledWith(COMPANY, "conv-1");
    expect(porId(r, "hub-msg-m1")).toHaveLength(1);
    expect(porId(r, "hub-devolver-aurinha")).toHaveLength(0);
    expect(porId(r, "hub-thread-status")).toHaveLength(0);

    const input = r.root.findAll((n) => n.props && typeof n.props.onChangeText === "function" && n.props.placeholder)[0];
    await act(async () => { input.props.onChangeText("Oi, aqui é a Cassie"); });
    const enviar = r.root.findAll((n) => n.props && typeof n.props.onPress === "function"
      && n.findAll((c) => c.props && c.props.children === "Enviar").length > 0, { deep: false })[0];
    await act(async () => { await enviar.props.onPress(); });
    await flush();
    expect(mockHub.reply).toHaveBeenCalledWith(COMPANY, "conv-1", "Oi, aqui é a Cassie");
  });

  it("dono vê 'Ativar a Aurinha' como ação secundária, que abre o convite", async () => {
    const r = await montar();
    expect(porId(r, "hub-conv-conv-1")).toHaveLength(1);
    const botao = porId(r, "hub-ativar-aurinha");
    expect(botao).toHaveLength(1);
    await act(async () => { botao[0].props.onPress(); });
    expect(porId(r, "hub-convite-aurinha")).toHaveLength(1);
    // o inbox continua na tela com o convite aberto
    expect(porId(r, "hub-conv-conv-1")).toHaveLength(1);
  });

  it("membro comum não vê o convite (o servidor recusaria)", async () => {
    mockAuth = { company: { id: COMPANY, member_role: "employee" }, isStaff: false };
    const r = await montar();
    expect(porId(r, "hub-conv-conv-1")).toHaveLength(1);
    expect(porId(r, "hub-ativar-aurinha")).toHaveLength(0);
  });

  it("com a Aurinha ligada nada muda: filtro 'IA atendendo' e sem convite", async () => {
    mockHub.settings.mockResolvedValue({ enabled: true, approval_mode: true, model: null, extra_instructions: null });
    const r = await montar();
    expect(temTexto(r, "IA atendendo")).toBe(true);
    expect(porId(r, "hub-ativar-aurinha")).toHaveLength(0);
  });
});

describe("autor de cada fala", () => {
  it("na thread: cliente pelo telefone, eco do celular como EQUIPE, Aurinha como AURINHA", async () => {
    const r = await montar();
    await act(async () => { porId(r, "hub-conv-conv-1")[0].props.onPress(); });
    await flush();
    const autor = (id: string) => porId(r, `hub-msg-autor-${id}`)[0].props.children;
    expect(autor("m1")).toBe("(11) 98888-7777");
    expect(autor("m2")).toBe("EQUIPE");
    expect(autor("m3")).toBe("AURINHA");
    expect(temTexto(r, "VOCÊ")).toBe(false);
  });

  const wa = { customer_name: null, external_id: "5511988887777", channel: "whatsapp" as const };
  const ig = { customer_name: null, external_id: "IGSID-123456", channel: "instagram" as const };

  it("cliente com nome usa o nome", () => {
    expect(rotuloDoAutor({ direction: "inbound", source_type: null, author: "cliente" }, { ...wa, customer_name: "Marina" })).toBe("Marina");
    expect(nomeDoContato(wa)).toBe("(11) 98888-7777");
  });

  it("humano vale mesmo sem source_type (eco); aurinha pelo author", () => {
    expect(rotuloDoAutor({ direction: "outbound", source_type: null, author: "humano" }, wa)).toBe("EQUIPE");
    expect(rotuloDoAutor({ direction: "outbound", source_type: "humano", author: "aurinha" }, wa)).toBe("AURINHA");
  });

  it("Instagram (sem author) segue o critério antigo", () => {
    expect(rotuloDoAutor({ direction: "inbound", source_type: null }, ig)).toBeNull();
    expect(rotuloDoAutor({ direction: "outbound", source_type: "humano" }, ig)).toBe("VOCÊ");
    expect(rotuloDoAutor({ direction: "outbound", source_type: "aurinha" }, ig)).toBe("AURINHA");
  });
});
