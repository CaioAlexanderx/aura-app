// ============================================================
// QA 27/09 · a navegação da vitrine nova, desenhada
//
// Monta a vitrine como o layout de `app/[slug]` (casca + rota filha),
// com um `navegar` falso — o mesmo arranjo de vitrineStudioHomeNovaTela:
//   - loja com UMA categoria com peça e peças soltas (a aura-qa): a barra
//     aparece com "Todas as peças", a categoria e "Outras peças"; a
//     gaveta e o rodapé repetem a lista;
//   - "Outras peças" abre a página com as soltas, "N peças" e a trilha;
//   - link direto de peça que saiu da loja: a home com o recado no topo,
//     que fecha com "Fechar aviso".
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

// Como a aura-qa: Canecas com peças, duas categorias vazias e peças soltas.
const PRODUTOS = [
  peca("branca", { name: "Caneca Branca", category_id: "canecas" }),
  peca("coracao", { name: "Caneca Alça Coração", category_id: "canecas" }),
  peca("cromada", { name: "Caneca Cromada Prata", category_id: "canecas" }),
  peca("azulejo", { name: "Azulejo com Foto" }),
  peca("chaveiro", { name: "Chaveiro Acrílico" }),
  peca("camiseta", { name: "Camiseta Básica", category_id: "categoria-apagada" }),
];
const CATEGORIAS = [cat("cartao-de-visita", "Cartão de visita"), cat("foto-colorida", "Foto Colorida"), cat("canecas", "Canecas")];

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

/** Monta numa tela e devolve como trocar a URL (o `navegar` é falso). */
function montarComRota(tela: TelaDaVitrine, store: any = loja()) {
  servidor(store);
  const navegar = jest.fn();
  try { window.sessionStorage.setItem("aura-vitrine-na-aba-" + SLUG, "1"); } catch {}
  const arvore = (t: TelaDaVitrine) => (
    <ProvedorDaRota navegar={navegar}>
      <CascaDaVitrine slug={SLUG} navegar={navegar}>
        <TelaNaRota key={JSON.stringify(t)} tela={t} />
      </CascaDaVitrine>
    </ProvedorDaRota>
  );
  const r = render(arvore(tela));
  return { navegar, irPara: (t: TelaDaVitrine) => r.rerender(arvore(t)) };
}

describe("a barra com uma categoria só (a aura-qa)", () => {
  test("desktop: Todas as peças, Canecas e Outras peças", async () => {
    montar();
    await home();
    expect(temId("barra-todas")).toBe(true);
    expect(temId("barra-categoria")).toBe(true);
    expect(temId("barra-outras")).toBe(true);
    const texto = JSON.stringify(screen.toJSON());
    expect(texto.indexOf("Todas as peças")).toBeLessThan(texto.indexOf("Outras peças"));
    // Categorias sem peça não entram.
    expect(screen.queryAllByLabelText("Foto Colorida")).toHaveLength(0);
  });

  test("Outras peças abre a página do grupo", async () => {
    const navegar = montar();
    await home();
    fireEvent.press(pegarId("barra-outras"));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "categoria", categoria: "outras" }, "empilhar"));
  });

  test("Canecas abre a categoria", async () => {
    const navegar = montar();
    await home();
    fireEvent.press(pegarId("barra-categoria"));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "categoria", categoria: "canecas" }, "empilhar"));
  });

  test("o rodapé repete a lista no Navegue", async () => {
    montar();
    await home();
    expect(temId("rodape-navegacao")).toBe(true);
    // Barra + rodapé: cada entrada aparece duas vezes.
    expect(screen.getAllByLabelText("Todas as peças").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByLabelText("Outras peças").length).toBeGreaterThanOrEqual(2);
  });

  test("celular: a gaveta tem Todas as peças e Outras peças", async () => {
    largura(390);
    const navegar = montar();
    await home();
    fireEvent.press(screen.getByLabelText("Abrir o menu"));
    await acharId("gaveta-do-menu");
    expect(temId("gaveta-todas")).toBe(true);
    expect(temId("gaveta-outras")).toBe(true);
    fireEvent.press(pegarId("gaveta-outras"));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "categoria", categoria: "outras" }, "empilhar"));
    expect(temId("gaveta-do-menu")).toBe(false);
  });
});

describe("a página Outras peças", () => {
  test("/c/outras: trilha Início / Outras peças, N peças, sublinhado na barra", async () => {
    montar({ tipo: "categoria", categoria: "outras" });
    expect(await acharId("grade-de-modelos-v2")).toBeTruthy();
    expect(naTela("Início")).toBe(true);
    expect(naTela("3 peças")).toBe(true);
    expect(naTela("Azulejo com Foto")).toBe(true);
    expect(naTela("Chaveiro Acrílico")).toBe(true);
    // Categoria que a loja não tem mais conta como solta.
    expect(naTela("Camiseta Básica")).toBe(true);
    expect(naTela("Caneca Branca")).toBe(false);
    // A entrada da página aberta vai em negrito, com o sublinhado.
    const emNegrito = (id: string) => pegarId(id).findAll((n: any) => typeof n.type === "string" && n.props?.style?.fontWeight === "600").length > 0;
    expect(emNegrito("barra-outras")).toBe(true);
    expect(emNegrito("barra-todas")).toBe(false);
  });

  test("a peça solta abre sem o seletor de modelo", async () => {
    const navegar = montar({ tipo: "categoria", categoria: "outras" });
    await acharId("grade-de-modelos-v2");
    fireEvent.press(screen.getByLabelText("Chaveiro Acrílico, R$ 49,90"));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "produto", id: "chaveiro" }, "empilhar"));
  });

  test("Todas as peças fora da home volta para a home", async () => {
    const navegar = montar({ tipo: "categoria", categoria: "outras" });
    await acharId("grade-de-modelos-v2");
    fireEvent.press(pegarId("barra-todas"));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "home" }, "voltar"));
  });
});

describe("a tipografia Marcante (font_family: editorial)", () => {
  test("a vitrine carrega o link com Instrument Serif e DM Sans", async () => {
    montar({ tipo: "home" }, loja({ site: { font_family: "editorial" } }));
    await home();
    const link = document.getElementById("aura-storefront-fonts") as HTMLLinkElement | null;
    expect(link?.getAttribute("href")).toContain("family=Instrument+Serif");
    expect(link?.getAttribute("href")).toContain("family=DM+Sans");
    expect(link?.getAttribute("href")).not.toContain("Fraunces");
  });
});

describe("peça fora da loja por link direto", () => {
  test("a home abre com o recado no topo, e ele fecha", async () => {
    const { navegar, irPara } = montarComRota({ tipo: "produto", id: "11111111-2222-4333-8444-555555555555" });
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "home" }, "voltar"));
    irPara({ tipo: "home" });
    expect(await acharId("recado-da-home")).toBeTruthy();
    // QA 28/09: sem sacola nem arte montada, o recado não fala das artes.
    expect(naTela("Essa peça não está mais na loja. Escolha outra.")).toBe(true);
    expect(naTela("as artes continuam suas")).toBe(false);
    fireEvent.press(screen.getByLabelText("Fechar aviso"));
    await waitFor(() => expect(temId("recado-da-home")).toBe(false));
  });

  test("uma vez: saiu da home, o recado não volta", async () => {
    const { navegar, irPara } = montarComRota({ tipo: "produto", id: "nao-existe" });
    await waitFor(() => expect(navegar).toHaveBeenCalledWith({ tipo: "home" }, "voltar"));
    irPara({ tipo: "home" });
    await acharId("recado-da-home");
    irPara({ tipo: "categoria", categoria: "canecas" });
    await acharId("grade-de-modelos-v2");
    irPara({ tipo: "home" });
    await home();
    expect(temId("recado-da-home")).toBe(false);
  });
});

