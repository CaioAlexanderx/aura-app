// ============================================================
// WhatsApp · Conversas: conversa ABERTA (24 h) manda produto, orçamento,
// Pix e link da loja de graça.
//
// 1. a barra diz até quando a conversa fica aberta e que responder não gasta;
// 2. os atalhos só existem com a conversa aberta (fechada: nenhum, e a barra some);
// 3. link da loja sai com um toque; produto sai pelo id escolhido na busca;
// 4. o motivo que o servidor devolve aparece na tela (ex.: sem chave Pix);
// 5. conversaAbertaAte: "hoje", "amanhã", data e hora.
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
  settings: jest.fn(), conversations: jest.fn(), messages: jest.fn(), send: jest.fn(),
  catalogo: jest.fn(), orcamentos: jest.fn(), etiquetas: jest.fn(), clienteDaConversa: jest.fn(), reply: jest.fn(), assume: jest.fn(),
};
jest.mock("@/services/hubApi", () => ({
  hubApi: new Proxy({}, { get: (_t, k: string) => (...a: any[]) => (mockHub as any)[k](...a) }),
}));

const mockGrade: Record<string, jest.Mock> = { grade: jest.fn(), enviar: jest.fn(), reservarEMandarPix: jest.fn() };
jest.mock("@/services/hubProdutoGradeApi", () => ({
  hubProdutoGradeApi: new Proxy({}, { get: (_t, k: string) => (...a: any[]) => (mockGrade as any)[k](...a) }),
}));

import { HubView } from "@/components/screens/hub/HubView";
import { conversaAbertaAte } from "@/components/screens/hub/types";
import { parseValorBR } from "@/components/screens/hub/EnvioRapido";

const COMPANY = "645c1325-8865-48be-af6f-430d93fb2b6c";
const horasAtras = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const conv = (lastInbound: string) => ({
  id: "conv-1", channel: "whatsapp", external_id: "5511988887777", customer_id: null, customer_name: "Ana Paula",
  status: "humano", category: null, handoff_reason: null, last_inbound_at: lastInbound,
  last_message_at: lastInbound, last_message_preview: "Quero sim", pending_approvals: 0,
});
const MSGS = [
  { id: "m1", direction: "inbound", content: "Quero sim", author: "cliente", source_type: null, created_at: "2026-11-26T12:00:00Z" },
  { id: "m2", direction: "outbound", content: "*Saia midi*\nR$ 189,90", author: "humano", source_type: "humano", created_at: "2026-11-26T12:01:00Z",
    tipo: "produto", image_url: "https://r2.getaura.com.br/p1.jpg" },
];

let qc: QueryClient;
let tree: renderer.ReactTestRenderer | null = null;

function preparar(lastInbound: string) {
  mockHub.conversations.mockResolvedValue({ conversations: [conv(lastInbound)], counts: [] });
  mockHub.messages.mockResolvedValue({ conversation: conv(lastInbound), messages: MSGS, pending_approvals: [] });
}

const GRADE = {
  product: { id: "p1", name: "Saia midi plissada", price: 189.9, image_url: null }, tem_cor: true,
  fotos: [],
  cores: [
    { key: "caramelo", label: "Caramelo", hex: "#9a6a4f",
      fotos: [{ id: "f1", url: "https://r2/f1.jpg" }, { id: "f2", url: "https://r2/f2.jpg" }, { id: "f3", url: "https://r2/f3.jpg" }],
      tamanhos: [{ label: "P", qty: 2 }, { label: "M", qty: 1 }, { label: "G", qty: 3 }, { label: "GG", qty: 0 }] },
    { key: "preto", label: "Preto", hex: "#1d1a22", fotos: [{ id: "f4", url: "https://r2/f4.jpg" }],
      tamanhos: [{ label: "P", qty: 0 }, { label: "M", qty: 2 }] },
  ],
};

beforeEach(() => {
  Object.values(mockGrade).forEach((f) => f.mockReset());
  mockGrade.grade.mockResolvedValue(GRADE);
  mockGrade.enviar.mockResolvedValue({ ok: true, wamid: "w2" });
  Object.values(mockHub).forEach((f) => f.mockReset());
  mockAuth = { company: { id: COMPANY, member_role: "owner" }, isStaff: false };
  mockHub.etiquetas.mockResolvedValue({ labels: [] });
  mockHub.clienteDaConversa.mockResolvedValue({ cliente: null, sugestao: null });
  mockHub.settings.mockResolvedValue({ enabled: false, approval_mode: true, model: null, extra_instructions: null });
  mockHub.send.mockResolvedValue({ ok: true, wamid: "w1" });
  mockHub.catalogo.mockResolvedValue({ products: [{ id: "p1", name: "Saia midi plissada", price: 189.9, image_url: "https://r2.getaura.com.br/p1.jpg" }] });
  mockHub.orcamentos.mockResolvedValue({ quotes: [] });
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
async function abrirThread() {
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><HubView /></QueryClientProvider>);
  });
  await flush();
  await act(async () => { tree!.root.findAllByProps({ testID: "hub-conv-conv-1" }, { deep: false })[0].props.onPress(); });
  await flush();
  return tree!;
}
const porId = (r: renderer.ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id }, { deep: false });
const textoDe = (n: any): string => (typeof n === "string" ? n : Array.isArray(n.children) ? n.children.map(textoDe).join("") : n.children ? textoDe(n.children) : "");
const tudo = (r: renderer.ReactTestRenderer) => textoDe(r.toJSON());

describe("conversa aberta", () => {
  it("mostra até quando fica aberta e que responder não gasta mensagens", async () => {
    preparar(horasAtras(2));
    const r = await abrirThread();
    expect(porId(r, "hub-janela-aberta")).toHaveLength(1);
    expect(tudo(r)).toContain("responder não gasta mensagens");
    ["produto", "orcamento", "pix", "link_loja"].forEach((k) => expect(porId(r, `hub-envio-${k}`)).toHaveLength(1));
  });

  it("o produto mandado aparece na thread com a foto", async () => {
    preparar(horasAtras(2));
    const r = await abrirThread();
    expect(porId(r, "hub-msg-foto-m2")).toHaveLength(1);
  });

  it("conversa fechada: sem barra e sem atalhos", async () => {
    preparar(horasAtras(30));
    const r = await abrirThread();
    expect(porId(r, "hub-janela-aberta")).toHaveLength(0);
    expect(porId(r, "hub-envio-rapido")).toHaveLength(0);
  });

  it("link da loja sai com um toque", async () => {
    preparar(horasAtras(2));
    const r = await abrirThread();
    await act(async () => { await porId(r, "hub-envio-link_loja")[0].props.onPress(); });
    await flush();
    expect(mockHub.send).toHaveBeenCalledWith(COMPANY, "conv-1", { type: "link_loja" });
  });

  it("produto: a busca abre o painel de fotos e tamanhos (nada sai no toque)", async () => {
    preparar(horasAtras(2));
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-produto")[0].props.onPress(); });
    await flush();
    expect(mockHub.catalogo).toHaveBeenCalledWith(COMPANY, "");
    await act(async () => { await porId(r, "hub-produto-p1")[0].props.onPress(); });
    await flush();
    expect(mockHub.send).not.toHaveBeenCalled();
    expect(mockGrade.grade).toHaveBeenCalledWith(COMPANY, "p1");
    const t = tudo(r);
    expect(t).toContain("2 de 3 marcadas");
    expect(t).toContain("Mandar 2 fotos e tamanhos");
    expect(t).toContain("Grátis: a conversa está aberta");
    // sem quantidade; "último" quando sobra 1; GG sem peça
    expect(t).toContain("último");
    expect(t).toContain("sem peça");
    expect(t).not.toMatch(/3 peças/);
  });

  it("painel: trocar a cor troca fotos e tamanhos; marcar a foto muda o contador e o envio", async () => {
    preparar(horasAtras(2));
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-produto")[0].props.onPress(); });
    await flush();
    await act(async () => { await porId(r, "hub-produto-p1")[0].props.onPress(); });
    await flush();
    await act(async () => { porId(r, "hub-grade-foto-f3")[0].props.onPress(); });
    expect(tudo(r)).toContain("3 de 3 marcadas");
    await act(async () => { await porId(r, "hub-grade-enviar")[0].props.onPress(); });
    await flush();
    expect(mockGrade.enviar).toHaveBeenCalledWith(COMPANY, "conv-1", {
      type: "produto_grade", product_id: "p1", color_key: "caramelo", photo_ids: ["f1", "f2", "f3"], perguntar_tamanho: true,
    });
  });

  it("painel: cor Preto, interruptor desligado, uma foto", async () => {
    preparar(horasAtras(2));
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-produto")[0].props.onPress(); });
    await flush();
    await act(async () => { await porId(r, "hub-produto-p1")[0].props.onPress(); });
    await flush();
    await act(async () => { porId(r, "hub-grade-cor-preto")[0].props.onPress(); });
    expect(tudo(r)).toContain("1 de 1 marcadas");
    expect(tudo(r)).toContain("Mandar 1 foto e tamanhos");
    await act(async () => { porId(r, "hub-grade-perguntar")[0].props.onToggle(); });
    await act(async () => { await porId(r, "hub-grade-enviar")[0].props.onPress(); });
    await flush();
    expect(mockGrade.enviar).toHaveBeenCalledWith(COMPANY, "conv-1", expect.objectContaining({ color_key: "preto", photo_ids: ["f4"], perguntar_tamanho: false }));
  });

  it("painel sem foto: aviso, 'Tirar foto agora' e o botão de preço", async () => {
    mockGrade.grade.mockResolvedValue({ product: { id: "p1", name: "Blusa de linho", price: 129.9, image_url: null }, tem_cor: false, fotos: [],
      cores: [{ key: "unica", label: "", hex: null, fotos: [], tamanhos: [{ label: "P", qty: 1 }, { label: "M", qty: 4 }] }] });
    preparar(horasAtras(2));
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-produto")[0].props.onPress(); });
    await flush();
    await act(async () => { await porId(r, "hub-produto-p1")[0].props.onPress(); });
    await flush();
    expect(porId(r, "hub-grade-sem-foto")).toHaveLength(1);
    expect(porId(r, "hub-grade-tirar-foto")).toHaveLength(1);
    const t = tudo(r);
    expect(t).toContain("Este produto não tem foto. Vai só o texto com o preço e os tamanhos.");
    expect(t).toContain("Mandar preço e tamanhos");
    expect(t).not.toContain("Cor");
  });

  it("painel: sem a rota da grade, manda o produto do jeito antigo", async () => {
    mockGrade.grade.mockRejectedValue(new Error("404"));
    preparar(horasAtras(2));
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-produto")[0].props.onPress(); });
    await flush();
    await act(async () => { await porId(r, "hub-produto-p1")[0].props.onPress(); });
    await flush();
    await act(async () => { await porId(r, "hub-grade-so-preco")[0].props.onPress(); });
    await flush();
    expect(mockHub.send).toHaveBeenCalledWith(COMPANY, "conv-1", { type: "produto", product_id: "p1" });
  });

  it("thread: bolha com fotos e botões, resposta da cliente e a sugestão de reservar", async () => {
    mockHub.conversations.mockResolvedValue({ conversations: [conv(horasAtras(2))], counts: [] });
    mockHub.messages.mockResolvedValue({ conversation: conv(horasAtras(2)), pending_approvals: [], messages: [
      ...MSGS,
      { id: "m3", direction: "outbound", content: "Saia midi", author: "humano", source_type: "humano", created_at: "2026-11-26T12:02:00Z", tipo: "produto_grade",
        cartao: { fotos: ["https://r2/f1.jpg", "https://r2/f2.jpg"], legenda: ["Saia midi plissada · Caramelo · R$ 189,90", "Tem P, M (último) e G."], pergunta: "Qual tamanho?", botoes: ["P", "M", "G"] } },
      { id: "m4", direction: "inbound", content: "M", author: "cliente", source_type: null, created_at: "2026-11-26T12:03:00Z", tipo: "resposta_botao",
        cartao: { tamanho: "M", sugestao: { product_id: "p1", color_key: "caramelo", size: "M", valor: 189.9 } } },
    ] });
    mockHub.reservarEMandarPix = jest.fn().mockResolvedValue({ ok: true });
    const r = await abrirThread();
    expect(porId(r, "hub-cartao-grade")).toHaveLength(1);
    expect(porId(r, "hub-cartao-grade-botao-M")).toHaveLength(1);
    expect(porId(r, "hub-resposta-botao")).toHaveLength(1);
    const t = tudo(r);
    expect(t).toContain("tocou no botão");
    expect(t).toContain("Reservar uma e mandar o Pix de R$ 189,90?");
    expect(t).toContain("quer o M");
  });

  it("Pix com valor manda o valor", async () => {
    preparar(horasAtras(2));
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-pix")[0].props.onPress(); });
    await act(async () => { porId(r, "hub-pix-valor")[0].props.onChangeText("189,90"); });
    await act(async () => { await porId(r, "hub-pix-mandar")[0].props.onPress(); });
    await flush();
    expect(mockHub.send).toHaveBeenCalledWith(COMPANY, "conv-1", { type: "pix", amount: 189.9 });
  });

  it("orçamento: sem nenhum enviado, explica onde fazer", async () => {
    preparar(horasAtras(2));
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-orcamento")[0].props.onPress(); });
    await flush();
    expect(tudo(r)).toContain("Nenhum orçamento enviado para este cliente");
  });

  it("o motivo do servidor aparece na tela", async () => {
    preparar(horasAtras(2));
    mockHub.send.mockRejectedValue(Object.assign(new Error("A loja ainda não cadastrou a chave Pix."), { code: "SEM_PIX" }));
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-pix")[0].props.onPress(); });
    await act(async () => { await porId(r, "hub-pix-mandar")[0].props.onPress(); });
    await flush();
    expect(tudo(r)).toContain("A loja ainda não cadastrou a chave Pix.");
  });
});

describe("conversaAbertaAte", () => {
  const agora = new Date(2026, 10, 26, 10, 0);
  it("amanhã com hora e minuto", () => {
    expect(conversaAbertaAte(new Date(2026, 10, 26, 10, 15).toISOString(), agora)).toBe("amanhã, 10h15");
  });
  it("hoje, hora cheia sem minutos", () => {
    expect(conversaAbertaAte(new Date(2026, 10, 25, 15, 0).toISOString(), agora)).toBe("hoje, 15h");
  });
  it("fechada ou sem mensagem do cliente: null", () => {
    expect(conversaAbertaAte(new Date(2026, 10, 25, 9, 0).toISOString(), agora)).toBeNull();
    expect(conversaAbertaAte(null, agora)).toBeNull();
  });
});

describe("parseValorBR", () => {
  it("10.50 é R$ 10,50, nunca R$ 1.050", () => {
    expect(parseValorBR("10.50")).toBe(10.5);
    expect(parseValorBR("189,90")).toBe(189.9);
    expect(parseValorBR("1.189,90")).toBe(1189.9);
    expect(parseValorBR("1.189")).toBe(1189);
    expect(parseValorBR("R$ 25")).toBe(25);
    expect(parseValorBR("abc")).toBeNaN();
    expect(parseValorBR("")).toBeNaN();
  });
});
