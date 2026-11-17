// p-156 (17/11/2026): Enter na busca coloca o produto destacado.
import { decisaoDoEnter, indiceDoDestaque, moverDestaque, pareceCodigo } from "@/utils/destaqueDaBusca";

describe("destaque da busca", () => {
  test("nome com resultado: adicionar; sem resultado: servidor (caminho de sempre)", () => {
    expect(decisaoDoEnter("blusa", "blusa", 3)).toBe("adicionar");
    expect(decisaoDoEnter("  blusa ", "blusa", 3)).toBe("adicionar");
    expect(decisaoDoEnter("blusa", "blusa", 0)).toBe("servidor");
    expect(decisaoDoEnter("", "", 3)).toBe("nada");
  });
  test("código digitado à mão (8+ dígitos) e vale-troca continuam no servidor", () => {
    expect(pareceCodigo("7891234567895")).toBe(true);
    expect(pareceCodigo("1234")).toBe(false);
    expect(decisaoDoEnter("7891234567895", "7891234567895", 1)).toBe("servidor");
    expect(decisaoDoEnter("AURA-TROCA:abc", "AURA-TROCA:abc", 0)).toBe("servidor");
  });
  test("texto do Enter diferente do da busca (campo mexeu): servidor", () => {
    expect(decisaoDoEnter("blu", "blusa", 2)).toBe("servidor");
  });
  test("setas andam só dentro da página e param nas pontas", () => {
    expect(indiceDoDestaque(0, 0)).toBe(-1);
    expect(indiceDoDestaque(5, 3)).toBe(2);
    expect(moverDestaque(0, 1, 3)).toBe(1);
    expect(moverDestaque(2, 1, 3)).toBe(2);
    expect(moverDestaque(0, -1, 3)).toBe(0);
    expect(moverDestaque(9, -1, 3)).toBe(1);
  });
});
