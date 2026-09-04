// ============================================================
// O preço na vitrine é escrito como o Brasil escreve (QA de 04/09/2026)
//
// A vitrine mostrava "R$ 39.90" no cartão, no produto, no carrinho e no
// checkout — `toFixed(2)` cru — e "R$ 39,90" na grade de modelos, no lote
// e na mensagem do WhatsApp. Na mesma tela, o título dizia "De R$ 39,90"
// e o cartão logo abaixo "R$ 39.90". Uma conta só, em moeda.ts, e as
// três funções locais que existiam passam a delegar para ela.
// ============================================================
import { dinheiro } from "@/components/studio/storefront/moeda";
import { dinheiro as dinheiroDoLote } from "@/components/studio/storefront/loteDaVitrine";
import { mensagemDoPedido } from "@/components/studio/storefront/pedidoPeloWhatsApp";

describe("dinheiro em português", () => {
  test("vírgula nos centavos, nunca ponto", () => {
    expect(dinheiro(39.9)).toBe("R$ 39,90");
    expect(dinheiro(49.99)).toBe("R$ 49,99");
    expect(dinheiro(5)).toBe("R$ 5,00");
    expect(dinheiro("35.91")).toBe("R$ 35,91");
  });

  test("ponto de milhar acima de mil", () => {
    expect(dinheiro(1234.5)).toBe("R$ 1.234,50");
    expect(dinheiro(1000000)).toBe("R$ 1.000.000,00");
    expect(dinheiro(999.99)).toBe("R$ 999,99");
  });

  test("desconto (valor negativo) leva o sinal antes do R$", () => {
    expect(dinheiro(-3.99)).toBe("-R$ 3,99");
  });

  test("valor inválido não vira NaN na tela", () => {
    expect(dinheiro(undefined)).toBe("R$ 0,00");
    expect(dinheiro("abc")).toBe("R$ 0,00");
    expect(dinheiro(null)).toBe("R$ 0,00");
  });

  test("arredonda meio centavo como o checkout sempre fez", () => {
    expect(dinheiro(0.005)).toBe(dinheiro(Number((0.005).toFixed(2))));
    expect(dinheiro(35.905)).toBe("R$ 35,91");
  });
});

describe("as outras contas delegam para a mesma", () => {
  test("o lote escreve igual", () => {
    expect(dinheiroDoLote(454.86)).toBe(dinheiro(454.86));
    expect(dinheiroDoLote(1234.5)).toBe("R$ 1.234,50");
  });

  test("a mensagem do WhatsApp escreve igual", () => {
    const msg = mensagemDoPedido({
      produto: { id: "p1", name: "CANECA BRANCA", price: 39.9, customization_config: { fields: [] } } as any,
      valores: {},
      quantidade: 30,
      precoUnitario: 39.9,
      nomeDaLoja: "Loja",
    });
    expect(msg).toContain("30 × R$ 39,90 = R$ 1.197,00");
  });
});
