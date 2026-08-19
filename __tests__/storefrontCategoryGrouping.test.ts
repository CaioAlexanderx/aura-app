// ============================================================
// AURA Studio — S1: uma página por categoria, não por SKU
//
// A Sheid tem 9 canecas que são o mesmo produto em modelos diferentes.
// Nove cartões é ruim para o cliente e para a lojista. A F0 já dá a
// árvore; estes testes cobrem a parte que a transforma em navegação.
//
// O caso mais importante aqui é o `transportarValores`: os ids dos
// campos NÃO são estáveis entre produtos (o painel gera `f_<timestamp>`),
// então trocar de modelo casando por id perderia tudo o que o cliente
// digitou — justo na ação que a página por categoria torna comum.
// ============================================================
import {
  agruparVitrine, transportarValores, precoMinimo, imagemDoGrupo,
  type StoreCategory,
} from "@/components/studio/storefront/categoryGrouping";

const CANECAS: StoreCategory = {
  id: "cat-1", name: "Canecas", slug: "canecas", path: "canecas", depth: 0, parent_id: null,
};
const CAMISETAS: StoreCategory = {
  id: "cat-2", name: "Camisetas", slug: "camisetas", path: "camisetas", depth: 0, parent_id: null,
};

function prod(id: string, nome: string, extra: any = {}): any {
  return {
    id, name: nome, description: null, price: 39.9, image_url: null,
    category: "Produtos", stock_qty: 10, customization_config: null, templates: [],
    category_id: null, category_slug: null, category_path: null, ...extra,
  };
}

describe("agruparVitrine", () => {
  it("junta as canecas numa entrada só", () => {
    const entries = agruparVitrine(
      [
        prod("p1", "CANECA BRANCA", { category_id: "cat-1" }),
        prod("p2", "CANECA CHOPP", { category_id: "cat-1" }),
        prod("p3", "CANECA CROMADA", { category_id: "cat-1" }),
      ],
      [CANECAS]
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("category");
    if (entries[0].kind === "category") {
      expect(entries[0].category.name).toBe("Canecas");
      expect(entries[0].products.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    }
  });

  // Um cartão de categoria que abre e mostra uma opção só é um passo a
  // mais sem informação nenhuma.
  it("categoria com um produto só NÃO vira grupo", () => {
    const entries = agruparVitrine(
      [prod("p1", "CAMISETA BÁSICA", { category_id: "cat-2" })],
      [CAMISETAS]
    );
    expect(entries).toEqual([{ kind: "product", product: expect.objectContaining({ id: "p1" }) }]);
  });

  // A F1 não pode depender de a taxonomia estar 100% preenchida: hoje a
  // Sheid tem 36 dos 74 produtos sem categoria.
  it("produto sem categoria continua aparecendo sozinho", () => {
    const entries = agruparVitrine(
      [
        prod("p1", "CANECA BRANCA", { category_id: "cat-1" }),
        prod("p2", "CANECA CHOPP", { category_id: "cat-1" }),
        prod("p9", "ITEM SOLTO"),
      ],
      [CANECAS]
    );

    expect(entries).toHaveLength(2);
    expect(entries[0].kind).toBe("category");
    expect(entries[1]).toEqual({ kind: "product", product: expect.objectContaining({ id: "p9" }) });
  });

  it("vínculo para categoria fora da árvore recebida cai em produto solto", () => {
    const entries = agruparVitrine(
      [
        prod("p1", "A", { category_id: "cat-fantasma" }),
        prod("p2", "B", { category_id: "cat-fantasma" }),
      ],
      [CANECAS]
    );
    expect(entries.every((e) => e.kind === "product")).toBe(true);
  });

  // Ligar a taxonomia não pode embaralhar uma vitrine que a lojista já
  // organizou: o grupo ocupa a posição do seu primeiro produto.
  it("o grupo ocupa a posição do primeiro produto dele", () => {
    const entries = agruparVitrine(
      [
        prod("p9", "DESTAQUE"),
        prod("p1", "CANECA A", { category_id: "cat-1" }),
        prod("p8", "OUTRO"),
        prod("p2", "CANECA B", { category_id: "cat-1" }),
      ],
      [CANECAS]
    );

    expect(entries.map((e) => (e.kind === "category" ? e.category.id : e.product.id)))
      .toEqual(["p9", "cat-1", "p8"]);
  });

  it("sem árvore (base pré-migração) tudo sai como produto solto", () => {
    const entries = agruparVitrine(
      [prod("p1", "A", { category_id: "cat-1" }), prod("p2", "B", { category_id: "cat-1" })],
      []
    );
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.kind === "product")).toBe(true);
  });

  it("vitrine vazia não quebra", () => {
    expect(agruparVitrine([], [CANECAS])).toEqual([]);
  });
});

describe("precoMinimo / imagemDoGrupo", () => {
  it("o cartão do grupo mostra o menor preço", () => {
    expect(precoMinimo([
      prod("p1", "A", { price: 70 }), prod("p2", "B", { price: 39.9 }), prod("p3", "C", { price: 54.9 }),
    ])).toBe(39.9);
  });

  it("usa a primeira imagem disponível do grupo", () => {
    expect(imagemDoGrupo([
      prod("p1", "A"), prod("p2", "B", { image_url: "https://cdn/b.png" }),
    ])).toBe("https://cdn/b.png");
    expect(imagemDoGrupo([prod("p1", "A")])).toBeNull();
  });
});

describe("transportarValores — troca de modelo", () => {
  // Ids diferentes de propósito: é assim que estão os dados reais.
  const CFG_BRANCA: any = {
    fields: [
      { id: "f_100", type: "text",  label: "Texto", required: false, config: {} },
      { id: "f_101", type: "image", label: "Foto",  required: false, config: {} },
      { id: "f_102", type: "color", label: "Cor",   required: false, config: {} },
    ],
  };
  const CFG_CHOPP: any = {
    fields: [
      { id: "f_200", type: "text",  label: "Texto", required: false, config: {} },
      { id: "f_201", type: "image", label: "Foto",  required: false, config: {} },
    ],
  };

  it("o texto e a arte sobrevivem à troca, mesmo com ids diferentes", () => {
    const out = transportarValores(CFG_BRANCA, CFG_CHOPP, {
      f_100: "Feliz aniversário",
      f_101: "https://cdn/arte.png",
      f_102: "#FFFFFF",
    });

    expect(out).toEqual({
      f_200: "Feliz aniversário",
      f_201: "https://cdn/arte.png",
    });
  });

  // O modelo de destino não tem campo de cor: o valor não tem para onde
  // ir e é descartado, não empurrado num campo de outro tipo.
  it("valor sem campo correspondente no destino é descartado", () => {
    const out = transportarValores(CFG_BRANCA, CFG_CHOPP, { f_102: "#FF0000" });
    expect(out).toEqual({});
  });

  it("cada campo de origem é consumido uma vez só", () => {
    const doisTextos: any = {
      fields: [
        { id: "d1", type: "text", label: "Frente", required: false, config: {} },
        { id: "d2", type: "text", label: "Verso",  required: false, config: {} },
      ],
    };
    const out = transportarValores(
      { fields: [
        { id: "o1", type: "text", label: "A", required: false, config: {} },
        { id: "o2", type: "text", label: "B", required: false, config: {} },
      ] } as any,
      doisTextos,
      { o1: "primeiro", o2: "segundo" }
    );
    expect(out).toEqual({ d1: "primeiro", d2: "segundo" });
  });

  it("campo vazio não ocupa a vaga de um preenchido", () => {
    const out = transportarValores(
      { fields: [
        { id: "o1", type: "text", label: "A", required: false, config: {} },
        { id: "o2", type: "text", label: "B", required: false, config: {} },
      ] } as any,
      { fields: [{ id: "d1", type: "text", label: "X", required: false, config: {} }] } as any,
      { o1: "", o2: "vale" }
    );
    expect(out).toEqual({ d1: "vale" });
  });

  it("verso só sobrevive se o modelo de destino também tiver verso", () => {
    const comVerso: any = { has_back: true, fields: CFG_CHOPP.fields };
    expect(transportarValores(CFG_BRANCA, comVerso, { has_back_selected: true }).has_back_selected)
      .toBe(true);
    expect(transportarValores(CFG_BRANCA, CFG_CHOPP, { has_back_selected: true }).has_back_selected)
      .toBeUndefined();
  });

  it("config ausente dos dois lados devolve vazio, sem quebrar", () => {
    expect(transportarValores(null, CFG_CHOPP, { x: 1 })).toEqual({});
    expect(transportarValores(CFG_BRANCA, null, { f_100: "a" })).toEqual({});
  });
});
