// Pagamento na linha do tempo do Crediário (08/10/2026, Looks da Jenny):
// as parcelas que o pagamento cobriu, por carnê, e o corpo da edição só com
// o que mudou.
import { gruposPorCarne, mudancasDoPagamento, diaSP, type AlocacaoDoPagamento } from "../utils/crediarioPagamento";

const aloc = (extra: Partial<AlocacaoDoPagamento>): AlocacaoDoPagamento => ({
  installment_id: "i1", number: 1, total_installments: 3, due_date: "2026-08-06",
  account_id: null, account_name: null, from_sale: true,
  principal_paid: 166, charges_paid: 0, status_after: "paid", ...extra,
});

describe("gruposPorCarne", () => {
  it("o caso real: quitou a 1/3 da venda e abateu R$ 34 da conta anterior", () => {
    const grupos = gruposPorCarne([
      aloc({}),
      aloc({ installment_id: "i2", number: 1, total_installments: 1, due_date: "2026-10-08", account_id: "acc-1", account_name: "conta anterior", from_sale: false, principal_paid: 34, status_after: "overdue" }),
    ]);
    expect(grupos.map((g) => [g.nome, g.total])).toEqual([["Venda no crediário", 166], ["conta anterior", 34]]);
    expect(grupos[0].linhas[0]).toEqual({ id: "i1", rotulo: "Parcela 1/3 · vence 06/08/26", valor: 166, quitou: true });
    expect(grupos[1].linhas[0]).toMatchObject({ rotulo: "Parcela 1/1 · vence 08/10/26", valor: 34, quitou: false });
  });

  it("parcelas do mesmo carnê ficam juntas, na ordem em que chegam, e os encargos entram no valor", () => {
    const grupos = gruposPorCarne([
      aloc({ installment_id: "a", account_id: "c1", account_name: "Carnê A", number: 1, principal_paid: 100, charges_paid: 2.5 }),
      aloc({ installment_id: "b", account_id: "c2", account_name: "Carnê B", number: 1, principal_paid: 50 }),
      aloc({ installment_id: "c", account_id: "c1", account_name: "Carnê A", number: 2, principal_paid: 30, status_after: "pending" }),
    ]);
    expect(grupos.map((g) => g.nome)).toEqual(["Carnê A", "Carnê B"]);
    expect(grupos[0].linhas.map((l) => l.id)).toEqual(["a", "c"]);
    expect(grupos[0].linhas[0].valor).toBe(102.5);
    expect(grupos[0].total).toBe(132.5);
  });

  it("sem carnê e sem venda é 'Conta geral'; lista vazia ou ausente não quebra", () => {
    expect(gruposPorCarne([aloc({ from_sale: false })])[0].nome).toBe("Conta geral");
    expect(gruposPorCarne([])).toEqual([]);
    expect(gruposPorCarne(null)).toEqual([]);
  });
});

describe("mudancasDoPagamento", () => {
  const original = { amount: 200, method: "pix", paidAt: "2026-09-26", customerId: "errada" };
  const igual = { amount: 200, method: "pix", paidAt: "2026-09-26", customerId: "errada" };
  const HOJE = "2026-10-08";

  it("manda só o que mudou", () => {
    expect(mudancasDoPagamento(original, { ...igual, amount: 20 }, HOJE)).toEqual({ corpo: { amount: 20 }, erro: null });
    expect(mudancasDoPagamento(original, { ...igual, customerId: "certa" }, HOJE)).toEqual({ corpo: { customer_id: "certa" }, erro: null });
    expect(mudancasDoPagamento(original, { ...igual, method: "dinheiro", paidAt: "2026-09-25" }, HOJE).corpo)
      .toEqual({ method: "dinheiro", paid_at: "2026-09-25" });
  });

  it("nada mudou: não salva", () => {
    expect(mudancasDoPagamento(original, igual, HOJE).erro).toBe("Nada foi alterado.");
  });

  it("recusa valor zero, data inválida, data futura e forma vazia", () => {
    expect(mudancasDoPagamento(original, { ...igual, amount: 0 }, HOJE).erro).toMatch(/maior que zero/);
    expect(mudancasDoPagamento(original, { ...igual, paidAt: null }, HOJE).erro).toMatch(/data do pagamento/);
    expect(mudancasDoPagamento(original, { ...igual, paidAt: "2026-10-09" }, HOJE).erro).toMatch(/futuro/);
    expect(mudancasDoPagamento(original, { ...igual, method: null }, HOJE).erro).toMatch(/forma/);
  });

  it("centavos: 199,999 e 200 são o mesmo valor", () => {
    expect(mudancasDoPagamento(original, { ...igual, amount: 199.999 }, HOJE).erro).toBe("Nada foi alterado.");
  });
});

describe("diaSP", () => {
  it("o meio-dia de SP do pagamento retroativo é o próprio dia; meia-noite UTC é a véspera", () => {
    expect(diaSP("2026-09-26T15:00:00Z")).toBe("2026-09-26");
    expect(diaSP("2026-09-26T01:00:00Z")).toBe("2026-09-25");
    expect(diaSP(null)).toBe("");
    expect(diaSP("x")).toBe("");
  });
});
