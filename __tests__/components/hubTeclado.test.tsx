// ============================================================
// WhatsApp · Conversas — teclado no PC:
//  - lista: role=listbox/option, ↑ ↓ andam, Enter abre e leva o foco à conversa;
//  - filtros: role=radiogroup, setas mudam a seleção;
//  - painéis da barra de ações: Esc fecha e devolve o foco ao botão; ↑ ↓ andam nas opções;
//  - convites da conversa fechada: radiogroup com setas;
//  - "Aurinha responde por você": estado para todos, interruptor só para dono/admin.
// O RN Web entrega o evento do DOM; aqui o evento é simulado, com `currentTarget` falso.
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
  settings: jest.fn(), saveSettings: jest.fn(), conversations: jest.fn(), messages: jest.fn(), send: jest.fn(),
  catalogo: jest.fn(), orcamentos: jest.fn(), etiquetas: jest.fn(), clienteDaConversa: jest.fn(), convites: jest.fn(),
  saldoAvisos: jest.fn(),
};
jest.mock("@/services/hubApi", () => ({
  hubApi: new Proxy({}, { get: (_t, k: string) => (...a: any[]) => (mockHub as any)[k](...a) }),
}));

import { HubView } from "@/components/screens/hub/HubView";
import { tratarSetas, aoTeclarNoPainel } from "@/components/screens/hub/teclado";

const COMPANY = "645c1325-8865-48be-af6f-430d93fb2b6c";
const horasAtras = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const conv = (id: string, nome: string, inb: number) => ({
  id, channel: "whatsapp", external_id: `55119888${id.replace(/\D/g, "").padStart(5, "0")}`, customer_id: null, customer_name: nome,
  status: "humano", category: null, handoff_reason: null, last_inbound_at: horasAtras(inb),
  last_message_at: horasAtras(inb), last_message_preview: "oi", pending_approvals: 0, labels: [],
});
const LISTA = [conv("conv-1", "Ana", 2), conv("conv-2", "Bia", 3), conv("conv-3", "Cris", 4)];
const CONVITE = {
  key: "chegou", titulo: "Chegou o que pediu", estado: "APPROVED", pronto: true,
  partes: ["Oi, ", { campo: "nome" }, "."], campos: [{ key: "nome", rotulo: "Nome", auto: true, exemplo: "Bia", max: 60 }],
};

let qc: QueryClient;
let tree: renderer.ReactTestRenderer | null = null;

beforeEach(() => {
  Object.values(mockHub).forEach((f) => f.mockReset());
  mockAuth = { company: { id: COMPANY, member_role: "owner" }, isStaff: false };
  mockHub.settings.mockResolvedValue({ enabled: false, approval_mode: true, model: null, extra_instructions: null });
  mockHub.saveSettings.mockResolvedValue({ ok: true });
  mockHub.conversations.mockResolvedValue({ conversations: LISTA, counts: [] });
  mockHub.messages.mockImplementation(async (_c: string, id: string) => ({
    conversation: LISTA.find((c) => c.id === id) || LISTA[0], messages: [], pending_approvals: [],
  }));
  mockHub.etiquetas.mockResolvedValue({ labels: [{ id: "l1", name: "Orçamento", color: "#c4b5fd" }, { id: "l2", name: "Pix", color: "#fcd34d" }] });
  mockHub.clienteDaConversa.mockResolvedValue({ cliente: null, sugestao: null });
  mockHub.catalogo.mockResolvedValue({ products: [{ id: "p1", name: "Saia", price: 100, image_url: null }] });
  mockHub.orcamentos.mockResolvedValue({ quotes: [] });
  mockHub.convites.mockResolvedValue({ aberta: false, conectado: true, meu_link: null, saldo: null, auto: { nome: "Bia", loja: "Lume" }, convites: [CONVITE, { ...CONVITE, key: "orc", titulo: "Orçamento pronto" }] });
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
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><HubView /></QueryClientProvider>); });
  await flush();
  return tree!;
}
const porId = (r: renderer.ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id }, { deep: false });
const comTeclado = (r: renderer.ReactTestRenderer, id: string) =>
  r.root.findAll((n) => n.props && n.props.testID === id && typeof n.props.onKeyDown === "function")[0];
const fakeItens = (n: number) => Array.from({ length: n }, () => ({ focus: jest.fn(), click: jest.fn(), contains: () => false }));
const evento = (key: string, itens: any[]) => ({ key, preventDefault: jest.fn(), stopPropagation: jest.fn(), currentTarget: { querySelectorAll: () => itens } });

describe("tratarSetas", () => {
  it("↓ vai ao primeiro quando nada está focado, ↑ ao último; Home e End vão às pontas", () => {
    const a = fakeItens(3);
    expect(tratarSetas(evento("ArrowDown", a), { selector: "x" })).toBe(true);
    expect(a[0].focus).toHaveBeenCalled();
    const b = fakeItens(3);
    tratarSetas(evento("ArrowUp", b), { selector: "x" });
    expect(b[2].focus).toHaveBeenCalled();
    const c = fakeItens(3);
    tratarSetas(evento("End", c), { selector: "x" });
    expect(c[2].focus).toHaveBeenCalled();
    tratarSetas(evento("Home", c), { selector: "x" });
    expect(c[0].focus).toHaveBeenCalled();
  });

  it("radiogroup: a seta também clica (seleciona); outras teclas passam", () => {
    const a = fakeItens(3);
    expect(tratarSetas(evento("ArrowRight", a), { selector: "x", seleciona: true, horizontal: true })).toBe(true);
    expect(a[0].click).toHaveBeenCalled();
    expect(tratarSetas(evento("a", a), { selector: "x" })).toBe(false);
    expect(tratarSetas(evento("ArrowRight", a), { selector: "x" })).toBe(false); // sem horizontal, → não vale
  });

  it("sem DOM (celular nativo, jest): nada acontece e nada quebra", () => {
    expect(tratarSetas({ key: "ArrowDown" }, { selector: "x" })).toBe(false);
  });

  it("painel: Home e End ficam para o texto do campo", () => {
    const a = fakeItens(2);
    aoTeclarNoPainel(evento("End", a), undefined, undefined);
    expect(a[1].focus).not.toHaveBeenCalled();
  });
});

describe("lista de conversas (listbox)", () => {
  it("é um listbox de opções, com tabindex móvel: só a conversa ativa entra no Tab", async () => {
    const r = await montar();
    const lista = comTeclado(r, "hub-lista");
    expect(lista.props.role).toBe("listbox");
    const opcoes = LISTA.map((c) => porId(r, `hub-conv-${c.id}`)[0]);
    opcoes.forEach((o) => expect(o.props.role).toBe("option"));
    expect(opcoes.map((o) => o.props.tabIndex)).toEqual([0, -1, -1]);
  });

  it("↓ move o foco entre as conversas", async () => {
    const r = await montar();
    const itens = fakeItens(3);
    await act(async () => { comTeclado(r, "hub-lista").props.onKeyDown(evento("ArrowDown", itens)); });
    expect(itens[0].focus).toHaveBeenCalled();
  });

  it("Enter abre a conversa e o foco vai para a conversa aberta", async () => {
    const focar = jest.fn();
    const original = document.querySelector;
    const r = await montar();
    const preventDefault = jest.fn();
    (document as any).querySelector = (s: string) => (s.includes("hub-thread-regiao") ? { focus: focar } : original.call(document, s));
    try {
      await act(async () => { porId(r, "hub-conv-conv-2")[0].props.onKeyDown({ key: "Enter", preventDefault }); });
      await act(async () => { await new Promise((x) => setTimeout(x, 350)); });
    } finally {
      (document as any).querySelector = original;
    }
    await flush();
    expect(preventDefault).toHaveBeenCalled();
    expect(mockHub.messages).toHaveBeenCalledWith(COMPANY, "conv-2");
    expect(focar).toHaveBeenCalled();
    expect(porId(r, "hub-thread-regiao")).toHaveLength(1);
  });
});

describe("filtros (radiogroup)", () => {
  it("os estados e as etiquetas são radiogroups; cada opção é um radio com tabindex móvel", async () => {
    const r = await montar();
    const grupos = r.root.findAll((n) => n.props && n.props.role === "radiogroup" && typeof n.props.onKeyDown === "function");
    expect(grupos.length).toBeGreaterThanOrEqual(2);
    const etiquetas = comTeclado(r, "hub-filtro-etiquetas");
    expect(etiquetas.props.role).toBe("radiogroup");
    const radios = [porId(r, "hub-filtro-etiqueta-l1")[0], porId(r, "hub-filtro-etiqueta-l2")[0]];
    expect(radios.map((x) => x.props.role)).toEqual(["radio", "radio"]);
    expect(radios.map((x) => x.props.semTab)).toEqual([false, true]);
  });

  it("→ muda a seleção (foca e clica o próximo)", async () => {
    const r = await montar();
    const itens = fakeItens(2);
    await act(async () => { comTeclado(r, "hub-filtro-etiquetas").props.onKeyDown(evento("ArrowRight", itens)); });
    expect(itens[0].focus).toHaveBeenCalled();
    expect(itens[0].click).toHaveBeenCalled();
  });
});

describe("painéis da barra de ações", () => {
  async function abrirThread() {
    const r = await montar();
    await act(async () => { porId(r, "hub-conv-conv-1")[0].props.onPress(); });
    await flush();
    return r;
  }

  it("Esc fecha o painel e devolve o foco ao botão que abriu", async () => {
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-produto")[0].props.onPress(); });
    await flush();
    expect(porId(r, "hub-envio-painel-produto")).toHaveLength(1);
    const focar = jest.fn();
    const original = document.querySelector;
    (document as any).querySelector = (s: string) => (s.includes('hub-envio-produto"') ? { focus: focar } : original.call(document, s));
    try {
      await act(async () => { comTeclado(r, "hub-envio-painel-produto").props.onKeyDown(evento("Escape", [])); });
      await act(async () => { await new Promise((x) => setTimeout(x, 60)); });
    } finally {
      (document as any).querySelector = original;
    }
    expect(porId(r, "hub-envio-painel-produto")).toHaveLength(0);
    expect(focar).toHaveBeenCalled();
  });

  it("↓ anda entre as opções do painel", async () => {
    const r = await abrirThread();
    await act(async () => { porId(r, "hub-envio-produto")[0].props.onPress(); });
    await flush();
    const itens = fakeItens(2);
    await act(async () => { comTeclado(r, "hub-envio-painel-produto").props.onKeyDown(evento("ArrowDown", itens)); });
    expect(itens[0].focus).toHaveBeenCalled();
  });
});

describe("convites da conversa fechada", () => {
  it("radiogroup com setas; só o convite escolhido entra no Tab", async () => {
    mockHub.conversations.mockResolvedValue({ conversations: [conv("conv-1", "Bia", 40)], counts: [] });
    mockHub.messages.mockResolvedValue({ conversation: conv("conv-1", "Bia", 40), messages: [], pending_approvals: [] });
    const r = await montar();
    await act(async () => { porId(r, "hub-conv-conv-1")[0].props.onPress(); });
    await flush();
    const grupo = r.root.findAll((n) => n.props && n.props.accessibilityLabel === "Convite" && typeof n.props.onKeyDown === "function")[0];
    expect(grupo.props.accessibilityRole).toBe("radiogroup");
    expect(porId(r, "hub-convite-chegou")[0].props.role).toBe("radio");
    expect(porId(r, "hub-convite-chegou")[0].props.semTab).toBe(false);
    expect(porId(r, "hub-convite-orc")[0].props.semTab).toBe(true);
    const itens = fakeItens(2);
    await act(async () => { grupo.props.onKeyDown(evento("ArrowRight", itens)); });
    expect(itens[0].click).toHaveBeenCalled();
  });
});

describe("Aurinha responde por você", () => {
  it("dono vê o estado e o interruptor; ligar abre o convite como antes", async () => {
    const r = await montar();
    expect(porId(r, "hub-aurinha-situacao")[0].props.children).toBe("Desligada");
    // rótulo curto na tela, texto completo para o leitor de tela; sem "IA" na tela
    expect(porId(r, "hub-aurinha-estado")[0].props.accessibilityLabel).toContain("Aurinha responde por você");
    expect(porId(r, "hub-ativar-aurinha")[0].props.accessibilityLabel).toBe("Aurinha responde por você");
    await act(async () => { porId(r, "hub-ativar-aurinha")[0].props.onPress(); });
    await flush();
    expect(porId(r, "hub-convite-aurinha")).toHaveLength(1);
  });

  it("ligada: o interruptor desliga (PUT /hub/settings enabled:false)", async () => {
    mockHub.settings.mockResolvedValue({ enabled: true, approval_mode: true, model: null, extra_instructions: null });
    const r = await montar();
    expect(porId(r, "hub-aurinha-situacao")[0].props.children).toBe("Ligada");
    expect(porId(r, "hub-ativar-aurinha")).toHaveLength(0);
    await act(async () => { porId(r, "hub-desativar-aurinha")[0].props.onPress(); });
    await flush();
    expect(mockHub.saveSettings).toHaveBeenCalledWith(COMPANY, { enabled: false });
  });

  it("membro vê só o estado, sem interruptor", async () => {
    mockAuth = { company: { id: COMPANY, member_role: "member" }, isStaff: false };
    const r = await montar();
    expect(porId(r, "hub-aurinha-situacao")).toHaveLength(1);
    expect(porId(r, "hub-ativar-aurinha")).toHaveLength(0);
    expect(porId(r, "hub-desativar-aurinha")).toHaveLength(0);
  });
});
