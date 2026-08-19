// ============================================================
// AURA Studio — S8: placa do entregador na retirada por app
//
// Espelho de normalizePlate em src/services/courierPickup.js
// (aura-backend). O servidor revalida sempre; isto existe para o cliente
// ver o erro ANTES de mandar o pedido.
//
// Se os dois divergirem, o cliente preenche, envia e leva 400 — que é o
// mesmo tipo de falha que o S0 corrigiu nos campos obrigatórios.
// ============================================================
import { normalizePlate, maskPlate } from "@/components/studio/storefront/courierPlate";

describe("normalizePlate — mesmos casos do backend", () => {
  it("aceita placa antiga e Mercosul", () => {
    expect(normalizePlate("ABC1234")).toBe("ABC1234");
    expect(normalizePlate("ABC1D23")).toBe("ABC1D23");
  });

  it("normaliza o que o cliente digita no celular", () => {
    expect(normalizePlate("abc-1234")).toBe("ABC1234");
    expect(normalizePlate(" abc 1d23 ")).toBe("ABC1D23");
  });

  it("recusa o que não é placa", () => {
    expect(normalizePlate("")).toBeNull();
    expect(normalizePlate(null)).toBeNull();
    expect(normalizePlate("ABC123")).toBeNull();    // curta
    expect(normalizePlate("ABC12345")).toBeNull();  // longa
    expect(normalizePlate("1234ABC")).toBeNull();   // invertida
    expect(normalizePlate("AB01234")).toBeNull();   // 2 letras
    expect(normalizePlate("ABCD123")).toBeNull();   // 4ª letra na posição do dígito
  });
});

describe("maskPlate — formata, nunca recusa", () => {
  it("insere o hífen depois das três letras", () => {
    expect(maskPlate("abc1234")).toBe("ABC-1234");
    expect(maskPlate("abc1d23")).toBe("ABC-1D23");
  });

  it("não põe hífen antes da hora", () => {
    expect(maskPlate("a")).toBe("A");
    expect(maskPlate("abc")).toBe("ABC");
  });

  it("descarta separador digitado e corta no sétimo caractere", () => {
    expect(maskPlate("ABC-1234")).toBe("ABC-1234");
    expect(maskPlate("ABC12345678")).toBe("ABC-1234");
  });

  // Uma máscara que bloqueia caractere "errado" trava o cliente que
  // digitou um dígito a mais e tenta corrigir. Quem recusa é o
  // normalizePlate no envio.
  it("deixa passar conteúdo inválido enquanto se digita", () => {
    expect(maskPlate("1234567")).toBe("123-4567");
    expect(normalizePlate(maskPlate("1234567"))).toBeNull();
  });

  it("apagar tudo volta para vazio", () => {
    expect(maskPlate("")).toBe("");
  });
});
