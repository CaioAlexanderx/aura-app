// ============================================================
// Curva ABC por categoria — formato da resposta (24/10/2026)
//
// Crash em produção: "TypeError: t.reduce is not a function at sumRevenue".
// GET /companies/:id/products/categories responde
//   res.json({ period, categories: data })
// (aura-backend src/routes/productsRanking.js), mas a tela tratava o corpo
// como lista e passava o objeto direto para sumRevenue. Estes testes usam
// o formato REAL da resposta e garantem que um corpo inesperado vira lista
// vazia em vez de derrubar a tela.
// ============================================================
import {
  normalizeCategoryRanking,
  sumRevenue,
  classifyABC,
} from "@/components/screens/financeiro/v2/abcCategoryUtils";

// Formato exato que getCategories + a rota devolvem (números já parseados
// pelo backend, ordenado por total_revenue DESC, share_pct com 1 casa).
const RESPOSTA_REAL = {
  period: "month",
  categories: [
    { category: "Calçados", total_products: 18, total_revenue: 4000, total_qty: 210, share_pct: 50 },
    { category: "Blusas", total_products: 24, total_revenue: 2500, total_qty: 340, share_pct: 31.3 },
    { category: "Sem categoria", total_products: 3, total_revenue: 1500, total_qty: 61, share_pct: 18.8 },
  ],
};

describe("normalizeCategoryRanking", () => {
  it("extrai a lista de { period, categories } (formato real da rota)", () => {
    const lista = normalizeCategoryRanking(RESPOSTA_REAL);
    expect(lista).toHaveLength(3);
    expect(lista.map((c) => c.category)).toEqual(["Calçados", "Blusas", "Sem categoria"]);
  });

  it("aceita a lista crua (compatibilidade)", () => {
    expect(normalizeCategoryRanking(RESPOSTA_REAL.categories)).toBe(RESPOSTA_REAL.categories);
  });

  it("período sem vendas: { period, categories: [] } vira lista vazia", () => {
    expect(normalizeCategoryRanking({ period: "today", categories: [] })).toEqual([]);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["objeto sem categories", { period: "month" }],
    ["categories que não é lista", { period: "month", categories: { a: 1 } }],
    ["string", "erro"],
    ["número", 42],
  ])("%s vira lista vazia", (_nome, valor) => {
    expect(normalizeCategoryRanking(valor)).toEqual([]);
  });
});

describe("sumRevenue e classifyABC com o formato real", () => {
  it("o objeto da rota passado direto não derruba (era o crash)", () => {
    expect(() => sumRevenue(RESPOSTA_REAL as any)).not.toThrow();
    expect(sumRevenue(RESPOSTA_REAL as any)).toBe(0);
    expect(classifyABC(RESPOSTA_REAL as any, 100)).toEqual([]);
  });

  it("normalizado, soma e classifica como o backend", () => {
    const lista = normalizeCategoryRanking(RESPOSTA_REAL);
    const total = sumRevenue(lista);
    expect(total).toBe(8000);
    const classificadas = classifyABC(lista, total);
    // 4000/8000 = 50% (A); 6500/8000 = 81,25% (B); 100% (C)
    expect(classificadas.map((c) => c.abc)).toEqual(["A", "B", "C"]);
    expect(classificadas.map((c) => c.accumulated_pct)).toEqual([50, 81.3, 100]);
  });
});
