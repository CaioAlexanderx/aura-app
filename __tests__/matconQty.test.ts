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
  QTY_MAXLEN_PECAS,
  usaPecasNoMilheiro,
  unidadesParaMilheiro,
  milheiroParaUnidades,
  parseInteiroDigitado,
  fraseDoMilheiro,
  quantidadeParaContar,
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

  it("toggle on: 6 dígitos no stepper (1.200 sacos) e 9 no campo decimal", () => {
    expect(qtyMaxLength(true, "sc")).toBe(QTY_MAXLEN_MATCON);
    expect(qtyMaxLength(true, "m²")).toBe(QTY_MAXLEN_DECIMAL);
  });

  it("milheiro com toggle on: campo de peças com 9 ('1.000.000'); sem toggle, os 3 de sempre", () => {
    expect(qtyMaxLength(true, "mlh")).toBe(QTY_MAXLEN_PECAS);
    expect(qtyMaxLength(false, "mlh")).toBe(QTY_MAXLEN_PADRAO);
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

// ------------------------------------------------------------
// QA em produção 22/09/2026 — tijolo por peça com preço por milheiro.
// "0,5" virava 5 mlh (R$ 4.450) e "500" virava 500 mlh (R$ 445.000).
// ------------------------------------------------------------
describe("usaPecasNoMilheiro — só com o toggle E o produto em milheiro", () => {
  it("toggle on + mlh (qualquer grafia): campo de peças", () => {
    expect(usaPecasNoMilheiro(true, "mlh")).toBe(true);
    expect(usaPecasNoMilheiro(true, " MLH ")).toBe(true);
  });

  it("toggle off: nunca, nem em mlh", () => {
    expect(usaPecasNoMilheiro(false, "mlh")).toBe(false);
  });

  it("outras unidades não entram", () => {
    ["un", "sc", "m²", "br", "pç", undefined, null, ""].forEach(u => {
      expect(usaPecasNoMilheiro(true, u as any)).toBe(false);
    });
  });
});

describe("unidadesParaMilheiro / milheiroParaUnidades", () => {
  it("500 peças = 0,5 mlh; 1 peça = 0,001 mlh; 20.000 peças = 20 mlh", () => {
    expect(unidadesParaMilheiro(500)).toBe(0.5);
    expect(unidadesParaMilheiro(1)).toBe(0.001);
    expect(unidadesParaMilheiro(20000)).toBe(20);
    expect(unidadesParaMilheiro(1250)).toBe(1.25);
  });

  it("nunca passa de 3 casas: peça é inteira", () => {
    expect(unidadesParaMilheiro(333)).toBe(0.333);
    expect(unidadesParaMilheiro(333.6)).toBe(0.334);
  });

  it("zero, negativo e lixo -> 0", () => {
    expect(unidadesParaMilheiro(0)).toBe(0);
    expect(unidadesParaMilheiro(-5)).toBe(0);
    expect(unidadesParaMilheiro(NaN)).toBe(0);
  });

  it("volta: 0,5 mlh = 500 peças, sem erro de ponto flutuante", () => {
    expect(milheiroParaUnidades(0.5)).toBe(500);
    expect(milheiroParaUnidades(0.333)).toBe(333);
    expect(milheiroParaUnidades(0.001)).toBe(1);
    expect(milheiroParaUnidades(19.5)).toBe(19500);
    expect(milheiroParaUnidades(0)).toBe(0);
  });

  it("ida e volta fecham para qualquer quantidade de peças", () => {
    [1, 7, 99, 333, 500, 999, 1001, 3500, 12345].forEach(n => {
      expect(milheiroParaUnidades(unidadesParaMilheiro(n))).toBe(n);
    });
  });
});

describe("parseInteiroDigitado — vírgula e ponto cortam, nunca somem", () => {
  it("'0,5' -> 0 (antes virava 5) e '12,5' -> 12 (antes 125)", () => {
    expect(parseInteiroDigitado("0,5")).toBe(0);
    expect(parseInteiroDigitado("12,5")).toBe(12);
    expect(parseInteiroDigitado("12.5")).toBe(12);
    expect(parseInteiroDigitado("3,")).toBe(3);
  });

  it("milhar em pt-BR continua milhar: '1.500' -> 1500, '12.000' -> 12000", () => {
    expect(parseInteiroDigitado("1.500")).toBe(1500);
    expect(parseInteiroDigitado("12.000")).toBe(12000);
    expect(parseInteiroDigitado("1.000.000")).toBe(1000000);
  });

  it("inteiro simples passa, com espaço nas pontas", () => {
    expect(parseInteiroDigitado("500")).toBe(500);
    expect(parseInteiroDigitado(" 42 ")).toBe(42);
  });

  it("vazio, sem dígito antes do separador ou lixo -> null", () => {
    expect(parseInteiroDigitado("")).toBeNull();
    expect(parseInteiroDigitado(",5")).toBeNull();
    expect(parseInteiroDigitado("abc")).toBeNull();
    expect(parseInteiroDigitado(null)).toBeNull();
    expect(parseInteiroDigitado(undefined)).toBeNull();
  });
});

describe("fraseDoMilheiro — a conta que o vendedor confere", () => {
  it("500 tijolos a R$ 890/mlh", () => {
    expect(fraseDoMilheiro(0.5, 890)).toBe("500 un = 0,5 mlh · R$ 890,00/mlh → R$ 445,00");
  });

  it("milhar com ponto e centavos arredondados", () => {
    expect(fraseDoMilheiro(3.5, 890)).toBe("3.500 un = 3,5 mlh · R$ 890,00/mlh → R$ 3.115,00");
    expect(fraseDoMilheiro(0.333, 889.99)).toBe("333 un = 0,333 mlh · R$ 889,99/mlh → R$ 296,37");
  });

  it("quantidade zerada não produz frase", () => {
    expect(fraseDoMilheiro(0, 890)).toBeNull();
  });
});

describe("quantidadeParaContar — milheiro conta peças", () => {
  it("toggle on: 0,5 mlh conta 500; m² e sc contam como sempre", () => {
    expect(quantidadeParaContar(true, 0.5, "mlh")).toBe(500);
    expect(quantidadeParaContar(true, 12.5, "m²")).toBe(12.5);
    expect(quantidadeParaContar(true, 3, "sc")).toBe(3);
  });

  it("toggle off: a quantidade crua de sempre", () => {
    expect(quantidadeParaContar(false, 0.5, "mlh")).toBe(0.5);
  });
});
