// ============================================================
// Busca pelo nome da cor no Caixa e no Estoque (CP6 da revisão de cores,
// 14/11/2026). utils/productSearch é a busca das duas telas.
// ============================================================
import { buildProductHaystack, matchesQuery, productMatchesSearch } from "@/utils/productSearch";

const vestido = { name: "Vestido Midi", variant_color_names: ["Preto", "Off White"] };
const saia = { name: "Saia Lápis", variant_color_names: ["Verde-água"] };
const blusa = { name: "Blusa Básica", variant_color_names: ["Cinza escuro", "AZUL ESCUR"] };
const camiseta = { name: "Camiseta", color: "#000000" };
const regata = { name: "Regata", color: "Preta" };
const calca = { name: "Calça Jeans", variant_color_names: ["Marrom Café"] };

const acha = (q: string) => [vestido, saia, blusa, camiseta, regata, calca].filter((p) => productMatchesSearch(p, q)).map((p) => p.name);

describe("busca pelo nome da cor da variante", () => {
  test("pelo nome que a tela mostra, sem acento e sem caixa", () => {
    expect(acha("off white")).toEqual(["Vestido Midi"]);
    expect(acha("VERDE AGUA")).toEqual(["Saia Lápis"]);
    expect(acha("agua")).toEqual(["Saia Lápis"]);
    expect(acha("cinza escuro")).toEqual(["Blusa Básica"]);
  });
  test("pelo nome gravado, mesmo cortado", () => {
    expect(acha("azul escur")).toEqual(["Blusa Básica"]);
  });
  test("Preta e Preto contam como a mesma cor (e apelidos da paleta)", () => {
    expect(acha("preta")).toEqual(["Vestido Midi", "Camiseta", "Regata"]);
    expect(acha("preto")).toEqual(["Vestido Midi", "Camiseta", "Regata"]);
    expect(acha("black")).toEqual(["Vestido Midi", "Camiseta", "Regata"]);
  });
  test("cor junto com o nome do produto (todas as palavras)", () => {
    expect(acha("vestido preta")).toEqual(["Vestido Midi"]);
    expect(acha("regata preto")).toEqual(["Regata"]);
    expect(acha("saia preta")).toEqual([]);
  });
  test("nome próprio fora da paleta acha pelo texto", () => {
    expect(acha("marrom cafe")).toEqual(["Calça Jeans"]);
  });
  test("o que já era achado continua", () => {
    expect(acha("vestido")).toEqual(["Vestido Midi"]);
    expect(acha("")).toHaveLength(6);
  });
  test("haystack com a marca da cor da paleta", () => {
    expect(buildProductHaystack(regata)).toContain("cor:preto");
    expect(matchesQuery(buildProductHaystack({ name: "x", variant_color_names: ["Bordô"] }), "bordo")).toBe(true);
  });
});
