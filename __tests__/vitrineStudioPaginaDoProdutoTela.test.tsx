// ============================================================
// Vitrine Studio · Fase 3 — a página do produto nova, desenhada
//
// Monta a vitrine como o layout de `app/[slug]` monta (casca + rota
// filha), com um `navegar` falso, e confere a página nova atrás da chave
// `vitrine_v2`:
//   - a chave escolhe entre a página nova e o configurador de hoje;
//   - "Adicionar à sacola" é o primário e nunca fica desabilitado: com
//     pendência, a barra diz o que falta e nada entra na sacola;
//   - "Criem a arte pra mim" dispensa a arte; o texto vira o mockup;
//   - quantidade digitável com a frase da escada e o prazo por faixa;
//   - view_item e add_to_cart continuam sendo medidos;
//   - loja fechada: "Pedir orçamento" com o recado;
//   - a grade de modelos nova na rota da categoria.
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
// O motor do mockup (2D/3D) não é o assunto: o stub diz o lado que recebeu.
jest.mock("@/components/studio/storefront/LivePreview", () => {
  const R = require("react");
  return {
    LivePreview: (p: any) => R.createElement("div", { "data-testid": "mockup" }, "mockup-" + (p.lado || "front")),
    defaultConfiguratorSize: () => 320,
  };
});
const mockMedir = jest.fn();
jest.mock("@/components/studio/storefront/eventosDaVitrine", () => ({
  ...jest.requireActual("@/components/studio/storefront/eventosDaVitrine"),
  medirNaVitrine: (...a: any[]) => mockMedir(...a),
}));

import { CascaDaVitrine } from "@/components/studio/storefront/PaginaDaVitrine";
import { ProvedorDaRota, TelaNaRota } from "@/components/studio/storefront/VitrineNaRota";
import type { TelaDaVitrine } from "@/components/studio/storefront/rotasDaVitrine";

const CATEGORIA = { id: "cat-canecas", name: "Canecas", slug: "canecas", path: "/canecas", depth: 0, parent_id: null };

const CANECA = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Caneca Branca", description: "Caneca de cerâmica, 325 ml.", price: 49.9,
  image_url: "https://x/branca.jpg", gallery_urls: ["https://x/branca.jpg", "https://x/branca-2.jpg"],
  category: "Canecas", category_id: "cat-canecas", category_slug: "canecas",
  stock_qty: 10, pedidos: 0,
  qty_tiers: [
    { min_qty: 10, max_qty: 19, unit_price: 47.41, discount_pct: 5, lead_days: 5 },
    { min_qty: 20, max_qty: null, unit_price: 44.91, discount_pct: 10, lead_days: 8 },
  ],
  templates: [],
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
          { value: "adjust", label: "Envio minha arte e vocês ajustam", price_delta: 10 },
          { value: "designer", label: "Criem a arte pra mim", price_delta: 25 },
        ] } },
    ],
  },
};
const CHOPP = {
  ...CANECA, id: "22222222-2222-4222-8222-222222222222", name: "Caneca Chopp", price: 70,
  image_url: "https://x/chopp.jpg", gallery_urls: [], qty_tiers: [], pedidos: 5,
  customization_config: { print_area: { width_cm: 10, height_cm: 10 }, fields: [
    { id: "t2", type: "text", side: "front", required: false, label: "Texto", config: {} },
  ] },
};

function loja(extra: any = {}) {
  return {
    products: [CANECA, CHOPP],
    categories: [CATEGORIA],
    sla: { sla_base_days: 3, queue_qty: 0, total_estimate_days: 3 },
    payment: { has_pix: true, has_card: true, pay_on_delivery_enabled: false, pix_discount_pct: 5, card_max_installments: 3 },
    revisions: { max_included: 2, extra_price: 10, policy_text: null },
    delivery: { pickup_enabled: true, delivery_enabled: true, courier_pickup_enabled: false, delivery_fee: 0, pickup_eta_text: null, delivery_eta_text: null },
    pedidos: { aceita: true, motivo: null, recado: null, pedidos_ate: null },
    total_products: 2,
    ...extra,
    site: {
      name: "Sheid Mania", primary_color: "#1a1612", accent_color: "#1a1612", logo_url: null,
      whatsapp: "12999990001", endereco: "Av Dom Pedro I, 553 - Jardim Colonial",
      rastreadores: { ga4: "G-TESTE", pixel: null },
      vitrine_v2: true,
      ...(extra.site || {}),
    },
  };
}

const fetchOriginal = global.fetch;
beforeEach(() => {
  mockMedir.mockClear();
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch {}
});
afterEach(() => { global.fetch = fetchOriginal; });

function servidor(store: any) {
  global.fetch = jest.fn((url: string) => Promise.resolve({
    ok: String(url).endsWith("/studio/products"), status: String(url).endsWith("/studio/products") ? 200 : 404,
    json: () => Promise.resolve(String(url).endsWith("/studio/products") ? store : { error: "nao" }),
  })) as any;
}

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);
/** A página nova está na tela: o primário dela é "Adicionar à sacola". */
const pagina = () => screen.findByLabelText("Adicionar à sacola");

function montar(tela: TelaDaVitrine, store = loja()) {
  servidor(store);
  const navegar = jest.fn();
  try { window.sessionStorage.setItem("aura-vitrine-na-aba-sheid-mania", "1"); } catch {}
  render(
    <ProvedorDaRota navegar={navegar}>
      <CascaDaVitrine slug="sheid-mania" navegar={navegar}>
        <TelaNaRota tela={tela} />
      </CascaDaVitrine>
    </ProvedorDaRota>,
  );
  return navegar;
}

describe("a chave escolhe a página", () => {
  test("ligada: a página nova, com título, trilha, preço, parcelas, Pix e prazo", async () => {
    montar({ tipo: "produto", id: CANECA.id });
    expect(await pagina()).toBeTruthy();
    expect(document.title).toBe("Caneca Branca · Sheid Mania");
    expect(naTela("Adicionar à sacola")).toBe(true);
    expect(naTela("Comprar agora")).toBe(true);
    expect(naTela("Adicionar ao carrinho")).toBe(false);
    expect(naTela("Início")).toBe(true);
    expect(naTela("Branca")).toBe(true); // último nível da trilha, nome curto
    expect(naTela("ou 3x de R$ 16,63 sem juros")).toBe(true);
    expect(naTela("R$ 47,41")).toBe(true); // Pix de 5% sobre 49,90
    expect(naTela("Pronto em 3 dias úteis")).toBe(true);
    expect(naTela("Foto ")).toBe(true);
    // Abaixo da dobra: área de uma fonte só e revisões da loja.
    expect(naTela("20 × 9 cm")).toBe(true);
    expect(naTela("2 revisões inclusas; revisão extra R$ 10,00.")).toBe(true);
    expect(naTela("Retire na loja · Jardim Colonial")).toBe(true);
  });

  test("desligada: o configurador de hoje", async () => {
    montar({ tipo: "produto", id: CANECA.id }, loja({ site: { vitrine_v2: false } }));
    expect(await screen.findByText("Adicionar ao carrinho")).toBeTruthy();
    expect(screen.queryByLabelText("Adicionar à sacola")).toBeNull();
  });

  test("?v2=1 guardado na aba liga numa loja desligada", async () => {
    window.sessionStorage.setItem("aura-vitrine-v2-sheid-mania", "1");
    montar({ tipo: "produto", id: CANECA.id }, loja({ site: { vitrine_v2: false } }));
    expect(await pagina()).toBeTruthy();
  });

  test("view_item é medido uma vez ao abrir a peça", async () => {
    montar({ tipo: "produto", id: CANECA.id });
    await pagina();
    const vistos = mockMedir.mock.calls.filter((c) => c[1]?.nome === "view_item");
    expect(vistos).toHaveLength(1);
    expect(vistos[0][1].itens[0]).toMatchObject({ id: CANECA.id, nome: "Caneca Branca" });
  });
});

describe("a barra de compra", () => {
  test("com pendência: diz o que falta e nada entra na sacola", async () => {
    const navegar = montar({ tipo: "produto", id: CANECA.id });
    await pagina();
    expect(naTela("Falta a arte da frente")).toBe(true);
    expect(naTela("Falta a arte")).toBe(true); // etiqueta da seção
    fireEvent.press(screen.getByLabelText("Adicionar à sacola"));
    expect(navegar).not.toHaveBeenCalledWith({ tipo: "home" }, "voltar");
    expect(JSON.parse(localStorage.getItem("aura-studio-storefront-sheid-mania") || "[]")).toHaveLength(0);
    expect(mockMedir.mock.calls.some((c) => c[1]?.nome === "add_to_cart")).toBe(false);
  });

  test("'Criem a arte pra mim' dispensa a arte; o texto vira o mockup; adicionar mede add_to_cart", async () => {
    const navegar = montar({ tipo: "produto", id: CANECA.id });
    await pagina();
    fireEvent.press(screen.getByLabelText("Criem a arte pra mim, +R$ 25,00"));
    await waitFor(() => expect(naTela("Falta o texto da frente")).toBe(true));
    expect(naTela("Descreva sua ideia")).toBe(true);
    expect(naTela("A loja cria a arte a partir da sua ideia")).toBe(true);
    // O preço já inclui a criação (sem a Fase 2, ela entra no unitário).
    expect(naTela("Inclui criação da arte (+R$ 25,00)")).toBe(true);

    expect(naTela("Sua caneca")).toBe(false);
    fireEvent.changeText(screen.getByLabelText("Nome ou frase"), "Mãe");
    await waitFor(() => expect(naTela("Tudo pronto para a sacola")).toBe(true));
    // O mockup virou o slide ativo, com a etiqueta.
    expect(naTela("Sua caneca")).toBe(true);
    expect(naTela("Prévia. A loja manda o mockup final para você aprovar.")).toBe(true);

    fireEvent.press(screen.getByLabelText("Adicionar à sacola"));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "home" }, "voltar"));
    const add = mockMedir.mock.calls.find((c) => c[1]?.nome === "add_to_cart");
    expect(add?.[1].itens[0]).toMatchObject({ id: CANECA.id, preco: 74.9, quantidade: 1 });
    await waitFor(() => expect(JSON.parse(localStorage.getItem("aura-studio-storefront-sheid-mania") || "[]")).toHaveLength(1));
  });

  test("as abas Frente · Verso levam o mockup junto; o verso é opt-in cobrado", async () => {
    montar({ tipo: "produto", id: CANECA.id });
    await pagina();
    fireEvent.changeText(screen.getByLabelText("Nome ou frase"), "Ana");
    await waitFor(() => expect(naTela("mockup-front")).toBe(true));
    fireEvent.press(screen.getAllByLabelText("Verso")[0]);
    await waitFor(() => expect(naTela("mockup-back")).toBe(true));
    const optin = screen.getByLabelText("Personalizar também o verso, mais R$ 8,00");
    fireEvent.press(optin);
    await waitFor(() => expect(naTela("+R$ 8,00 no total")).toBe(true));
    expect(naTela("Inclui verso (+R$ 8,00)")).toBe(true);
  });
});

describe("quantidade e desconto", () => {
  test("digitar 17: a frase da escada, o preço da faixa e o prazo por faixa", async () => {
    montar({ tipo: "produto", id: CANECA.id });
    await pagina();
    expect(naTela("Leve 10 e pague ")).toBe(true);
    const campo = screen.getByLabelText("Quantidade");
    fireEvent(campo, "focus", { nativeEvent: {}, target: {} });
    fireEvent.changeText(campo, "17");
    await waitFor(() => expect(naTela("Faltam 3 para pagar ")).toBe(true));
    expect(naTela("R$ 44,91")).toBe(true);
    expect(naTela("pronto em 5 dias úteis")).toBe(true);
    expect(naTela("Você economiza R$ 42,33 com o desconto de 5%.")).toBe(true);
    // O total da barra: 17 × 47,41.
    expect(naTela("17 un × R$ 47,41")).toBe(true);
  });

  test("tocar numa parada sobe até ela; o campo não passa de 999", async () => {
    montar({ tipo: "produto", id: CANECA.id });
    await pagina();
    fireEvent.press(screen.getByLabelText("Levar 20 unidades: R$ 44,91 cada"));
    await waitFor(() => expect(naTela("Você chegou ao menor preço: ")).toBe(true));
    expect(naTela("pronto em 8 dias úteis")).toBe(true);
    const campo = screen.getByLabelText("Quantidade");
    fireEvent(campo, "focus", { nativeEvent: {}, target: {} });
    fireEvent.changeText(campo, "12345");
    fireEvent(campo, "blur", { nativeEvent: {}, target: {} });
    await waitFor(() => expect(naTela("123 un × ")).toBe(true));
  });
});

describe("loja fechada", () => {
  test("o primário vira 'Pedir orçamento', com o recado; sem 'Adicionar à sacola'", async () => {
    montar({ tipo: "produto", id: CANECA.id }, loja({ pedidos: { aceita: false, motivo: "pausado", recado: "Voltamos em 6 de janeiro.", pedidos_ate: null } }));
    await screen.findByLabelText("Pedir orçamento desta peça");
    expect(naTela("Pedir orçamento")).toBe(true);
    expect(naTela("Voltamos em 6 de janeiro.")).toBe(true);
    expect(naTela("Adicionar à sacola")).toBe(false);
    expect(naTela("Prefere pedir pelo WhatsApp?")).toBe(false);
  });
});

describe("modelo e cor", () => {
  test("o seletor de modelos troca a peça pela URL, sem empilhar", async () => {
    const navegar = montar({ tipo: "categoria", categoria: "canecas" });
    const cartao = await screen.findByLabelText("Caneca Branca, R$ 49,90");
    fireEvent.press(cartao);
    expect(navegar).toHaveBeenCalledWith({ tipo: "produto", id: CANECA.id }, "empilhar");
  });
});

describe("a grade de modelos nova", () => {
  test("cartões de foto grande, contagem, 'a partir de' só quando o preço muda, e Pix", async () => {
    montar({ tipo: "categoria", categoria: "canecas" });
    expect(await screen.findByText("2 modelos")).toBeTruthy();
    expect(document.title).toBe("Canecas · Sheid Mania");
    expect(naTela("2 modelos")).toBe(true);
    expect(naTela("De R$ 49,90 a R$ 70,00")).toBe(true);
    expect(naTela("Cada modelo tem um preço. Toque para ver a peça de perto.")).toBe(true);
    // Caneca Branca tem escada e adicionais: "a partir de". A Chopp não.
    expect(JSON.stringify(screen.toJSON()).match(/a partir de/g)).toHaveLength(1);
    expect(naTela("Mais pedido")).toBe(true);
    expect(naTela("R$ 66,50")).toBe(true); // Pix da Chopp
  });
});
