// ============================================================
// WhatsApp · Conversas: conversa FECHADA (artboard "Fechada") e celular
// (artboard "Celular").
//
// Estado 1 (ainda há avisos): convites prontos, prévia com só os trechos
//   marcados editáveis, "Usa 1 aviso · ficam 71 de 100", Mandar convite.
//   Sem texto livre: o WhatsApp só aceita convite pronto fora das 24 h.
// Estado 2 (esgotado): "Os 100 avisos de novembro acabaram.", Copiar meu
//   link e "Adicionar 200 avisos por R$ 19" — que só gera a cobrança, nunca
//   por conta própria.
// Celular: "72 avisos" no cabeçalho, cliente/etiquetas atrás de um toque,
//   "Mandar para a Ana · tudo grátis agora".
// ============================================================
import React from "react";
import { Linking } from "react-native";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
let mockWide = true;
jest.mock("@/constants/helpers", () => ({
  ...jest.requireActual("@/constants/helpers"),
  get IS_WIDE() { return mockWide; },
}));
const mockCopiar = jest.fn(async (_t: string) => true);
jest.mock("@/utils/clipboard", () => ({ copyToClipboard: (t: string) => mockCopiar(t) }));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));

const mockHub: Record<string, jest.Mock> = {
  settings: jest.fn(), conversations: jest.fn(), messages: jest.fn(), etiquetas: jest.fn(), clienteDaConversa: jest.fn(),
  convites: jest.fn(), mandarConvite: jest.fn(), prepararConvites: jest.fn(), pedirPacoteDeAvisos: jest.fn(), saldoAvisos: jest.fn(),
  reply: jest.fn(),
};
jest.mock("@/services/hubApi", () => ({
  hubApi: new Proxy({}, { get: (_t, k: string) => (...a: any[]) => (mockHub as any)[k](...a) }),
}));

import { HubView } from "@/components/screens/hub/HubView";
import { mesPorExtenso, reaisDeCentavos } from "@/components/screens/hub/ConversaFechada";

const COMPANY = "645c1325-8865-48be-af6f-430d93fb2b6c";
const velha = new Date(Date.now() - 40 * 3600000).toISOString();
const recente = new Date(Date.now() - 2 * 3600000).toISOString();
const conv = (extra: any = {}) => ({
  id: "conv-1", channel: "whatsapp", external_id: "5511988887777", customer_id: null, customer_name: "Bia Torres",
  status: "humano", category: null, handoff_reason: null, last_inbound_at: velha, last_message_at: velha,
  last_message_preview: "Tem o cinto em preto?", pending_approvals: 0, labels: [], ...extra,
});
const CHEGOU = {
  key: "chegou", titulo: "Chegou o que pediu", estado: "APPROVED", pronto: true,
  partes: ["Oi, ", { campo: "nome" }, ". Chegou ", { campo: "produto" }, " que você perguntou na ", { campo: "loja" }, ". Guardo um para você até ", { campo: "ate" }, "."],
  campos: [
    { key: "nome", rotulo: "Nome", auto: true, exemplo: "Bia", max: 60 },
    { key: "produto", rotulo: "Produto", auto: false, exemplo: "o cinto de couro em preto", max: 60 },
    { key: "loja", rotulo: "Nome da loja", auto: true, exemplo: "Lume Moda", max: 60 },
    { key: "ate", rotulo: "Guardo até", auto: false, exemplo: "sábado", max: 60 },
  ],
};
const ORC = { ...CHEGOU, key: "orcamento", titulo: "Orçamento pronto", estado: "PENDING", pronto: false };
const SALDO = { ativo: true, restante: 72, total: 100, esgotado: false, renova_em: "2026-12-01", mes: "2026-11", pacote: { qty: 200, preco_centavos: 1900 } };
const convites = (extra: any = {}) => ({
  aberta: false, conectado: true, meu_link: "https://wa.me/5511987650000", saldo: SALDO,
  auto: { nome: "Bia", loja: "Lume Moda" }, convites: [CHEGOU, ORC], ...extra,
});

let qc: QueryClient;
let tree: renderer.ReactTestRenderer | null = null;

beforeEach(() => {
  Object.values(mockHub).forEach((f) => f.mockReset());
  mockCopiar.mockClear();
  mockWide = true;
  mockAuth = { company: { id: COMPANY, member_role: "owner" }, isStaff: false };
  mockHub.settings.mockResolvedValue({ enabled: false, approval_mode: true, model: null, extra_instructions: null });
  mockHub.conversations.mockResolvedValue({ conversations: [conv()], counts: [] });
  mockHub.messages.mockResolvedValue({ conversation: conv(), messages: [], pending_approvals: [] });
  mockHub.etiquetas.mockResolvedValue({ labels: [] });
  mockHub.clienteDaConversa.mockResolvedValue({ cliente: null, sugestao: null });
  mockHub.convites.mockResolvedValue(convites());
  mockHub.mandarConvite.mockResolvedValue({ ok: true, outbox_id: "o1" });
  mockHub.saldoAvisos.mockResolvedValue({ ativo: true, saldos: { avisos: { restante: 72, total: 100 } } });
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as any);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  if (tree) act(() => { tree!.unmount(); });
  tree = null;
  qc.clear();
  jest.restoreAllMocks();
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
const tocar = async (r: renderer.ReactTestRenderer, id: string) => { await act(async () => { await porId(r, id)[0].props.onPress(); }); await flush(); };
const digitar = async (r: renderer.ReactTestRenderer, id: string, t: string) => { await act(async () => { porId(r, id)[0].props.onChangeText(t); }); };

describe("estado 1 · ainda há avisos", () => {
  it("lista os convites, escolhe o primeiro pronto e mostra a prévia com o nome já preenchido", async () => {
    const r = await abrirThread();
    expect(porId(r, "hub-fechada")).toHaveLength(1);
    expect(tudo(r)).toContain("Para falar com Bia, escolha o convite:");
    expect(tudo(r)).toContain("Chegou o que pediu");
    expect(tudo(r)).toContain("Orçamento pronto · em aprovação");
    expect(porId(r, "hub-convite-orcamento")[0].props.disabled).toBe(true);
    const previa = textoDe(porId(r, "hub-convite-previa")[0]);
    expect(previa).toContain("Oi, Bia. Chegou [Produto] que você perguntou na Lume Moda.");
    expect(previa).toContain("prévia · você muda só os trechos marcados");
  });

  it("só os campos editáveis têm caixa; nome e loja são da Aura", async () => {
    const r = await abrirThread();
    expect(porId(r, "hub-convite-campo-produto")).toHaveLength(1);
    expect(porId(r, "hub-convite-campo-ate")).toHaveLength(1);
    expect(porId(r, "hub-convite-campo-nome")).toHaveLength(0);
    expect(porId(r, "hub-convite-campo-loja")).toHaveLength(0);
  });

  it("diz quanto gasta e quanto sobra: Usa 1 aviso · ficam 71 de 100", async () => {
    const r = await abrirThread();
    expect(textoDe(porId(r, "hub-fechada-custo")[0])).toBe("Usa 1 aviso · ficam 71 de 100");
  });

  it("sem o saldo no servidor, só diz que usa 1 aviso", async () => {
    mockHub.convites.mockResolvedValue(convites({ saldo: null }));
    const r = await abrirThread();
    expect(textoDe(porId(r, "hub-fechada-custo")[0])).toBe("Usa 1 aviso");
  });

  it("não deixa mandar com campo vazio; mandando, envia só os campos e avisa que a conversa abre quando ela responder", async () => {
    const r = await abrirThread();
    expect(porId(r, "hub-fechada-mandar")[0].props.disabled).toBe(true);
    await digitar(r, "hub-convite-campo-produto", "o cinto de couro em preto");
    expect(porId(r, "hub-fechada-mandar")[0].props.disabled).toBe(true);
    await digitar(r, "hub-convite-campo-ate", "sábado");
    expect(porId(r, "hub-fechada-mandar")[0].props.disabled).toBe(false);
    expect(textoDe(porId(r, "hub-convite-previa")[0])).toContain("Chegou o cinto de couro em preto que você perguntou na Lume Moda. Guardo um para você até sábado.");
    await tocar(r, "hub-fechada-mandar");
    expect(mockHub.mandarConvite).toHaveBeenCalledWith(COMPANY, "conv-1", {
      key: "chegou", campos: { produto: "o cinto de couro em preto", ate: "sábado" },
    });
    expect(textoDe(porId(r, "hub-fechada-aviso")[0])).toContain("Quando Bia responder, a conversa abre de novo por um dia");
  });

  it("não há campo de texto livre nem botão Enviar: fechada só sai por convite", async () => {
    const r = await abrirThread();
    const livre = r.root.findAll((n) => n.props && typeof n.props.onChangeText === "function" && n.props.placeholder === "Escreva sua resposta…");
    expect(livre).toHaveLength(0);
    expect(porId(r, "hub-envio-rapido")).toHaveLength(0);
  });

  it("erro do servidor aparece na tela", async () => {
    mockHub.mandarConvite.mockRejectedValue(Object.assign(new Error("O WhatsApp da loja está pausado. Nada foi enviado."), { code: "PAUSADO" }));
    const r = await abrirThread();
    await digitar(r, "hub-convite-campo-produto", "o cinto");
    await digitar(r, "hub-convite-campo-ate", "sábado");
    await tocar(r, "hub-fechada-mandar");
    expect(tudo(r)).toContain("O WhatsApp da loja está pausado. Nada foi enviado.");
  });
});

describe("sem convite pronto", () => {
  const nenhum = (estado: string) => convites({ convites: [CHEGOU, ORC].map((c) => ({ ...c, estado, pronto: false })) });

  it("nenhum criado: dono pede os convites ao WhatsApp", async () => {
    mockHub.convites.mockResolvedValue(nenhum("NAO_CRIADO"));
    mockHub.prepararConvites.mockResolvedValue({ criados: 2, ja_existiam: 0 });
    const r = await abrirThread();
    expect(porId(r, "hub-fechada-sem-convite")).toHaveLength(1);
    await tocar(r, "hub-fechada-preparar");
    expect(mockHub.prepararConvites).toHaveBeenCalledWith(COMPANY);
    expect(tudo(r)).toContain("Quando ele aprovar, eles aparecem aqui");
  });

  it("membro comum não pede; é orientado a falar com o dono", async () => {
    mockAuth = { company: { id: COMPANY, member_role: "employee" }, isStaff: false };
    mockHub.convites.mockResolvedValue(nenhum("NAO_CRIADO"));
    const r = await abrirThread();
    expect(porId(r, "hub-fechada-preparar")).toHaveLength(0);
    expect(tudo(r)).toContain("Peça ao dono ou a um admin");
  });

  it("em aprovação: só espera", async () => {
    mockHub.convites.mockResolvedValue(nenhum("PENDING"));
    const r = await abrirThread();
    expect(porId(r, "hub-fechada-preparar")).toHaveLength(0);
    expect(tudo(r)).toContain("em aprovação no WhatsApp");
  });

  it("WhatsApp desconectado", async () => {
    mockHub.convites.mockResolvedValue(convites({ conectado: false, convites: [] }));
    const r = await abrirThread();
    expect(tudo(r)).toContain("Conecte o WhatsApp da loja");
  });
});

describe("estado 2 · avisos esgotados", () => {
  const esgotado = () => convites({ saldo: { ...SALDO, restante: 0, esgotado: true } });

  it("diz que acabaram, quando voltam, e oferece o link e o pacote", async () => {
    mockHub.convites.mockResolvedValue(esgotado());
    const r = await abrirThread();
    expect(porId(r, "hub-fechada-esgotado")).toHaveLength(1);
    const t = tudo(r);
    expect(t).toContain("Os 100 avisos de novembro acabaram.");
    expect(t).toContain("Convites voltam em 1º de dezembro.");
    expect(t).toContain("Nada sai além do que a loja contratou, nem por engano.");
    expect(t).toContain("sem custo");
    expect(t).toContain("Só passam a valer depois do pagamento. A Aura nunca compra sozinha.");
    expect(textoDe(porId(r, "hub-fechada-link")[0])).toBe("wa.me/5511987650000");
    expect(textoDe(porId(r, "hub-fechada-pacote")[0])).toBe("Adicionar 200 avisos por R$ 19");
    // nada de convite nem de botão de mandar
    expect(porId(r, "hub-fechada-mandar")).toHaveLength(0);
  });

  it("Copiar meu link copia o wa.me da loja", async () => {
    mockHub.convites.mockResolvedValue(esgotado());
    const r = await abrirThread();
    await tocar(r, "hub-fechada-copiar");
    expect(mockCopiar).toHaveBeenCalledWith("https://wa.me/5511987650000");
    expect(textoDe(porId(r, "hub-fechada-copiar")[0])).toBe("Link copiado");
  });

  it("o pacote só é pedido quando a lojista toca, e abre o pagamento", async () => {
    mockHub.convites.mockResolvedValue(esgotado());
    mockHub.pedirPacoteDeAvisos.mockResolvedValue({ payment_url: "https://pagar.asaas.example/x", needs_manual: false });
    const r = await abrirThread();
    expect(mockHub.pedirPacoteDeAvisos).not.toHaveBeenCalled();
    await tocar(r, "hub-fechada-pacote");
    expect(mockHub.pedirPacoteDeAvisos).toHaveBeenCalledTimes(1);
    expect(mockHub.pedirPacoteDeAvisos).toHaveBeenCalledWith(COMPANY);
    expect(Linking.openURL).toHaveBeenCalledWith("https://pagar.asaas.example/x");
    expect(textoDe(porId(r, "hub-fechada-aviso")[0])).toContain("assim que ele for confirmado");
  });

  it("pacote pendente de ativação manual não abre pagamento", async () => {
    mockHub.convites.mockResolvedValue(esgotado());
    mockHub.pedirPacoteDeAvisos.mockResolvedValue({ payment_url: null, needs_manual: true });
    const r = await abrirThread();
    await tocar(r, "hub-fechada-pacote");
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(textoDe(porId(r, "hub-fechada-aviso")[0])).toContain("A equipe da Aura ativa o pacote");
  });

  it("Essencial sem renovação: não promete data", async () => {
    mockHub.convites.mockResolvedValue(convites({ saldo: { ...SALDO, restante: 0, esgotado: true, renova_em: null } }));
    const r = await abrirThread();
    expect(tudo(r)).toContain("Esses avisos não renovam sozinhos.");
    expect(tudo(r)).not.toContain("Convites voltam em");
  });

  it("o servidor recusa por saldo no meio do envio: a tela vira o estado 2 na hora", async () => {
    mockHub.mandarConvite.mockRejectedValue(Object.assign(new Error("Os avisos do mês acabaram."), { code: "SALDO_ESGOTADO" }));
    const r = await abrirThread();
    await digitar(r, "hub-convite-campo-produto", "o cinto");
    await digitar(r, "hub-convite-campo-ate", "sábado");
    mockHub.convites.mockResolvedValue(esgotado());
    await tocar(r, "hub-fechada-mandar");
    expect(porId(r, "hub-fechada-esgotado")).toHaveLength(1);
  });
});

describe("celular", () => {
  beforeEach(() => { mockWide = false; });

  it("conversa aberta: 'Aberta até', 72 avisos, 'Mandar para a Bia · tudo grátis agora'", async () => {
    mockHub.conversations.mockResolvedValue({ conversations: [conv({ last_inbound_at: recente })], counts: [] });
    mockHub.messages.mockResolvedValue({ conversation: conv({ last_inbound_at: recente }), messages: [], pending_approvals: [] });
    mockHub.catalogo = jest.fn();
    const r = await abrirThread();
    expect(textoDe(porId(r, "hub-thread-avisos")[0])).toBe("72 avisos");
    const bar = textoDe(porId(r, "hub-janela-aberta")[0]);
    expect(bar).toContain("Conversa aberta");
    expect(bar).not.toContain("responder não gasta mensagens"); // enxuto: o aviso vira "tudo grátis agora"
    const t = tudo(r);
    expect(t).toContain("Mandar para Bia");
    expect(t).toContain("tudo grátis agora");
    ["produto", "orcamento", "pix", "link_loja", "foto"].forEach((k) => expect(porId(r, `hub-envio-${k}`)).toHaveLength(1));
  });

  it("cliente e etiquetas ficam atrás de um toque", async () => {
    const r = await abrirThread();
    expect(porId(r, "hub-etiquetas")).toHaveLength(0);
    expect(porId(r, "hub-cliente-sem")).toHaveLength(0);
    await tocar(r, "hub-detalhes-toggle");
    expect(porId(r, "hub-etiquetas")).toHaveLength(1);
    await tocar(r, "hub-detalhes-toggle");
    expect(porId(r, "hub-etiquetas")).toHaveLength(0);
  });

  it("sem saldo no servidor o cabeçalho não mostra número nenhum", async () => {
    mockHub.saldoAvisos.mockRejectedValue(new Error("404"));
    const r = await abrirThread();
    expect(porId(r, "hub-thread-avisos")).toHaveLength(0);
  });

  it("a conversa fechada também funciona no celular", async () => {
    const r = await abrirThread();
    expect(porId(r, "hub-fechada")).toHaveLength(1);
  });
});

describe("formatos", () => {
  it("mesPorExtenso e reaisDeCentavos", () => {
    expect(mesPorExtenso("2026-12-01")).toBe("dezembro");
    expect(mesPorExtenso(null)).toBe("");
    expect(reaisDeCentavos(1900)).toBe("R$ 19");
    expect(reaisDeCentavos(6990)).toBe("R$ 69,90");
  });
});
