// ============================================================
// Vitrine Studio · Fase 5 — a aba Design do painel quando a loja é Studio
//
// - a prévia mostra a VITRINE STUDIO no endereço da loja (antes: a loja
//   comum, num endereço antigo do Railway); a loja comum segue com a
//   página renderizada, agora pelo endereço da API;
// - os selos de fábrica do painel não aparecem como se fossem dela;
// - a peça automática do destaque segue a regra da vitrine.
// ============================================================
import { enderecoDaPrevia, selosDeFabrica, pecaAutomatica, pecasParaODestaque } from "@/components/screens/canal/designDaVitrineStudio";
import { pecaDoDestaque } from "@/components/studio/storefront/home/regrasDaHome";

describe("a prévia da aba Design", () => {
  test("Studio: o endereço da loja que o backend devolve, ou loja.getaura.com.br/<slug>", () => {
    expect(enderecoDaPrevia({ slug: "sheid-mania", storefrontUrl: "https://loja.getaura.com.br/sheid-mania/", vitrine: "studio" }))
      .toBe("https://loja.getaura.com.br/sheid-mania");
    expect(enderecoDaPrevia({ slug: "sheid-mania", vitrine: "studio" })).toBe("https://loja.getaura.com.br/sheid-mania");
  });
  test("comum: a página pelo endereço da API, nunca o Railway", () => {
    const url = enderecoDaPrevia({ slug: "finesse", vitrine: "comum", api: "https://api.getaura.com.br/api/v1" });
    expect(url).toBe("https://api.getaura.com.br/api/v1/storefront/finesse/page");
    expect(enderecoDaPrevia({ slug: "finesse" })).not.toContain("railway");
  });
  test("sem slug (loja não publicada), sem prévia", () => {
    expect(enderecoDaPrevia({ slug: "", vitrine: "studio" })).toBeNull();
  });
});

describe("os selos de fábrica", () => {
  const fabrica = [
    { title: "Entrega rápida", body: "Confirmação no WhatsApp" },
    { title: "Embalagem cuidadosa", body: "Pronta pra presentear" },
    { title: "Pagamento seguro", body: "Pix e demais opções" },
    { title: "Curadoria editada", body: "Produtos selecionados" },
  ];
  test("o conjunto intocado é de fábrica; um escrito por ela muda tudo", () => {
    expect(selosDeFabrica(fabrica)).toBe(true);
    expect(selosDeFabrica([...fabrica.slice(0, 3), { title: "Produção própria", body: "SJC" }])).toBe(false);
    expect(selosDeFabrica([])).toBe(false);
  });
});

describe("a peça do destaque no painel", () => {
  const produtos = [
    { id: "a", name: "Azulejo", image_url: "https://x/a.jpg", visual_kind: null },
    { id: "b", name: "Caneca", image_url: "https://x/b.jpg", visual_kind: "model3d" },
  ];
  test("as 3D primeiro no seletor; a automática é a mesma da vitrine", () => {
    const pecas = pecasParaODestaque(produtos);
    expect(pecas.map((p) => p.id)).toEqual(["b", "a"]);
    const daVitrine = pecaDoDestaque({ products: produtos as any, site: {} } as any)!.produto.id;
    expect(pecaAutomatica(pecasParaODestaque(produtos))!.id).toBe(daVitrine);
    expect(pecaAutomatica([])).toBeNull();
  });
});

describe("o destino do botão do banner no painel", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { destinoValido, estadoDoCta } = require("@/components/screens/canal/destinoDoCta");
  test("aceita as vistas da loja e o orçamento em lote, como o backend", () => {
    expect(destinoValido("#vista=lote")).toBe(true);
    expect(destinoValido("#vista=todos")).toBe(true);
    expect(destinoValido("#vista=mais_vendidos")).toBe(true);
    expect(destinoValido("#vista=promocao")).toBe(false);
    expect(estadoDoCta("Pedir orçamento", "#vista=lote")).toBe("ok");
  });
});
