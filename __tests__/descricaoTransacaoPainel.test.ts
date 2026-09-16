// Descrição das Últimas transações no Painel (Fase 0, 16/09/2026).
//
// QA em produção achou "Crediario – venda a8e5ee97-86ba-4574-bffd-
// 93dc12531c49" nas Últimas transações: o backend monta essa string quando
// não tem um nome melhor pra mostrar, e o id do sistema vazava pro lojista.
// formatTransactionDescription() trata isso no front: usa nome do cliente
// ou dado de parcela quando o payload trouxer (campos ainda não emitidos
// pelo backend, mas já suportados aqui), e cai pra "<tipo> · venda" sem o
// id quando não há nada melhor.

import { formatTransactionDescription } from "@/components/screens/dashboard/types";

const UUID = "a8e5ee97-86ba-4574-bffd-93dc12531c49";

describe("formatTransactionDescription", () => {
  it("com UUID e nome do cliente: usa o nome, não o id", () => {
    expect(
      formatTransactionDescription({
        customer: `Crediario – venda ${UUID}`,
        customer_name: "Simone",
      })
    ).toBe("Crediário · Simone");
  });

  it("com UUID e dado de parcela: usa a parcela, não o id", () => {
    expect(
      formatTransactionDescription({
        customer: `Crediario – venda ${UUID}`,
        installment_number: 2,
        total_installments: 6,
      })
    ).toBe("Crediário · parcela 2/6");
  });

  it("com UUID e sem cliente: cai pra 'Crediário · venda', sem o id", () => {
    const out = formatTransactionDescription({ customer: `Crediario – venda ${UUID}` });
    expect(out).toBe("Crediário · venda");
    expect(out).not.toContain(UUID);
  });

  it("com UUID mas com nome já embutido na própria string: aproveita o nome", () => {
    // Caso em que o backend já manda o nome junto, sem separar em campo à
    // parte — o id ainda precisa sumir, mas o nome não pode ir junto.
    expect(
      formatTransactionDescription({ customer: `Crediario – Ana Oliveira ${UUID}` })
    ).toBe("Crediário · Ana Oliveira");
  });

  it("sem UUID: passa a descrição adiante sem mexer", () => {
    expect(formatTransactionDescription({ customer: "Maria Silva" })).toBe("Maria Silva");
  });

  it("sem customer: não quebra, devolve vazio", () => {
    expect(formatTransactionDescription({})).toBe("");
  });
});
