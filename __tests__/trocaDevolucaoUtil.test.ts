// ============================================================
// Matcon M4 — devolução de sobra de obra (delta no wizard de troca).
// docs/CONTRACT_MATCON.md §"Devolução de sobra de obra (delta no wizard
// de troca)". Criado: 22/09/2026.
// ============================================================
import {
  restockDeDevolucao,
  creditoDaDevolucao,
  fraseCaixaFechada,
  fraseCaixaAberta,
  resumoSucesso,
} from "@/components/screens/pdv/troca/devolucaoUtil";

describe("restockDeDevolucao", () => {
  it("quantidade exata em caixas fechadas — nada sobra", () => {
    expect(restockDeDevolucao(4.64, 2.32)).toEqual({
      restockQty: 4.64, caixasFechadas: 2, naoVolta: 0,
    });
  });

  it("sobra de caixa aberta não volta ao estoque", () => {
    expect(restockDeDevolucao(5.8, 2.32)).toEqual({
      restockQty: 4.64, caixasFechadas: 2, naoVolta: 1.16,
    });
  });

  it("sem purchase_factor: tudo volta, sem conceito de caixa", () => {
    expect(restockDeDevolucao(3, null)).toEqual({
      restockQty: 3, caixasFechadas: null, naoVolta: 0,
    });
  });

  it("purchase_factor inválido (<=0) cai no mesmo caminho de 'sem fator'", () => {
    expect(restockDeDevolucao(3, 0)).toEqual({ restockQty: 3, caixasFechadas: null, naoVolta: 0 });
    expect(restockDeDevolucao(3, -1)).toEqual({ restockQty: 3, caixasFechadas: null, naoVolta: 0 });
  });
});

describe("creditoDaDevolucao", () => {
  it("crédito sobre a quantidade que volta ao estoque (não a devolvida)", () => {
    expect(creditoDaDevolucao(4.64, 54.9)).toBe(254.74);
  });

  it("sem restock, sem crédito", () => {
    expect(creditoDaDevolucao(0, 54.9)).toBe(0);
  });
});

describe("fraseCaixaFechada", () => {
  it("frase da linha verde — plural", () => {
    expect(fraseCaixaFechada({
      caixasFechadas: 2, restockQty: 4.64, unit: "m²", lotCode: "27B", credito: 254.74,
    })).toBe("✓ 2 caixas fechadas — 4,64 m² voltam ao estoque, no lote 27B. Crédito de R$ 254,74.");
  });

  it("singular e sem lote", () => {
    expect(fraseCaixaFechada({
      caixasFechadas: 1, restockQty: 2.32, unit: "m²", lotCode: null, credito: 127.37,
    })).toBe("✓ 1 caixa fechada — 2,32 m² voltam ao estoque. Crédito de R$ 127,37.");
  });
});

describe("fraseCaixaAberta", () => {
  it("frase da linha âmbar — sem jargão de estoque", () => {
    const frase = fraseCaixaAberta({ naoVolta: 1.16, unit: "m²" });
    expect(frase).toContain("1,16 m²");
    expect(frase).toContain("não volta ao estoque e vale R$ 0");
    expect(frase).not.toMatch(/NF de devolução|movimentação/i);
  });
});

describe("resumoSucesso", () => {
  it("estoque + vale — caso do mockup", () => {
    expect(resumoSucesso([
      { caixasFechadas: 2, lotCode: "27B", credito: 254.74 },
    ])).toBe("estoque +2 cx no lote 27B · vale de R$ 254,74");
  });

  it("sem caixas fechadas (produto sem purchase_factor) — só o vale", () => {
    expect(resumoSucesso([{ caixasFechadas: null, lotCode: null, credito: 30 }]))
      .toBe("vale de R$ 30,00");
  });

  it("nada pra mostrar — string vazia", () => {
    expect(resumoSucesso([])).toBe("");
    expect(resumoSucesso([{ caixasFechadas: null, lotCode: null, credito: 0 }])).toBe("");
  });

  it("vários lotes — soma as caixas mas não inventa lote único", () => {
    expect(resumoSucesso([
      { caixasFechadas: 2, lotCode: "27B", credito: 100 },
      { caixasFechadas: 1, lotCode: "9F", credito: 50 },
    ])).toBe("estoque +3 cx · vale de R$ 150,00");
  });
});
