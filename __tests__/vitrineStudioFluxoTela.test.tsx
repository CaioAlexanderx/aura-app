// ============================================================
// O fluxo lista → produto → checkout, desenhado (Fase 1C · 25/09/2026)
//
// Primeiros testes de TELA do fluxo de compra (JORNADA D13): a
// regressão que só aparecia no QA da Sheid passa a aparecer aqui.
//   - a temporada aparece na home e perto do botão do produto;
//   - com a loja fechada, a sacola não finaliza: explica com o recado e
//     oferece o orçamento pelo WhatsApp;
//   - a loja que fecha no meio da compra (409) vira o recado, não erro;
//   - sem consentimento nenhum evento sai; com ele, o funil inteiro.
//
// Mesmo arranjo de vitrineStudioErroTela.test.tsx: PaginaDaVitrine de
// verdade, fetch simulado, hostComponentNames declarados.
// ============================================================
import React from "react";
import { Linking } from "react-native";
import { render, screen, fireEvent, waitFor, configure } from "@testing-library/react-native";

// Ver vitrineStudioErroTela.test.tsx: sob react-native-web a detecção
// automática de host components quebra; declarar os nomes a pula.
configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);

jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return {
    __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"),
    Circle: stub("Circle"), Rect: stub("Rect"), G: stub("G"),
  };
});

import { PaginaDaVitrine } from "@/components/studio/storefront/PaginaDaVitrine";

const CANECA = {
  id: "p1", name: "Caneca Alça Coração", description: null, price: 49.9,
  image_url: null, category: null, stock_qty: 10,
  customization_config: null, templates: [],
};

/** "AAAA-MM-DD" daqui a `n` dias, no fuso do teste. */
function daquiA(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function loja(extra: any = {}) {
  return {
    products: [CANECA],
    categories: [],
    sla: { sla_base_days: 5, queue_qty: 0, total_estimate_days: 5 },
    payment: { has_pix: true, has_card: false, pay_on_delivery_enabled: false },
    revisions: { max_included: 2, extra_price: 0, policy_text: null },
    delivery: {
      pickup_enabled: true, delivery_enabled: false, courier_pickup_enabled: false,
      delivery_fee: 0, pickup_eta_text: null, delivery_eta_text: null,
    },
    pedidos: { aceita: true, motivo: null, recado: null, pedidos_ate: null },
    total_products: 1,
    ...extra,
    site: {
      name: "Sheid Mania", primary_color: "#1a1612", accent_color: "#1a1612",
      logo_url: null, whatsapp: "12999990001",
      rastreadores: { ga4: null, pixel: null },
      ...(extra.site || {}),
    },
  };
}

function resposta(status: number, corpo: any) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) });
}

/** fetch da vitrine: a loja, o pedido e 404 para o resto (motor visual etc.). */
function servidor(store: any, pedido?: { status: number; corpo: any }) {
  const fn = jest.fn((url: string) => {
    if (String(url).endsWith("/studio/products")) return resposta(200, store);
    if (String(url).endsWith("/studio/order")) return resposta(pedido?.status ?? 200, pedido?.corpo ?? {});
    return resposta(404, { error: "nao encontrado" });
  });
  global.fetch = fn as any;
  return fn;
}

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);

const fetchOriginal = global.fetch;
beforeEach(() => { localStorage.clear(); });
afterEach(() => {
  global.fetch = fetchOriginal;
  delete (window as any).gtag;
  delete (window as any).fbq;
  jest.restoreAllMocks();
});

async function abrirProduto() {
  const cartoes = await screen.findAllByText(CANECA.name);
  fireEvent.press(cartoes[0]);
  expect(await screen.findByText("Adicionar ao carrinho")).toBeTruthy();
}

async function irAoCheckoutComUmaCaneca() {
  await abrirProduto();
  fireEvent.press(screen.getByText("Adicionar ao carrinho"));
  fireEvent.press(await screen.findByText("Finalizar →"));
  expect(await screen.findByPlaceholderText("Nome *")).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText("Nome *"), "Marina");
  fireEvent.changeText(screen.getByPlaceholderText("WhatsApp *"), "12999990002");
}

describe("temporada: pedidos até uma data", () => {
  test("a faixa aparece na home e perto do botão do produto", async () => {
    const ate = daquiA(5);
    const [, m, d] = ate.split("-");
    const texto = `Pedidos até ${d}/${m}`;
    servidor(loja({ pedidos: { aceita: true, motivo: null, recado: null, pedidos_ate: ate } }));
    render(<PaginaDaVitrine slug="aura-qa" />);

    await screen.findAllByText(CANECA.name);
    expect(naTela(texto)).toBe(true);

    await abrirProduto();
    expect(naTela(texto)).toBe(true);
    expect(naTela("Comprar agora")).toBe(true);
  });

  test("no último dia, a frase muda", async () => {
    servidor(loja({ pedidos: { aceita: true, motivo: null, recado: null, pedidos_ate: daquiA(0) } }));
    render(<PaginaDaVitrine slug="aura-qa" />);
    await screen.findAllByText(CANECA.name);
    expect(naTela("Último dia para pedir com entrega nesta temporada.")).toBe(true);
  });

  test("longe da data, nenhuma faixa", async () => {
    servidor(loja({ pedidos: { aceita: true, motivo: null, recado: null, pedidos_ate: daquiA(60) } }));
    render(<PaginaDaVitrine slug="aura-qa" />);
    await screen.findAllByText(CANECA.name);
    expect(naTela("Pedidos até")).toBe(false);
  });
});

describe("loja fechada para pedidos", () => {
  const FECHADA = {
    pedidos: { aceita: false, motivo: "pausado", recado: "Voltamos em 6 de janeiro.", pedidos_ate: null },
  };

  test("a sacola guardada não finaliza: explica e oferece o orçamento", async () => {
    // A sacola sobreviveu no navegador desde antes de a loja fechar.
    localStorage.setItem("aura-studio-storefront-aura-qa", JSON.stringify([
      { lineId: "l1", product: CANECA, qty: 2, values: {}, hasBackSelected: false },
    ]));
    const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(true as any);
    servidor(loja(FECHADA));
    render(<PaginaDaVitrine slug="aura-qa" />);

    expect(await screen.findByText(/itens na sacola/)).toBeTruthy();
    expect(naTela("Finalizar →")).toBe(false);
    // O recado já está no alto da home.
    expect(naTela("Voltamos em 6 de janeiro.")).toBe(true);

    fireEvent.press(screen.getByLabelText("Ver sacola, 2 itens"));
    const pedir = await screen.findByText("Pedir orçamento desta sacola");
    expect(naTela("Sua sacola")).toBe(true);

    fireEvent.press(pedir);
    expect(abrir).toHaveBeenCalledTimes(1);
    const link = decodeURIComponent(String(abrir.mock.calls[0][0]));
    expect(link).toMatch(/^https:\/\/wa\.me\/5512999990001\?text=/);
    expect(link).toContain("*Caneca Alça Coração* × 2");
  });

  test("no produto, o link do WhatsApp não duplica o botão principal", async () => {
    servidor(loja(FECHADA));
    render(<PaginaDaVitrine slug="aura-qa" />);
    const cartoes = await screen.findAllByText(CANECA.name);
    fireEvent.press(cartoes[0]);
    expect(await screen.findByText("Pedir orçamento")).toBeTruthy();
    expect(naTela("Prefere pedir pelo WhatsApp?")).toBe(false);
    expect(naTela("Adicionar ao carrinho")).toBe(false);
    expect(naTela("Voltamos em 6 de janeiro.")).toBe(true);
  });

  test("a loja fecha durante a compra: o 409 vira o recado, não erro cru", async () => {
    servidor(loja(), {
      status: 409,
      corpo: { error: "Voltamos em 6 de janeiro.", motivo: "pausado", pedidos_ate: null },
    });
    render(<PaginaDaVitrine slug="aura-qa" />);
    await irAoCheckoutComUmaCaneca();

    fireEvent.press(screen.getByText(/^Enviar pedido/));
    // Cabeçalho (accessibilityRole="header") vira <h1>: conferido na árvore.
    await waitFor(() => expect(naTela("A loja não está recebendo pedidos agora")).toBe(true));
    expect(naTela("Voltamos em 6 de janeiro.")).toBe(true);
    expect(naTela("Pedir orçamento desta sacola")).toBe(true);
    expect(naTela("Enviar pedido")).toBe(false);
  });
});

describe("eventos de medição", () => {
  const COM_GA4 = { site: { rastreadores: { ga4: "G-8Q3FQ2N1KM", pixel: "123456789012345" } } };
  const PEDIDO = { order_id: "o1", order_number: "1042", total: 47.41, status: "pending", pix: null, card: null };

  /** gtag/fbq simulados DEPOIS da carga: a injeção do snippet já passou. */
  function espioes() {
    const gtag = jest.fn();
    const fbq = jest.fn();
    (window as any).gtag = gtag;
    (window as any).fbq = fbq;
    return { gtag, fbq };
  }

  test("sem consentimento, nenhum evento sai em todo o fluxo", async () => {
    servidor(loja(COM_GA4), { status: 200, corpo: PEDIDO });
    render(<PaginaDaVitrine slug="aura-qa" />);
    await screen.findAllByText(CANECA.name);
    const { gtag, fbq } = espioes();

    await irAoCheckoutComUmaCaneca();
    fireEvent.press(screen.getByText(/^Enviar pedido/));
    await waitFor(() => expect(naTela("Enviar pedido")).toBe(false));

    expect(gtag).not.toHaveBeenCalled();
    expect(fbq).not.toHaveBeenCalled();
  });

  test("com consentimento, o funil inteiro chega ao GA4 e ao Pixel", async () => {
    localStorage.setItem("aura_lgpd_consent", "1");
    servidor(loja(COM_GA4), { status: 200, corpo: PEDIDO });
    render(<PaginaDaVitrine slug="aura-qa" />);
    await screen.findAllByText(CANECA.name);
    const { gtag, fbq } = espioes();

    await irAoCheckoutComUmaCaneca();
    fireEvent.press(screen.getByText(/^Enviar pedido/));
    await waitFor(() => expect(gtag.mock.calls.map((c) => c[1])).toContain("purchase"));

    expect(gtag.mock.calls.map((c) => c[1])).toEqual(["view_item", "add_to_cart", "begin_checkout", "purchase"]);
    expect(fbq.mock.calls.map((c) => c[1])).toEqual(["ViewContent", "AddToCart", "InitiateCheckout", "Purchase"]);
    const compra = gtag.mock.calls[3][2];
    expect(compra).toMatchObject({ transaction_id: "1042", value: 47.41, currency: "BRL" });
  });
});
