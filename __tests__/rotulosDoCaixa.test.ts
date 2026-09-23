// ============================================================
// Caixa — textos na língua do lojista (components/screens/pdv/rotulosDoCaixa.ts).
// QA 23/09/2026: nada de "CARTAO", "1× SPLIT", "!" no toast do cupom.
// ============================================================
import {
  fraseDoCupomAplicado, nomeDoPagamento, rotuloDoLadoDinheiro, rotuloDoPagamento,
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
    expect(rotuloDoPagamento("pix", true, [
      { method: "pix", value: 400 }, { method: "cartao", value: 824.13 }, { method: "dinheiro", value: 50 },
    ])).toBe("Dividido em 3");
    expect(rotuloDoPagamento("pix", true, [{ value: 0 }])).toBe("Dividido");
    expect(rotuloDoPagamento("pix", true, [])).toBe("Dividido");
  });
  test("QA 23/09: com um pagamento só, o nome da forma — nunca 'Dividido em 1'", () => {
    // Uma linha com valor e outra zerada: é o PIX que está pagando.
    expect(rotuloDoPagamento("dinheiro", true, [{ method: "pix", value: 400 }, { method: "cartao", value: 0 }])).toBe("PIX");
    // Acabou de ligar o dividido: uma linha só.
    expect(rotuloDoPagamento("pix", true, [{ method: "cartao", value: 1066 }])).toBe("Crédito");
    expect(rotuloDoPagamento("pix", true, [{ method: "debito", value: 0 }])).toBe("Débito");
    // Sem saber a forma (chamador antigo), não inventa: "Dividido".
    expect(rotuloDoPagamento("pix", true, [{ value: 400 }, { value: 0 }])).toBe("Dividido");
    for (const n of [0, 1]) {
      const linhas = [{ method: "pix", value: 400 }, { method: "cartao", value: n ? 10 : 0 }];
      expect(rotuloDoPagamento("pix", true, linhas)).not.toBe("Dividido em 1");
    }
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
