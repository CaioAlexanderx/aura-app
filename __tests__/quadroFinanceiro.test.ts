// Quadro do Financeiro (28/09/2026) — regras puras: quais movimentos existem,
// selos de prazo, meses e a atualização otimista do cache.
import {
  aplicarMovimento, diasEntre, mesDeOrigem, motivoDoBloqueio, movimento, nomeDoMes,
  rotulos, seloDoPrazo, somarMes, corpoDoMovimento, type CartaoQuadro, type Quadro,
} from "@/utils/quadroFinanceiro";

function cartao(over: Partial<CartaoQuadro>): CartaoQuadro {
  return {
    id: "x", description: "Encomenda", category: "Vendas", amount: 100, status: "pending",
    date: "2026-09-30", due_date: "2026-09-30", paid_at: null, payment_method: null, notes: null,
    employee_name: null, recurrence_type: null, recurrence_index: null, movable: true, ...over,
  };
}

function quadro(): Quadro {
  return {
    type: "income", month: "2026-09", today: "2026-09-28", limit_per_column: 150,
    columns: {
      atrasado: { total: 97.5, count: 1, items: [cartao({ id: "a", amount: 97.5, date: "2026-08-30" })] },
      aberto: { total: 432, count: 1, items: [cartao({ id: "b", amount: 432, date: "2026-09-30" })] },
      feito: { total: 1534.7, count: 10, items: [cartao({ id: "c", amount: 250, status: "confirmed", date: "2026-09-05", paid_at: "2026-09-05T03:00:00.000Z" })], grupos: [{ date: "2026-09-27", origem: "caixa", count: 9, total: 1284.7 }] },
    },
  };
}

describe("movimento / motivoDoBloqueio", () => {
  it("só existem baixa, nova data e desfazer", () => {
    expect(movimento("aberto", "feito")).toBe("baixa");
    expect(movimento("atrasado", "feito")).toBe("baixa");
    expect(movimento("atrasado", "aberto")).toBe("nova_data");
    expect(movimento("feito", "aberto")).toBe("desfazer");
    expect(movimento("aberto", "atrasado")).toBeNull();
    expect(movimento("feito", "atrasado")).toBeNull();
    expect(movimento("aberto", "aberto")).toBeNull();
  });

  it("arrastar para Atrasado explica que é pela data", () => {
    expect(motivoDoBloqueio("aberto", "atrasado", true)).toMatch(/pela data de vencimento/);
  });

  it("lançamento que veio de outro fluxo não se move", () => {
    expect(motivoDoBloqueio("feito", "aberto", false)).toMatch(/muda por lá/);
    expect(motivoDoBloqueio("aberto", "feito", true)).toBeNull();
  });
});

describe("rótulos por tipo", () => {
  it("receitas: A receber / Recebido; despesas: A pagar / Pago", () => {
    expect(rotulos("income")).toMatchObject({ aberto: "A receber", feito: "Recebido", acao: "Recebi" });
    expect(rotulos("expense")).toMatchObject({ aberto: "A pagar", feito: "Pago", acao: "Paguei" });
  });
});

describe("prazos e meses", () => {
  it("diasEntre ignora fuso e horário de verão", () => {
    expect(diasEntre("2026-08-30", "2026-09-28")).toBe(29);
    expect(diasEntre("2026-09-28", "2026-09-28")).toBe(0);
  });

  it("seloDoPrazo", () => {
    expect(seloDoPrazo({ date: "2026-09-23" }, "atrasado", "2026-09-28")).toEqual({ texto: "Venceu há 5 dias", tom: "atraso" });
    expect(seloDoPrazo({ date: "2026-09-27" }, "atrasado", "2026-09-28")!.texto).toBe("Venceu há 1 dia");
    expect(seloDoPrazo({ date: "2026-09-28" }, "aberto", "2026-09-28")!.texto).toBe("Vence hoje");
    expect(seloDoPrazo({ date: "2026-09-29" }, "aberto", "2026-09-28")!.texto).toBe("Vence amanhã");
    expect(seloDoPrazo({ date: "2026-10-01" }, "aberto", "2026-09-28")).toEqual({ texto: "Vence em 3 dias", tom: "breve" });
    expect(seloDoPrazo({ date: "2026-10-10" }, "aberto", "2026-09-28")).toEqual({ texto: "Vence 10/10", tom: "neutro" });
    expect(seloDoPrazo({ date: "2026-09-05" }, "feito", "2026-09-28")).toBeNull();
  });

  it("somarMes vira o ano nos dois sentidos", () => {
    expect(somarMes("2026-12", 1)).toBe("2027-01");
    expect(somarMes("2026-01", -1)).toBe("2025-12");
    expect(somarMes("2026-09", 0)).toBe("2026-09");
  });

  it("nomeDoMes e mesDeOrigem", () => {
    expect(nomeDoMes("2026-09")).toBe("Setembro 2026");
    expect(mesDeOrigem({ date: "2026-08-30" }, "2026-09")).toBe("de agosto");
    expect(mesDeOrigem({ date: "2026-09-02" }, "2026-09")).toBeNull();
  });
});

describe("aplicarMovimento (otimista)", () => {
  it("baixa leva o cartão para Recebido com data e forma, e acerta os totais", () => {
    const q = aplicarMovimento(quadro(), "b", "baixa", { data: "2026-09-27", forma: "pix" });
    expect(q.columns.aberto.items).toHaveLength(0);
    expect(q.columns.aberto).toMatchObject({ count: 0, total: 0 });
    expect(q.columns.feito.items[0]).toMatchObject({ id: "b", status: "confirmed", payment_method: "pix", paid_at: "2026-09-27T03:00:00.000Z" });
    expect(q.columns.feito).toMatchObject({ count: 11, total: 1966.7 });
  });

  it("desfazer de algo já vencido cai em Atrasado; do futuro, em A receber", () => {
    const q = aplicarMovimento(quadro(), "c", "desfazer", {});
    expect(q.columns.atrasado.items.map((c) => c.id)).toContain("c");
    expect(q.columns.atrasado.items.find((c) => c.id === "c")).toMatchObject({ status: "pending", paid_at: null });
  });

  it("nova data tira do Atrasado", () => {
    const q = aplicarMovimento(quadro(), "a", "nova_data", { data: "2026-10-05" });
    expect(q.columns.atrasado.items).toHaveLength(0);
    expect(q.columns.aberto.items[0]).toMatchObject({ id: "a", date: "2026-10-05", due_date: "2026-10-05" });
  });

  it("id que não está no quadro não mexe em nada", () => {
    const antes = quadro();
    expect(aplicarMovimento(antes, "zzz", "baixa", {})).toBe(antes);
  });
});

describe("corpoDoMovimento (PATCH)", () => {
  it("baixa manda status, data e forma; desfazer só o status; nova data só o vencimento", () => {
    expect(corpoDoMovimento({ id: "b", mov: "baixa", data: "2026-09-27", forma: "pix" })).toEqual({ status: "confirmed", paid_at: "2026-09-27", payment_method: "pix" });
    expect(corpoDoMovimento({ id: "c", mov: "desfazer" })).toEqual({ status: "pending" });
    expect(corpoDoMovimento({ id: "a", mov: "nova_data", data: "2026-10-05" })).toEqual({ due_date: "2026-10-05" });
  });
});
