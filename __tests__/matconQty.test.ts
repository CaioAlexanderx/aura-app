// ============================================================
// Matcon M0 — as duas perguntas do carrinho, testadas fora do React
// (components/screens/pdv/matconQty.ts).
// ============================================================
import {
  usaCampoDecimal,
  qtyMaxLength,
  fraseDeEmbalagem,
  QTY_MAXLEN_PADRAO,
  QTY_MAXLEN_MATCON,
  QTY_MAXLEN_DECIMAL,
} from "@/components/screens/pdv/matconQty";

describe("usaCampoDecimal — toggle E unidade, nunca só um dos dois", () => {
  it("com o toggle off, NENHUMA unidade ganha campo decimal", () => {
    ["m²", "m", "kg", "L", "ton", "un", "sc"].forEach(u => {
      expect(usaCampoDecimal(false, u)).toBe(false);
    });
  });

  it("com o toggle on, só as unidades fracionáveis", () => {
    ["m", "m²", "m³", "kg", "g", "L", "ml", "ton"].forEach(u => {
      expect(usaCampoDecimal(true, u)).toBe(true);
    });
    // Ninguém vende 2,5 sacos de cimento.
    ["un", "sc", "br", "mlh", "cx", "pç", "rolo", "lata", "balde", "pct", "kit", "par"].forEach(u => {
      expect(usaCampoDecimal(true, u)).toBe(false);
    });
  });

  it("produto sem unidade cadastrada cai no stepper", () => {
    expect(usaCampoDecimal(true, undefined)).toBe(false);
    expect(usaCampoDecimal(true, null)).toBe(false);
    expect(usaCampoDecimal(true, "  ")).toBe(false);
  });
});

describe("qtyMaxLength — o teto de 999 só sobe dentro do Matcon", () => {
  it("toggle off: 3 dígitos, como sempre foi", () => {
    expect(qtyMaxLength(false, "un")).toBe(QTY_MAXLEN_PADRAO);
    expect(qtyMaxLength(false, "m²")).toBe(QTY_MAXLEN_PADRAO);
  });

  it("toggle on: 6 dígitos no stepper (1.200 tijolos) e 9 no campo decimal", () => {
    expect(qtyMaxLength(true, "mlh")).toBe(QTY_MAXLEN_MATCON);
    expect(qtyMaxLength(true, "m²")).toBe(QTY_MAXLEN_DECIMAL);
  });
});

describe("fraseDeEmbalagem — a frase do momento 'olha isso'", () => {
  const base = { matconEnabled: true, roundToPackage: true, qty: 12.5, unit: "m²", purchaseFactor: 2.32 };

  it("12,5 m² numa caixa de 2,32 m² = 6 caixas, 13,92 m², sobra 1,42 m²", () => {
    expect(fraseDeEmbalagem(base)).toBe("= 6 caixas · 13,92 m² · sobra 1,42 m²");
  });

  it("usa a unidade de compra cadastrada quando ela existe", () => {
    expect(fraseDeEmbalagem({ ...base, purchaseUnit: "cx" })).toBe("= 6 cx · 13,92 m² · sobra 1,42 m²");
  });

  it("QA 22/09/2026 — 1 caixa no singular, não '1 caixas'", () => {
    // Caixa de 2,5 m², quantidade 1: fecha em 1 caixa só, com sobra.
    expect(fraseDeEmbalagem({ ...base, qty: 1, purchaseFactor: 2.5 })).toBe("= 1 caixa · 2,5 m² · sobra 1,5 m²");
  });

  it("sem sobra, some o '· sobra' (quantidade fecha na embalagem cheia)", () => {
    expect(fraseDeEmbalagem({ ...base, qty: 4.64 })).toBe("= 2 caixas · 4,64 m²");
  });

  it("some inteira quando falta toggle, config ou fator de compra", () => {
    expect(fraseDeEmbalagem({ ...base, matconEnabled: false })).toBeNull();
    expect(fraseDeEmbalagem({ ...base, roundToPackage: false })).toBeNull();
    expect(fraseDeEmbalagem({ ...base, purchaseFactor: 0 })).toBeNull();
    expect(fraseDeEmbalagem({ ...base, purchaseFactor: null })).toBeNull();
  });

  it("some em unidade não fracionada, mesmo com fator cadastrado", () => {
    // Saco de cimento comprado em palete não vira "= 1 caixas · …": o item
    // nem tem campo decimal, a frase não faria sentido embaixo do stepper.
    expect(fraseDeEmbalagem({ ...base, unit: "sc", purchaseFactor: 40 })).toBeNull();
  });

  it("qty zerada não produz frase", () => {
    expect(fraseDeEmbalagem({ ...base, qty: 0 })).toBeNull();
  });
});
