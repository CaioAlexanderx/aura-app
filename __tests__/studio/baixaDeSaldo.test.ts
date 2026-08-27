// ============================================================
// AURA STUDIO · baixa do saldo da encomenda — a matemática (27/08/2026)
//
// O relato da Sheid Mania: venda com sinal fechada, saldo em aberto, dinheiro
// recebido — e nenhum lugar na UI pra registrar que entrou. O botão "Recebi"
// nasceu daí, e estas são as regras que decidem quanto ele lança.
//
// Companheiro de signalCheckout.test.ts: lá é a matemática que ABRE o saldo
// (total − sinal), aqui é a que FECHA.
//
// O servidor é quem manda — ele relê a parcela e recusa o que não fecha.
// Estes testes travam a validação da tela, que existe pra a lojista não
// descobrir o erro depois de apertar o botão.
// ============================================================
import {
  parseValorBR,
  ehBaixaIntegral,
  erroDoValor,
  restanteApos,
  ehParcial,
  round2,
} from "../../components/studio/baixaDeSaldo";

describe("o que a lojista digita vira número", () => {
  test("aceita vírgula — é o que o teclado brasileiro entrega", () => {
    expect(parseValorBR("75,00")).toBe(75);
    expect(parseValorBR("135,50")).toBe(135.5);
  });

  test("aceita ponto — teclado decimal de iOS manda assim", () => {
    expect(parseValorBR("75.00")).toBe(75);
  });

  test("aceita inteiro seco e espaços em volta", () => {
    expect(parseValorBR("75")).toBe(75);
    expect(parseValorBR("  75,00  ")).toBe(75);
  });

  test("campo vazio é null, não zero — zero seria um lançamento", () => {
    expect(parseValorBR("")).toBeNull();
    expect(parseValorBR("   ")).toBeNull();
  });

  test("lixo vira null em vez de NaN chegando no servidor", () => {
    expect(parseValorBR("abc")).toBeNull();
    expect(parseValorBR("75,00,00")).toBeNull();
    expect(parseValorBR("R$ 75")).toBeNull();
    expect(parseValorBR("-75")).toBeNull();
  });
});

describe("integral × parcial — o que decide mandar `amount`", () => {
  // O caso real: R$ 75,00 em aberto da Cidiomara.
  test("valor igual ao saldo é baixa integral", () => {
    expect(ehBaixaIntegral(75, 75)).toBe(true);
  });

  test("diferença de meio centavo ainda conta como integral", () => {
    // É o ponto do EPS: sem ele, o servidor receberia amount=74.999... e a
    // encomenda ficaria aberta devendo fração de centavo pra sempre.
    expect(ehBaixaIntegral(74.999, 75)).toBe(true);
    expect(ehBaixaIntegral(75.001, 75)).toBe(true);
  });

  test("um centavo de diferença é pagamento parcial de verdade", () => {
    expect(ehBaixaIntegral(74.99, 75)).toBe(false);
    expect(ehParcial(74.99, 75)).toBe(true);
  });

  test("metade agora é parcial", () => {
    expect(ehParcial(37.5, 75)).toBe(true);
    expect(ehBaixaIntegral(37.5, 75)).toBe(false);
  });

  test("valor cheio NÃO é parcial", () => {
    expect(ehParcial(75, 75)).toBe(false);
  });

  test("valor inválido não é parcial — é inválido", () => {
    expect(ehParcial(0, 75)).toBe(false);
    expect(ehParcial(null, 75)).toBe(false);
    expect(ehParcial(200, 75)).toBe(false);
  });
});

describe("o que o botão recusa antes de virar dinheiro", () => {
  test("zero e negativo não têm o que lançar", () => {
    expect(erroDoValor(0, 75)).toBe("invalido");
    expect(erroDoValor(-10, 75)).toBe("invalido");
  });

  test("campo vazio (null) trava o botão", () => {
    expect(erroDoValor(null, 75)).toBe("invalido");
  });

  test("NaN trava o botão", () => {
    expect(erroDoValor(NaN, 75)).toBe("invalido");
  });

  test("acima do saldo é recusado — o excedente viraria crédito do cliente", () => {
    // Vocabulário de crediário, que é exatamente o que este fluxo evita.
    expect(erroDoValor(200, 75)).toBe("acima");
  });

  test("exatamente o saldo passa", () => {
    expect(erroDoValor(75, 75)).toBeNull();
  });

  test("meio centavo acima ainda passa — é arredondamento, não excesso", () => {
    expect(erroDoValor(75.004, 75)).toBeNull();
    expect(erroDoValor(75.01, 75)).toBe("acima");
  });

  test("parcial passa", () => {
    expect(erroDoValor(37.5, 75)).toBeNull();
  });
});

describe("quanto ainda falta depois da baixa", () => {
  test("parcial deixa a diferença", () => {
    expect(restanteApos(50, 75)).toBe(25);
  });

  test("integral zera", () => {
    expect(restanteApos(75, 75)).toBe(0);
  });

  test("nunca devolve negativo", () => {
    expect(restanteApos(200, 75)).toBe(0);
  });

  test("arredonda pra centavo, sem sobra de float", () => {
    // 0.3 - 0.1 = 0.19999999999999998 em float puro.
    expect(restanteApos(0.1, 0.3)).toBe(0.2);
    expect(restanteApos(33.33, 99.99)).toBe(66.66);
  });
});

describe("round2", () => {
  test("corta na segunda casa", () => {
    expect(round2(75.004)).toBe(75);
    expect(round2(75.005)).toBe(75.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});
