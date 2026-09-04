// ============================================================
// O botão "Enviar pedido" apagado diz o que falta (LJ-07, QA de 04/09/2026)
//
// Com nome ou WhatsApp em branco o botão ficava cinza e mudo; o campo
// obrigatório estava acima da dobra do celular e a cliente com pressa
// não tinha como saber por que "não funcionava".
// ============================================================
import { oQueFaltaNoCheckout } from "@/components/studio/storefront/oQueFaltaNoCheckout";

describe("o que falta para enviar o pedido", () => {
  test("nada falta: nenhuma frase", () => {
    expect(oQueFaltaNoCheckout({ itens: 1, nome: "Marina", whatsapp: "12999990001" })).toBeNull();
  });

  test("um campo só", () => {
    expect(oQueFaltaNoCheckout({ itens: 1, nome: "", whatsapp: "12999990001" }))
      .toBe("Falta seu nome para enviar o pedido.");
    expect(oQueFaltaNoCheckout({ itens: 1, nome: "Marina", whatsapp: "   " }))
      .toBe("Falta seu WhatsApp para enviar o pedido.");
  });

  test("os dois campos, numa frase só", () => {
    expect(oQueFaltaNoCheckout({ itens: 2, nome: "", whatsapp: "" }))
      .toBe("Faltam seu nome e seu WhatsApp para enviar o pedido.");
  });

  test("carrinho vazio vem antes de qualquer campo", () => {
    expect(oQueFaltaNoCheckout({ itens: 0, nome: "", whatsapp: "" }))
      .toBe("Escolha uma peça para enviar o pedido.");
  });

  test("espaço em branco não conta como preenchido", () => {
    expect(oQueFaltaNoCheckout({ itens: 1, nome: "  ", whatsapp: "12999990001" }))
      .toBe("Falta seu nome para enviar o pedido.");
  });
});
