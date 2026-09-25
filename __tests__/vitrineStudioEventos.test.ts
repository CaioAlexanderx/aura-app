// ============================================================
// Os eventos de venda da vitrine no GA4 e no Pixel (Fase 1C · 25/09/2026)
//
// A linha de base da Fase 2: produto visto, sacola, checkout começado,
// compra e compartilhamento. Duas regras que não podem quebrar:
//   - sem consentimento (ou sem ID válido), NADA sai;
//   - os nomes e parâmetros são os padrões de cada plataforma, senão o
//     funil de e-commerce pronto do GA4 e as otimizações do Pixel não
//     enxergam a venda.
// ============================================================
import {
  parametrosDoEvento, chamadasDoEvento, medirNaVitrine,
  itemDoProduto, itensDaSacola, valorDosItens, MOEDA,
  type EventoDaVitrine,
} from "@/components/studio/storefront/eventosDaVitrine";

const CANECA = itemDoProduto({ id: "p1", name: "Caneca Alça Coração", price: 49.9 });
const IDS = { ga4: "G-8Q3FQ2N1KM", pixel: "123456789012345" };

describe("os itens", () => {
  test("do produto: preço de tabela quando não há preço configurado", () => {
    expect(CANECA).toEqual({ id: "p1", nome: "Caneca Alça Coração", preco: 49.9, quantidade: 1 });
  });

  test("da sacola: o preço unitário que a cliente viu, com a quantidade", () => {
    const linhas = [{ product: { id: "p1", name: "Caneca", price: 49.9 }, qty: 3 }];
    expect(itensDaSacola(linhas, () => 44.9)).toEqual([
      { id: "p1", nome: "Caneca", preco: 44.9, quantidade: 3 },
    ]);
  });

  test("o valor soma em reais, sem ruído de ponto flutuante", () => {
    // 49.9 * 3 = 149.70000000000002 em JS
    expect(valorDosItens([{ ...CANECA, quantidade: 3 }])).toBe(149.7);
  });
});

describe("os parâmetros de cada canal", () => {
  test("view_item / ViewContent", () => {
    const p = parametrosDoEvento({ nome: "view_item", itens: [CANECA] });
    expect(p.ga4.nome).toBe("view_item");
    expect(p.ga4.params).toMatchObject({
      currency: "BRL", value: 49.9,
      items: [{ item_id: "p1", item_name: "Caneca Alça Coração", price: 49.9, quantity: 1 }],
    });
    expect(p.pixel?.nome).toBe("ViewContent");
    expect(p.pixel?.params).toMatchObject({
      content_ids: ["p1"], content_type: "product", value: 49.9, currency: "BRL",
    });
  });

  test("add_to_cart / AddToCart", () => {
    const p = parametrosDoEvento({ nome: "add_to_cart", itens: [{ ...CANECA, quantidade: 2 }] });
    expect(p.ga4.nome).toBe("add_to_cart");
    expect(p.ga4.params.value).toBe(99.8);
    expect(p.pixel?.nome).toBe("AddToCart");
    expect(p.pixel?.params.contents).toEqual([{ id: "p1", quantity: 2, item_price: 49.9 }]);
  });

  test("begin_checkout / InitiateCheckout conta as peças", () => {
    const p = parametrosDoEvento({
      nome: "begin_checkout",
      itens: [{ ...CANECA, quantidade: 2 }, { id: "p2", nome: "Copo", preco: 30, quantidade: 1 }],
    });
    expect(p.ga4.nome).toBe("begin_checkout");
    expect(p.ga4.params.value).toBe(129.8);
    expect(p.pixel?.nome).toBe("InitiateCheckout");
    expect(p.pixel?.params.num_items).toBe(3);
  });

  test("purchase / Purchase: o valor é o total do SERVIDOR, com o número do pedido", () => {
    const p = parametrosDoEvento({
      nome: "purchase", itens: [CANECA], pedido: "1042", valor: 62.4, frete: 12.5,
    });
    expect(p.ga4.params).toMatchObject({
      transaction_id: "1042", value: 62.4, currency: MOEDA, shipping: 12.5,
    });
    expect(p.pixel?.nome).toBe("Purchase");
    expect(p.pixel?.params).toMatchObject({ value: 62.4, currency: "BRL" });
  });

  test("share vai só ao GA4: o Pixel não tem evento padrão de compartilhar", () => {
    const p = parametrosDoEvento({ nome: "share", metodo: "whatsapp", item: { id: "p1", nome: "Caneca" } });
    expect(p.ga4).toEqual({
      nome: "share",
      params: { method: "whatsapp", content_type: "product", item_id: "p1" },
    });
    expect(p.pixel).toBeNull();
  });
});

describe("quem recebe o evento", () => {
  const VISTO: EventoDaVitrine = { nome: "view_item", itens: [CANECA] };

  test("sem consentimento, nada — nem com os dois IDs", () => {
    expect(chamadasDoEvento(VISTO, IDS, false)).toEqual([]);
  });

  test("sem ID válido, nada — nem com consentimento", () => {
    expect(chamadasDoEvento(VISTO, null, true)).toEqual([]);
    expect(chamadasDoEvento(VISTO, { ga4: "UA-1234-1", pixel: "12" }, true)).toEqual([]);
  });

  test("com consentimento, um por canal configurado; o GA4 preso ao ID da loja", () => {
    const c = chamadasDoEvento(VISTO, IDS, true);
    expect(c.map((x) => [x.canal, x.args[0], x.args[1]])).toEqual([
      ["ga4", "event", "view_item"],
      ["pixel", "track", "ViewContent"],
    ]);
    expect(c[0].args[2].send_to).toBe("G-8Q3FQ2N1KM");
  });

  test("só GA4: o Pixel não entra", () => {
    const c = chamadasDoEvento(VISTO, { ga4: IDS.ga4, pixel: null }, true);
    expect(c.map((x) => x.canal)).toEqual(["ga4"]);
  });

  test("parâmetro sem valor não vira coluna vazia no relatório", () => {
    const [ga4] = chamadasDoEvento({ nome: "share", metodo: "link" }, IDS, true);
    expect(Object.keys(ga4.args[2])).not.toContain("item_id");
  });
});

describe("medirNaVitrine", () => {
  test("sem consentimento não chama gtag nem fbq", () => {
    const alvo = { gtag: jest.fn(), fbq: jest.fn() };
    expect(medirNaVitrine(IDS, { nome: "view_item", itens: [CANECA] }, { consentiu: false, alvo })).toBe(0);
    expect(alvo.gtag).not.toHaveBeenCalled();
    expect(alvo.fbq).not.toHaveBeenCalled();
  });

  test("com consentimento chama os dois", () => {
    const alvo = { gtag: jest.fn(), fbq: jest.fn() };
    expect(medirNaVitrine(IDS, { nome: "add_to_cart", itens: [CANECA] }, { consentiu: true, alvo })).toBe(2);
    expect(alvo.gtag).toHaveBeenCalledWith("event", "add_to_cart", expect.objectContaining({ currency: "BRL" }));
    expect(alvo.fbq).toHaveBeenCalledWith("track", "AddToCart", expect.objectContaining({ currency: "BRL" }));
  });

  test("script ainda não carregado: não há para onde mandar, e não quebra", () => {
    expect(medirNaVitrine(IDS, { nome: "view_item", itens: [CANECA] }, { consentiu: true, alvo: {} })).toBe(0);
  });

  test("erro do script da plataforma nunca sobe para a compra", () => {
    const alvo = { gtag: () => { throw new Error("gtag quebrado"); } };
    expect(() =>
      medirNaVitrine(IDS, { nome: "purchase", itens: [CANECA], pedido: "1", valor: 49.9 }, { consentiu: true, alvo }),
    ).not.toThrow();
  });

  test("lê o consentimento de verdade quando não é informado", () => {
    // Mesma chave do banner do painel e da barra da vitrine (LGPDConsent).
    const alvo = { gtag: jest.fn() };
    localStorage.clear();
    medirNaVitrine(IDS, { nome: "view_item", itens: [CANECA] }, { alvo });
    localStorage.setItem("aura_lgpd_consent", "essential");
    medirNaVitrine(IDS, { nome: "view_item", itens: [CANECA] }, { alvo });
    expect(alvo.gtag).not.toHaveBeenCalled();

    localStorage.setItem("aura_lgpd_consent", "1");
    medirNaVitrine(IDS, { nome: "view_item", itens: [CANECA] }, { alvo });
    expect(alvo.gtag).toHaveBeenCalledTimes(1);
    localStorage.clear();
  });
});
