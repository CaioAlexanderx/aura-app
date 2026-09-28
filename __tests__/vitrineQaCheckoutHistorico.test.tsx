// ============================================================
// QA 27/09 · o voltar do navegador no checkout
//
// /<slug>/finalizar não mudava entre as etapas: voltar na etapa 2 ou 3
// saía do checkout, e avançar ou F5 voltavam à etapa 1 com os dados
// apagados. Agora cada etapa entra no histórico (mesmo endereço, marca no
// history.state) e o que a cliente digita fica no rascunho da aba até o
// pedido ser enviado.
//
// Mesmo arranjo de vitrineStudioFase2Tela.test.tsx: a vitrine de
// verdade, fetch simulado, hostComponentNames declarados.
// ============================================================
import React from "react";
import { render, screen, fireEvent, waitFor, configure } from "@testing-library/react-native";

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

const mockRouter = { replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn() };
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSegments: () => ["[slug]"],
  useLocalSearchParams: () => ({}),
  Slot: "Slot",
  Link: "Link",
  router: {
    replace: (...a: any[]) => mockRouter.replace(...a),
    push: (...a: any[]) => mockRouter.push(...a),
    dismissTo: (...a: any[]) => mockRouter.dismissTo(...a),
  },
}));

import { CascaDaVitrine, ConteudoDaVitrine } from "@/components/studio/storefront/PaginaDaVitrine";
import { ProvedorDaRota } from "@/components/studio/storefront/VitrineNaRota";
import { MARCA_DA_ETAPA } from "@/components/studio/storefront/historicoDaVitrine";
import { chaveDoRascunho } from "@/components/studio/storefront/dadosLembrados";

const SLUG = "aura-qa";
const ARTE = {
  id: "art_service", type: "option", label: "Quem cria a arte", required: false,
  config: { is_art_service: true, choices: [
    { value: "none", label: "Vou enviar minha arte pronta", price_delta: 0 },
    { value: "adjust", label: "Envio minha arte e vocês ajustam", price_delta: 10 },
    { value: "designer", label: "Criem a arte pra mim", price_delta: 15 },
  ] },
};
const CANECA = {
  id: "p1", name: "Caneca Branca", description: null, price: 39.9,
  image_url: null, category: null, stock_qty: 10, templates: [],
  customization_config: { fields: [ARTE] },
};

function loja(extra: any = {}) {
  return {
    products: [CANECA],
    categories: [],
    sla: { sla_base_days: 3, queue_qty: 0, total_estimate_days: 3 },
    payment: { has_pix: true, has_card: true, pay_on_delivery_enabled: false, pix_discount_pct: 5, card_max_installments: 3 },
    revisions: { max_included: 2, extra_price: 10, policy_text: null },
    delivery: {
      pickup_enabled: true, delivery_enabled: false, courier_pickup_enabled: false,
      delivery_fee: 0, pickup_eta_text: null, delivery_eta_text: null,
    },
    pedidos: { aceita: true, motivo: null, recado: null, pedidos_ate: null },
    total_products: 1,
    ...extra,
    site: {
      name: "Sheid Mania", primary_color: "#1a1612", accent_color: "#1a1612",
      logo_url: null, whatsapp: "12999990001", endereco: "Av. Dom Pedro I, 553",
      rastreadores: { ga4: null, pixel: null }, vitrine_v2: true,
      ...(extra.site || {}),
    },
  };
}

function resposta(status: number, corpo: any) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) });
}

/** O pedido público, do jeito do contrato B2. */
function pedidoPublico(extra: any = {}) {
  return {
    numero: "123", criado_em: "2026-09-25T17:03:00Z", cliente_primeiro_nome: "Helena",
    status: "pending_payment", payment_status: "pending", payment_method: "pix",
    subtotal: 89.8, desconto_pix: 4.49, frete: 0, total: 85.31,
    entrega: { tipo: "pickup", prazo_texto: null, retirada_endereco: "Av. Dom Pedro I, 553", bairro_cidade: null, courier_a_informar: false },
    itens: [{ nome: "Caneca Branca", quantidade: 2, preco_unitario: 39.9, total: 89.8, imagem_url: null, resumo: ["Envio minha arte e vocês ajustam"] }],
    pix: { qrcode: null, copia_e_cola: "00020126580014BR.GOV.BCB.PIX-mock", expira_em: "2026-09-28T17:03:00Z", modo: "manual" },
    cartao: null, comprovante_enviado: false,
    etapas: [
      { chave: "recebido", rotulo: "Pedido recebido", estado: "atual" },
      { chave: "arte", rotulo: "Criando a arte", estado: "futuro" },
      { chave: "producao", rotulo: "Em produção", estado: "futuro" },
      { chave: "pronto", rotulo: "Pronto", estado: "futuro" },
    ],
    prazo_dias_uteis: 3, revisoes: { max_included: 2, extra_price: 10, policy_text: null },
    acompanhar_url: "https://app.getaura.com.br/acompanhar/tok", loja: { nome: "Sheid Mania", whatsapp: "5512999990001" },
    ...extra,
  };
}
const PAGO = { status: "confirmed", payment_status: "paid", pix: null };

type Rotas = {
  store?: any;
  pedido?: { status: number; corpo: any };
  porToken?: () => { status: number; corpo: any };
};

/** fetch da vitrine: loja, cotação (conta do servidor), pedido, pedido por token e 404 para o resto. */
function servidor(r: Rotas = {}) {
  const fn = jest.fn((url: string, init?: any) => {
    const u = String(url);
    if (u.endsWith("/studio/products")) return resposta(200, r.store || loja());
    if (u.endsWith("/studio/cotacao")) {
      const body = JSON.parse(init?.body || "{}");
      const itens = (body.items || []).map((i: any, k: number) => {
        const arte = i.customization?.art_service === "adjust" ? 10 : i.customization?.art_service === "designer" ? 15 : 0;
        return { indice: k, preco_unitario: 39.9, total: Math.round((39.9 * i.quantity + arte) * 100) / 100, detalhe: { base: 39.9, opcoes: 0, verso: 0, meio: 0, arte, faixa: null } };
      });
      const subtotal = itens.reduce((s: number, i: any) => s + i.total, 0);
      const desc = Math.round(subtotal * 5) / 100;
      return resposta(200, { itens, subtotal, desconto_pix: desc, total: subtotal, total_pix: subtotal - desc, prazo_dias_uteis: 3 });
    }
    if (u.endsWith("/studio/order")) return resposta(r.pedido?.status ?? 201, r.pedido?.corpo ?? {});
    if (u.includes("/studio/pedido/")) {
      const x = r.porToken ? r.porToken() : { status: 404, corpo: { error: "Pedido nao encontrado" } };
      return resposta(x.status, x.corpo);
    }
    if (/\/order\/[^/]+\/mark-as-paid$/.test(u)) return resposta(200, { status: "awaiting_approval" });
    return resposta(404, { error: "nao encontrado" });
  });
  global.fetch = fn as any;
  return fn;
}

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);
// Sob react-native-web o testID vira data-testid (ver lojaSempreAberta.test.tsx).
const porId = (id: string) =>
  screen.root.findAll((n: any) => typeof n.type === "string" && n.props?.["data-testid"] === id);
const pegarId = (id: string) => {
  const a = porId(id);
  if (!a.length) throw new Error("sem data-testid " + id);
  return a[0];
};
const acharId = (id: string) => waitFor(() => pegarId(id));
/** Título (accessibilityRole="header" vira <h1>, fora do getByText): pela árvore. */
const ver = (t: string) => waitFor(() => expect(naTela(t)).toBe(true));
const nenhumId = (id: string) => porId(id).length === 0;
const chamadas = (fn: jest.Mock, trecho: string) => fn.mock.calls.filter((c) => String(c[0]).includes(trecho));

const fetchOriginal = global.fetch;
beforeEach(() => {
  localStorage.clear();
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* jsdom */ }
  mockRouter.replace.mockClear(); mockRouter.push.mockClear(); mockRouter.dismissTo.mockClear();
});
afterEach(() => {
  global.fetch = fetchOriginal;
  jest.restoreAllMocks();
});

async function adicionarUmaCaneca(arte?: string) {
  const cartoes = await screen.findAllByText(CANECA.name);
  fireEvent.press(cartoes[0]);
  expect(await screen.findByText("Adicionar à sacola")).toBeTruthy();
  if (arte) fireEvent.press(screen.getByText(arte));
  fireEvent.press(screen.getByText("Adicionar à sacola"));
}

// ── O checkout em etapas ─────────────────────────────────────
function montarComRota(navegar: jest.Mock) {
  return render(
    <ProvedorDaRota navegar={navegar}>
      <CascaDaVitrine slug={SLUG} navegar={navegar}>
        <ConteudoDaVitrine />
      </CascaDaVitrine>
    </ProvedorDaRota>,
  );
}

async function irAoCheckout() {
  await adicionarUmaCaneca("Envio minha arte e vocês ajustam");
  fireEvent.press(await screen.findByText("Ver sacola"));
  fireEvent.press(await acharId("finalizar-compra"));
  expect(await acharId("checkout-em-etapas")).toBeTruthy();
}

const botao = () => pegarId("botao-do-checkout");

const etapaNaTela = (n: number) => waitFor(() => expect(naTela(`Etapa ${n} de 3`)).toBe(true));
const marcaAtual = () => (window.history.state || {})[MARCA_DA_ETAPA];

async function preencherDados() {
  fireEvent.changeText(screen.getByLabelText("Nome completo"), "Helena Martins");
  fireEvent.changeText(screen.getByLabelText("WhatsApp"), "12991834410");
  fireEvent.press(pegarId("quero-documento"));
  fireEvent.changeText(screen.getByLabelText("CPF ou CNPJ"), "52998224725");
}

beforeEach(() => {
  // A mesma janela entre os testes: o histórico começa limpo.
  window.history.replaceState(null, "");
  servidor();
});

describe("cada etapa entra no histórico", () => {
  test("continuar empilha a etapa; voltar do navegador volta uma; avançar avança", async () => {
    montarComRota(jest.fn());
    await irAoCheckout();
    await preencherDados();
    const antes = window.history.length;
    fireEvent.press(botao());
    await etapaNaTela(2);
    expect(window.history.length).toBe(antes + 1);
    expect(marcaAtual()).toBe(2);
    fireEvent.press(botao());
    await etapaNaTela(3);
    expect(marcaAtual()).toBe(3);

    window.history.back();
    await etapaNaTela(2);
    window.history.back();
    await etapaNaTela(1);
    // Os dados ficaram.
    expect(naTela("Helena Martins")).toBe(true);
    window.history.forward();
    await etapaNaTela(2);
  });

  test("QA 28/09: o roteador apaga a marca a cada popstate, e voltar e avançar funcionam quantas vezes for", async () => {
    // O expo-router regrava a entrada com `{ id }` a cada popstate (é o
    // que apagava `auraEtapaDoCheckout` depois da primeira passada).
    const roteador = () => {
      const id = (window.history.state || {}).id;
      window.history.replaceState({ id }, "");
    };
    window.addEventListener("popstate", roteador);
    try {
      montarComRota(jest.fn());
      await irAoCheckout();
      await preencherDados();
      fireEvent.press(botao());
      await etapaNaTela(2);
      fireEvent.press(botao());
      await etapaNaTela(3);
      for (let passada = 0; passada < 2; passada++) {
        window.history.back();
        await etapaNaTela(2);
        window.history.back();
        await etapaNaTela(1);
        window.history.forward();
        await etapaNaTela(2);
        window.history.forward();
        await etapaNaTela(3);
      }
      window.history.back();
      await etapaNaTela(2);
      // A marca voltou para a entrada depois que o roteador a apagou.
      await waitFor(() => expect(marcaAtual()).toBe(2));
    } finally {
      window.removeEventListener("popstate", roteador);
    }
  });

  test("o Voltar da tela anda no histórico (o voltar seguinte sai do checkout, não repassa as etapas)", async () => {
    montarComRota(jest.fn());
    await irAoCheckout();
    await preencherDados();
    fireEvent.press(botao());
    await etapaNaTela(2);
    fireEvent.press(screen.getByLabelText("Voltar para a etapa anterior"));
    await etapaNaTela(1);
    expect(marcaAtual()).toBeUndefined();
  });

  test("Alterar os dados na etapa 3 volta duas entradas", async () => {
    montarComRota(jest.fn());
    await irAoCheckout();
    await preencherDados();
    fireEvent.press(botao());
    await etapaNaTela(2);
    fireEvent.press(botao());
    await etapaNaTela(3);
    fireEvent.press(screen.getByLabelText("Alterar seus dados"));
    await etapaNaTela(1);
    expect(marcaAtual()).toBeUndefined();
  });
});

describe("o rascunho da aba", () => {
  test("o que a cliente digita fica na aba, e a etapa do histórico reabre com os dados", async () => {
    const r = montarComRota(jest.fn());
    await irAoCheckout();
    await preencherDados();
    fireEvent.press(botao());
    await etapaNaTela(2);
    const guardado = JSON.parse(window.sessionStorage.getItem(chaveDoRascunho(SLUG)) || "{}");
    expect(guardado).toMatchObject({ etapa: 2, dados: { name: "Helena Martins", phone: "(12) 99183-4410", customer_cpf_cnpj: "529.982.247-25", quer_documento: true } });

    // A vitrine inteira de novo (como no F5 ou no avançar depois de sair):
    // o estado da loja some; a entrada do histórico e a aba ficam.
    r.unmount();
    montarComRota(jest.fn());
    fireEvent.press(await acharId("botao-da-sacola"));
    fireEvent.press(await acharId("finalizar-compra"));
    await acharId("checkout-em-etapas");
    await etapaNaTela(2);
    fireEvent.press(screen.getByLabelText("Voltar para a etapa anterior"));
    await etapaNaTela(1);
    expect(naTela("Helena Martins")).toBe(true);
    expect(naTela("(12) 99183-4410")).toBe(true);
    expect(naTela("529.982.247-25")).toBe(true);
  });

  test("o pedido criado apaga o rascunho", async () => {
    servidor({
      pedido: { status: 201, corpo: { order_id: "o1", order_number: "123", total: 47.41, status: "pending_payment", payment_method: "pix", pix: null, card: null, pedido_token: "tok123" } },
    });
    const navegar = jest.fn();
    montarComRota(navegar);
    await irAoCheckout();
    await preencherDados();
    fireEvent.press(botao());
    await etapaNaTela(2);
    fireEvent.press(botao());
    await etapaNaTela(3);
    expect(window.sessionStorage.getItem(chaveDoRascunho(SLUG))).not.toBeNull();
    fireEvent.press(screen.getAllByText("Pix")[0]);
    fireEvent.press(botao());
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "pedido", token: "tok123" }, "trocar"));
    expect(window.sessionStorage.getItem(chaveDoRascunho(SLUG))).toBeNull();
  });
});
