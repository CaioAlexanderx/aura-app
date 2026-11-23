// Movimentações da ficha do crediário (F1, 23/11/2026): verbo, sinal, mês,
// "paga inteira / abateu / sobra" e "hoje faltam".
import {
  agruparPorMes, diaDoEvento, mesDoEvento, paraOndeFoiODinheiro, tituloDoEvento,
  valorComSinal, verboDoPagamento, diminuiADivida,
  type AlocacaoDaMovimentacao,
} from "@/utils/crediarioMovimentacao";

const aloc = (o: Partial<AlocacaoDaMovimentacao>): AlocacaoDaMovimentacao => ({
  installment_id: "i", number: 1, total_installments: 3, due_date: "2026-11-20",
  account_id: "c19", account_name: "Compra de 19/10", from_sale: true,
  principal_paid: 0, charges_paid: 0, status_after: "paid", ...o,
});

describe("título: verbo no lugar do tipo", () => {
  test("pagamento pela forma", () => {
    expect(tituloDoEvento({ type: "payment", payment: { method: "pix" } })).toBe("Pagou no Pix");
    expect(tituloDoEvento({ type: "payment", payment: { method: "dinheiro" } })).toBe("Pagou em dinheiro");
    expect(tituloDoEvento({ type: "payment", payment: { method: "cartao" } })).toBe("Pagou no cartão");
    expect(verboDoPagamento("credito")).toBe("Pagou no cartão");
    expect(verboDoPagamento("cartao_debito")).toBe("Pagou no cartão");
    expect(verboDoPagamento(null)).toBe("Pagou");
    expect(verboDoPagamento("algo-novo")).toBe("Pagou");
  });
  test("demais tipos", () => {
    expect(tituloDoEvento({ type: "purchase" })).toBe("Comprou");
    expect(tituloDoEvento({ type: "manual_debit" })).toBe("Valor lançado à mão pela loja");
    expect(tituloDoEvento({ type: "refund" })).toBe("Devolveu itens");
    expect(tituloDoEvento({ type: "exchange_credit" })).toBe("Ganhou crédito de troca");
    expect(tituloDoEvento({ type: "credit_use" })).toBe("Usou crédito na compra");
    expect(tituloDoEvento({ type: "x" } as any)).toBe("Movimentação");
  });
});

describe("sinal do ponto de vista da dívida", () => {
  test("pagamento diminui (−), compra aumenta (+)", () => {
    expect(valorComSinal(-205.34)).toBe("− R$ 205,34");
    expect(valorComSinal(616)).toBe("+ R$ 616,00");
    expect(diminuiADivida(-1)).toBe(true);
    expect(diminuiADivida(45)).toBe(false);
  });
});

describe("mês e dia em São Paulo", () => {
  test("cabeçalho do mês e dia curto", () => {
    expect(mesDoEvento("2026-11-20T15:00:00Z")).toBe("Novembro de 2026");
    expect(diaDoEvento("2026-11-20T15:00:00Z")).toBe("20 nov");
    // 01h UTC do dia 1º ainda é 31/10 em São Paulo
    expect(mesDoEvento("2026-11-01T01:00:00Z")).toBe("Outubro de 2026");
    expect(diaDoEvento("2026-11-01T01:00:00Z")).toBe("31 out");
    expect(mesDoEvento("")).toBe("");
  });
  test("agrupa na ordem que chegou", () => {
    const g = agruparPorMes([
      { id: "a", occurred_at: "2026-11-20T15:00:00Z" },
      { id: "b", occurred_at: "2026-10-19T15:00:00Z" },
      { id: "c", occurred_at: "2026-10-05T15:00:00Z" },
      { id: "d", occurred_at: "2026-09-01T15:00:00Z" },
    ]);
    expect(g.map(x => x.mes)).toEqual(["Novembro de 2026", "Outubro de 2026", "Setembro de 2026"]);
    expect(g[1].eventos.map(e => e.id)).toEqual(["b", "c"]);
  });
});

describe("para onde foi o dinheiro", () => {
  test("o print da cliente: quitou a 1 e o centavo da 2 é sobra, com o que falta hoje", () => {
    const g = paraOndeFoiODinheiro(
      [
        aloc({ installment_id: "p1", number: 1, principal_paid: 205.33, status_after: "paid" }),
        aloc({ installment_id: "p2", number: 2, due_date: "2026-12-20", principal_paid: 0.01, status_after: "pending" }),
      ],
      [{ id: "p2", due_date: "2026-12-20", amount_due: 205.33, covered_amount: 0.01 }],
      "2026-11-23",
    );
    expect(g).toHaveLength(1);
    expect(g[0].nome).toBe("Compra de 19/10");
    expect(g[0].linhas[0]).toMatchObject({ tipo: "inteira", rotulo: "Parcela 1 de 3 · paga inteira", detalhe: "", valor: 205.33 });
    expect(g[0].linhas[1]).toMatchObject({
      tipo: "sobra", rotulo: "Parcela 2 de 3 · sobra do pagamento",
      detalhe: "vence 20/12 · hoje faltam R$ 205,32", valor: 0.01,
    });
  });

  test("abateu parte de uma parcela vencida: venceu e o que falta hoje com multa e juros", () => {
    const g = paraOndeFoiODinheiro(
      [
        aloc({ installment_id: "a2", number: 2, total_installments: 4, account_id: "c02", account_name: "Compra de 02/08", principal_paid: 80, status_after: "paid" }),
        aloc({ installment_id: "a3", number: 3, total_installments: 4, account_id: "c02", account_name: "Compra de 02/08", due_date: "2026-11-02", principal_paid: 20, status_after: "overdue" }),
      ],
      [{ id: "a3", due_date: "2026-11-02", amount_due: 80, covered_amount: 20, remaining: 60, total_due: 62.11 }],
      "2026-11-21",
    );
    expect(g[0].linhas[1]).toMatchObject({
      tipo: "abateu", rotulo: "Parcela 3 de 4 · abateu R$ 20,00",
      detalhe: "venceu 02/11 · hoje faltam R$ 62,11",
    });
  });

  test("pagamento que só abateu (sem quitar nada) nunca é sobra, mesmo pequeno", () => {
    const g = paraOndeFoiODinheiro(
      [aloc({ installment_id: "x", principal_paid: 0.5, status_after: "pending" })],
      [{ id: "x", due_date: "2026-11-20", remaining: 10 }],
      "2026-11-20",
    );
    expect(g[0].linhas[0].tipo).toBe("abateu");
    // vence hoje ainda é "vence"
    expect(g[0].linhas[0].detalhe).toBe("vence 20/11 · hoje faltam R$ 10,00");
  });

  test("parcela que saiu das abertas: não afirma que foi paga", () => {
    const g = paraOndeFoiODinheiro(
      [aloc({ installment_id: "y", principal_paid: 30, status_after: "pending" })],
      [],
      "2026-11-23",
    );
    expect(g[0].linhas[0].detalhe).toBe("já não está em aberto");
  });

  test("sem carnê e várias lojas de carnê: agrupa por carnê, sem carnê com nome próprio", () => {
    const g = paraOndeFoiODinheiro(
      [
        aloc({ installment_id: "s1", account_id: null, account_name: null, number: 1, total_installments: 1, principal_paid: 100 }),
        aloc({ installment_id: "k1", account_id: "k", account_name: "Compra de 05/09", number: 1, total_installments: null, principal_paid: 50, charges_paid: 2.5 }),
      ],
      [],
      "2026-11-23",
    );
    expect(g.map(x => x.nome)).toEqual(["Compras sem carnê", "Compra de 05/09"]);
    expect(g[1].linhas[0]).toMatchObject({ rotulo: "Parcela 1 · paga inteira", valor: 52.5 });
  });

  test("sem alocações: nada", () => {
    expect(paraOndeFoiODinheiro(undefined, [], "2026-11-23")).toEqual([]);
  });
});
