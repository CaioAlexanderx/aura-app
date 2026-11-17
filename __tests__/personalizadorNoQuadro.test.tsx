// ============================================================
// p-181 — o personalizador no quadro (iframe) da loja comum
//
// Rota `/<slug>/personalizar/<id>` (PersonalizadorNoQuadro.tsx) e o
// contrato de mensagens com a página mãe (mensagensDoQuadro.ts):
//   1. as regras puras: quais origens contam como a loja, qual é a da
//      mãe, o que é aceito de entrada, o tema da URL, a miniatura;
//   2. a rota desenhada com uma peça de teste: só o personalizador, o
//      "pronto" sai com a origem da loja, a confirmação leva a
//      customization validada, o preço do servidor e a miniatura;
//   3. origem estranha: nada desenhado, nada enviado, mensagem ignorada;
//   4. a vitrine Studio continua igual (a mesma página, sem o quadro).
// ============================================================
import React from "react";
import { render, screen, fireEvent, waitFor, configure, act } from "@testing-library/react-native";

configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);

jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return { __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path") };
});
jest.mock("expo-router", () => ({
  Slot: () => null,
  router: { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock("@/components/studio/storefront/LivePreview", () => {
  const R = require("react");
  return {
    LivePreview: (p: any) => R.createElement("div", { "data-testid": "mockup" }, "mockup-" + (p.lado || "front")),
    defaultConfiguratorSize: () => 320,
  };
});

import { PersonalizadorNoQuadro } from "@/components/studio/storefront/quadro/PersonalizadorNoQuadro";
import {
  FONTE_DA_LOJA, FONTE_DO_QUADRO, ORIGEM_DA_LOJA_AURA,
  lerMensagemDaLoja, normalizarOrigem, origemDaLoja, origensPermitidas, temaDaConsulta,
} from "@/components/studio/storefront/quadro/mensagensDoQuadro";
import { imagemDoCanvas, maiorCanvas, miniaturaDaPeca } from "@/components/studio/storefront/quadro/miniaturaDoQuadro";
import { CascaDaVitrine } from "@/components/studio/storefront/PaginaDaVitrine";
import { ProvedorDaRota, TelaNaRota, ehPaginaDoPosCompra, ehPaginaDoQuadro, ehPaginaSemCasca } from "@/components/studio/storefront/VitrineNaRota";
import { linhaDaPeca } from "@/components/studio/storefront/useStorefront";

const LOJA = ORIGEM_DA_LOJA_AURA;

const CANECA = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Caneca Branca", description: "Caneca de cerâmica, 325 ml.", price: 49.9,
  image_url: "https://x/branca.jpg", gallery_urls: ["https://x/branca.jpg"],
  category: "Canecas", category_id: "cat-canecas", category_slug: "canecas",
  stock_qty: 0, pedidos: 0, qty_tiers: [], templates: [],
  customization_config: {
    print_area: { width_cm: 20, height_cm: 9 },
    has_back: true, back_charge_enabled: true, back_price_delta: 8,
    fields: [
      { id: "image", type: "image", side: "front", required: true, label: "Sua arte", config: {} },
      { id: "text", type: "text", side: "front", required: true, label: "Nome ou frase", config: { max_chars: 20 } },
      { id: "tv", type: "text", side: "back", required: false, label: "Nome ou frase do verso", config: {} },
      { id: "color", type: "color", side: "front", required: true, label: "Cor", config: { colors: ["#F7F4EE", "#1F1B18"] } },
      { id: "art_service", type: "option", side: "front", required: false, label: "Quem cria a arte",
        config: { is_art_service: true, choices: [
          { value: "none", label: "Vou enviar minha arte pronta", price_delta: 0 },
          { value: "designer", label: "Criem a arte pra mim", price_delta: 25 },
        ] } },
    ],
  },
};

function loja(extra: any = {}) {
  return {
    products: [CANECA],
    categories: [{ id: "cat-canecas", name: "Canecas", slug: "canecas", path: "/canecas", depth: 0, parent_id: null }],
    sla: { sla_base_days: 3, queue_qty: 0, total_estimate_days: 3 },
    payment: { has_pix: true, has_card: true, pay_on_delivery_enabled: false, pix_discount_pct: 5, card_max_installments: 3 },
    revisions: { max_included: 2, extra_price: 10, policy_text: null },
    delivery: { pickup_enabled: true, delivery_enabled: true, courier_pickup_enabled: false, delivery_fee: 0 },
    pedidos: { aceita: true, motivo: null, recado: null, pedidos_ate: null },
    total_products: 1,
    ...extra,
    site: {
      name: "Ateliê de Teste", primary_color: "#1a1612", accent_color: "#1a1612", logo_url: null,
      whatsapp: "12999990001", vitrine_v2: true,
      ...(extra.site || {}),
    },
  };
}

const fetchOriginal = global.fetch;
let pedidosDeCotacao: any[] = [];
function servidor(store: any, cotacao: (body: any) => { status: number; json: any } = (b) => ({
  status: 200,
  json: { itens: [{ indice: 0, preco_unitario: 49.9, total: 74.9 }], subtotal: 74.9, desconto_pix: 0, total: 74.9, total_pix: 74.9 },
})) {
  pedidosDeCotacao = [];
  global.fetch = jest.fn((url: string, init?: any) => {
    const u = String(url);
    if (u.endsWith("/studio/products")) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(store) });
    if (u.endsWith("/studio/cotacao")) {
      const body = JSON.parse(init?.body || "{}");
      pedidosDeCotacao.push(body);
      const r = cotacao(body);
      return Promise.resolve({ ok: r.status < 400, status: r.status, json: () => Promise.resolve(r.json) });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: "nao" }) });
  }) as any;
}

// ── A janela mãe falsa ───────────────────────────────────────
// No jsdom `window.parent === window`; o quadro precisa estar enquadrado.
const paiOriginal = Object.getOwnPropertyDescriptor(window, "parent");
let mae: { postMessage: jest.Mock };
function enquadrar() {
  mae = { postMessage: jest.fn() };
  Object.defineProperty(window, "parent", { configurable: true, get: () => mae });
}
function desenquadrar() {
  if (paiOriginal) Object.defineProperty(window, "parent", paiOriginal);
}
const enviadas = (tipo?: string) =>
  mae.postMessage.mock.calls.filter((c) => !tipo || c[0]?.tipo === tipo);

/** Uma mensagem chegando da janela `de`, com a origem `origem`. */
function chegar(data: any, origem: string, de: any = mae) {
  const e = new MessageEvent("message", { data, origin: origem });
  Object.defineProperty(e, "source", { value: de });
  act(() => { window.dispatchEvent(e); });
}

beforeEach(() => {
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch {}
  enquadrar();
});
afterEach(() => { global.fetch = fetchOriginal; desenquadrar(); });

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);
// Sob react-native-web o testID vira `data-testid` no host; a busca é
// pela prop (vitrineStudioPosCompraTela.test.tsx).
const temId = (id: string) => screen.UNSAFE_queryAllByProps({ testID: id }).length > 0;
const porId = (id: string) => screen.UNSAFE_getAllByProps({ testID: id })[0];
const acharId = (id: string) => waitFor(() => { if (!temId(id)) throw new Error("sem " + id); });

function montarQuadro(consulta: Record<string, unknown> = { origem: LOJA }, store = loja()) {
  servidor(store);
  return render(<PersonalizadorNoQuadro slug="atelie-teste" produtoId={CANECA.id} consulta={consulta} />);
}

// ── 1. Regras puras ──────────────────────────────────────────

describe("quem conta como a loja", () => {
  test("loja.getaura.com.br, a própria origem e o domínio próprio ativo", () => {
    expect(origensPermitidas({})).toEqual([LOJA]);
    expect(origensPermitidas({ propria: "https://loja.getaura.com.br/x/personalizar/1" })).toEqual([LOJA]);
    expect(origensPermitidas({ propria: "https://app.getaura.com.br", dominioProprio: "MinhaLoja.com.br" }))
      .toEqual([LOJA, "https://app.getaura.com.br", "https://minhaloja.com.br"]);
    // Domínio malformado não entra; http fora do desenvolvimento também não.
    expect(origensPermitidas({ dominioProprio: "javascript:alert(1)" })).toEqual([LOJA]);
    expect(origensPermitidas({ propria: "http://localhost:8081" })).toEqual([LOJA]);
    expect(origensPermitidas({ propria: "http://localhost:8081", dev: true })).toEqual([LOJA, "http://localhost:8081"]);
  });

  test("normalizarOrigem: só https (http só localhost em desenvolvimento), sem caminho nem usuário", () => {
    expect(normalizarOrigem("https://loja.getaura.com.br/atelie?x=1")).toBe(LOJA);
    expect(normalizarOrigem("http://loja.getaura.com.br")).toBeNull();
    expect(normalizarOrigem("https://a:b@loja.getaura.com.br")).toBeNull();
    expect(normalizarOrigem("data:text/html,oi")).toBeNull();
    expect(normalizarOrigem(42)).toBeNull();
    expect(normalizarOrigem("http://127.0.0.1:5500", true)).toBe("http://127.0.0.1:5500");
  });

  test("a origem da mãe: o navegador manda; sem ele, o ?origem=; sem os dois, o referrer", () => {
    const permitidas = [LOJA];
    expect(origemDaLoja({ enquadrado: false, pedida: LOJA, permitidas })).toBeNull();
    expect(origemDaLoja({ enquadrado: true, ancestral: LOJA, permitidas })).toBe(LOJA);
    // O ancestral que o navegador informa vence um ?origem= de mentira.
    expect(origemDaLoja({ enquadrado: true, ancestral: "https://golpe.example", pedida: LOJA, permitidas })).toBeNull();
    expect(origemDaLoja({ enquadrado: true, pedida: LOJA, permitidas })).toBe(LOJA);
    expect(origemDaLoja({ enquadrado: true, pedida: "https://golpe.example", permitidas })).toBeNull();
    expect(origemDaLoja({ enquadrado: true, referrer: LOJA + "/atelie/p/1", permitidas })).toBe(LOJA);
    expect(origemDaLoja({ enquadrado: true, permitidas })).toBeNull();
  });

  test("entrada: só da origem da loja, da janela mãe e no envelope do contrato", () => {
    const ok = { fonte: FONTE_DA_LOJA, versao: 1, tipo: "editar", customization: { text: "Ana" }, quantidade: 2 };
    const ctx = { origemDaLoja: LOJA, fonteOk: true };
    expect(lerMensagemDaLoja({ origin: LOJA, data: ok }, ctx)).toEqual({ tipo: "editar", customization: { text: "Ana" }, quantidade: 2 });
    expect(lerMensagemDaLoja({ origin: "https://golpe.example", data: ok }, ctx)).toBeNull();
    expect(lerMensagemDaLoja({ origin: LOJA, data: ok }, { ...ctx, fonteOk: false })).toBeNull();
    expect(lerMensagemDaLoja({ origin: LOJA, data: ok }, { ...ctx, origemDaLoja: null })).toBeNull();
    expect(lerMensagemDaLoja({ origin: LOJA, data: { ...ok, fonte: "outra" } }, ctx)).toBeNull();
    expect(lerMensagemDaLoja({ origin: LOJA, data: { ...ok, versao: 2 } }, ctx)).toBeNull();
    expect(lerMensagemDaLoja({ origin: LOJA, data: { ...ok, tipo: "apagar" } }, ctx)).toBeNull();
    expect(lerMensagemDaLoja({ origin: LOJA, data: { ...ok, customization: [1] } }, ctx)).toBeNull();
    expect(lerMensagemDaLoja({ origin: LOJA, data: { ...ok, quantidade: -3 } }, ctx)?.quantidade).toBe(1);
    expect(lerMensagemDaLoja({ origin: LOJA, data: "texto" }, ctx)).toBeNull();
  });

  test("o tema da URL: cor hex, modo conhecido, fonte simples; o resto vira null", () => {
    expect(temaDaConsulta({ cor: "#1A1612", modo: "Escuro", fonte: "editorial" })).toEqual({ cor: "#1A1612", modo: "escuro", fonte: "editorial" });
    expect(temaDaConsulta({ cor: "red; background:url(x)", modo: "neon", fonte: "a b" })).toEqual({ cor: null, modo: null, fonte: null });
    expect(temaDaConsulta(undefined)).toEqual({ cor: null, modo: null, fonte: null });
  });
});

describe("a miniatura", () => {
  const canvas = (w: number, h: number) => ({ width: w, height: h, getBoundingClientRect: () => ({ width: w, height: h }) });
  test("o maior canvas do palco, reduzido a uma imagem", () => {
    const grande = canvas(600, 600);
    const raiz = { querySelectorAll: () => [canvas(40, 40), grande, canvas(0, 0)] };
    expect(maiorCanvas(raiz)).toBe(grande);
    const desenho = { fillRect: jest.fn(), drawImage: jest.fn(), fillStyle: "" };
    const alvo: any = { getContext: () => desenho, toDataURL: () => "data:image/jpeg;base64,AAA" };
    expect(imagemDoCanvas(grande, { criar: () => alvo })).toBe("data:image/jpeg;base64,AAA");
    expect(alvo.width).toBe(240);
    expect(desenho.drawImage).toHaveBeenCalledWith(grande, 0, 0, 240, 240);
  });

  test("canvas recusado ou ausente: a foto https da peça; sem ela, nada", () => {
    const sujo: any = { getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => { throw new Error("SecurityError"); } };
    expect(imagemDoCanvas(canvas(10, 10), { criar: () => sujo })).toBeNull();
    expect(miniaturaDaPeca({ raiz: null, fotoDaPeca: "https://x/branca.jpg" })).toBe("https://x/branca.jpg");
    expect(miniaturaDaPeca({ raiz: null, fotoDaPeca: "javascript:alert(1)" })).toBeNull();
  });
});

describe("as rotas da loja sem a casca", () => {
  test("o quadro e o pós-compra saem da casca; a peça fica nela", () => {
    expect(ehPaginaDoQuadro(["[slug]", "personalizar", "[id]"])).toBe(true);
    expect(ehPaginaSemCasca(["[slug]", "personalizar", "[id]"])).toBe(true);
    expect(ehPaginaSemCasca(["[slug]", "acompanhar", "[token]"])).toBe(true);
    expect(ehPaginaDoPosCompra(["[slug]", "personalizar", "[id]"])).toBe(false);
    expect(ehPaginaSemCasca(["[slug]", "p", "[id]"])).toBe(false);
    expect(ehPaginaDoQuadro(["studio", "personalizar"])).toBe(false);
  });

  test("a rota existe na árvore de app/", () => {
    const fs = require("fs");
    const path = require("path");
    expect(fs.existsSync(path.join(__dirname, "..", "app", "[slug]", "personalizar", "[id].tsx"))).toBe(true);
  });
});

describe("linhaDaPeca (a mesma do commit da vitrine)", () => {
  test("falta campo: a mensagem; completo: a linha sem o verso não escolhido", () => {
    const base = { produto: CANECA as any, qty: 2, addBack: false, addMiddle: false };
    expect(linhaDaPeca({ ...base, values: { color: "#F7F4EE" } })).toEqual({ erro: 'Envie sua arte em "Sua arte"' });
    const r: any = linhaDaPeca({ ...base, values: { color: "#F7F4EE", art_service: "designer", text: "Ana", tv: "verso" } });
    expect(r.linha.qty).toBe(2);
    expect(r.linha.values).toEqual({ color: "#F7F4EE", art_service: "designer", text: "Ana", has_middle_selected: false });
    expect(r.linha.hasBackSelected).toBe(false);
  });
});

// ── 2. A rota desenhada ──────────────────────────────────────

describe("o personalizador no quadro", () => {
  test("só o personalizador: sem cabeçalho da loja, trilha, entrega, rodapé nem 'Comprar agora'", async () => {
    montarQuadro();
    await acharId("cabecalho-do-quadro");
    expect(naTela("Personalizar · Caneca Branca")).toBe(true);
    expect(screen.getByLabelText("Adicionar à sacola")).toBeTruthy();
    expect(naTela("Comprar agora")).toBe(false);
    expect(temId("botao-da-sacola")).toBe(false);
    expect(naTela("Início")).toBe(false);
    expect(naTela("Entrega ou retirada")).toBe(false);
    expect(naTela("Comprando para evento ou empresa?")).toBe(false);
    expect(temId("secao-entrega")).toBe(false);
    // O personalizador continua o de hoje: cor, arte, quantidade e o preço ao vivo.
    expect(temId("secao-cor")).toBe(true);
    expect(temId("secao-arte")).toBe(true);
    expect(temId("secao-quantidade")).toBe(true);
    expect(naTela("R$ 49,90")).toBe(true);
  });

  test("avisa 'pronto' à loja, com a origem da loja como destino (nunca '*')", async () => {
    montarQuadro();
    await acharId("cabecalho-do-quadro");
    await waitFor(() => expect(enviadas("pronto")).toHaveLength(1));
    const [msg, destino] = enviadas("pronto")[0];
    expect(destino).toBe(LOJA);
    expect(msg).toEqual({ fonte: FONTE_DO_QUADRO, versao: 1, tipo: "pronto", produto_id: CANECA.id, nome: "Caneca Branca" });
    expect(mae.postMessage.mock.calls.every((c) => c[1] === LOJA)).toBe(true);
  });

  test("com pendência a peça não sai: a barra diz o que falta e nada vai para a loja", async () => {
    montarQuadro();
    await acharId("cabecalho-do-quadro");
    fireEvent.press(screen.getByLabelText("Adicionar à sacola"));
    expect(naTela("Falta a arte da frente")).toBe(true);
    expect(enviadas("confirmou")).toHaveLength(0);
    expect(pedidosDeCotacao).toHaveLength(0);
  });

  test("confirmar: a customization validada, o preço do servidor, o resumo e a miniatura", async () => {
    montarQuadro();
    await acharId("cabecalho-do-quadro");
    fireEvent.press(screen.getByLabelText("Criem a arte pra mim, +R$ 25,00"));
    fireEvent.changeText(screen.getByLabelText("Nome ou frase"), "Ana");
    await waitFor(() => expect(naTela("Tudo pronto para a sacola")).toBe(true));
    fireEvent.press(screen.getByLabelText("Adicionar à sacola"));
    await waitFor(() => expect(enviadas("confirmou")).toHaveLength(1));

    // A cotação recebeu o item exatamente como o pedido mandaria.
    expect(pedidosDeCotacao).toHaveLength(1);
    const item = pedidosDeCotacao[0].items[0];
    expect(item).toMatchObject({ product_id: CANECA.id, quantity: 1 });

    const [msg, destino] = enviadas("confirmou")[0];
    expect(destino).toBe(LOJA);
    expect(msg).toMatchObject({
      fonte: FONTE_DO_QUADRO, versao: 1, tipo: "confirmou",
      produto_id: CANECA.id, nome: "Caneca Branca", quantidade: 1, editando: false,
      preco: { unitario: 49.9, total: 74.9, fonte: "servidor" },
      // Sem canvas no teste (o motor é um stub): a foto da peça.
      miniatura: "https://x/branca.jpg",
    });
    expect(msg.customization).toEqual(item.customization);
    expect(msg.customization).toMatchObject({ text: "Ana", art_service: "designer", has_back_selected: false, has_middle_selected: false });
    // O verso não escolhido sai sem os campos dele.
    expect("tv" in msg.customization).toBe(false);
    expect(Array.isArray(msg.resumo)).toBe(true);
    expect(msg.resumo.join(" · ")).toContain("Ana");
    // A peça NÃO entrou na sacola do app: a sacola é a da loja.
    expect(JSON.parse(localStorage.getItem("aura-studio-storefront-atelie-teste") || "[]")).toHaveLength(0);
    expect(await screen.findByLabelText("Adicionado à sacola")).toBeTruthy();
  });

  test("o servidor recusa a peça: o motivo na barra, nada vai para a loja", async () => {
    servidor(loja(), () => ({ status: 400, json: { error: 'Personalizacao de "Caneca Branca": campo "Nome ou frase" obrigatorio', indice: 0 } }));
    render(<PersonalizadorNoQuadro slug="atelie-teste" produtoId={CANECA.id} consulta={{ origem: LOJA }} />);
    await acharId("cabecalho-do-quadro");
    fireEvent.press(screen.getByLabelText("Criem a arte pra mim, +R$ 25,00"));
    fireEvent.changeText(screen.getByLabelText("Nome ou frase"), "Ana");
    await waitFor(() => expect(naTela("Tudo pronto para a sacola")).toBe(true));
    fireEvent.press(screen.getByLabelText("Adicionar à sacola"));
    await waitFor(() => expect(naTela("campo \\\"Nome ou frase\\\" obrigatorio")).toBe(true));
    expect(enviadas("confirmou")).toHaveLength(0);
  });

  test("sem rede para a cotação: confirma com a estimativa", async () => {
    servidor(loja());
    const f = global.fetch as jest.Mock;
    const original = f.getMockImplementation()!;
    f.mockImplementation((url: string, init?: any) =>
      String(url).endsWith("/studio/cotacao") ? Promise.reject(new Error("offline")) : original(url, init));
    render(<PersonalizadorNoQuadro slug="atelie-teste" produtoId={CANECA.id} consulta={{ origem: LOJA }} />);
    await acharId("cabecalho-do-quadro");
    fireEvent.press(screen.getByLabelText("Criem a arte pra mim, +R$ 25,00"));
    fireEvent.changeText(screen.getByLabelText("Nome ou frase"), "Ana");
    await waitFor(() => expect(naTela("Tudo pronto para a sacola")).toBe(true));
    fireEvent.press(screen.getByLabelText("Adicionar à sacola"));
    await waitFor(() => expect(enviadas("confirmou")).toHaveLength(1));
    expect(enviadas("confirmou")[0][0].preco).toEqual({ unitario: 49.9, total: 74.9, fonte: "estimativa" });
  });

  test("fechar avisa 'cancelou'", async () => {
    montarQuadro();
    await acharId("cabecalho-do-quadro");
    fireEvent.press(porId(temId("quadro-fechar") ? "quadro-fechar" : "quadro-voltar"));
    expect(enviadas("cancelou")).toHaveLength(1);
    expect(enviadas("cancelou")[0]).toEqual([{ fonte: FONTE_DO_QUADRO, versao: 1, tipo: "cancelou", produto_id: CANECA.id }, LOJA]);
  });

  test("'editar' da loja reabre a peça com o item e o botão vira 'Atualizar item'", async () => {
    montarQuadro();
    await acharId("cabecalho-do-quadro");
    await waitFor(() => expect(enviadas("pronto")).toHaveLength(1));
    chegar({ fonte: FONTE_DA_LOJA, versao: 1, tipo: "editar", quantidade: 3,
      customization: { text: "Bia", art_service: "designer", color: "#1F1B18", has_back_selected: false, has_middle_selected: false } }, LOJA);
    expect(await screen.findByLabelText(/Atualizar item/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/Atualizar item/));
    await waitFor(() => expect(enviadas("confirmou")).toHaveLength(1));
    const [msg] = enviadas("confirmou")[0];
    expect(msg).toMatchObject({ editando: true, quantidade: 3 });
    expect(msg.customization).toMatchObject({ text: "Bia", color: "#1F1B18" });
  });

  test("tema pela URL: a cor da loja comum vence a do cadastro", async () => {
    montarQuadro({ origem: LOJA, cor: "#0E7A43" });
    await acharId("cabecalho-do-quadro");
    // O botão primário é pintado com a cor da loja (marcaFill do tema).
    expect(JSON.stringify(screen.toJSON())).toMatch(/0e7a43|14,\s*122,\s*67/i);
  });

  test("peça fora da loja: avisa 'erro' e oferece voltar", async () => {
    servidor(loja({ products: [] }));
    render(<PersonalizadorNoQuadro slug="atelie-teste" produtoId={CANECA.id} consulta={{ origem: LOJA }} />);
    await acharId("quadro-peca-indisponivel");
    await waitFor(() => expect(enviadas("erro")).toHaveLength(1));
    expect(enviadas("erro")[0]).toEqual([{ fonte: FONTE_DO_QUADRO, versao: 1, tipo: "erro", motivo: "produto_indisponivel" }, LOJA]);
  });
});

// ── 3. Origem estranha ───────────────────────────────────────

describe("origem estranha", () => {
  test("enquadrado por outro site: nada de personalizador e nada enviado", async () => {
    montarQuadro({ origem: "https://golpe.example" });
    await acharId("quadro-fora-da-loja");
    expect(temId("cabecalho-do-quadro")).toBe(false);
    expect(mae.postMessage).not.toHaveBeenCalled();
  });

  test("aberto fora de um quadro: leva para a loja", async () => {
    desenquadrar();
    servidor(loja());
    render(<PersonalizadorNoQuadro slug="atelie-teste" produtoId={CANECA.id} consulta={{ origem: LOJA }} />);
    await acharId("quadro-fora-da-loja");
    expect(naTela("O personalizador abre pela loja")).toBe(true);
  });

  test("mensagem de origem estranha (ou de outra janela) é ignorada", async () => {
    montarQuadro();
    await acharId("cabecalho-do-quadro");
    await waitFor(() => expect(enviadas("pronto")).toHaveLength(1));
    const editar = { fonte: FONTE_DA_LOJA, versao: 1, tipo: "editar", quantidade: 5, customization: { text: "Golpe" } };
    chegar(editar, "https://golpe.example");
    chegar(editar, LOJA, { postMessage: jest.fn() }); // origem certa, janela errada
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.queryByLabelText(/Atualizar item/)).toBeNull();
    expect(naTela("Golpe")).toBe(false);
    expect(screen.getByLabelText("Adicionar à sacola")).toBeTruthy();
  });
});

// ── 4. A vitrine Studio continua igual ───────────────────────

describe("a vitrine Studio não muda", () => {
  test("a mesma página sem o quadro: cabeçalho da loja, trilha, 'Comprar agora', entrega e orçamento em lote", async () => {
    desenquadrar();
    servidor(loja());
    const navegar = jest.fn();
    try { window.sessionStorage.setItem("aura-vitrine-na-aba-atelie-teste", "1"); } catch {}
    render(
      <ProvedorDaRota navegar={navegar}>
        <CascaDaVitrine slug="atelie-teste" navegar={navegar}>
          <TelaNaRota tela={{ tipo: "produto", id: CANECA.id }} />
        </CascaDaVitrine>
      </ProvedorDaRota>,
    );
    expect(await screen.findByLabelText("Adicionar à sacola")).toBeTruthy();
    expect(temId("cabecalho-do-quadro")).toBe(false);
    expect(temId("botao-da-sacola")).toBe(true);
    expect(naTela("Comprar agora")).toBe(true);
    expect(naTela("Início")).toBe(true);
    expect(temId("secao-entrega")).toBe(true);
    expect(naTela("Comprando para evento ou empresa?")).toBe(true);
    // Adicionar continua gravando na sacola do app.
    fireEvent.press(screen.getByLabelText("Criem a arte pra mim, +R$ 25,00"));
    fireEvent.changeText(screen.getByLabelText("Nome ou frase"), "Ana");
    await waitFor(() => expect(naTela("Tudo pronto para a sacola")).toBe(true));
    fireEvent.press(screen.getByLabelText("Adicionar à sacola"));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("aura-studio-storefront-atelie-teste") || "[]")).toHaveLength(1));
  });
});
