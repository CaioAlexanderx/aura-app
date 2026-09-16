// Crediário: cliente com dívida em outra loja do grupo (16/09/2026).
// Relato Davi Calçados / Mary Lucy: o recebimento falhava com "Confira os
// dados e tente de novo", sem dizer o que conferir.
import {
  mensagemErroRecebimento,
  lojasComSaldo,
  nomeCurtoDaLoja,
  rotaFichaNaLoja,
  clienteDaRota,
  MSG_RECEBIMENTO_GENERICA,
} from "@/utils/creditoOutraLoja";

const MATRIZ = "08c05f0e-b75b-4c12-870e-d7fb65f1dca0";
const VILLA = "ea68b4d2-f051-46b1-9ac5-b8438c6cd5fc";
const MARY = "8fbde0b9-2ec0-4bc9-be58-f86c31465fa6";

describe("mensagemErroRecebimento", () => {
  it("cliente fora do cadastro do grupo diz o que fazer", () => {
    const msg = mensagemErroRecebimento({ status: 404, data: { code: "CUSTOMER_NOT_FOUND", error: "x" } });
    expect(msg).toMatch(/cadastro desta loja/);
    expect(msg).toMatch(/abra de novo pela lista/);
  });

  it("crediário desligado aponta a configuração", () => {
    const msg = mensagemErroRecebimento({ status: 403, data: { code: "CREDIARIO_DISABLED" } });
    expect(msg).toMatch(/Configurações → PDV/);
  });

  it("sem conexão manda conferir o Histórico antes de repetir", () => {
    expect(mensagemErroRecebimento({ status: 0, isNetworkError: true, message: "x" }))
      .toMatch(/Histórico/);
  });

  it("400 fala do valor e da data, nunca do texto cru do backend", () => {
    const msg = mensagemErroRecebimento({ status: 400, data: { error: "amount > 0 obrigatorio" } });
    expect(msg).not.toMatch(/obrigatorio/);
    expect(msg).toMatch(/valor e a data/);
  });

  it("5xx usa o texto amigável que o ApiError já traz", () => {
    expect(mensagemErroRecebimento({ status: 500, message: "A falha foi nossa." }))
      .toBe("A falha foi nossa.");
  });

  it("qualquer outra coisa cai na genérica, sem pedir para conferir dados", () => {
    expect(mensagemErroRecebimento(undefined)).toBe(MSG_RECEBIMENTO_GENERICA);
    expect(mensagemErroRecebimento({ status: 409 })).toBe(MSG_RECEBIMENTO_GENERICA);
    expect(MSG_RECEBIMENTO_GENERICA).not.toMatch(/Confira os dados/);
  });
});

describe("lojasComSaldo", () => {
  const go = [
    { company_id: VILLA, company_name: "Davi Calçados Villa Branca", balance: 179.99 },
    { company_id: MATRIZ, company_name: "Davi Calçados Matriz", balance: 99.99 },
    { company_id: "zerada", company_name: "Loja zerada", balance: 0 },
  ];

  it("tira a loja atual e as zeradas", () => {
    expect(lojasComSaldo(go, MATRIZ).map((g) => g.company_id)).toEqual([VILLA]);
  });

  it("backend antigo (sem group_open) não mostra nada", () => {
    expect(lojasComSaldo(undefined, MATRIZ)).toEqual([]);
    expect(lojasComSaldo(null, MATRIZ)).toEqual([]);
  });
});

describe("nomeCurtoDaLoja", () => {
  it("tira o prefixo comum com a loja atual", () => {
    expect(nomeCurtoDaLoja("Davi Calçados Villa Branca", "Davi Calçados Matriz")).toBe("Villa Branca");
  });
  it("sem prefixo comum, mantém o nome inteiro", () => {
    expect(nomeCurtoDaLoja("Finesse", "Davi Calçados Matriz")).toBe("Finesse");
  });
  it("nunca devolve vazio quando os nomes são iguais", () => {
    expect(nomeCurtoDaLoja("Davi Calçados", "Davi Calçados")).toBe("Calçados");
  });
});

describe("rota da ficha na outra loja", () => {
  it("ida e volta pelo ?cliente=", () => {
    const rota = rotaFichaNaLoja(MARY);
    expect(rota).toBe(`/crediario?cliente=${MARY}`);
    expect(clienteDaRota(new URLSearchParams(rota.split("?")[1]).get("cliente"))).toBe(MARY);
  });
  it("só abre ficha com UUID", () => {
    expect(clienteDaRota("../../x")).toBeNull();
    expect(clienteDaRota("")).toBeNull();
    expect(clienteDaRota(undefined)).toBeNull();
    expect(clienteDaRota([MARY, "outro"])).toBe(MARY);
  });
});
