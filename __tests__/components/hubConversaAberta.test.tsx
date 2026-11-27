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
  ...jest.requireActual("@/services/hubProdutoGradeApi"),
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

const T = (tamanho: string, ultimo = false) => ({ tamanho, variant_id: "v-" + tamanho, preco: 189.9, ultimo });
const GRADE = {
  produto: { id: "p1", nome: "Saia midi plissada", preco: 189.9 }, tem_grade: true, fotos: [],
  cores: [
    { chave: "9a6a4f", nome: "Caramelo", hex: "#9a6a4f", preco: 189.9, foto: null, disponivel: true,
      fotos: [{ url: "https://r2/f1.jpg" }, { url: "https://r2/f2.jpg" }, { url: "https://r2/f3.jpg" }],
      tamanhos: [T("P"), T("M", true), T("G")] },
    { chave: "1d1a22", nome: "Preto", hex: "#1d1a22", preco: 189.9, foto: null, disponivel: true,
      fotos: [{ url: "https://r2/f4.jpg" }], tamanhos: [T("M"), T("G", true)] },
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
        expect(t).not.toMatch(/3 peças/);
  });

  it("painel: trocar a cor troca fotos e tamanhos; marcar a foto muda o contador e o envio", async () => {
    preparar(horasAtras(2));
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-produto")[0].props.onPress(); });
    await flush();
    await act(async () => { await porId(r, "hub-produto-p1")[0].props.onPress(); });
    await flush();
    await act(async () => { porId(r, "hub-grade-foto-https://r2/f3.jpg")[0].props.onPress(); });
    expect(tudo(r)).toContain("3 de 3 marcadas");
    await act(async () => { await porId(r, "hub-grade-enviar")[0].props.onPress(); });
    await flush();
    expect(mockGrade.enviar).toHaveBeenCalledWith(COMPANY, "conv-1", {
      type: "produto_grade", product_id: "p1", cor: "9a6a4f", fotos: ["https://r2/f1.jpg", "https://r2/f2.jpg", "https://r2/f3.jpg"], perguntar_tamanho: true,
    });
  });

  it("painel: cor Preto, interruptor desligado, uma foto", async () => {
    preparar(horasAtras(2));
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-produto")[0].props.onPress(); });
    await flush();
    await act(async () => { await porId(r, "hub-produto-p1")[0].props.onPress(); });
    await flush();
    await act(async () => { porId(r, "hub-grade-cor-1d1a22")[0].props.onPress(); });
    expect(tudo(r)).toContain("1 de 1 marcadas");
    expect(tudo(r)).toContain("Mandar 1 foto e tamanhos");
    await act(async () => { porId(r, "hub-grade-perguntar")[0].props.onToggle(); });
    await act(async () => { await porId(r, "hub-grade-enviar")[0].props.onPress(); });
    await flush();
    expect(mockGrade.enviar).toHaveBeenCalledWith(COMPANY, "conv-1", expect.objectContaining({ cor: "1d1a22", fotos: ["https://r2/f4.jpg"], perguntar_tamanho: false }));
  });

  it("painel sem foto: aviso, 'Tirar foto agora' e o botão de preço", async () => {
    mockGrade.grade.mockResolvedValue({ produto: { id: "p1", nome: "Blusa de linho", preco: 129.9 }, tem_grade: true, fotos: [],
      cores: [{ chave: "unica", nome: null, hex: null, preco: 129.9, foto: null, fotos: [], disponivel: true, tamanhos: [T("P", true), T("M")] }] });
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

  const msgsGrade = (sugestao: any) => [
    ...MSGS,
    { id: "m3", direction: "outbound", content: "Saia midi", author: "humano", source_type: "humano", created_at: "2026-11-26T12:02:00Z", tipo: "produto",
      cartao: { nome: "Saia midi plissada", cor: "Caramelo", preco: 189.9, fotos: ["https://r2/f1.jpg", "https://r2/f2.jpg"], tamanhos: [{ tamanho: "P" }, { tamanho: "M", ultimo: true }, { tamanho: "G" }] } },
    { id: "m3b", direction: "outbound", content: "Qual tamanho?", author: "humano", source_type: "humano", created_at: "2026-11-26T12:02:01Z", tipo: "pergunta_tamanho",
      metadata: { tipo: "pergunta_tamanho", formato: "botoes", opcoes: ["P", "M", "G"], product_id: "p1" } },
    { id: "m4", direction: "inbound", content: "Tocou no botão: M", author: "cliente", source_type: null, created_at: "2026-11-26T12:03:00Z",
      metadata: { produto_grade: { product_id: "p1", variant_id: "v-M", tamanho: "M" }, sugestao } },
  ];
  const SUG = { tipo: "reservar_e_mandar_pix", product_id: "p1", variant_id: "v-M", tamanho: "M", quantidade: 1, preco: 189.9, estado: "pendente" };
  async function abrirComSugestao(sugestao: any) {
    mockHub.conversations.mockResolvedValue({ conversations: [conv(horasAtras(2))], counts: [] });
    mockHub.messages.mockResolvedValue({ conversation: conv(horasAtras(2)), pending_approvals: [], messages: msgsGrade(sugestao) });
    return abrirThread();
  }

  it("painel: todos_tamanhos risca o sem peça; sem o campo, só os com peça", async () => {
    mockGrade.grade.mockResolvedValue({ ...GRADE, cores: [{ ...GRADE.cores[0], todos_tamanhos: [
      { tamanho: "P", disponivel: true, ultimo: false }, { tamanho: "M", disponivel: true, ultimo: true },
      { tamanho: "G", disponivel: true, ultimo: false }, { tamanho: "GG", disponivel: false, ultimo: false }] }, GRADE.cores[1]] });
    preparar(horasAtras(2));
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-produto")[0].props.onPress(); });
    await flush();
    await act(async () => { await porId(r, "hub-produto-p1")[0].props.onPress(); });
    await flush();
    const gg = porId(r, "hub-grade-tam-GG");
    expect(gg).toHaveLength(1);
    expect(gg[0].props.accessibilityState).toEqual({ disabled: true });
    expect(tudo(r)).toContain("sem peça");
    expect(porId(r, "hub-grade-tam-M")[0].props.accessibilityState).toEqual({ disabled: false });
  });

  it("cabeçalho da conversa mostra a etiqueta \"Quer o M\" ao lado do nome", async () => {
    const c: any = { ...conv(horasAtras(2)), labels: [{ id: "l1", name: "Quer o M", color: "#7c3aed" }] };
    mockHub.conversations.mockResolvedValue({ conversations: [c], counts: [] });
    mockHub.messages.mockResolvedValue({ conversation: c, pending_approvals: [], messages: MSGS });
    const r = await abrirThread();
    expect(porId(r, "hub-thread-etiqueta-l1")).toHaveLength(1);
    expect(textoDe(porId(r, "hub-thread-etiquetas")[0])).toContain("Quer o M");
  });

  it("thread: uma bolha só (produto com opcoes) mostra fotos, legenda e botões", async () => {
    mockHub.conversations.mockResolvedValue({ conversations: [conv(horasAtras(2))], counts: [] });
    mockHub.messages.mockResolvedValue({ conversation: conv(horasAtras(2)), pending_approvals: [], messages: [
      ...MSGS,
      { id: "m3", direction: "outbound", content: "Saia", author: "humano", source_type: "humano", created_at: "2026-11-26T12:02:00Z", tipo: "produto",
        metadata: { pergunta: true, formato: "botoes", opcoes: ["P", "M"] },
        cartao: { nome: "Saia midi plissada", cor: "Caramelo", preco: 189.9, fotos: ["https://r2/f1.jpg"],
          tamanhos: [{ tamanho: "P", disponivel: true }, { tamanho: "M", disponivel: true, ultimo: true }, { tamanho: "GG", disponivel: false }] } },
    ] });
    const r = await abrirThread();
    expect(porId(r, "hub-cartao-grade")).toHaveLength(1);
    expect(porId(r, "hub-pergunta-botao-M")).toHaveLength(1);
    const t = tudo(r);
    expect(t).toContain("Tem P e M (último).");
    expect(t).not.toContain("GG");
  });

  it("thread: bolha com fotos, 'Qual tamanho?' com botões e a resposta; sem a trava do Pedido a sugestão vira só Pix", async () => {
    const r = await abrirComSugestao(SUG);
    expect(porId(r, "hub-cartao-grade")).toHaveLength(1);
    expect(porId(r, "hub-pergunta-botao-M")).toHaveLength(1);
    expect(porId(r, "hub-resposta-botao")).toHaveLength(1);
    const t = tudo(r);
    expect(t).toContain("Saia midi plissada · Caramelo · R$ 189,90");
    expect(t).toContain("Tem P, M (último) e G.");
    expect(t).toContain("tocou no botão");
    expect(t).toContain("quer o M. Mandar o Pix de R$ 189,90?");
    expect(t).not.toContain("Reservar e mandar o Pix");
    await act(async () => { await porId(r, "hub-sugestao-reservar")[0].props.onPress(); });
    await flush();
    expect(mockHub.send).toHaveBeenCalledWith(COMPANY, "conv-1", { type: "pix", amount: 189.9 });
    expect(mockGrade.reservarEMandarPix).not.toHaveBeenCalled();
  });

  it("thread: com a trava do Pedido ligada, 'Reservar e mandar o Pix' reserva pela mensagem", async () => {
    mockAuth = { ...mockAuth, user: { id: "u1", is_staff: true } };
    const r = await abrirComSugestao(SUG);
    expect(tudo(r)).toContain("Reservar uma e mandar o Pix de R$ 189,90?");
    mockGrade.reservarEMandarPix.mockResolvedValue({ ok: true, order_id: "o1", total: 189.9 });
    await act(async () => { await porId(r, "hub-sugestao-reservar")[0].props.onPress(); });
    await flush();
    expect(mockGrade.reservarEMandarPix).toHaveBeenCalledWith(COMPANY, "conv-1", "m4");
  });

  it("thread: 403 PEDIDO_NAO_LIBERADO cai para 'Mandar o Pix'; JA_RESERVADO e sem_estoque têm frase", async () => {
    mockAuth = { ...mockAuth, user: { id: "u1", is_staff: true } };
    const r = await abrirComSugestao(SUG);
    mockGrade.reservarEMandarPix.mockRejectedValue(Object.assign(new Error("x"), { status: 403, data: { code: "PEDIDO_NAO_LIBERADO" } }));
    await act(async () => { await porId(r, "hub-sugestao-reservar")[0].props.onPress(); });
    await flush();
    expect(tudo(r)).toContain("Mandar o Pix de R$ 189,90?");
    // JA_RESERVADO
    mockGrade.reservarEMandarPix.mockRejectedValue(Object.assign(new Error("x"), { status: 409, data: { code: "JA_RESERVADO" } }));
    tree!.unmount(); tree = null;
    const r2 = await abrirComSugestao(SUG);
    await act(async () => { await porId(r2, "hub-sugestao-reservar")[0].props.onPress(); });
    await flush();
    expect(tudo(r2)).toContain("já está reservada para Ana");
    // sem_estoque
    tree!.unmount(); tree = null;
    const r3 = await abrirComSugestao({ ...SUG, estado: "sem_estoque" });
    expect(tudo(r3)).toContain("esse tamanho acabou entre o envio e o toque");
    expect(porId(r3, "hub-sugestao-reservar")).toHaveLength(0);
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
