// p-35 (18/10/2026): ordem de tamanhos e de variantes, compartilhada pelo
// Caixa ("Qual variante?") e pelo cadastro de tamanhos.
import { compararTextoPtBr, ordenarPeloTamanhoNaCor, ordenarTamanhos, ordenarVariantes } from "@/utils/ordemDeTamanhos";
import { corETamanhoDaVariante } from "@/utils/nomeDaCor";

describe("ordenarTamanhos", () => {
  it("letras na ordem PP, P, M, G, GG, XG e depois os extragrandes", () => {
    expect(ordenarTamanhos(["GG", "XGG", "P", "XG", "M", "PP", "G", "EG", "XXG", "EGG"]))
      .toEqual(["PP", "P", "M", "G", "GG", "XG", "EG", "EGG", "XGG", "XXG"]);
  });

  it("sem diferenciar maiúscula e ignorando espaço nas pontas", () => {
    expect(ordenarTamanhos(["g", " p ", "M"])).toEqual([" p ", "M", "g"]);
  });

  it("números em ordem numérica, inclusive decimal com vírgula", () => {
    expect(ordenarTamanhos(["40", "8", "36", "1,5", "38", "10"])).toEqual(["1,5", "8", "10", "36", "38", "40"]);
  });

  it("letras, depois números, depois o resto em ordem alfabética natural", () => {
    expect(ordenarTamanhos(["Único", "38", "G", "10 anos", "U", "2 anos", "P", "36", "G2", "G1"]))
      .toEqual(["P", "G", "36", "38", "2 anos", "10 anos", "G1", "G2", "U", "Único"]);
  });

  it("não altera a lista original", () => {
    const lista = ["G", "P"];
    ordenarTamanhos(lista);
    expect(lista).toEqual(["G", "P"]);
  });
});

describe("compararTextoPtBr", () => {
  it("não diferencia acento nem maiúscula", () => {
    expect(compararTextoPtBr("ÂMBAR", "ambar")).toBe(0);
    expect(["Verde", "azul", "Árvore", "bege"].sort(compararTextoPtBr)).toEqual(["Árvore", "azul", "bege", "Verde"]);
  });
});

describe("ordenarVariantes", () => {
  const v = (id: string, cor: string | null, tamanho: string | null) => ({ id, cor, tamanho });
  const chave = (x: { cor: string | null; tamanho: string | null }) => ({ cor: x.cor, tamanho: x.tamanho });
  const ids = (l: { id: string }[]) => l.map((x) => x.id);

  it("cor primeiro (alfabética, sem acento), depois tamanho", () => {
    const l = [v("1", "Vermelho", "M"), v("2", "Azul", "G"), v("3", "Âmbar", "GG"), v("4", "Azul", "P")];
    expect(ids(ordenarVariantes(l, chave))).toEqual(["3", "4", "2", "1"]);
  });

  it("sem cor vem depois das que têm cor; sem tamanho, depois das que têm", () => {
    const l = [v("a", null, "P"), v("b", "Azul", null), v("c", "Azul", "G"), v("d", "Azul", "P")];
    expect(ids(ordenarVariantes(l, chave))).toEqual(["d", "c", "b", "a"]);
  });

  it("empate mantém a ordem original", () => {
    const l = [v("x", null, null), v("y", null, null), v("z", null, null)];
    expect(ids(ordenarVariantes(l, chave))).toEqual(["x", "y", "z"]);
  });
});

// p-200 (23/11/2026): a grade voltava na ordem do banco depois de salvar.
describe("p-200: ordem da grade ao ler", () => {
  it("o atalho 34 a 44 volta em ordem numérica", () => {
    expect(ordenarTamanhos(["36", "44", "42", "38", "40", "34"])).toEqual(["34", "36", "38", "40", "42", "44"]);
  });

  it("numeração com meia (34,5) entre os inteiros", () => {
    expect(ordenarTamanhos(["35", "34,5", "34", "35.5"])).toEqual(["34", "34,5", "35", "35.5"]);
  });

  it("a Blusa: M, P, G volta P, M, G", () => {
    expect(ordenarTamanhos(["M", "P", "G"])).toEqual(["P", "M", "G"]);
  });

  it("roupa com EXG e tamanho único no fim", () => {
    expect(ordenarTamanhos(["U", "GG", "EXG", "PP", "XG", "P"])).toEqual(["PP", "P", "GG", "XG", "EXG", "U"]);
    expect(ordenarTamanhos(["Único", "M", "P"])).toEqual(["P", "M", "Único"]);
    expect(ordenarTamanhos(["Tamanho único", "38", "36"])).toEqual(["36", "38", "Tamanho único"]);
  });

  it("texto livre em ordem pt-BR", () => {
    expect(ordenarTamanhos(["Médio", "grande", "Árvore", "baixo"])).toEqual(["Árvore", "baixo", "grande", "Médio"]);
  });
});

describe("ordenarPeloTamanhoNaCor", () => {
  const v = (id: string, cor: string | null, tamanho: string | null) => ({
    id,
    attributes: [
      ...(cor ? [{ attribute: "cor", value: cor }] : []),
      ...(tamanho ? [{ attribute: "tamanho", value: tamanho }] : []),
    ],
  });
  const ids = (l: { id: string }[]) => l.map((x) => x.id);

  it("as cores ficam na ordem em que vieram; o tamanho ordena dentro da cor", () => {
    const l = [
      v("1", "#FF0000", "M"), v("2", "#FF0000", "P"), v("3", "#0000FF", "G"),
      v("4", "#0000FF", "P"), v("5", "#FF0000", "G"),
    ];
    expect(ids(ordenarPeloTamanhoNaCor(l, corETamanhoDaVariante))).toEqual(["2", "1", "5", "4", "3"]);
  });

  it("só tamanho (sem cor): 34 a 44 em ordem", () => {
    const l = ["36", "44", "42", "38", "40", "34"].map((t) => v(t, null, t));
    expect(ids(ordenarPeloTamanhoNaCor(l, corETamanhoDaVariante))).toEqual(["34", "36", "38", "40", "42", "44"]);
  });

  it("não altera a lista original", () => {
    const l = [v("a", null, "G"), v("b", null, "P")];
    ordenarPeloTamanhoNaCor(l, corETamanhoDaVariante);
    expect(ids(l)).toEqual(["a", "b"]);
  });
});
