// ============================================================
// Vitrine Studio · Fase 5 — a home nova e a navegação, desenhadas
//
// Monta a vitrine como o layout de `app/[slug]` monta (casca + rota
// filha), com um `navegar` falso, e confere atrás da chave `vitrine_v2`:
//   - a chave escolhe entre a home nova e a de hoje (intocada);
//   - faixa e selos automáticos do Studio; escritos na aba Design valem;
//   - sem banner, a peça do destaque; com banners, botão com destino
//     interno e banner-link; reduzir movimento tira a pausa (nada gira);
//   - celular: gaveta com categorias, busca a cada letra, "Nada
//     encontrado" com "Ver a loja toda" e WhatsApp com o termo;
//   - desktop: a busca cai do campo do cabeçalho;
//   - a página da categoria: trilha, filhas como opções, "não achou?";
//   - o "Tirar dúvida" não aparece em cima do destaque.
// ============================================================
import React from "react";
import { Linking } from "react-native";
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
    LivePreview: (p: any) => R.createElement("div", { "data-testid": "mockup" }, "mockup"),
    defaultConfiguratorSize: () => 320,
  };
});
// O 3D não carrega no jsdom: o destaque fica na foto, como sem rede.
jest.mock("@/components/studio/visualEngine/threeLoader", () => ({
  loadThree: () => Promise.reject(new Error("sem 3D no teste")),
}));

import { CascaDaVitrine } from "@/components/studio/storefront/PaginaDaVitrine";
import { ProvedorDaRota, TelaNaRota } from "@/components/studio/storefront/VitrineNaRota";
import type { TelaDaVitrine } from "@/components/studio/storefront/rotasDaVitrine";

const SLUG = "sheid-mania";
const cat = (id: string, name: string, parent: string | null = null) => ({ id, name, slug: id, path: parent ? `/${parent}/${id}` : `/${id}`, depth: parent ? 1 : 0, parent_id: parent });

const campos = { fields: [
  { id: "cor", type: "color", side: "front", config: { colors: ["#F7F4EE", "#1F1B18"] } },
  { id: "txt", type: "text", side: "front", config: {} },
] };
function peca(id: string, extra: any = {}) {
  return {
    id, name: "Peça " + id, description: "Uma peça.", price: 49.9, image_url: `https://x/${id}.jpg`, gallery_urls: [],
    category: null, category_id: null, stock_qty: 5, pedidos: 0, visual_kind: null, qty_tiers: [], templates: [],
    customization_config: campos, created_at: "2026-01-01T00:00:00Z", ...extra,
  };
}

const PRODUTOS = [
  peca("branca", { name: "Caneca Branca", category_id: "ceramica", visual_kind: "model3d" }),
  peca("coracao", { name: "Caneca Alça Coração", category_id: "ceramica", visual_kind: "model3d" }),
  peca("cromada", { name: "Caneca Cromada Prata", description: "Cor prata espelhada.", category_id: "metal", visual_kind: "model3d" }),
  peca("polo", { name: "Camisa Polo", category_id: "camisetas" }),
  peca("basica", { name: "Camisa Básica", category_id: "camisetas" }),
  peca("copo", { name: "Copo Stanley", category_id: "copos" }),
];
const CATEGORIAS = [cat("canecas", "Canecas"), cat("ceramica", "Cerâmica", "canecas"), cat("metal", "Metalizadas", "canecas"), cat("camisetas", "Camisetas"), cat("copos", "Copos")];

function loja(extra: any = {}) {
  return {
    products: PRODUTOS,
    categories: CATEGORIAS,
    sla: { sla_base_days: 3, queue_qty: 0, total_estimate_days: 3 },
    payment: { has_pix: true, has_card: false, pay_on_delivery_enabled: false, pix_discount_pct: 5, card_max_installments: null },
    revisions: { max_included: 2, extra_price: 10, policy_text: null },
    delivery: { pickup_enabled: true, delivery_enabled: false, courier_pickup_enabled: false, delivery_fee: 0, pickup_eta_text: null, delivery_eta_text: null },
    pedidos: { aceita: true, motivo: null, recado: null, pedidos_ate: null },
    numeros: { pedidos_entregues: 0 },
    rodape_institucional: { formas: ["Pix"], politica_titulo: "Trocas e devoluções", politica: "Até 7 dias." },
    total_products: PRODUTOS.length,
    ...extra,
    site: {
      name: "Sheid Mania", primary_color: "#1a1612", accent_color: "#1a1612", logo_url: null,
      whatsapp: "(12) 99614-5447", endereco: "Av Dom Pedro I, 553 - Jardim Colonial", redes: [],
      banners: [], banners_automaticos: true, announcement_bar: "", service_cards: [], hero_product_id: null,
      vitrine_v2: true, card_style: "image-heavy",
      ...(extra.site || {}),
    },
  };
}

const fetchOriginal = global.fetch;
function servidor(store: any) {
  global.fetch = jest.fn((url: string) => Promise.resolve({
    ok: String(url).endsWith("/studio/products"), status: String(url).endsWith("/studio/products") ? 200 : 404,
    json: () => Promise.resolve(String(url).endsWith("/studio/products") ? store : { error: "nao" }),
  })) as any;
}
/** A largura da janela: o react-native-web mede pelo documentElement. */
function largura(w: number) {
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: w });
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 844 });
  act(() => { window.dispatchEvent(new Event("resize")); });
}

beforeEach(() => {
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch {}
  largura(1280);
  jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve(true));
});
afterEach(() => { global.fetch = fetchOriginal; jest.restoreAllMocks(); delete (window as any).matchMedia; });

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);
// No react-native-web o testID vira data-testid no host (ver vitrineStudioFase2Tela).
const porId = (id: string) =>
  screen.root.findAll((n: any) => typeof n.type === "string" && n.props?.["data-testid"] === id);
const pegarId = (id: string) => {
  const a = porId(id);
  if (!a.length) throw new Error("sem data-testid " + id);
  return a[0];
};
const acharId = (id: string) => waitFor(() => pegarId(id));
const temId = (id: string) => porId(id).length > 0;
const home = () => acharId("home-da-vitrine-nova");

function montar(tela: TelaDaVitrine = { tipo: "home" }, store: any = loja()) {
  servidor(store);
  const navegar = jest.fn();
  try { window.sessionStorage.setItem("aura-vitrine-na-aba-" + SLUG, "1"); } catch {}
  render(
    <ProvedorDaRota navegar={navegar}>
      <CascaDaVitrine slug={SLUG} navegar={navegar}>
        <TelaNaRota tela={tela} />
      </CascaDaVitrine>
    </ProvedorDaRota>,
  );
  return navegar;
}

describe("a chave escolhe a home", () => {
  test("ligada: faixa automática, cabeçalho, destaque, passos, grade, selos e rodapé", async () => {
    montar();
    await home();
    // Faixa automática do Studio, com os dados da loja.
    expect(naTela("Você aprova o mockup antes de produzir")).toBe(true);
    expect(naTela("Pronto em 3 dias úteis")).toBe(true);
    expect(naTela("5% no Pix")).toBe(true);
    // Cabeçalho com a sacola e a barra de categorias (raízes com peça).
    expect(temId("cabecalho-da-vitrine")).toBe(true);
    expect(screen.getByLabelText("Abrir a sacola")).toBeTruthy();
    expect(screen.getAllByLabelText("Canecas").length).toBeGreaterThan(0);
    // Sem banner: a primeira com prévia 3D, com os nomes de exemplo.
    expect(temId("hero-da-peca")).toBe(true);
    expect(naTela("Presentes que ninguém mais tem.")).toBe(true);
    expect(screen.getByLabelText("Helena")).toBeTruthy();
    expect(naTela("Caneca Branca")).toBe(true);
    // Os blocos.
    expect(naTela("Três passos até o presente pronto")).toBe(true);
    expect(naTela("Escolha a peça. A arte é sua.")).toBe(true);
    expect(naTela("Mockup antes de produzir, 2 revisões inclusas")).toBe(true);
    expect(naTela("Retire na loja")).toBe(true);
    expect(naTela("Loja desenvolvida com ")).toBe(true);
    // Saiu da home (decisão 10 do PO) e não entra (JORNADA §5).
    expect(naTela("O que a gente personaliza")).toBe(false);
    expect(naTela("Últimas unidades")).toBe(false);
  });

  test("desligada: a home de hoje, intocada", async () => {
    montar({ tipo: "home" }, loja({ site: { vitrine_v2: false } }));
    expect(await screen.findByPlaceholderText("Buscar na loja...")).toBeTruthy();
    expect(temId("home-da-vitrine-nova")).toBe(false);
  });

  test("faixa e selos escritos na aba Design valem os dela", async () => {
    montar({ tipo: "home" }, loja({ site: {
      announcement_bar: "Natal: pedidos até 20/12 · Embalagem de presente",
      service_cards: [{ icon: "heart", title: "Produção própria", body: "Feito em SJC", enabled: true }],
    } }));
    await home();
    expect(naTela("Natal: pedidos até 20/12")).toBe(true);
    expect(naTela("Você aprova o mockup antes de produzir")).toBe(false);
    expect(naTela("Produção própria")).toBe(true);
    expect(naTela("Mockup antes de produzir, 2 revisões inclusas")).toBe(false);
  });

  test("a peça escolhida na aba Design é a do destaque", async () => {
    montar({ tipo: "home" }, loja({ site: { hero_product_id: "cromada" } }));
    await home();
    expect(screen.getByLabelText("Prévia da Caneca Cromada Prata com artes de exemplo")).toBeTruthy();
  });
});

describe("os banners", () => {
  const b = (x: any) => ({ kicker: "", headline: "", body: "", cta: "", cta_url: "", tone: "split", tint: "brand", image_url: null, image_url_mobile: null, enabled: true, ...x });
  const comBanners = () => loja({ site: { banners_automaticos: false, banners: [
    b({ kicker: "Dia das Mães", headline: "Canecas com a foto dela", body: "Mande a foto.", cta: "Ver canecas", cta_url: "#cat=/canecas", image_url: "https://x/b0.jpg" }),
    b({ headline: "50 canecas para a formatura", cta: "Pedir orçamento", cta_url: "#vista=lote", image_url: "https://x/b1.jpg" }),
    b({ image_url: "https://x/b2.jpg", cta: "Artes prontas", cta_url: "#vista=todos" }),
  ] } });

  test("até 3, com setas no desktop, bolinhas e contador; o botão leva à categoria", async () => {
    const navegar = montar({ tipo: "home" }, comBanners());
    await home();
    expect(temId("hero-de-banners")).toBe(true);
    expect(screen.getByLabelText("Próximo banner")).toBeTruthy();
    expect(screen.getByLabelText("Pausar os banners")).toBeTruthy();
    expect(naTela("01 / 03")).toBe(true);
    fireEvent.press(screen.getByLabelText("Ir para o banner 2"));
    await waitFor(() => expect(naTela("02 / 03")).toBe(true));
    fireEvent.press(screen.getByLabelText("Ir para o banner 1"));
    fireEvent.press(await screen.findByText("Ver canecas"));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "categoria", categoria: "canecas" }, "empilhar"));
  });

  test("arte pronta sem texto nosso: o banner inteiro é o link (#vista=lote abre o orçamento)", async () => {
    const navegar = montar({ tipo: "home" }, loja({ site: { banners_automaticos: false, banners: [
      b({ image_url: "https://x/b.jpg", cta: "Orçamento em lote para empresas", cta_url: "#vista=lote" }),
    ] } }));
    await home();
    fireEvent.press(screen.getByLabelText("Orçamento em lote para empresas"));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "orcamento" }, "empilhar"));
    // Um banner só: nada de bolinhas nem setas.
    expect(screen.queryByLabelText("Próximo banner")).toBeNull();
  });

  test("com reduzir movimento, nada gira: sem botão de pausa", async () => {
    (window as any).matchMedia = (q: string) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} });
    montar({ tipo: "home" }, comBanners());
    await home();
    expect(screen.queryByLabelText("Pausar os banners")).toBeNull();
    expect(screen.getByLabelText("Ir para o banner 2")).toBeTruthy();
  });
});

describe("navegação no celular", () => {
  beforeEach(() => largura(390));

  test("a gaveta: categorias com contagem, filhas em sanfona; tocar abre a página da categoria", async () => {
    const navegar = montar();
    await home();
    fireEvent.press(screen.getByLabelText("Abrir o menu"));
    expect(await acharId("gaveta-do-menu")).toBeTruthy();
    expect(naTela("Orçamento em lote")).toBe(true);
    expect(naTela("Falar no WhatsApp")).toBe(true);
    // Canecas tem filhas: primeiro abre a sanfona.
    fireEvent.press(screen.getAllByText("Canecas").pop()!);
    expect(await screen.findByText("Ver todas as canecas")).toBeTruthy();
    fireEvent.press(screen.getByText("Ver todas as canecas"));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "categoria", categoria: "canecas" }, "empilhar"));
    expect(temId("gaveta-do-menu")).toBe(false);
  });

  test("a busca: a cada letra, nome antes da descrição, categoria em cima", async () => {
    montar();
    await home();
    fireEvent.press(screen.getByLabelText("Buscar na loja"));
    const campo = await screen.findByLabelText("Buscar produtos");
    fireEvent.changeText(campo, "caneca co");
    await acharId("resultados-da-busca");
    const texto = JSON.stringify(screen.toJSON());
    expect(texto.indexOf("Alça")).toBeLessThan(texto.indexOf("Na descrição: Cor prata espelhada."));
    // A Branca não tem "co" no nome nem na descrição: 2 das 3 canecas.
    expect(screen.getByLabelText("Canecas, 2 de 3 modelos")).toBeTruthy();
  });

  test("nada encontrado: ver a loja toda, ou pedir pelo WhatsApp com o termo", async () => {
    montar();
    await home();
    fireEvent.press(screen.getByLabelText("Buscar na loja"));
    fireEvent.changeText(await screen.findByLabelText("Buscar produtos"), "garrafa");
    expect(await acharId("busca-nada-encontrado")).toBeTruthy();
    expect(naTela("Ver a loja toda")).toBe(true);
    fireEvent.press(screen.getByText("Pedir pelo WhatsApp"));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('Procurei "garrafa" na loja')));
    // O da camada de busca (o do destaque fica embaixo dela).
    fireEvent.press(screen.getAllByText("Ver a loja toda").pop()!);
    await waitFor(() => expect(temId("busca-da-vitrine")).toBe(false));
  });

  test("o Tirar dúvida não aparece em cima do destaque (celular, topo da página)", async () => {
    montar();
    await home();
    expect(screen.queryByLabelText("Falar com Sheid Mania no WhatsApp")).toBeNull();
  });
});

describe("desktop", () => {
  test("a busca cai embaixo do campo do cabeçalho", async () => {
    const navegar = montar();
    await home();
    const campo = screen.getByLabelText("Buscar produtos");
    fireEvent(campo, "focus", { target: campo, nativeEvent: {} });
    fireEvent.changeText(campo, "polo");
    expect(await acharId("busca-suspensa")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Camisa Polo, R$ 49,90"));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "produto", id: "polo" }, "empilhar"));
  });

  test("a barra de categorias abre a página da categoria", async () => {
    const navegar = montar();
    await home();
    fireEvent.press(screen.getAllByLabelText("Camisetas")[0]);
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "categoria", categoria: "camisetas" }, "empilhar"));
  });

  test("categoria de uma peça só abre a peça", async () => {
    const navegar = montar();
    await home();
    fireEvent.press(screen.getAllByLabelText("Copos")[0]);
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "produto", id: "copo" }, "empilhar"));
  });
});

describe("a página da categoria", () => {
  test("trilha, filhas como opções e o não achou? com WhatsApp", async () => {
    montar({ tipo: "categoria", categoria: "canecas" });
    expect(await acharId("grade-de-modelos-v2")).toBeTruthy();
    expect(temId("cabecalho-da-vitrine")).toBe(true);
    expect(naTela("Início")).toBe(true);
    expect(screen.getByLabelText("Tipos de canecas")).toBeTruthy();
    expect(naTela("Metalizadas")).toBe(true);
    expect(naTela("3 modelos")).toBe(true);
    fireEvent.press(screen.getByText("Metalizadas"));
    await waitFor(() => expect(naTela("1 modelo")).toBe(true));
    expect(naTela("Perguntar no WhatsApp")).toBe(true);
  });
});
