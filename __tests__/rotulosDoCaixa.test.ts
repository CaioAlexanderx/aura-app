// ============================================================
// Caixa — textos na língua do lojista (components/screens/pdv/rotulosDoCaixa.ts).
// QA 23/09/2026: nada de "CARTAO", "1× SPLIT", "!" no toast do cupom.
// ============================================================
import {
  fraseDeProdutos, fraseDoCupomAplicado, nomeDoPagamento, rotuloDoLadoDinheiro, rotuloDoPagamento,
} from "@/components/screens/pdv/rotulosDoCaixa";

describe("toast do cupom", () => {
  test("sem '!' e com o desconto do método escolhido", () => {
    expect(fraseDoCupomAplicado("15OFF", 223.79)).toBe("Cupom 15OFF aplicado · −R$ 223,79");
    expect(fraseDoCupomAplicado("15OFF", 1201.6)).toBe("Cupom 15OFF aplicado · −R$ 1.201,60");
  });
  test("sem valor (dividido) ou zero: só o aviso", () => {
    expect(fraseDoCupomAplicado("15OFF", null)).toBe("Cupom 15OFF aplicado");
    expect(fraseDoCupomAplicado("15OFF", 0)).toBe("Cupom 15OFF aplicado");
  });
});

describe("Pagamento no topo do carrinho", () => {
  test("nomes do balcão, com acento", () => {
    expect(rotuloDoPagamento("cartao", false)).toBe("Crédito");
    expect(rotuloDoPagamento("debito", false)).toBe("Débito");
    expect(rotuloDoPagamento("crediario", false)).toBe("Crediário");
    expect(rotuloDoPagamento("dinheiro", false)).toBe("Dinheiro");
    expect(rotuloDoPagamento("pix", false)).toBe("PIX");
    expect(nomeDoPagamento("outro")).toBe("outro");
  });
  test("dividido conta as linhas com valor", () => {
    expect(rotuloDoPagamento("pix", true, [{ value: 400 }, { value: 824.13 }])).toBe("Dividido em 2");
    expect(rotuloDoPagamento("pix", true, [{ value: 400 }, { value: 0 }])).toBe("Dividido em 1");
    expect(rotuloDoPagamento("pix", true, [{ value: 0 }])).toBe("Dividido");
    expect(rotuloDoPagamento("pix", true, [])).toBe("Dividido");
  });
});

describe("par de totais", () => {
  test("'Dinheiro ou PIX'; com Crediário, cita o crediário", () => {
    expect(rotuloDoLadoDinheiro("pix", false)).toBe("Dinheiro ou PIX");
    expect(rotuloDoLadoDinheiro("cartao", false)).toBe("Dinheiro ou PIX");
    expect(rotuloDoLadoDinheiro("crediario", false)).toBe("Dinheiro, PIX ou crediário");
    expect(rotuloDoLadoDinheiro("crediario", true)).toBe("Dinheiro ou PIX");
  });
});

describe("produtos", () => {
  test("conta linhas, com plural", () => {
    expect(fraseDeProdutos(1)).toBe("1 produto");
    expect(fraseDeProdutos(2)).toBe("2 produtos");
    expect(fraseDeProdutos(0)).toBe("0 produtos");
  });
});
