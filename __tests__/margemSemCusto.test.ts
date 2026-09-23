// ============================================================
// AURA. -- Testes: margem de produto sem custo (QA producao 23/09/2026,
// item 9 -- "Produto sem custo mostra margem 100%" na lista do Estoque).
// ============================================================
import { computeMargin } from "@/utils/productMargin";

describe("computeMargin", () => {
  test("custo 0 -> null (nao 100%)", () => {
    expect(computeMargin(120, 0)).toBeNull();
  });

  test("custo null -> null", () => {
    expect(computeMargin(120, null)).toBeNull();
  });

  test("custo undefined -> null", () => {
    expect(computeMargin(120, undefined)).toBeNull();
  });

  test("preco 0 -> null (nao ha margem sem preco)", () => {
    expect(computeMargin(0, 50)).toBeNull();
  });

  test("custo negativo (lixo de import) -> null", () => {
    expect(computeMargin(120, -10)).toBeNull();
  });

  test("com custo e preco validos, calcula a margem normalmente", () => {
    expect(computeMargin(100, 60)).toBe(40);
    expect(computeMargin(120, 90)).toBeCloseTo(25);
  });

  test("custo igual ao preco -> 0% (nao null -- ha custo, so nao ha lucro)", () => {
    expect(computeMargin(100, 100)).toBe(0);
  });

  test("custo maior que o preco -> negativo (prejuizo, nao null)", () => {
    expect(computeMargin(100, 150)).toBe(-50);
  });
});
