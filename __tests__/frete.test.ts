// ============================================================
// Frete no Caixa — o que não precisa de tela (utils/frete.ts), 30/10/2026.
// ============================================================
import { lerFreteEnabled, valorDoFrete, textoDoFrete, linhaDoFrete, NOME_DO_FRETE, FRETE_MAXIMO } from "@/utils/frete";

describe("lerFreteEnabled", () => {
  test("só true liga", () => {
    expect(lerFreteEnabled({ frete_enabled: true })).toBe(true);
    expect(lerFreteEnabled({ frete_enabled: false })).toBe(false);
    expect(lerFreteEnabled({ frete_enabled: "true" })).toBe(false);
    expect(lerFreteEnabled({})).toBe(false);
    expect(lerFreteEnabled(null)).toBe(false);
    expect(lerFreteEnabled(undefined)).toBe(false);
  });
});

describe("valorDoFrete", () => {
  test("aceita vírgula, ponto de milhar, R$ e espaço", () => {
    expect(valorDoFrete("25")).toBe(25);
    expect(valorDoFrete("25,5")).toBe(25.5);
    expect(valorDoFrete("1.250,00")).toBe(1250);
    expect(valorDoFrete("R$ 30")).toBe(30);
    expect(valorDoFrete("12.9")).toBe(12.9);
    expect(valorDoFrete(" 7,25 ")).toBe(7.25);
  });
  test("vazio, zero, letra, negativo e acima do teto viram 0", () => {
    expect(valorDoFrete("")).toBe(0);
    expect(valorDoFrete(null)).toBe(0);
    expect(valorDoFrete("0")).toBe(0);
    expect(valorDoFrete("0,00")).toBe(0);
    expect(valorDoFrete("abc")).toBe(0);
    expect(valorDoFrete("-5")).toBe(0);
    expect(valorDoFrete(String(FRETE_MAXIMO + 1))).toBe(0);
    expect(valorDoFrete("1,234")).toBe(0);
  });
});

describe("textoDoFrete", () => {
  test("deixa só dígitos e um separador com até duas casas", () => {
    expect(textoDoFrete("25")).toBe("25");
    expect(textoDoFrete("25,5")).toBe("25,5");
    expect(textoDoFrete("25,555")).toBe("25,55");
    expect(textoDoFrete("2a5")).toBe("25");
    expect(textoDoFrete("R$ 25.00")).toBe("25.00");
    expect(textoDoFrete("123456")).toBe("12345");
    expect(textoDoFrete("")).toBe("");
  });
});

describe("linhaDoFrete", () => {
  test("linha sem produto de cadastro, quantidade 1, nome Frete", () => {
    expect(linhaDoFrete(25.456)).toEqual({
      product_id: undefined,
      variant_id: undefined,
      quantity: 1,
      unit_price: 25.46,
      product_name_snapshot: NOME_DO_FRETE,
    });
  });
});
