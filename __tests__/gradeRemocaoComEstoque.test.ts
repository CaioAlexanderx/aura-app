// 10/11/2026 — fix(estoque): editar a grade não deixa estoque preso.
// O modal pergunta antes de tirar da grade uma cor/tamanho com peças.
import {
  matrizDaGrade, removidasComEstoque, textoDaRemocaoComEstoque,
} from "@/components/screens/estoque/item-form/types";

const nome = (hex: string) => ({ "#000000": "Preto", "#3B82F6": "Azul" } as Record<string, string>)[hex] || hex;

describe("removidasComEstoque", () => {
  test("tamanho removido com peças entra na lista, com o nome da cor", () => {
    const servidor = { "#000000|P": 3, "#000000|M": 2 };
    const vai = matrizDaGrade([{ hex: "#000000" }], ["P"], { "#000000|P": "3" }, servidor);
    expect(removidasComEstoque(servidor, vai, nome)).toEqual([
      { chave: "#000000|M", rotulo: "Preto · M", pecas: 2 },
    ]);
  });

  test("removida sem peças não pergunta nada", () => {
    const servidor = { "|P": 1, "|GG": 0 };
    expect(removidasComEstoque(servidor, { "|P": 1 }, nome)).toEqual([]);
  });

  test("a mesma cor com hex em minúsculas não conta como removida", () => {
    expect(removidasComEstoque({ "#3b82f6|P": 4 }, { "#3B82F6|P": 4 }, nome)).toEqual([]);
  });

  test("trocar o hex de uma cor com peças pergunta (é outra cor)", () => {
    const lista = removidasComEstoque({ "#3B82F6|P": 4 }, { "#1E3A8A|P": 0 }, nome);
    expect(lista).toEqual([{ chave: "#3B82F6|P", rotulo: "Azul · P", pecas: 4 }]);
  });

  test("esvaziar a grade inteira lista tudo que tem peça", () => {
    const lista = removidasComEstoque({ "#000000|": 2, "#3B82F6|": 1 }, {}, nome);
    expect(lista.map((r) => r.rotulo)).toEqual(["Preto", "Azul"]);
  });

  test("grade sem nada no servidor (cadastro novo) não pergunta", () => {
    expect(removidasComEstoque(undefined, { "|P": 3 }, nome)).toEqual([]);
  });
});

describe("textoDaRemocaoComEstoque", () => {
  test("uma combinação", () => {
    expect(textoDaRemocaoComEstoque([{ chave: "#000000|M", rotulo: "Preto · M", pecas: 2 }]))
      .toBe("Preto · M ainda tem 2 peças. Zere o estoque ou transfira antes de remover.");
  });
  test("uma peça no singular", () => {
    expect(textoDaRemocaoComEstoque([{ chave: "|GG", rotulo: "GG", pecas: 1 }]))
      .toBe("GG ainda tem 1 peça. Zere o estoque ou transfira antes de remover.");
  });
  test("várias somam as peças (mesmo texto do backend)", () => {
    expect(textoDaRemocaoComEstoque([
      { chave: "#000000|M", rotulo: "Preto · M", pecas: 2 },
      { chave: "|GG", rotulo: "GG", pecas: 1 },
    ])).toBe("Estas cores/tamanhos ainda têm 3 peças: Preto · M (2 peças), GG (1 peça). Zere o estoque ou transfira antes de remover.");
  });
});
