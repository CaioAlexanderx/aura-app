// ============================================================
// AURA Studio — S6: desconto progressivo no lado do cliente
//
// O backend manda a escada JÁ calculada (services/studioQtyTiers.js).
// Aqui só se escolhe a faixa — mas escolher é obrigatório: se o app
// exibisse a escada sem aplicá-la, o cliente veria um total e o servidor
// cobraria outro. É a mesma classe de divergência que o S0 corrigiu na
// validação e o S2 no frete, e por isso a regra de casamento é a mesma
// dos dois lados: vence a faixa de maior min_qty que couber.
// ============================================================
import {
  matchTier, basePriceForQty, proximaFaixa, faixaLabel, type QtyTier,
} from "@/components/studio/storefront/qtyTiers";

// Escada típica de caneca de R$ 39,90: 10-49 com -10%, 50+ a R$ 29,90.
const ESCADA: QtyTier[] = [
  { min_qty: 10, max_qty: 49, unit_price: 35.91, discount_pct: 10 },
  { min_qty: 50, max_qty: null, unit_price: 29.9, discount_pct: 25.1 },
];

describe("matchTier", () => {
  it("abaixo da primeira faixa não casa nada", () => {
    expect(matchTier(ESCADA, 1)).toBeNull();
    expect(matchTier(ESCADA, 9)).toBeNull();
  });

  it("casa dentro da faixa e respeita o teto", () => {
    expect(matchTier(ESCADA, 10)?.min_qty).toBe(10);
    expect(matchTier(ESCADA, 49)?.min_qty).toBe(10);
    expect(matchTier(ESCADA, 50)?.min_qty).toBe(50);
    expect(matchTier(ESCADA, 9999)?.min_qty).toBe(50);
  });

  // Mesma regra do backend: quem compra mais nunca paga mais.
  it("com faixas sobrepostas vence a de maior min_qty", () => {
    const sobrepostas: QtyTier[] = [
      { min_qty: 10, max_qty: null, unit_price: 90, discount_pct: 10 },
      { min_qty: 50, max_qty: null, unit_price: 70, discount_pct: 30 },
    ];
    expect(matchTier(sobrepostas, 60)?.unit_price).toBe(70);
  });

  it("escada vazia ou quantidade inválida não casa", () => {
    expect(matchTier([], 50)).toBeNull();
    expect(matchTier(undefined, 50)).toBeNull();
    expect(matchTier(ESCADA, 0)).toBeNull();
    expect(matchTier(ESCADA, NaN)).toBeNull();
  });
});

describe("basePriceForQty — tem que bater com o servidor", () => {
  it("sem faixa aplicável usa o preço de tabela", () => {
    expect(basePriceForQty(39.9, ESCADA, 5)).toBe(39.9);
    expect(basePriceForQty(39.9, [], 100)).toBe(39.9);
  });

  it("dentro da faixa usa o preço unitário da faixa", () => {
    expect(basePriceForQty(39.9, ESCADA, 10)).toBe(35.91);
    expect(basePriceForQty(39.9, ESCADA, 50)).toBe(29.9);
  });

  // O servidor ignora faixa que encarece; o app não pode mostrar um valor
  // que o servidor não vai cobrar.
  it("faixa mais cara que a tabela cai no preço de tabela", () => {
    const ruim: QtyTier[] = [{ min_qty: 2, max_qty: null, unit_price: 99, discount_pct: -148 }];
    expect(basePriceForQty(39.9, ruim, 5)).toBe(39.9);
  });

  it("preço unitário corrompido não vira NaN no total", () => {
    const quebrada: any = [{ min_qty: 2, max_qty: null, unit_price: null }];
    expect(basePriceForQty(39.9, quebrada, 5)).toBe(39.9);
  });
});

describe("proximaFaixa — o empurrão de atacado", () => {
  it("aponta a próxima faixa ainda não alcançada", () => {
    expect(proximaFaixa(ESCADA, 1)?.min_qty).toBe(10);
    expect(proximaFaixa(ESCADA, 10)?.min_qty).toBe(50);
  });

  it("na última faixa não há o que sugerir", () => {
    expect(proximaFaixa(ESCADA, 50)).toBeNull();
    expect(proximaFaixa([], 1)).toBeNull();
  });
});

describe("faixaLabel", () => {
  it("faixa fechada e faixa aberta têm rótulos diferentes", () => {
    expect(faixaLabel(ESCADA[0])).toBe("10 a 49 un");
    expect(faixaLabel(ESCADA[1])).toBe("50 un ou mais");
  });
});
