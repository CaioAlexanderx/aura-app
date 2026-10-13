// ============================================================
// Gestão Aura › Hoje › Contatos › ficha da conversa (13/10/2026)
//
// Aura-backend#815: o bloco Contatos traz `conversa_id` por contato do
// WhatsApp e GET /admin/painel/contatos/:conversaId devolve telefone, link,
// empresa, situação e as últimas 200 mensagens. Clicar no contato abre a
// conversa: telefone completo com link wa.me, empresa (abre a ficha da
// loja), situação e as mensagens em ordem, com quem falou.
// Respostas reais do backend em __tests__/__fixtures__/painel.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return {
    __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"),
    Circle: stub("Circle"), Line: stub("Line"), Text: stub("SvgText"),
  };
});
// O Modal do react-native-web usa portal, que o test renderer não monta.
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return Object.setPrototypeOf({ Modal: ({ visible, children }: any) => (visible ? children : null) }, RN);
});
jest.mock("@/services/adminApi", () => ({
  adminApi: {
    painel: {
      hoje: jest.fn(), bloco: jest.fn(), ficha: jest.fn(), layout: jest.fn(), salvarLayout: jest.fn(), recalcular: jest.fn(),
      ofx: { extratos: jest.fn(), detalhe: jest.fn() },
      contatos: { conversa: jest.fn() },
    },
  },
}));

import { Linking } from "react-native";
import { PainelHoje } from "@/components/admin/painel/PainelHoje";
import { PAINEL_FALLBACK_DEV } from "@/components/admin/painel/usePainelHoje";
import { adaptarConversa } from "@/components/admin/painel/adaptadores";
import { adminApi } from "@/services/adminApi";

const api = (adminApi as any).painel as Record<string, any>;
const fx = (nome: string) => JSON.parse(JSON.stringify(require("../__fixtures__/painel/" + nome + ".json")));

const RENATA = "dddddddd-0000-4000-8000-000000000001";
const SEM_NOME = "dddddddd-0000-4000-8000-000000000004";
const MERCADO = "aaaaaaaa-0000-4000-8000-000000000002";

jest.setTimeout(30000);

let abrirUrl: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  PAINEL_FALLBACK_DEV.dadosDeExemplo = false;
  delete (global as any).__DEV__;
  api.hoje.mockImplementation(async () => fx("hoje"));
  api.bloco.mockImplementation(async (id: string) => fx("blocos." + id));
  api.ficha.mockImplementation(async () => fx("clientes.ficha"));
  api.layout.mockImplementation(async () => fx("layout.get"));
  api.recalcular.mockImplementation(async () => fx("recalcular"));
  api.ofx.extratos.mockImplementation(async () => ({ meses: [] }));
  api.contatos.conversa.mockImplementation(async () => fx("contatos.conversa"));
  abrirUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as any);
});
afterEach(() => { abrirUrl.mockRestore(); });

async function flush(vezes = 3) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><PainelHoje /></QueryClientProvider>);
  });
  await flush();
  await act(async () => {
    tree.root.findAllByProps({ testID: "painel-hoje" }, { deep: false })[0].props.onLayout({ nativeEvent: { layout: { width: 1200 } } });
  });
  return tree;
}

const byTestId = (tree: renderer.ReactTestRenderer, id: string) => tree.root.findAllByProps({ testID: id }, { deep: false });
// Texto visível, com os pedaços de cada <Text> juntos.
function plano(no: any): string {
  if (no == null) return "";
  if (typeof no === "string") return no;
  if (Array.isArray(no)) return no.map(plano).join("");
  return plano(no.children);
}
const text = (tree: renderer.ReactTestRenderer) => plano(tree.toJSON());
async function press(tree: renderer.ReactTestRenderer, id: string) {
  const alvo = byTestId(tree, id);
  if (!alvo.length) throw new Error("testID não encontrado: " + id);
  await act(async () => { alvo[0].props.onPress(); });
  await flush();
}
async function abrirContatos(tree: renderer.ReactTestRenderer) {
  await press(tree, "bloco-expandir-contatos");
  await flush();
}

describe("lista do bloco Contatos", () => {
  it("contato do WhatsApp: o nome (ou o telefone mascarado) abre a conversa e a empresa abre a ficha", async () => {
    const tree = await mount();
    await abrirContatos(tree);
    expect(api.bloco).toHaveBeenCalledWith("contatos", undefined);

    // com nome
    expect(byTestId(tree, "contato-" + RENATA)).toHaveLength(1);
    expect(text(tree)).toContain("Renata Lima");
    // sem nome: vale o telefone mascarado, sem link de WhatsApp
    expect(byTestId(tree, "contato-" + SEM_NOME)).toHaveLength(1);
    expect(text(tree)).toContain("+55 11 *****-0004");
    expect(byTestId(tree, "whatsapp-5511000004")).toHaveLength(0);
    // empresa vinculada: abre a ficha da loja
    expect(byTestId(tree, "loja-" + MERCADO)).toHaveLength(1);
    // contato do site não abre conversa (conversa_id null)
    expect(text(tree)).toContain("Marina Prado");
    tree.unmount();
  });
});

describe("modal da conversa", () => {
  it("abre com GET /admin/painel/contatos/:conversaId e mostra telefone, empresa, situação e as mensagens em ordem", async () => {
    const tree = await mount();
    await abrirContatos(tree);
    await press(tree, "contato-" + RENATA);

    expect(api.contatos.conversa).toHaveBeenCalledWith(RENATA);
    expect(byTestId(tree, "conversa-modal")).toHaveLength(1);
    const t = text(tree);
    expect(t).toContain("Renata Lima");
    // telefone inteiro (não o mascarado) e a empresa
    expect(t).toContain("+55 11 99990-0002");
    expect(t).toContain("Mercado Bela Vista");
    // situação e indicadores
    expect(t).toContain("Caio");
    expect(t).toContain("Primeira resposta do Caio");
    expect(t).toContain("depois de 8 h 30 min");

    // mensagens na ordem do tempo, com quem falou
    for (const id of ["m04", "m05", "m06"]) expect(byTestId(tree, "mensagem-" + id)).toHaveLength(1);
    const a = t.indexOf("Renata · 12/10 23:40");
    const b = t.indexOf("Aurinha · 12/10 23:40");
    const c = t.indexOf("Caio · 13/10 08:10");
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(t).toContain("Oi, Renata! Fazemos sim.");
    tree.unmount();
  });

  it("telefone e 'Abrir no WhatsApp' vão para o link wa.me da conversa", async () => {
    const tree = await mount();
    await abrirContatos(tree);
    await press(tree, "contato-" + RENATA);

    await press(tree, "conversa-telefone");
    expect(abrirUrl).toHaveBeenLastCalledWith("https://wa.me/5511999900002");
    await press(tree, "conversa-whatsapp");
    expect(abrirUrl).toHaveBeenLastCalledWith("https://wa.me/5511999900002");
    tree.unmount();
  });

  it("a empresa abre a ficha do cliente (a conversa fecha)", async () => {
    const tree = await mount();
    await abrirContatos(tree);
    await press(tree, "contato-" + RENATA);
    expect(byTestId(tree, "conversa-modal")).toHaveLength(1);

    await press(tree, "conversa-abrir-empresa");
    expect(byTestId(tree, "conversa-modal")).toHaveLength(0);
    expect(byTestId(tree, "ficha-modal")).toHaveLength(1);
    expect(api.ficha).toHaveBeenCalledWith(MERCADO);
    tree.unmount();
  });

  it("sem empresa vinculada diz isso e não oferece a ficha", async () => {
    api.contatos.conversa.mockImplementation(async () => ({
      ...fx("contatos.conversa"), conversa_id: SEM_NOME, nome: null, empresa: null,
      telefone_formatado: "+55 12 98888-0077", telefone: "5512988880077", link_whatsapp: "https://wa.me/5512988880077",
    }));
    const tree = await mount();
    await abrirContatos(tree);
    await press(tree, "contato-" + SEM_NOME);
    expect(byTestId(tree, "conversa-sem-empresa")).toHaveLength(1);
    expect(byTestId(tree, "conversa-abrir-empresa")).toHaveLength(0);
    // sem nome, o título é o telefone
    expect(text(tree)).toContain("+55 12 98888-0077");
    tree.unmount();
  });

  it("conversa truncada avisa que são as últimas 200", async () => {
    api.contatos.conversa.mockImplementation(async () => ({ ...fx("contatos.conversa"), truncada: true }));
    const tree = await mount();
    await abrirContatos(tree);
    await press(tree, "contato-" + RENATA);
    expect(byTestId(tree, "conversa-truncada")).toHaveLength(1);
    tree.unmount();
  });

  it("404 (conversa de outro tenant ou número desligado) vira mensagem com 'tentar de novo'", async () => {
    api.contatos.conversa.mockRejectedValueOnce({ status: 404, message: "Conversa não encontrada" });
    const tree = await mount();
    await abrirContatos(tree);
    await press(tree, "contato-" + RENATA);
    expect(byTestId(tree, "conversa-erro")).toHaveLength(1);

    await press(tree, "conversa-tentar-de-novo");
    expect(api.contatos.conversa).toHaveBeenCalledTimes(2);
    expect(byTestId(tree, "conversa-erro")).toHaveLength(0);
    expect(text(tree)).toContain("Oi, Renata! Fazemos sim.");
    tree.unmount();
  });

  it("fecha pelo X", async () => {
    const tree = await mount();
    await abrirContatos(tree);
    await press(tree, "contato-" + RENATA);
    await press(tree, "conversa-modal-fechar");
    expect(byTestId(tree, "conversa-modal")).toHaveLength(0);
    tree.unmount();
  });
});

describe("adaptarConversa", () => {
  it("monta o modelo da tela com a fixture real", () => {
    const c = adaptarConversa(fx("contatos.conversa"));
    expect(c.titulo).toBe("Renata Lima");
    expect(c.telefone).toBe("+55 11 99990-0002");
    expect(c.link).toBe("https://wa.me/5511999900002");
    expect(c.empresa).toEqual({ company_id: MERCADO, nome: "Mercado Bela Vista" });
    expect(c.situacao).toEqual({ texto: "Caio", tom: "sobe" });
    expect(c.indicadores.map((i) => i.rotulo)).toEqual(["Primeiro contato", "Primeira resposta do Caio"]);
    expect(c.indicadores[1]).toMatchObject({ valor: "13/10 08:10", nota: "depois de 8 h 30 min" });
    expect(c.mensagens.map((m) => [m.id, m.quem])).toEqual([["m04", "Renata"], ["m05", "Aurinha"], ["m06", "Caio"]]);
    expect(c.mensagens[0].quando).toBe("12/10 23:40");   // 02:40Z em Brasília
    expect(c.truncada).toBe(false);
  });

  it("sem resposta humana: fala da Aurinha e de quem está esperando; sem nome vira 'Cliente'", () => {
    const raw = fx("contatos.conversa");
    raw.nome = null;
    raw.contato_atual = { ...raw.contato_atual, situacao_rotulo: "Sem resposta", primeira_resposta_humana_em: null, espera_min: null };
    raw.aguardando_resposta_desde = "2026-10-13T11:50:00.000Z";
    raw.contatos_na_conversa = 2;
    // fora de ordem: a tela ordena pelo horário
    raw.mensagens = raw.mensagens.slice().reverse();
    const c = adaptarConversa(raw);
    expect(c.titulo).toBe("+55 11 99990-0002");
    expect(c.situacao).toEqual({ texto: "Sem resposta", tom: "desce" });
    expect(c.indicadores.map((i) => i.rotulo)).toEqual([
      "Primeiro contato", "Primeira resposta da Aurinha", "Sem resposta desde", "Contatos nesta conversa",
    ]);
    expect(c.mensagens[0].quem).toBe("Cliente");
    expect(c.mensagens.map((m) => m.id)).toEqual(["m04", "m05", "m06"]);
  });
});
