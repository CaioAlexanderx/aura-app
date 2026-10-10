// ============================================================
// Crediário · cartão do carnê: derivação (10/10/2026, Aura-backend#803)
//
//   - "falta" é o remaining, NÃO o balance (que não desconta recebimento
//     livre); sem remaining (backend antigo) cai no balance;
//   - progresso e "N de M pagas" vêm de paid_count/total_count;
//   - quitado = não falta nada (e não há parcela viva);
//   - venda 1x/fiado: saldo sem parcela, sem barra de progresso;
//   - backend antigo: nome, saldo e parcelas — sem quebrar;
//   - grupo sem carnê vira "Compras anteriores", com as compras por compra;
//   - parcela órfã nunca some da ficha.
// ============================================================
import { derivarCarne, organizarCarnes, diaMes, NOME_SEM_CARNE } from "@/utils/crediarioCarne";

const parcela = (over: Record<string, any> = {}) => ({
  id: "p-" + Math.random().toString(36).slice(2, 7),
  account_id: "c1", due_date: "2026-11-10", amount_due: 70, covered_amount: 0, is_overdue: false,
  ...over,
});

const CARNE = {
  id: "c1", name: "Compra de 13/09", balance: 280, overdue: false, next_due_date: "2026-11-10",
  purchases: [
    { date: "2026-09-13T15:00:00Z", description: "Vans Hylane 40/41", quantity: 1, amount: 120, manual: false },
    { date: "2026-09-13T15:00:00Z", description: "Slide Alta 40/41", quantity: 2, amount: 160, manual: false },
  ],
  purchases_total: 280, total_amount: 280, refunded_total: 0,
  total_count: 4, paid_count: 2,
  paid_installments: [
    { id: "pg2", installment_number: 2, total_installments: 4, due_date: "2026-10-10", paid_at: "2026-10-08T14:00:00Z", amount: 70 },
    { id: "pg1", installment_number: 1, total_installments: 4, due_date: "2026-09-13", paid_at: "2026-09-13T15:00:00Z", amount: 70 },
  ],
  open_remaining: 140, unscheduled: 0, remaining: 140,
};

describe("derivarCarne — backend novo", () => {
  const abertas = [parcela({ id: "a4", due_date: "2026-12-10" }), parcela({ id: "a3", due_date: "2026-11-10" })];
  const c = derivarCarne(CARNE, abertas);

  it("falta é o remaining, não o balance", () => {
    expect(c.falta).toBe(140);
    expect(c.quitado).toBe(false);
  });

  it("progresso e resumo vêm de paid_count/total_count", () => {
    expect(c.progresso).toBe(0.5);
    expect(c.resumo).toBe("2 de 4 pagas · próx. 10/11");
  });

  it("itens numa linha, com quantidade; abertos, uma linha por item e o total", () => {
    expect(c.itensResumo).toBe("Vans Hylane 40/41 · 2× Slide Alta 40/41");
    expect(c.compras).toEqual([
      { rotulo: "Vans Hylane 40/41", valor: 120 },
      { rotulo: "2× Slide Alta 40/41", valor: 160 },
    ]);
    expect(c.comprasTotal).toBe(280);
  });

  it("parcelas pagas em ordem de número; abertas em ordem de vencimento", () => {
    expect(c.parcelasPagas.map(p => p.id)).toEqual(["pg1", "pg2"]);
    expect(c.parcelasAbertas.map(p => p.id)).toEqual(["a3", "a4"]);
    expect(c.somaParcelas).toBe(140);
  });

  it("atraso: overdue do carnê OU a regra única numa parcela", () => {
    expect(c.atrasado).toBe(false);
    expect(derivarCarne({ ...CARNE, overdue: true }, abertas).atrasado).toBe(true);
    const comVencida = derivarCarne(CARNE, [parcela({ due_date: "2026-10-05", is_overdue: true }), ...abertas]);
    expect(comVencida.atrasado).toBe(true);
    expect(comVencida.resumo).toBe("2 de 4 pagas · venceu 05/10");
  });

  it("a regra de atraso é a injetada (utils/creditOverdue na tela)", () => {
    const regra = jest.fn(() => true);
    expect(derivarCarne(CARNE, abertas, regra).atrasado).toBe(true);
    expect(regra).toHaveBeenCalled();
  });

  it("uma parcela só: 'paga' no singular", () => {
    const um = derivarCarne({ ...CARNE, total_count: 1, paid_count: 0, remaining: 85 }, [parcela({ due_date: "2026-11-02" })]);
    expect(um.resumo).toBe("0 de 1 paga · próx. 02/11");
    expect(um.progresso).toBe(0);
  });
});

describe("derivarCarne — quitado, fiado, vazio", () => {
  it("quitado: remaining <= 0 e nenhuma parcela aberta", () => {
    const q = derivarCarne({ ...CARNE, remaining: 0, paid_count: 4, balance: 0 }, []);
    expect(q.quitado).toBe(true);
    expect(q.atrasado).toBe(false);
    expect(q.valorOriginal).toBe(280);
  });

  it("balance alto com remaining zerado continua quitado (recebimento livre)", () => {
    expect(derivarCarne({ ...CARNE, remaining: 0, paid_count: 4, balance: 140 }, []).quitado).toBe(true);
  });

  it("saldo zerado com parcela viva NÃO vai para quitados", () => {
    const d = derivarCarne({ ...CARNE, remaining: 0 }, [parcela()]);
    expect(d.quitado).toBe(false);
  });

  it("venda 1x/fiado: total_count 0 e remaining > 0 — sem barra, com aviso", () => {
    const f = derivarCarne({ ...CARNE, total_count: 0, paid_count: 0, paid_installments: [], remaining: 220, balance: 220 }, []);
    expect(f.semParcelas).toBe(true);
    expect(f.progresso).toBeNull();
    expect(f.resumo).toBe("sem parcelas — à vista no crediário");
    expect(f.falta).toBe(220);
    expect(f.quitado).toBe(false);
  });

  it("carnê criado à mão e ainda vazio não é 'quitado'", () => {
    const v = derivarCarne({ id: "c9", name: "Reforma", balance: 0, remaining: 0, total_count: 0, paid_count: 0, purchases: [] }, []);
    expect(v.vazio).toBe(true);
    expect(v.quitado).toBe(false);
    expect(v.resumo).toBe("Sem lançamentos");
  });
});

describe("derivarCarne — backend antigo (sem os campos novos)", () => {
  const ANTIGO = { id: "c1", name: "Carnê da Maria", balance: 210, overdue: false, next_due_date: "2026-11-10" };

  it("degrada para nome, saldo e parcelas", () => {
    const c = derivarCarne(ANTIGO, [parcela(), parcela({ due_date: "2026-12-10" }), parcela({ due_date: "2027-01-10" })]);
    expect(c.temCamposNovos).toBe(false);
    expect(c.nome).toBe("Carnê da Maria");
    expect(c.falta).toBe(210);
    expect(c.progresso).toBeNull();
    expect(c.pagas).toBeNull();
    expect(c.itensResumo).toBe("");
    expect(c.compras).toEqual([]);
    expect(c.comprasTotal).toBeNull();
    expect(c.parcelasPagas).toEqual([]);
    expect(c.resumo).toBe("3 parcelas em aberto · próx. 10/11");
  });

  it("saldo zerado sem campos novos fica na lista (não dá para saber se foi pago)", () => {
    const c = derivarCarne({ ...ANTIGO, balance: 0 }, []);
    expect(c.quitado).toBe(false);
    expect(c.vazio).toBe(true);
  });

  it("fiado antigo: saldo sem parcela", () => {
    const c = derivarCarne(ANTIGO, []);
    expect(c.semParcelas).toBe(true);
    expect(c.resumo).toBe("sem parcelas — à vista no crediário");
  });
});

describe("grupo sem carnê — Compras anteriores", () => {
  const GERAL = {
    id: null, name: "Conta geral", balance: 425, remaining: 425, total_count: 1, paid_count: 0,
    purchases: [
      { date: "2026-09-13T15:00:00Z", description: "Slide Asuna 42/43", quantity: 1, amount: 85 },
      { date: "2026-09-13T15:00:00Z", description: "Slide Alta 38/39", quantity: 1, amount: 80 },
      { date: "2026-09-13T18:30:00Z", description: "Slide Asuna 40/41", quantity: 1, amount: 160 },
      { date: "2026-09-02T12:00:00Z", description: "", quantity: 1, amount: 20, manual: true },
    ],
    purchases_total: 345,
  };
  const c = derivarCarne(GERAL, [parcela({ account_id: null, due_date: "2026-10-10", amount_due: 425 })]);

  it("tem nome próprio e é marcado como sem carnê", () => {
    expect(c.nome).toBe(NOME_SEM_CARNE);
    expect(c.semCarne).toBe(true);
    expect(c.key).toBe("general");
    expect(c.id).toBeNull();
  });

  it("lista por COMPRA: itens da mesma venda numa linha, com a data", () => {
    expect(c.compras).toEqual([
      { rotulo: "13/09 · Slide Asuna 42/43, Slide Alta 38/39", valor: 165 },
      { rotulo: "13/09 · Slide Asuna 40/41", valor: 160 },
      { rotulo: "02/09 · Lançamento manual", valor: 20 },
    ]);
    expect(c.itensResumo).toBe("3 compras de antes dos carnês por compra");
    expect(c.resumo).toBe("0 de 1 paga · próx. 10/10");
  });
});

describe("organizarCarnes", () => {
  it("separa abertos de quitados e deixa Compras anteriores por último", () => {
    const { abertos, quitados } = organizarCarnes(
      [
        { id: null, name: "Conta geral", balance: 50, remaining: 50, total_count: 0, paid_count: 0, purchases: [] },
        { ...CARNE },
        { ...CARNE, id: "c2", name: "Compra de 02/08", remaining: 0, paid_count: 4 },
      ],
      [parcela({ account_id: "c1" })],
    );
    expect(abertos.map(c => c.nome)).toEqual(["Compra de 13/09", NOME_SEM_CARNE]);
    expect(quitados.map(c => c.nome)).toEqual(["Compra de 02/08"]);
    expect(abertos[0].parcelasAbertas).toHaveLength(1);
  });

  it("parcela órfã (sem carnê na lista) vira o cartão Compras anteriores", () => {
    const { abertos } = organizarCarnes(
      [{ id: "c1", name: "Carnê", balance: 70 }],
      [parcela({ account_id: "c1" }), parcela({ account_id: null, amount_due: 30 }), parcela({ account_id: "sumiu", amount_due: 20 })],
    );
    expect(abertos).toHaveLength(2);
    const geral = abertos[1];
    expect(geral.semCarne).toBe(true);
    expect(geral.parcelasAbertas).toHaveLength(2);
    expect(geral.falta).toBe(50);
  });

  it("conta geral zerada do backend antigo não vira cartão vazio", () => {
    const { abertos } = organizarCarnes(
      [{ id: "c1", name: "Carnê", balance: 70 }, { id: null, name: "Conta geral", balance: 0 }],
      [parcela({ account_id: "c1" })],
    );
    expect(abertos.map(c => c.key)).toEqual(["c1"]);
  });
});

describe("diaMes", () => {
  it("data pura é dia de calendário (sem D-1)", () => {
    expect(diaMes("2026-08-03")).toBe("03/08");
    expect(diaMes("2026-08-03T00:00:00.000Z")).toBe("03/08");
  });
  it("timestamp vai para o fuso de São Paulo", () => {
    expect(diaMes("2026-10-06T01:30:00Z")).toBe("05/10");
  });
  it("vazio ou inválido não quebra", () => {
    expect(diaMes(null)).toBe("");
    expect(diaMes("ontem")).toBe("");
  });
});
