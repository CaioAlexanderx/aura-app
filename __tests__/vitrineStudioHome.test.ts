// ============================================================
// Os blocos da home da vitrine Studio (S2 · 03/09/2026)
//
// A regra é a mesma do redesign da loja comum: bloco nasce da
// configuração da lojista ou não existe. O handoff desenha uma home
// cheia — banner, "os queridinhos", "312 pedidos entregues" — e a Sheid
// Mania, que é a loja do desenho, tem hoje zero pedidos, nenhuma faixa
// de quantidade e nenhum banner cadastrado.
//
// "Os queridinhos da Sheid" com nada embaixo, ou um número inventado, é
// a loja dizendo à cliente que ninguém compra ali. Este teste guarda o
// silêncio: o que a loja não tem, ela não anuncia.
// ============================================================
import {
  montarBlocosDaHome, avisosDaLoja, passosDaLoja, maisPedidos,
  artesProntas, numerosDeConfianca, tiraDeCategorias, bannerDaVez,
  MINIMO_NA_FILEIRA, MAXIMO_MAIS_PEDIDOS,
} from "@/components/studio/storefront/blocosDaHome";
import type { StorePayload, StudioStoreProduct } from "@/components/studio/storefront/types";

function produto(over: Partial<StudioStoreProduct> = {}): StudioStoreProduct {
  return {
    id: "p" + Math.random().toString(36).slice(2, 7),
    name: "Caneca", description: null, price: 39.9,
    image_url: "https://x/foto.jpg", category: null,
    stock_qty: 3, customization_config: null, templates: [],
    ...over,
  } as StudioStoreProduct;
}

/** A Sheid como ela é hoje: produtos e artes, sem pedido nem banner. */
function lojaSheid(over: Partial<StorePayload> = {}): StorePayload {
  return {
    site: { name: "Sheid Mania", tagline: "", primary_color: "#1a1612",
            accent_color: "#EC4899", logo_url: "https://x/logo.jpg" },
    products: [produto(), produto()],
    sla: { sla_base_days: 3, queue_qty: 0, total_estimate_days: 3 },
    payment: { has_pix: true, has_card: false, pay_on_delivery_enabled: false },
    revisions: { max_included: 0, extra_price: 0, policy_text: null },
    numeros: { pedidos_entregues: 0 },
    total_products: 2,
    ...over,
  } as StorePayload;
}

describe("a loja silencia o que não tem", () => {
  test("Sheid hoje: sem mais pedidos, sem confiança, sem banner", () => {
    const b = montarBlocosDaHome(lojaSheid());
    expect(b.maisPedidos).toEqual([]);
    expect(b.confianca).toEqual([]);
    expect(b.hero.banner).toBeNull();
    // Sem banner, o mockup assume o topo — é o que ela tem de mais próprio.
    expect(b.hero.usarMockup).toBe(true);
  });

  test("um pedido só não faz fileira", () => {
    expect(maisPedidos([produto({ pedidos: 9 }), produto({ pedidos: 0 })])).toEqual([]);
  });

  test("com pedidos de verdade, ordena pelo mais pedido e corta em 4", () => {
    const lista = [1, 7, 3, 12, 5, 2].map((n) => produto({ pedidos: n }));
    const r = maisPedidos(lista);
    expect(r).toHaveLength(MAXIMO_MAIS_PEDIDOS);
    expect(r.map((p) => p.pedidos)).toEqual([12, 7, 5, 3]);
  });

  test("produto sem o campo pedidos conta como zero, não quebra", () => {
    expect(maisPedidos([produto(), produto()])).toEqual([]);
  });
});

describe("a faixa de avisos", () => {
  test("só diz o que é verdade sobre esta loja", () => {
    const a = avisosDaLoja(lojaSheid());
    expect(a.some((x) => x.includes("3 dias úteis"))).toBe(true);
    expect(a.some((x) => x.includes("aprova"))).toBe(true);
    // Loja sem revisão extra e sem desconto não anuncia nenhum dos dois.
    expect(a.some((x) => x.includes("revis"))).toBe(false);
    expect(a.some((x) => x.includes("Pix"))).toBe(false);
  });

  test("com desconto e revisões configurados, os dois entram", () => {
    const a = avisosDaLoja(lojaSheid({
      revisions: { max_included: 2, extra_price: 15, policy_text: null },
      payment: { has_pix: true, has_card: false, pay_on_delivery_enabled: false,
                 pix_discount_pct: 5 } as any,
    }));
    expect(a.some((x) => x === "2 revisões inclusas")).toBe(true);
    expect(a.some((x) => x === "5% de desconto no Pix")).toBe(true);
  });

  test("uma revisão fala no singular", () => {
    const a = avisosDaLoja(lojaSheid({
      revisions: { max_included: 1, extra_price: 0, policy_text: null },
    }));
    expect(a).toContain("1 revisão inclusa");
  });
});

describe("os três passos", () => {
  test("o último carrega o prazo real e como a pessoa recebe", () => {
    const p = passosDaLoja(lojaSheid({
      delivery: { pickup_enabled: true, delivery_enabled: true,
                  courier_pickup_enabled: false, delivery_fee: 0,
                  pickup_eta_text: null, delivery_eta_text: null },
    }));
    expect(p).toHaveLength(3);
    expect(p[2].texto).toContain("3 dias úteis");
    expect(p[2].texto).toContain("Retire na loja ou receba em casa");
  });

  test("loja que só entrega não oferece retirada", () => {
    const p = passosDaLoja(lojaSheid({
      delivery: { pickup_enabled: false, delivery_enabled: true,
                  courier_pickup_enabled: false, delivery_fee: 0,
                  pickup_eta_text: null, delivery_eta_text: null },
    }));
    expect(p[2].texto).toContain("entrega no seu endereço");
    expect(p[2].texto).not.toContain("Retire");
  });

  test("sem revisão configurada, o passo 2 não promete revisão", () => {
    expect(passosDaLoja(lojaSheid())[1].texto).not.toContain("revis");
  });
});

describe("as artes prontas", () => {
  test("não repetem a mesma arte vinculada a dois produtos", () => {
    const t = { id: "t1", name: "Floral", image_url: "https://x/a.png", thumb_url: null, category_name: null };
    const t2 = { id: "t2", name: "Geo", image_url: "https://x/b.png", thumb_url: null, category_name: null };
    const r = artesProntas([produto({ templates: [t, t2] }), produto({ templates: [t] })]);
    expect(r.map((a) => a.id)).toEqual(["t1", "t2"]);
  });

  test("arte sem imagem não entra", () => {
    const semImg = { id: "t9", name: "X", image_url: "", thumb_url: null, category_name: null };
    expect(artesProntas([produto({ templates: [semImg] })])).toEqual([]);
  });

  test("uma arte só não faz galeria", () => {
    const t = { id: "t1", name: "Floral", image_url: "https://x/a.png", thumb_url: null, category_name: null };
    expect(artesProntas([produto({ templates: [t] })])).toEqual([]);
  });
});

describe("a faixa de confiança", () => {
  test("loja nova não mostra número nenhum", () => {
    expect(numerosDeConfianca(lojaSheid())).toEqual([]);
  });

  test("com entregas e revisões, mostra os dois mais o prazo", () => {
    const n = numerosDeConfianca(lojaSheid({
      numeros: { pedidos_entregues: 312 },
      revisions: { max_included: 2, extra_price: 0, policy_text: null },
    }));
    expect(n.map((x) => x.valor)).toEqual(["312", "2", "3"]);
    expect(n[0].rotulo).toBe("pedidos entregues");
  });

  test("um número só não faz faixa", () => {
    const n = numerosDeConfianca(lojaSheid({
      sla: { sla_base_days: 3, queue_qty: 0, total_estimate_days: 3 },
    }));
    expect(n.length).toBeLessThan(MINIMO_NA_FILEIRA);
  });
});

describe("a tira de categorias", () => {
  const cats = [
    { id: "c1", name: "Canecas", slug: "canecas", path: "/canecas", depth: 0, parent_id: null },
    { id: "c2", name: "Camisetas", slug: "camisetas", path: "/camisetas", depth: 0, parent_id: null },
    { id: "c3", name: "Brancas", slug: "brancas", path: "/canecas/brancas", depth: 1, parent_id: "c1" },
  ];

  test("só primeiro nível, e só categoria com produto", () => {
    const r = tiraDeCategorias(cats, [
      produto({ category_path: "/canecas/brancas" }),
      produto({ category_path: "/canecas" }),
    ]);
    expect(r.map((c) => c.nome)).toEqual(["Canecas"]);
    expect(r[0].total).toBe(2);
  });

  test("uma categoria só não vira tira — a loja não tem por onde escolher", () => {
    expect(tiraDeCategorias([cats[0]], [produto({ category_path: "/canecas" })])).toEqual([]);
  });

  test("loja sem árvore não quebra", () => {
    expect(tiraDeCategorias(undefined, [produto()])).toEqual([]);
  });
});

describe("o banner", () => {
  const banner = (over: any = {}) => ({
    kicker: "", headline: "Presentes que ninguém mais tem", body: "", cta: "",
    cta_url: null, tone: "split", tint: "brand",
    image_url: "https://x/b.jpg", image_url_mobile: null, enabled: true, ...over,
  });

  test("pega o primeiro ligado e com conteúdo", () => {
    const r = bannerDaVez([banner({ enabled: false }), banner({ headline: "Segundo" })]);
    expect(r?.headline).toBe("Segundo");
  });

  test("banner vazio não conta como banner", () => {
    expect(bannerDaVez([banner({ image_url: null, headline: "" })])).toBeNull();
  });

  test("com banner, o mockup sai do topo", () => {
    const b = montarBlocosDaHome(lojaSheid({
      site: { ...lojaSheid().site, banners: [banner()] } as any,
    }));
    expect(b.hero.usarMockup).toBe(false);
    expect(b.hero.banner?.image_url).toBe("https://x/b.jpg");
  });
});

describe("o bloco B2B", () => {
  test("aparece com produto para orçar", () => {
    expect(montarBlocosDaHome(lojaSheid()).mostrarB2B).toBe(true);
  });

  test("some em loja sem produto nenhum", () => {
    expect(montarBlocosDaHome(lojaSheid({ products: [], total_products: 0 })).mostrarB2B).toBe(false);
  });
});
