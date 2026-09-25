// ============================================================
// Vitrine Studio · Fase 5 — as regras da home nova
//
// Mockup docs/mockups/studio-vitrine-05-home.html (telas 1 a 6) e
// decisão 10 do PO: faixa e selos da aba Design ou automáticos do Studio
// com os números da loja; até 3 banners com destino interno; sem banner,
// a peça escolhida (ou a primeira com prévia 3D) com as artes trocando;
// busca com o nome antes da descrição; categoria com filhas.
// ============================================================
import {
  itensDaFaixa, destinoDoBanner, bannersDaHome, proximoBanner, bannerGira, alturaDoHero,
  pecaDoDestaque, artesDoDestaque, nomesDeExemplo, listaDeCategorias, fraseDoDestaque, conviteDaPeca,
  lugarDaLoja, produtosDaArvore, alvoDaCategoria, menuDaLoja, trilhaDaCategoria, subcategorias,
  buscarNaVitrine, trechosDestacados, sugestoesDeBusca, mensagemDaBuscaVazia, selosDaHome,
  categoriaMaisForte, tituloParaEmpresas, blocoParaEmpresas, artesDaHome, mostrarTirarDuvida,
  descontoDoPix, gradeDaHome,
} from "@/components/studio/storefront/home/regrasDaHome";
import { resolverTela } from "@/components/studio/storefront/rotasDaVitrine";
import { agruparVitrine } from "@/components/studio/storefront/categoryGrouping";

const cat = (id: string, name: string, parent: string | null = null, path?: string) => ({
  id, name, slug: id, path: path || "/" + id, depth: parent ? 1 : 0, parent_id: parent,
});

function peca(id: string, extra: any = {}) {
  return {
    id, name: "Peça " + id, description: null, price: 49.9, image_url: "https://x/" + id + ".jpg",
    category: null, category_id: null, stock_qty: 1, pedidos: 0, visual_kind: null,
    customization_config: null, templates: [], ...extra,
  } as any;
}

function loja(extra: any = {}): any {
  return {
    products: [],
    categories: [],
    sla: { sla_base_days: 3, queue_qty: 0, total_estimate_days: 3 },
    payment: { has_pix: true, has_card: false, pay_on_delivery_enabled: false, pix_discount_pct: 5 },
    revisions: { max_included: 2, extra_price: 10, policy_text: null },
    delivery: { pickup_enabled: true, delivery_enabled: false, courier_pickup_enabled: false, delivery_fee: 0, pickup_eta_text: null, delivery_eta_text: null },
    numeros: { pedidos_entregues: 0 },
    total_products: 0,
    ...extra,
    site: { name: "Sheid Mania", primary_color: "#1a1612", accent_color: "#000", logo_url: null, whatsapp: "(12) 99614-5447", endereco: "Av Dom Pedro I, 553 - Jardim Colonial", ...(extra.site || {}) },
  };
}

describe("a faixa de anúncio", () => {
  test("vazia: a automática do Studio com prazo e Pix da loja", () => {
    expect(itensDaFaixa(loja())).toEqual(["Você aprova o mockup antes de produzir", "Pronto em 3 dias úteis", "5% no Pix"]);
  });
  test("sem desconto no Pix não anuncia desconto; um dia útil no singular", () => {
    const l = loja({ payment: { has_pix: true, pix_discount_pct: 0 }, sla: { total_estimate_days: 1 } });
    expect(itensDaFaixa(l)).toEqual(["Você aprova o mockup antes de produzir", "Pronto em 1 dia útil"]);
    expect(descontoDoPix(loja({ payment: { has_pix: false, pix_discount_pct: 10 } }))).toBe(0);
    expect(itensDaFaixa(loja({ payment: { has_pix: true, pix_discount_pct: 7.5 } }))[2]).toBe("7,5% no Pix");
  });
  test("escrita na aba Design: vale a dela, partida no ponto médio", () => {
    expect(itensDaFaixa(loja({ site: { announcement_bar: " Natal: pedidos até 20/12 · Frete grátis no centro " } })))
      .toEqual(["Natal: pedidos até 20/12", "Frete grátis no centro"]);
  });
});

describe("os destinos internos", () => {
  const l = loja({
    categories: [cat("canecas", "Canecas"), cat("vidro", "Vidro e chopp", "canecas", "/canecas/vidro"), cat("vazia", "Vazia")],
    products: [peca("a", { category_id: "vidro" }), peca("b", { category_id: "canecas", pedidos: 3 }), peca("c", { pedidos: 2 })],
  });
  test("#cat=/caminho abre a categoria; categoria sem peça ou inexistente não vira botão", () => {
    expect(destinoDoBanner("#cat=/canecas", l)).toMatchObject({ tipo: "categoria", categoria: { id: "canecas" } });
    expect(destinoDoBanner("#cat=/canecas/vidro", l)).toMatchObject({ tipo: "categoria", categoria: { id: "vidro" } });
    expect(destinoDoBanner("#cat=/vazia", l)).toBeNull();
    expect(destinoDoBanner("#cat=/sumiu", l)).toBeNull();
  });
  test("#vista: lote abre o orçamento; mais_vendidos os queridinhos; o resto a grade", () => {
    expect(destinoDoBanner("#vista=lote", l)).toEqual({ tipo: "lote" });
    expect(destinoDoBanner("#vista=mais_vendidos", l)).toEqual({ tipo: "queridinhos" });
    expect(destinoDoBanner("#vista=mais_vendidos", loja())).toEqual({ tipo: "grade" });
    expect(destinoDoBanner("#vista=todos", l)).toEqual({ tipo: "grade" });
    expect(destinoDoBanner("#vista=novidades", l)).toEqual({ tipo: "grade" });
  });
  test("http(s) sai da loja; o resto não é destino", () => {
    expect(destinoDoBanner("https://instagram.com/sheidmania_", l)).toEqual({ tipo: "externo", url: "https://instagram.com/sheidmania_" });
    expect(destinoDoBanner("javascript:alert(1)", l)).toBeNull();
    expect(destinoDoBanner("", l)).toBeNull();
  });
});

describe("os banners", () => {
  const b = (x: any) => ({ kicker: "", headline: "", body: "", cta: "", cta_url: "", tone: "split", tint: "brand", image_url: null, image_url_mobile: null, enabled: true, ...x });
  test("até 3, ligados e com conteúdo; arte pronta com destino é o banner-link", () => {
    const l = loja({
      categories: [cat("canecas", "Canecas")],
      products: [peca("a", { category_id: "canecas" }), peca("b", { category_id: "canecas" })],
      site: { banners: [
        b({ kicker: "Dia das Mães", headline: "Canecas com a foto dela", cta: "Ver canecas", cta_url: "#cat=/canecas", image_url: "https://x/b0.jpg" }),
        b({ headline: "desligado", enabled: false }),
        b({ image_url: "https://x/b2.jpg", cta_url: "#vista=lote" }),
        b({ image_url: "https://x/b3.jpg" }),
        b({ headline: "quarto" }),
      ] },
    });
    const bs = bannersDaHome(l);
    expect(bs).toHaveLength(3);
    expect(bs[0]).toMatchObject({ comTexto: true, soLink: false, destino: { tipo: "categoria" }, rotulo: "Ver canecas" });
    expect(bs[1]).toMatchObject({ comTexto: false, soLink: true, destino: { tipo: "lote" } });
    expect(bs[2]).toMatchObject({ comTexto: false, soLink: false, destino: null });
  });
  test("o fallback de capa + tagline da loja comum conta como sem banner", () => {
    expect(bannersDaHome(loja({ site: { banners: [b({ headline: "tagline" })], banners_automaticos: true } }))).toEqual([]);
  });
  test("giro: volta ao começo; só gira com 2+, sem pausa e sem reduzir movimento", () => {
    expect(proximoBanner(2, 3)).toBe(0);
    expect(proximoBanner(0, 3, -1)).toBe(2);
    expect(bannerGira({ total: 3, pausado: false, reduzirMovimento: false })).toBe(true);
    expect(bannerGira({ total: 1, pausado: false, reduzirMovimento: false })).toBe(false);
    expect(bannerGira({ total: 3, pausado: true, reduzirMovimento: false })).toBe(false);
    expect(bannerGira({ total: 3, pausado: false, reduzirMovimento: true })).toBe(false);
  });
  test("altura: 3:1 no desktop; no celular alta com texto ou arte de celular, 3:1 só com arte pronta larga", () => {
    const comTexto = bannersDaHome(loja({ site: { banners: [b({ headline: "x", image_url: "https://x/1.jpg" })] } }));
    const soArte = bannersDaHome(loja({ site: { banners: [b({ image_url: "https://x/1.jpg" })] } }));
    const arteDoCelular = bannersDaHome(loja({ site: { banners: [b({ image_url: "https://x/1.jpg", image_url_mobile: "https://x/m.jpg" })] } }));
    expect(alturaDoHero(1280, true, comTexto)).toBe(427);
    expect(alturaDoHero(390, false, comTexto)).toBe(476);
    expect(alturaDoHero(390, false, arteDoCelular)).toBe(476);
    expect(alturaDoHero(390, false, soArte)).toBe(130);
  });
});

describe("a peça do destaque sem banner", () => {
  const produtos = [
    peca("foto"), peca("tres-d", { visual_kind: "model3d" }), peca("outra-3d", { visual_kind: "model3d" }),
  ];
  test("a escolhida na aba Design, se ainda está na loja", () => {
    expect(pecaDoDestaque(loja({ products: produtos, site: { hero_product_id: "outra-3d" } })))
      .toMatchObject({ produto: { id: "outra-3d" }, escolhida: true });
  });
  test("senão a primeira com prévia 3D; sem 3D a primeira com foto", () => {
    expect(pecaDoDestaque(loja({ products: produtos, site: { hero_product_id: "saiu" } })))
      .toMatchObject({ produto: { id: "tres-d" }, escolhida: false });
    expect(pecaDoDestaque(loja({ products: [peca("s", { image_url: null }), peca("f")] }))!.produto.id).toBe("f");
    expect(pecaDoDestaque(loja())).toBeNull();
  });
  test("artes: as prontas da peça no campo de arte; sem elas, nomes de exemplo no campo de texto", () => {
    const comArte = peca("x", {
      templates: [{ id: "t1", name: "Mãe coração", image_url: "https://x/t1.png", thumb_url: null }, { id: "t2", name: "Formatura", image_url: "https://x/t2.png", thumb_url: null }],
      customization_config: { fields: [
        { id: "cor", type: "color", config: { colors: ["#F7F4EE", "#111"] } },
        { id: "arte", type: "template", config: {} },
        { id: "txt", type: "text", config: {} },
      ] },
    });
    expect(artesDoDestaque(comArte, "Sheid")).toEqual([
      { rotulo: "Mãe coração", values: { cor: "#F7F4EE", arte: "https://x/t1.png" } },
      { rotulo: "Formatura", values: { cor: "#F7F4EE", arte: "https://x/t2.png" } },
    ]);
    const soTexto = peca("y", { customization_config: { fields: [{ id: "t", type: "text", side: "front", config: {} }, { id: "v", type: "text", side: "back", config: {} }] } });
    expect(artesDoDestaque(soTexto, "Sheid Mania").map((a) => a.values)).toEqual([{ t: "Helena" }, { t: "Vovó Lourdes" }, { t: "Time Sheid" }]);
    expect(artesDoDestaque(peca("z"), "x")).toEqual([]);
    expect(nomesDeExemplo("")[2]).toBe("Feliz aniversário");
  });
  test("os textos: a tagline dela ou a frase do Studio com as categorias; o convite no singular", () => {
    expect(listaDeCategorias(["Canecas", "Camisetas", "Copos", "Azulejos"])).toBe("Canecas, camisetas e copos");
    expect(listaDeCategorias(["Canecas"])).toBe("Canecas");
    expect(fraseDoDestaque(loja({ site: { tagline: "Feito à mão em SJC" } }))).toBe("Feito à mão em SJC");
    const l = loja({ categories: [cat("canecas", "Canecas")], products: [peca("a", { category_id: "canecas" })] });
    expect(fraseDoDestaque(l)).toBe("Canecas com a sua foto, o seu nome ou a sua frase. Você vê como fica antes de pagar.");
    expect(conviteDaPeca("Canecas")).toBe("Personalizar uma caneca");
    expect(conviteDaPeca("Copos")).toBe("Personalizar um copo");
    expect(conviteDaPeca("Cartões")).toBe("Personalizar um cartão");
    expect(conviteDaPeca("Cartão de visita")).toBe("Personalizar um cartão de visita");
    expect(conviteDaPeca("Foto Colorida")).toBe("Personalizar esta peça");
    expect(conviteDaPeca("Chaveiros e ímãs")).toBe("Personalizar um chaveiro e ímãs");
    expect(conviteDaPeca("Adesivos")).toBe("Personalizar um adesivo");
    expect(conviteDaPeca("Chinelos")).toBe("Personalizar um chinelo");
    expect(conviteDaPeca("Lápis")).toBe("Personalizar esta peça");
    expect(conviteDaPeca(null)).toBe("Personalizar esta peça");
    expect(lugarDaLoja("Av Dom Pedro I, 553 - Jardim Colonial")).toBe("Jardim Colonial");
    expect(lugarDaLoja("Rua X, 10")).toBe("");
    expect(lugarDaLoja("")).toBe("");
  });
});

describe("categorias com filhas", () => {
  const cats = [cat("canecas", "Canecas"), cat("ceramica", "Cerâmica", "canecas"), cat("metal", "Metalizadas", "canecas"), cat("copos", "Copos")];
  const produtos = [
    peca("1", { category_id: "ceramica" }), peca("2", { category_id: "ceramica" }), peca("3", { category_id: "metal" }),
    peca("4", { category_id: "copos" }), peca("5"),
  ];
  const l = loja({ categories: cats, products: produtos });
  test("a raiz leva as peças das filhas; uma peça só abre a peça", () => {
    expect(produtosDaArvore("canecas", l).map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(alvoDaCategoria(cats[0] as any, l)).toMatchObject({ tipo: "grupo", produtos: [{ id: "1" }, { id: "2" }, { id: "3" }] });
    expect(alvoDaCategoria(cats[2] as any, l)).toMatchObject({ tipo: "produto", produto: { id: "3" } });
    expect(alvoDaCategoria(null, l)).toBeNull();
  });
  test("o menu: raízes com peça, as maiores primeiro, filhas com peça na sanfona", () => {
    const m = menuDaLoja(l);
    expect(m.map((i) => [i.categoria.name, i.total])).toEqual([["Canecas", 3], ["Copos", 1]]);
    expect(m[0].filhas.map((f) => [f.categoria.name, f.total])).toEqual([["Cerâmica", 2], ["Metalizadas", 1]]);
  });
  test("trilha e subcategorias", () => {
    expect(trilhaDaCategoria(cats[2] as any, cats as any).map((c) => c.name)).toEqual(["Canecas", "Metalizadas"]);
    expect(subcategorias(cats[0] as any, l).map((s) => [s.categoria.name, s.total])).toEqual([["Cerâmica", 2], ["Metalizadas", 1]]);
  });
  test("a grade da home agrupa pela raiz: um cartão Canecas com as filhas dentro", () => {
    const g = gradeDaHome(l);
    expect(g.map((e) => (e.kind === "category" ? "cat:" + e.category.id + ":" + e.products.length : "p:" + e.product.id)))
      .toEqual(["cat:canecas:3", "p:4", "p:5"]);
    // As peças do cartão guardam a categoria de verdade (a filha).
    const canecas: any = g[0];
    expect(canecas.products.map((p: any) => p.category_id)).toEqual(["ceramica", "ceramica", "metal"]);
    // Sem árvore, o agrupamento de sempre.
    const plana = loja({ categories: [cat("a", "A")], products: [peca("1", { category_id: "a" }), peca("2", { category_id: "a" })] });
    expect(gradeDaHome(plana)).toHaveLength(1);
  });

  test("a URL da raiz abre a página dela (F5 e link colado), não a home", () => {
    const r = resolverTela({ tipo: "categoria", categoria: "canecas" }, l, agruparVitrine(l.products, l.categories));
    expect(r).toMatchObject({ acao: "categoria", categoria: { id: "canecas" } });
    expect((r as any).produtos).toHaveLength(3);
    expect(resolverTela({ tipo: "categoria", categoria: "copos" }, l, [])).toEqual({ acao: "redirecionar", para: { tipo: "produto", id: "4" } });
  });
});

describe("a busca", () => {
  const l = loja({
    categories: [cat("canecas", "Canecas")],
    products: [
      peca("cromada", { name: "Caneca Cromada Prata", description: "Cor prata espelhada.", category_id: "canecas" }),
      peca("colorida", { name: "Caneca Alça Colorida", category_id: "canecas" }),
      peca("coracao", { name: "Caneca Alça Coração", category_id: "canecas" }),
      peca("copo", { name: "Copo Stanley" }),
    ],
  });
  test("nome antes da descrição, na ordem da vitrine; a categoria que casa em cima", () => {
    const r = buscarNaVitrine("caneca co", l);
    expect(r.pecas.map((p) => [p.produto.id, p.noNome])).toEqual([["colorida", true], ["coracao", true], ["cromada", false]]);
    expect(r.categorias).toEqual([{ categoria: expect.objectContaining({ id: "canecas" }), casam: 3, total: 3 }]);
    expect(r.pecas[0].categoria).toBe("Canecas");
  });
  test("sem acento e sem caixa; vazio não busca", () => {
    expect(buscarNaVitrine("CORACAO", l).pecas.map((p) => p.produto.id)).toEqual(["coracao"]);
    expect(buscarNaVitrine("   ", l)).toEqual({ pecas: [], categorias: [] });
    expect(buscarNaVitrine("garrafa", l).pecas).toEqual([]);
  });
  test("o termo marcado no nome, com acento no original", () => {
    expect(trechosDestacados("Caneca Alça Coração", "alca cor")).toEqual([
      { texto: "Caneca ", marcado: false }, { texto: "Alça", marcado: true }, { texto: " ", marcado: false },
      { texto: "Cor", marcado: true }, { texto: "ação", marcado: false },
    ]);
    expect(trechosDestacados("Copo", "")).toEqual([{ texto: "Copo", marcado: false }]);
  });
  test("sugestões com as palavras da loja; mensagem do nada encontrado com o termo", () => {
    expect(sugestoesDeBusca(l, 3)).toEqual(["Caneca", "Alça", "Colorida"]);
    expect(mensagemDaBuscaVazia("garrafa", "Sheid Mania")).toBe('Olá, Sheid Mania! Procurei "garrafa" na loja e não achei. Vocês fazem?');
  });
});

describe("os selos de confiança", () => {
  test("automáticos do Studio: aprova antes com as revisões, compra segura, retirada com o bairro, atendimento", () => {
    expect(selosDaHome(loja())).toEqual([
      { icone: "eye", titulo: "Você aprova antes", texto: "Mockup antes de produzir, 2 revisões inclusas" },
      { icone: "shield", titulo: "Compra segura", texto: "Pix, pagamento protegido" },
      { icone: "store", titulo: "Retire na loja", texto: "Jardim Colonial" },
      { icone: "whatsapp", titulo: "Atendimento humano", texto: "WhatsApp direto com a loja" },
    ]);
  });
  test("os números da loja entram: pedidos entregues; o prazo quando sobra lugar", () => {
    const s = selosDaHome(loja({ numeros: { pedidos_entregues: 312 } }));
    expect(s[1]).toEqual({ icone: "check_circle", titulo: "312 pedidos entregues", texto: "Feitos e entregues por esta loja" });
    expect(s).toHaveLength(4);
    const semZap = selosDaHome(loja({ site: { whatsapp: "" }, revisions: { max_included: 0 } }));
    expect(semZap.map((x) => x.titulo)).toEqual(["Você aprova antes", "Compra segura", "Retire na loja", "Pronto em 3 dias úteis"]);
    expect(semZap[0].texto).toBe("Mockup antes de produzir, nada sai sem o seu ok");
  });
  test("escritos na aba Design: valem os dela, com os ícones do painel", () => {
    const s = selosDaHome(loja({ site: { service_cards: [
      { icon: "pkg", title: "Embalagem para presente", body: "Sem custo" },
      { icon: "leaf", title: "Produção própria", body: "", enabled: true },
      { icon: "star", title: "", body: "", enabled: true },
    ] } }));
    expect(s).toEqual([
      { icone: "package", titulo: "Embalagem para presente", texto: "Sem custo" },
      { icone: "sparkles", titulo: "Produção própria", texto: "" },
    ]);
  });
});

describe("o bloco para empresas", () => {
  const cats = [cat("canecas", "Canecas"), cat("camisetas", "Camisetas")];
  test("a categoria mais forte: mais pedidos; sem pedido, mais peças", () => {
    const semPedido = loja({ categories: cats, products: [peca("1", { category_id: "canecas" }), peca("2", { category_id: "camisetas" }), peca("3", { category_id: "camisetas" })] });
    expect(categoriaMaisForte(semPedido)!.categoria.id).toBe("camisetas");
    const comPedido = loja({ categories: cats, products: [peca("1", { category_id: "canecas", pedidos: 4 }), peca("2", { category_id: "camisetas" }), peca("3", { category_id: "camisetas" })] });
    expect(categoriaMaisForte(comPedido)!.categoria.id).toBe("canecas");
    expect(categoriaMaisForte(loja())).toBeNull();
  });
  test("o título na língua da categoria", () => {
    expect(tituloParaEmpresas("Canecas")).toBe("50 canecas com o nome de cada convidado? Preço na hora.");
    expect(tituloParaEmpresas("Camisetas")).toBe("30 camisetas com o nome de cada pessoa do time? Preço na hora.");
    expect(tituloParaEmpresas("Copos e garrafas")).toBe("40 copos com o nome de cada convidado? Preço na hora.");
    expect(tituloParaEmpresas("Adesivos")).toBe("50 peças com o nome de cada convidado? Preço na hora.");
    expect(tituloParaEmpresas(null)).toBe("50 peças com o nome de cada convidado? Preço na hora.");
  });
  test("a escada da peça de referência, com o prazo por faixa; sem escada, nada inventado", () => {
    const tiers = [
      { min_qty: 1, max_qty: 9, unit_price: 39.9, discount_pct: 0, lead_days: 3 },
      { min_qty: 10, max_qty: 49, unit_price: 35.91, discount_pct: 10, lead_days: 5 },
      { min_qty: 50, max_qty: null, unit_price: 31.92, discount_pct: 20, lead_days: 8 },
    ];
    const l = loja({ categories: cats, products: [peca("1", { name: "Caneca Branca", category_id: "canecas", qty_tiers: tiers }), peca("2", { category_id: "canecas" })] });
    const b = blocoParaEmpresas(l);
    expect(b.titulo).toMatch(/^50 canecas/);
    expect(b.degraus).toEqual([{ minimo: 10, preco: 35.91, pct: 10 }, { minimo: 50, preco: 31.92, pct: 20 }]);
    expect(b.legenda).toBe("Caneca Branca, preço por unidade. Prazo: até 9 un, 3 dias úteis · 10 a 49, 5 dias úteis · 50 ou mais, 8 dias úteis.");
    expect(b.fotos).toHaveLength(2);
    expect(blocoParaEmpresas(loja({ products: [peca("x")] }))).toMatchObject({ degraus: [], legenda: null });
  });
});

describe("as artes prontas abrem a peça", () => {
  const campo = { fields: [{ id: "arte", type: "template", config: {} }] };
  test("cada arte com a peça que a aceita, a mais pedida primeiro; menos de 2 não é seleção", () => {
    const a = peca("a", { customization_config: campo, templates: [{ id: "t1", name: "Mãe", image_url: "https://x/1.png", thumb_url: "https://x/1s.png" }] });
    const b = peca("b", { pedidos: 5, customization_config: campo, templates: [{ id: "t2", name: "Pai", image_url: "https://x/2.png", thumb_url: null }, { id: "t1", name: "Mãe", image_url: "https://x/1.png", thumb_url: null }] });
    const semCampo = peca("c", { templates: [{ id: "t3", name: "X", image_url: "https://x/3.png", thumb_url: null }] });
    const artes = artesDaHome([a, b, semCampo]);
    expect(artes.map((x) => [x.id, x.produto.id, x.campoId, x.imagem, x.valor])).toEqual([["t2", "b", "arte", "https://x/2.png", "https://x/2.png"], ["t1", "b", "arte", "https://x/1.png", "https://x/1.png"]]);
    // A miniatura na vitrine; a imagem inteira no campo.
    expect(artesDaHome([b, a]).find((x) => x.id === "t1")).toBeTruthy();
    expect(artesDaHome([a])).toEqual([]);
  });
});

describe("o Tirar dúvida não cobre o destaque", () => {
  test("aparece só quando o fim do destaque está acima da faixa do botão", () => {
    // Celular 390×844: destaque sem banner termina em ~1100.
    expect(mostrarTirarDuvida({ rolagem: 0, fimDoTopo: 1100, alturaDaTela: 844 })).toBe(false);
    expect(mostrarTirarDuvida({ rolagem: 400, fimDoTopo: 1100, alturaDaTela: 844 })).toBe(true);
    // Desktop 1280×800: banners terminam em 600 — o botão já cabe embaixo.
    expect(mostrarTirarDuvida({ rolagem: 0, fimDoTopo: 600, alturaDaTela: 800 })).toBe(true);
    // Antes de medir, não aparece.
    expect(mostrarTirarDuvida({ rolagem: 0, fimDoTopo: 0, alturaDaTela: 800 })).toBe(false);
  });
});
