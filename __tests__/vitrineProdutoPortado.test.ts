// ============================================================
// O porte da página de produto para a vitrine Studio.
//
// As duas lojas não compartilham UMA LINHA de UI: a loja comum é HTML
// gerado no servidor, a vitrine é React Native Web. O que compartilham é
// o payload — e o backend tem um teste que falha se um campo de produto
// existir só de um lado (paridadeDosPayloads).
//
// Estes testes guardam a lógica que veio junto no porte, não o visual.
// ============================================================
import { relacionadosDe, MAXIMO_RELACIONADOS } from "@/components/studio/storefront/relacionados";
import { linhasDaFicha } from "@/components/studio/storefront/FichaTecnica";
import type { StudioStoreProduct } from "@/components/studio/storefront/types";

function prod(over: Partial<StudioStoreProduct> = {}): StudioStoreProduct {
  return {
    id: "p1",
    name: "Peça",
    description: null,
    price: 100,
    image_url: null,
    category: "Bolsas",
    stock_qty: 5,
    customization_config: null,
    templates: [],
    ...over,
  } as StudioStoreProduct;
}

describe("ficha técnica", () => {
  test("só aparecem as linhas que a lojista preencheu", () => {
    const linhas = linhasDaFicha(prod({ material: "Couro", cuidados: "Pano seco" }));
    expect(linhas).toEqual([
      ["Material", "Couro"],
      ["Cuidados", "Pano seco"],
    ]);
  });

  test("campo em branco não vira linha vazia", () => {
    // A lojista salva "   " sem perceber. Uma linha "Medidas" sem valor
    // parece defeito da loja, não campo não preenchido.
    expect(linhasDaFicha(prod({ material: "  ", medidas: null, cuidados: "" }))).toEqual([]);
  });

  test("a ordem é a da pergunta, não a do banco", () => {
    const linhas = linhasDaFicha(prod({ cuidados: "c", medidas: "m", material: "mat" }));
    expect(linhas.map((l) => l[0])).toEqual(["Material", "Medidas", "Cuidados"]);
  });

  test("o valor é aparado", () => {
    expect(linhasDaFicha(prod({ medidas: "  30x22 cm \n" }))[0][1]).toBe("30x22 cm");
  });
});

describe("produtos relacionados", () => {
  const atual = prod({ id: "a", category: "Bolsas" });
  const vizinhos = [
    atual,
    prod({ id: "b", category: "Bolsas" }),
    prod({ id: "c", category: "Bolsas" }),
    prod({ id: "d", category: "Sandálias" }),
  ];

  test("traz vizinhos de categoria sem o próprio produto", () => {
    const r = relacionadosDe(atual, vizinhos);
    expect(r.map((p) => p.id)).toEqual(["b", "c"]);
  });

  test("some quando sobra menos de dois", () => {
    // Uma fileira "Produtos relacionados" com um item só chama atenção
    // para o tamanho da loja em vez de mostrar produto.
    const r = relacionadosDe(atual, [atual, prod({ id: "b", category: "Bolsas" })]);
    expect(r).toEqual([]);
  });

  test("não passa do máximo", () => {
    const muitos = [atual, ...Array.from({ length: 9 }, (_, i) => prod({ id: "v" + i, category: "Bolsas" }))];
    expect(relacionadosDe(atual, muitos).length).toBe(MAXIMO_RELACIONADOS);
  });

  test("esgotado não entra", () => {
    // Mostrar quatro vizinhos e a pessoa descobrir no toque que três estão
    // fora de estoque é pior que mostrar dois.
    const r = relacionadosDe(atual, [
      atual,
      prod({ id: "b", category: "Bolsas", stock_qty: 0 }),
      prod({ id: "c", category: "Bolsas" }),
      prod({ id: "e", category: "Bolsas" }),
    ]);
    expect(r.map((p) => p.id)).toEqual(["c", "e"]);
  });

  test("category_id vence o nome quando existe", () => {
    // Duas categorias homônimas em ramos diferentes da árvore não são a
    // mesma categoria. Comparar sempre pelo nome as juntaria.
    const a = prod({ id: "a", category: "Acessórios", category_id: "ramo-1" });
    const r = relacionadosDe(a, [
      a,
      prod({ id: "b", category: "Acessórios", category_id: "ramo-2" }),
      prod({ id: "c", category: "Acessórios", category_id: "ramo-1" }),
      prod({ id: "d", category: "Acessórios", category_id: "ramo-1" }),
    ]);
    expect(r.map((p) => p.id)).toEqual(["c", "d"]);
  });

  test("produto sem categoria não puxa todo mundo sem categoria", () => {
    // Sem esta guarda, `p.category === null` casaria com todos os outros
    // sem categoria e a seção viraria "produtos aleatórios".
    const semCat = prod({ id: "a", category: null });
    const r = relacionadosDe(semCat, [
      semCat,
      prod({ id: "b", category: null }),
      prod({ id: "c", category: null }),
    ]);
    expect(r).toEqual([]);
  });

  test("aguenta lista vazia e produto nulo", () => {
    expect(relacionadosDe(null, vizinhos)).toEqual([]);
    expect(relacionadosDe(atual, [])).toEqual([]);
    expect(relacionadosDe(atual, undefined)).toEqual([]);
  });
});
