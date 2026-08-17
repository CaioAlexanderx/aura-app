// ============================================================
// AURA STUDIO · PDV — matemática da venda com sinal (F3)
//
// A lojista fecha a venda recebendo uma entrada e o restante numa data
// combinada. Estes testes travam as regras que decidem dinheiro:
//
//   1. saldo = total − sinal, sempre
//   2. só 0 < sinal < total (sem piso de sinal — decisão de produto)
//   3. sinal NÃO é split: `sinal + saldo = total` por construção, então
//      splitIsBalanced não se aplica e não pode ser usado no lugar
//
// O backend é quem manda: ele recalcula o total a partir dos itens. Isto
// aqui é a validação da tela, que existe pra ela não descobrir o erro
// depois de apertar Concluir.
// ============================================================
import {
  signalBalance,
  signalIsValid,
  signalError,
  splitIsBalanced,
  round2,
  todayISO,
} from "../../components/studio/pdv/checkoutMath";

describe("saldo = total − sinal", () => {
  test("caso da Sheid: 240 com sinal de 100 deixa 140", () => {
    expect(signalBalance(240, 100)).toBe(140);
  });

  test("arredonda pra centavo, sem sobra de float", () => {
    expect(signalBalance(0.3, 0.1)).toBe(0.2);
    expect(signalBalance(99.99, 33.33)).toBe(66.66);
  });

  test("nunca devolve saldo negativo", () => {
    expect(signalBalance(100, 150)).toBe(0);
  });

  test("sinal vazio ou inválido trata como zero", () => {
    expect(signalBalance(240, NaN)).toBe(240);
    expect(signalBalance(240, 0)).toBe(240);
  });
});

describe("0 < sinal < total", () => {
  test("aceita sinal parcial", () => {
    expect(signalIsValid(240, 100)).toBe(true);
    expect(signalError(240, 100)).toBeNull();
  });

  // Sem piso: a lojista decide quanto pedir de entrada.
  test("aceita sinal minúsculo — não há piso", () => {
    expect(signalIsValid(240, 0.01)).toBe(true);
    expect(signalBalance(240, 0.01)).toBe(239.99);
  });

  test("recusa zero e negativo, com o motivo na mensagem", () => {
    expect(signalIsValid(240, 0)).toBe(false);
    expect(signalError(240, 0)).toMatch(/pagando agora/i);
    expect(signalIsValid(240, -5)).toBe(false);
  });

  // Sinal == total não é venda com sinal: é venda à vista, e geraria uma
  // parcela de R$ 0,00 no crediário.
  test("recusa sinal igual ou maior que o total", () => {
    expect(signalIsValid(240, 240)).toBe(false);
    expect(signalError(240, 240)).toMatch(/menor que o total/i);
    expect(signalIsValid(240, 300)).toBe(false);
  });

  test("compara em centavos, não em float cru", () => {
    // 240.004 arredonda pra 240.00 — mesmo valor do total, então recusa.
    expect(signalIsValid(240.004, 240)).toBe(false);
  });
});

// Guarda da decisão de arquitetura: venda com sinal não é split. Se alguém
// tentar validar o sinal com splitIsBalanced, os pagamentos "não fecham"
// com o total — porque não devem mesmo fechar: o saldo é o que falta.
describe("sinal não é split", () => {
  test("o sinal sozinho não fecha o total, e está correto assim", () => {
    const total = 240;
    const sinal = 100;
    expect(splitIsBalanced(total, [{ method: "pix", value: sinal }])).toBe(false);
    expect(signalIsValid(total, sinal)).toBe(true);
  });

  test("sinal + saldo fecham o total por construção", () => {
    const total = 240;
    const sinal = 100;
    expect(round2(sinal + signalBalance(total, sinal))).toBe(total);
  });
});

describe("todayISO", () => {
  test("devolve YYYY-MM-DD", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Data pura não pode passar por new Date(): seria lida como UTC e
  // voltaria um dia no fuso de São Paulo.
  test("bate com a data local, não com a UTC", () => {
    const d = new Date();
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(todayISO()).toBe(local);
  });
});
