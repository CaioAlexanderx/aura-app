// ============================================================
// Matcon M3 — a conta da calculadora de ambiente, fora do React
// (components/matcon/calculadoraUtil.ts).
//
// Os números são os do mockup docs/mockups/matcon-m3-clube-calculadora.html
// (#calculadora): 3,5 × 4,2 = 14,70 m² · +8% = 15,88 m² · ÷ 2,32 = 6,84 →
// 7 caixas = 16,24 m² · sobra 0,36 m².
// ============================================================
import {
  areaDoAmbiente,
  somarAmbientes,
  aplicarPerda,
  resultadoCalculadora,
  fmtArea,
  rotuloEmbalagem,
} from "@/components/matcon/calculadoraUtil";

describe("areaDoAmbiente — largura × comprimento, 3 casas", () => {
  it("3,5 × 4,2 = 14,70 m² (e não 14,700000000000001)", () => {
    expect(areaDoAmbiente(3.5, 4.2)).toBe(14.7);
    expect(fmtArea(areaDoAmbiente(3.5, 4.2), "m²")).toBe("14,70 m²");
  });

  it("linha vazia ou medida inválida não estraga a conta: área 0", () => {
    expect(areaDoAmbiente(null, 4.2)).toBe(0);
    expect(areaDoAmbiente(3.5, undefined)).toBe(0);
    expect(areaDoAmbiente(0, 4.2)).toBe(0);
    expect(areaDoAmbiente(-3, 4.2)).toBe(0);
    expect(areaDoAmbiente(NaN as any, 4.2)).toBe(0);
  });
});

describe("somarAmbientes — dois ambientes somam", () => {
  it("sala + cozinha", () => {
    const total = somarAmbientes([
      { nome: "Sala", largura: 3.5, comprimento: 4.2 },
      { nome: "Cozinha", largura: 2, comprimento: 3 },
    ]);
    expect(total).toBe(20.7);
    expect(fmtArea(total, "m²")).toBe("20,70 m²");
  });

  it("ambiente ainda vazio conta como zero", () => {
    expect(
      somarAmbientes([
        { nome: "Sala", largura: 3.5, comprimento: 4.2 },
        { nome: "Cozinha", largura: null, comprimento: null },
      ])
    ).toBe(14.7);
    expect(somarAmbientes([])).toBe(0);
    expect(somarAmbientes(null)).toBe(0);
  });
});

describe("aplicarPerda — 2 casas, porque é o número que vai pro carrinho", () => {
  it("14,70 com 8% de perda = 15,88 (15,876 arredondado)", () => {
    expect(aplicarPerda(14.7, 8)).toBe(15.88);
  });

  it("perda 0 / inválida devolve a própria área", () => {
    expect(aplicarPerda(14.7, 0)).toBe(14.7);
    expect(aplicarPerda(14.7, null)).toBe(14.7);
    expect(aplicarPerda(0, 8)).toBe(0);
  });
});

describe("resultadoCalculadora — a folha inteira", () => {
  const SALA = [{ nome: "Sala", largura: 3.5, comprimento: 4.2 }];

  it("com fator 2,32: 15,88 m² → 7 caixas, 16,24 m², sobra 0,36 m²", () => {
    const r = resultadoCalculadora({ ambientes: SALA, perdaPct: 8, purchaseFactor: 2.32 });
    expect(r.areaSomada).toBe(14.7);
    expect(r.areaComPerda).toBe(15.88);
    expect(r.caixas).toBe(7);
    expect(r.areaCaixasFechadas).toBe(16.24);
    expect(r.sobra).toBe(0.36);
  });

  it("sem fator de compra não há caixa: caixas null (e os m² continuam)", () => {
    const semFator = resultadoCalculadora({ ambientes: SALA, perdaPct: 8, purchaseFactor: null });
    expect(semFator.areaComPerda).toBe(15.88);
    expect(semFator.caixas).toBeNull();
    expect(semFator.areaCaixasFechadas).toBeNull();
    expect(semFator.sobra).toBeNull();

    expect(resultadoCalculadora({ ambientes: SALA, perdaPct: 8, purchaseFactor: 0 }).caixas).toBeNull();
    expect(resultadoCalculadora({ ambientes: SALA, perdaPct: 8, purchaseFactor: -2 }).caixas).toBeNull();
    expect(resultadoCalculadora({ ambientes: SALA, perdaPct: 8 }).caixas).toBeNull();
  });

  it("nenhum ambiente preenchido: tudo zerado, sem dividir por zero", () => {
    const r = resultadoCalculadora({ ambientes: [{ nome: "Sala" }], perdaPct: 8, purchaseFactor: 2.32 });
    expect(r.areaSomada).toBe(0);
    expect(r.areaComPerda).toBe(0);
    expect(r.caixas).toBeNull();
  });

  it("dois ambientes somam antes da perda", () => {
    const r = resultadoCalculadora({
      ambientes: [
        { nome: "Sala", largura: 3.5, comprimento: 4.2 },
        { nome: "Cozinha", largura: 2, comprimento: 3 },
      ],
      perdaPct: 8,
      purchaseFactor: 2.32,
    });
    expect(r.areaSomada).toBe(20.7);
    expect(r.areaComPerda).toBe(22.36); // 20,7 × 1,08 = 22,356
    expect(r.caixas).toBe(10); // 22,36 / 2,32 = 9,63
    expect(r.areaCaixasFechadas).toBe(23.2);
    expect(r.sobra).toBe(0.84);
  });
});

describe("rótulos em português", () => {
  it("fmtArea escreve sempre com 2 casas", () => {
    expect(fmtArea(14.7)).toBe("14,70");
    expect(fmtArea(15.876)).toBe("15,88");
    expect(fmtArea(0.36, "m²")).toBe("0,36 m²");
  });

  it("caixa no singular, caixas no plural, e a unidade da loja quando existe", () => {
    expect(rotuloEmbalagem(7)).toBe("7 caixas");
    expect(rotuloEmbalagem(1)).toBe("1 caixa");
    expect(rotuloEmbalagem(7, "cx")).toBe("7 cx");
  });
});
