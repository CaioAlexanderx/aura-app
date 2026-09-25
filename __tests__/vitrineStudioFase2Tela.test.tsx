// ============================================================
// Fase 2 · Fechar a venda — as telas (25/09/2026)
//
// Com a chave `vitrine_v2`:
//   - a sacola em gaveta: "Adicionado à sacola", quantidade digitável,
//     serviço de arte uma vez por linha, remover com "Desfazer", vazia;
//   - o checkout em três etapas: o botão diz o que falta, dados
//     lembrados + "Não sou eu", CPF/CNPJ com dígito, o pedido navega para
//     /pedido/<token> e guarda o que a página precisa;
//   - a proteção contra pedido duplicado (Tela 8);
//   - a página do pedido: Pix pendente → pago sozinho, F5, "Já paguei",
//     404; a volta do cartão; /sacola abre a gaveta.
// Sem a chave, a loja continua a de antes.
//
// Mesmo arranjo de vitrineStudioFluxoTela.test.tsx: a vitrine de verdade,
// fetch simulado, hostComponentNames declarados.
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

import { PaginaDaVitrine, CascaDaVitrine, ConteudoDaVitrine } from "@/components/studio/storefront/PaginaDaVitrine";
import {
  ProvedorDaRota, PedidoNaRota, SacolaNaRota, RetornoDoCartao,
} from "@/components/studio/storefront/VitrineNaRota";

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

// ── Sem a chave ───────────────────────────────────────────────
describe("chave desligada: a loja de antes", () => {
  test("carrinho, 'Finalizar →' e o checkout antigo", async () => {
    servidor({ store: loja({ site: { vitrine_v2: false } }) });
    render(<PaginaDaVitrine slug={SLUG} />);
    const cartoes = await screen.findAllByText(CANECA.name);
    fireEvent.press(cartoes[0]);
    fireEvent.press(await screen.findByText("Adicionar ao carrinho"));
    fireEvent.press(await screen.findByText("Finalizar →"));
    expect(await screen.findByPlaceholderText("Nome *")).toBeTruthy();
    expect(naTela("Seus dados")).toBe(true);
    expect(naTela("Etapa 1 de 3")).toBe(false);
    expect(nenhumId("sacola-em-gaveta")).toBe(true);
  });
});

// ── A sacola em gaveta ───────────────────────────────────────
describe("a sacola em gaveta (Tela 1)", () => {
  test("adicionar fica na peça, o toast abre a gaveta, a arte entra uma vez", async () => {
    const fetch = servidor();
    render(<PaginaDaVitrine slug={SLUG} />);
    await adicionarUmaCaneca("Envio minha arte e vocês ajustam");

    // continua na peça, com o toast
    expect(await acharId("aviso-adicionado")).toBeTruthy();
    expect(naTela("Adicionado à sacola")).toBe(true);
    expect(naTela("Adicionar à sacola")).toBe(true);

    fireEvent.press(screen.getByText("Ver sacola"));
    expect(await acharId("sacola-em-gaveta")).toBeTruthy();
    expect(naTela("Envio minha arte e vocês ajustam")).toBe(true);
    expect(naTela("R$ 49,90")).toBe(true);

    // quantidade digitável: 2 canecas = 39,90 × 2 + 10 (uma vez)
    const qtd = screen.getByLabelText("Quantidade de Caneca Branca");
    fireEvent.changeText(qtd, "2");
    fireEvent(qtd, "submitEditing");
    await waitFor(() => expect(naTela("R$ 89,80")).toBe(true));
    // a cotação foi pedida ao servidor com os itens do pedido
    await waitFor(() => expect(chamadas(fetch, "/studio/cotacao").length).toBeGreaterThan(0));
    const corpo = JSON.parse(chamadas(fetch, "/studio/cotacao").slice(-1)[0][1].body);
    expect(corpo.items[0]).toMatchObject({ product_id: "p1", quantity: 2, customization: { art_service: "adjust" } });
    expect(naTela("+ R$ 10,00 do serviço de arte, uma vez")).toBe(true);
  });

  test("Editar abre a peça e, ao salvar, volta para a gaveta (não para a home)", async () => {
    servidor();
    render(<PaginaDaVitrine slug={SLUG} />);
    await adicionarUmaCaneca();
    fireEvent.press(await screen.findByText("Ver sacola"));
    await acharId("sacola-em-gaveta");
    fireEvent.press(screen.getByLabelText("Editar Caneca Branca"));
    // o configurador da linha: uma ação só, atualizar
    const atualizar = await screen.findByText(/^Atualizar/);
    expect(nenhumId("sacola-em-gaveta")).toBe(true);
    fireEvent.press(screen.getByText("Criem a arte pra mim"));
    await waitFor(() => expect(naTela("R$ 54,90")).toBe(true)); // 39,90 + 15 (arte, uma vez)
    fireEvent.press(atualizar);
    await acharId("sacola-em-gaveta");
    expect(naTela("Criem a arte pra mim")).toBe(true);
    expect(porId("item-da-sacola").length).toBe(1);
  });

  test("remover com Desfazer, e a sacola vazia com voz", async () => {
    servidor();
    render(<PaginaDaVitrine slug={SLUG} />);
    await adicionarUmaCaneca();
    fireEvent.press(await screen.findByText("Ver sacola"));
    fireEvent.press(await screen.findByLabelText("Remover Caneca Branca da sacola"));
    expect(await screen.findByText("Desfazer")).toBeTruthy();
    expect(naTela("Sua sacola está vazia")).toBe(true);
    fireEvent.press(screen.getByText("Desfazer"));
    await waitFor(() => expect(porId("item-da-sacola").length).toBe(1));
  });

  test("loja fechada: a gaveta explica e troca o Finalizar pelo orçamento", async () => {
    localStorage.setItem("aura-studio-storefront-" + SLUG, JSON.stringify([
      { lineId: "l1", product: CANECA, qty: 2, values: {}, hasBackSelected: false },
    ]));
    servidor({ store: loja({ pedidos: { aceita: false, motivo: "pausado", recado: "Voltamos em 6 de janeiro.", pedidos_ate: null } }) });
    render(<PaginaDaVitrine slug={SLUG} />);
    // Fase 5: na home nova a sacola mora no cabeçalho (mockup 05, tela 1);
    // a barra escura do pé saiu. O toque abre a mesma gaveta.
    fireEvent.press(await acharId("botao-da-sacola"));
    expect(await acharId("sacola-em-gaveta")).toBeTruthy();
    expect(naTela("Pedir orçamento desta sacola")).toBe(true);
    expect(nenhumId("finalizar-compra")).toBe(true);
  });
});

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

describe("o checkout em três etapas (Telas 2 a 4)", () => {
  test("o botão diz o que falta, as etapas andam e o pedido abre /pedido/<token>", async () => {
    const navegar = jest.fn();
    const fetch = servidor({
      pedido: { status: 201, corpo: { order_id: "o1", order_number: "123", total: 85.31, status: "pending_payment", payment_method: "pix", pix: null, card: null, pedido_token: "tok123", pedido_url: "https://loja/aura-qa/pedido/tok123" } },
    });
    montarComRota(navegar);
    await irAoCheckout();

    expect(naTela("Etapa 1 de 3")).toBe(true);
    expect(naTela("Falta seu nome")).toBe(true);
    fireEvent.press(botao()); // leva ao campo, não avança
    expect(naTela("Etapa 1 de 3")).toBe(true);

    fireEvent.changeText(screen.getByLabelText("Nome completo"), "Helena Martins");
    fireEvent.changeText(screen.getByLabelText("WhatsApp"), "12991834410");
    expect(naTela("(12) 99183-4410")).toBe(true);
    fireEvent.press(pegarId("quero-documento"));
    fireEvent.changeText(screen.getByLabelText("CPF ou CNPJ"), "52998224724");
    expect(naTela("Confira o CPF ou CNPJ")).toBe(true);
    fireEvent.changeText(screen.getByLabelText("CPF ou CNPJ"), "52998224725");
    expect(naTela("CPF válido")).toBe(true);
    expect(naTela("Continuar para a entrega")).toBe(true);
    fireEvent.press(botao());

    // Etapa 2: a loja só tem retirada, então ela já vem escolhida.
    await ver("Como você quer receber?");
    expect(naTela("Av. Dom Pedro I, 553")).toBe(true);
    expect(naTela("Continuar para o pagamento")).toBe(true);
    fireEvent.press(botao());

    // Etapa 3: nada vem escolhido; cada forma diz quanto custa.
    await ver("Como você quer pagar?");
    expect(naTela("Escolha como pagar")).toBe(true);
    expect(naTela("Você aprova o mockup antes de produzir. 2 revisões inclusas.")).toBe(true);
    await waitFor(() => expect(naTela("R$ 47,40")).toBe(true)); // 49,90 − 5% no Pix
    fireEvent.press(screen.getAllByText("Pix")[0]);
    await waitFor(() => expect(naTela("Pagar R$ 47,40 no Pix")).toBe(true));
    fireEvent.press(botao());

    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "pedido", token: "tok123" }, "trocar"));
    const envio = chamadas(fetch, "/studio/order")[0];
    const body = JSON.parse(envio[1].body);
    expect(body).toMatchObject({
      customer_name: "Helena Martins", customer_phone: "(12) 99183-4410",
      delivery_type: "pickup", payment_method: "pix",
      customer_document: "52998224725", customer_cpf_cnpj: "52998224725", request_nfce: true,
    });
    expect(body.items[0]).toMatchObject({ product_id: "p1", quantity: 1, customization: { art_service: "adjust" } });
    // o que a página do pedido e a próxima visita precisam
    expect(window.sessionStorage.getItem("aura-vitrine-pedido-tok123")).toBe("o1");
    expect(JSON.parse(window.localStorage.getItem("aura_pending_order_" + SLUG) || "{}")).toMatchObject({ id: "o1", token: "tok123" });
    expect(JSON.parse(window.localStorage.getItem("aura_customer_" + SLUG) || "{}")).toMatchObject({ name: "Helena Martins" });
  });

  test("sem token do servidor, cai na confirmação antiga", async () => {
    const navegar = jest.fn();
    servidor({ pedido: { status: 201, corpo: { order_id: "o1", order_number: "123", total: 49.9, status: "pending_payment", payment_method: "card", pix: null, card: null } } });
    montarComRota(navegar);
    await irAoCheckout();
    fireEvent.changeText(screen.getByLabelText("Nome completo"), "Helena");
    fireEvent.changeText(screen.getByLabelText("WhatsApp"), "12991834410");
    fireEvent.press(botao());
    fireEvent.press(await acharId("botao-do-checkout"));
    await ver("Como você quer pagar?");
    fireEvent.press(screen.getByText("Cartão de crédito"));
    await waitFor(() => expect(naTela("no cartão")).toBe(true));
    fireEvent.press(botao());
    expect(await screen.findByText("Pedido enviado!")).toBeTruthy();
    expect(navegar).not.toHaveBeenCalledWith(expect.objectContaining({ tipo: "pedido" }), expect.anything());
  });

  test("a cliente que volta: 'Que bom te ver de novo' e 'Não sou eu'", async () => {
    window.localStorage.setItem("aura_customer_" + SLUG, JSON.stringify({
      ts: Date.now(), name: "Helena Martins", phone: "(12) 99183-4410", email: "helena@gmail.com",
    }));
    servidor();
    render(<PaginaDaVitrine slug={SLUG} />);
    await irAoCheckout();
    await ver("Que bom te ver de novo, Helena");
    expect(naTela("Bem-vind")).toBe(false);
    expect(naTela("Continuar para a entrega")).toBe(true);
    fireEvent.press(screen.getByText("Não sou eu"));
    await waitFor(() => expect(naTela("Falta seu nome")).toBe(true));
    expect(naTela("Que bom te ver de novo")).toBe(false);
    expect(window.localStorage.getItem("aura_customer_" + SLUG)).toBeNull();
  });

  test("Tela 8: um pedido esperando Pix pergunta antes de criar outro", async () => {
    window.localStorage.setItem("aura_pending_order_" + SLUG, JSON.stringify({
      id: "o9", token: "tok9", order_number: "123", ts: Date.now() - 2 * 3600 * 1000,
      payment_method: "pix", total: 206.81, pecas: 4, imagens: [],
    }));
    servidor({ porToken: () => ({ status: 200, corpo: pedidoPublico() }) });
    render(<PaginaDaVitrine slug={SLUG} />);
    await irAoCheckout();
    expect(await acharId("pedido-pendente")).toBeTruthy();
    expect(naTela("Você tem um pedido esperando pagamento (#00123)")).toBe(true);
    expect(naTela("há 2 horas")).toBe(true);
    expect(naTela("4 peças · R$ 206,81 no Pix")).toBe(true);
    fireEvent.press(screen.getByText("Fazer um novo"));
    await waitFor(() => expect(nenhumId("pedido-pendente")).toBe(true));
    expect(naTela("continua esperando o pagamento")).toBe(true);
  });

  test("Tela 8: pedido já pago some em silêncio", async () => {
    window.localStorage.setItem("aura_pending_order_" + SLUG, JSON.stringify({
      id: "o9", token: "tok9", order_number: "123", ts: Date.now(), payment_method: "pix", total: 1, pecas: 1,
    }));
    servidor({ porToken: () => ({ status: 200, corpo: pedidoPublico(PAGO) }) });
    render(<PaginaDaVitrine slug={SLUG} />);
    await irAoCheckout();
    await waitFor(() => expect(window.localStorage.getItem("aura_pending_order_" + SLUG)).toBeNull());
    expect(nenhumId("pedido-pendente")).toBe(true);
  });
});

// ── A página do pedido ───────────────────────────────────────
function paginaDoPedido(token = "tok", consulta?: any) {
  return render(
    <CascaDaVitrine slug={SLUG}>
      <PedidoNaRota token={token} consulta={consulta} />
    </CascaDaVitrine>,
  );
}

describe("a página do pedido (Telas 5, 6 e 7)", () => {
  test("Pix pendente: consulta a cada 4 s e vira 'Pagamento recebido' sozinha; F5 mantém", async () => {
    // Relógio de verdade: o intervalo é o do produto (4 s, pix.js da
    // Negócio), e o teste espera por ele.
    let n = 0;
    const fetch = servidor({ porToken: () => (++n <= 1 ? { status: 200, corpo: pedidoPublico() } : { status: 200, corpo: pedidoPublico(PAGO) }) });
    const tela = paginaDoPedido();
    await ver("Falta só o Pix");
    expect(naTela("Copiar código Pix")).toBe(true);
    expect(naTela("O código vale por 72 horas, até 28/09 às 14:03.")).toBe(true);
    expect(naTela("Você economiza R$ 4,49 pagando no Pix")).toBe(true);
    // sem o id do pedido nesta aba, "Já paguei" e o comprovante somem
    expect(nenhumId("ja-paguei")).toBe(true);
    expect(nenhumId("anexar-comprovante")).toBe(true);

    await waitFor(() => pegarId("pagamento-recebido"), { timeout: 6000 });
    expect(naTela("Pagamento recebido")).toBe(true);
    expect(chamadas(fetch, "/studio/pedido/tok").length).toBe(2);

    fireEvent.press(pegarId("ver-meu-pedido"));
    await ver("Pedido recebido, Helena.");
    expect(naTela("Pago no Pix")).toBe(true);
    expect(naTela("Acompanhar pedido")).toBe(true);
    expect(naTela("Guardar este link no WhatsApp")).toBe(true);

    // F5: a mesma URL, o mesmo pedido, lido do servidor — e sem a
    // comemoração de novo (ela é da mudança, não do pedido pago).
    tela.unmount();
    paginaDoPedido();
    await ver("Pedido recebido, Helena.");
    expect(nenhumId("pagamento-recebido")).toBe(true);
    // pago: não consulta mais
    const antes = chamadas(fetch, "/studio/pedido/tok").length;
    await new Promise((r) => setTimeout(r, 4500));
    expect(chamadas(fetch, "/studio/pedido/tok").length).toBe(antes);
  }, 25000);

  test("'Já paguei' usa a rota da loja comum e a tela passa a esperar a loja", async () => {
    window.sessionStorage.setItem("aura-vitrine-pedido-tok", "o1");
    let marcou = false;
    const fetch = servidor({
      porToken: () => ({ status: 200, corpo: marcou ? pedidoPublico({ status: "awaiting_approval", pix: null }) : pedidoPublico() }),
    });
    const f = fetch.getMockImplementation()!;
    fetch.mockImplementation(((url: string, init?: any) => {
      if (String(url).endsWith("/order/o1/mark-as-paid")) marcou = true;
      return f(url, init);
    }) as any);
    paginaDoPedido();
    fireEvent.press(await acharId("ja-paguei"));
    await ver("Aguardando a loja confirmar");
    expect(chamadas(fetch, `/storefront/${SLUG}/order/o1/mark-as-paid`).length).toBe(1);
    expect(naTela("Ainda não pagou? Ver o código de novo")).toBe(true);
  });

  test("token que não existe: 'Não achamos esse pedido'", async () => {
    servidor();
    paginaDoPedido("nada");
    await ver("Não achamos esse pedido");
  });

  test("volta do cartão recusado: tentar outro cartão com o init_point guardado", async () => {
    window.localStorage.setItem("aura_pending_order_" + SLUG, JSON.stringify({
      id: "o1", token: "tok", order_number: "123", ts: Date.now(), payment_method: "card", total: 89.8, pecas: 2,
      card_init_point: "https://mp/checkout/1",
    }));
    servidor({ porToken: () => ({ status: 200, corpo: pedidoPublico({ payment_method: "card", pix: null, desconto_pix: 0, total: 89.8 }) }) });
    paginaDoPedido("tok", { pagamento: "cartao", retorno: "failed" });
    await ver("O pagamento não foi aprovado");
    expect(pegarId("tentar-outro-cartao")).toBeTruthy();
    expect(naTela("Pagar com Pix")).toBe(true);
  });

  test("volta do cartão aprovado e já confirmado: 'Pagamento aprovado'", async () => {
    servidor({ porToken: () => ({ status: 200, corpo: pedidoPublico({ payment_method: "card", ...PAGO }) }) });
    paginaDoPedido("tok", { pagamento: "cartao", retorno: "approved" });
    await ver("Pagamento aprovado");
  });
});

describe("os endereços novos", () => {
  test("/sacola abre a loja com a gaveta aberta", async () => {
    localStorage.setItem("aura-studio-storefront-" + SLUG, JSON.stringify([
      { lineId: "l1", product: CANECA, qty: 1, values: {}, hasBackSelected: false },
    ]));
    const navegar = jest.fn();
    servidor();
    render(
      <ProvedorDaRota navegar={navegar}>
        <CascaDaVitrine slug={SLUG} navegar={navegar}>
          <SacolaNaRota />
          <ConteudoDaVitrine />
        </CascaDaVitrine>
      </ProvedorDaRota>,
    );
    expect(await acharId("sacola-em-gaveta")).toBeTruthy();
    expect(navegar).toHaveBeenCalledWith({ tipo: "home" }, "trocar");
  });

  test("a volta do Mercado Pago (?order_id=&payment=) abre a página do pedido", async () => {
    window.localStorage.setItem("aura_pending_order_" + SLUG, JSON.stringify({
      id: "o1", token: "tok1", order_number: "123", ts: Date.now(), payment_method: "card", total: 89.8, pecas: 2,
    }));
    window.history.pushState({}, "", "/aura-qa?order_id=o1&payment=approved");
    servidor();
    render(
      <CascaDaVitrine slug={SLUG}>
        <RetornoDoCartao slugDoCaminho="aura-qa" />
      </CascaDaVitrine>,
    );
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/aura-qa/pedido/tok1?pagamento=cartao&retorno=approved"));
    expect(window.location.search).toBe("");
    window.history.pushState({}, "", "/");
  });
});
