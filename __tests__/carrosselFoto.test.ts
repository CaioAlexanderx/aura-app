// ============================================================
// Carrossel da foto — o que a vitrine faz com a galeria
// ============================================================
import {
  proximoIndice, fotosDoProduto, fotosDoGrupo,
} from "@/components/studio/storefront/CarrosselFoto";

describe("proximoIndice", () => {
  test("anda e volta ao inicio — o cliente nunca trava na ponta", () => {
    expect(proximoIndice(0, 3, 1)).toBe(1);
    expect(proximoIndice(2, 3, 1)).toBe(0);
    expect(proximoIndice(0, 3, -1)).toBe(2);
  });

  test("com uma foto so nao ha para onde ir", () => {
    expect(proximoIndice(0, 1, 1)).toBe(0);
    expect(proximoIndice(0, 0, -1)).toBe(0);
  });
});

describe("fotosDoProduto", () => {
  test("a galeria manda e a capa entra junto", () => {
    expect(fotosDoProduto(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  test("capa repetida na galeria nao vira slide duplicado", () => {
    // O backend espelha image_url = gallery_urls[0], entao esse e o caso
    // COMUM, nao a excecao.
    expect(fotosDoProduto(["a", "b"], "a")).toEqual(["a", "b"]);
  });

  test("galeria vazia deixa so a capa", () => {
    expect(fotosDoProduto([], "a")).toEqual(["a"]);
    expect(fotosDoProduto(null, "a")).toEqual(["a"]);
    expect(fotosDoProduto(undefined, "a")).toEqual(["a"]);
  });

  test("sem foto nenhuma devolve lista vazia — a capa gerada assume", () => {
    expect(fotosDoProduto(null, null)).toEqual([]);
    expect(fotosDoProduto([], "")).toEqual([]);
    expect(fotosDoProduto(["  "], null)).toEqual([]);
  });

  test("galeria com lixo nao quebra", () => {
    expect(fotosDoProduto(["a", null, 42, "", "b"], null)).toEqual(["a", "b"]);
    expect(fotosDoProduto("nao e array", "a")).toEqual(["a"]);
  });
});

describe("fotosDoGrupo", () => {
  test("uma capa por modelo — o cliente ve a variedade antes de abrir", () => {
    const produtos = [{ image_url: "a" }, { image_url: "b" }, { image_url: "c" }];
    expect(fotosDoGrupo(produtos)).toEqual(["a", "b", "c"]);
  });

  test("modelo sem foto nao vira slide vazio", () => {
    expect(fotosDoGrupo([{ image_url: "a" }, { image_url: null }, { image_url: "b" }])).toEqual(["a", "b"]);
  });

  test("modelos que compartilham a mesma foto contam uma vez", () => {
    expect(fotosDoGrupo([{ image_url: "a" }, { image_url: "a" }])).toEqual(["a"]);
  });

  test("respeita o teto de 5 fotos da galeria", () => {
    const muitos = Array.from({ length: 9 }, (_, i) => ({ image_url: "f" + i }));
    expect(fotosDoGrupo(muitos)).toHaveLength(5);
  });
});
