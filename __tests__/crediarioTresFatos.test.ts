// ============================================================
// Os três fatos do alto da ficha do crediário (F4, 23/11/2026)
// utils/crediarioTresFatos — textos aprovados no mockup do Caio.
// ============================================================
import {
  datasDasPagas, fatoFaltaPagar, fatoOQueVemAgora, fatoPodeComprarMais, fraseDoScore, valorDeHoje,
} from "@/utils/crediarioTresFatos";
import { fmt } from "@/components/crediario/ficha/fichaHelpers";

const HOJE = "2026-11-21";

describe("fraseDoScore", () => {
  test("frase no lugar do número", () => {
    expect(fraseDoScore("premium")).toBe("Paga sempre em dia");
    expect(fraseDoScore("bom")).toBe("Paga em dia");
    expect(fraseDoScore("regular")).toBe("Às vezes atrasa");
    expect(fraseDoScore("restrito")).toBe("Atrasa bastante");
    expect(fraseDoScore(null)).toBeNull();
    expect(fraseDoScore("xyz")).toBeNull();
  });
});

describe("Falta pagar", () => {
  test("deve: valor e quantas compras", () => {
    expect(fatoFaltaPagar({ saldo: 570.66, comprasEmAberto: 2, fmt })).toEqual({
      titulo: "Falta pagar", valor: "R$ 570,66", detalhe: "2 compras em aberto", tom: "deve",
    });
    expect(fatoFaltaPagar({ saldo: 180, comprasEmAberto: 1, fmt }).detalhe).toBe("1 compra em aberto");
  });
  test("crédito na loja", () => {
    const f = fatoFaltaPagar({ saldo: -59.9, comprasEmAberto: 0, fmt });
    expect(f.titulo).toBe("Tem crédito na loja");
    expect(f.valor).toBe("R$ 59,90");
    expect(f.tom).toBe("credito");
  });
  test("zerado", () => {
    expect(fatoFaltaPagar({ saldo: 0, comprasEmAberto: 0, fmt }).detalhe).toBe("nada em aberto");
  });
});

describe("O que vem agora", () => {
  test("uma atrasada: valor com multa e juros, desde quando", () => {
    const f = fatoOQueVemAgora({
      atrasadas: [{ due_date: "2026-11-02", remaining: 80, total_due: 82.11, days_late: 19 }],
      proxima: { due_date: "2026-12-02", remaining: 80 }, saldo: 570.66, hoje: HOJE, fmt,
    });
    // com encargos, a frase diz quanto é multa e juros (R$ 82,11 > R$ 80,00)
    expect(f).toEqual({
      titulo: "Atrasado", valor: "R$ 82,11",
      detalhe: "com R$ 2,11 de multa e juros · 1 parcela · venceu 02/11, há 19 dias", atrasado: true,
    });
    const semEncargos = fatoOQueVemAgora({
      atrasadas: [{ due_date: "2026-11-02", remaining: 80, days_late: 19 }], proxima: null, saldo: 80, hoje: HOJE, fmt,
    });
    expect(semEncargos.detalhe).toBe("1 parcela · venceu 02/11, há 19 dias");
  });
  test("várias atrasadas: soma e a mais antiga", () => {
    const f = fatoOQueVemAgora({
      atrasadas: [
        { due_date: "2026-11-18", remaining: 206.75, total_due: 210.53, days_late: 3 },
        { due_date: "2026-10-18", remaining: 206.75, total_due: 216.27, days_late: 34 },
      ],
      proxima: null, saldo: 1240.5, hoje: HOJE, fmt,
    });
    expect(f.valor).toBe("R$ 426,80");
    expect(f.detalhe).toBe("com R$ 13,30 de multa e juros · 2 parcelas · a mais antiga venceu 18/10, há 34 dias");
  });
  test("sem dias do backend: conta pela data", () => {
    const f = fatoOQueVemAgora({ atrasadas: [{ due_date: "2026-11-20", remaining: 10 }], proxima: null, saldo: 10, hoje: HOJE, fmt });
    expect(f.detalhe).toBe("1 parcela · venceu 20/11, há 1 dia");
  });
  test("em dia: a próxima parcela", () => {
    const f = fatoOQueVemAgora({ atrasadas: [], proxima: { due_date: "2026-12-20", remaining: 205.32 }, saldo: 410.66, hoje: HOJE, fmt });
    expect(f).toEqual({ titulo: "Próxima parcela", valor: "R$ 205,32", detalhe: "vence 20/12", atrasado: false });
    expect(fatoOQueVemAgora({ atrasadas: [], proxima: { due_date: HOJE, remaining: 5 }, saldo: 5, hoje: HOJE, fmt }).detalhe).toBe("vence hoje");
    expect(fatoOQueVemAgora({ atrasadas: [], proxima: { due_date: "2027-01-20", remaining: 5 }, saldo: 5, hoje: HOJE, fmt }).detalhe).toBe("vence 20/01/27");
  });
  test("vencida dentro da carência: 'venceu', nunca 'vence' com data passada", () => {
    const f = fatoOQueVemAgora({ atrasadas: [], proxima: { due_date: "2026-11-19", remaining: 50, total_due: 51 }, saldo: 50, hoje: HOJE, fmt });
    expect(f.detalhe).toBe("venceu 19/11");
    // e sem encargos: não está em atraso
    expect(f.valor).toBe("R$ 50,00");
  });
  test("só parcelas a conferir", () => {
    expect(fatoOQueVemAgora({ atrasadas: [], proxima: null, aConferir: 2, saldo: 300, hoje: HOJE, fmt })).toEqual({
      titulo: "O que vem agora", valor: "Parcelas a conferir", detalhe: "veja o aviso abaixo", atrasado: false,
    });
  });
  test("compras sem carnê, sem parcela", () => {
    expect(fatoOQueVemAgora({ atrasadas: [], proxima: null, saldo: 180, hoje: HOJE, fmt })).toEqual({
      titulo: "Próxima parcela", valor: "Sem data marcada", detalhe: "compras sem carnê: receba quando ela pagar", atrasado: false,
    });
  });
  test("nada a vencer", () => {
    expect(fatoOQueVemAgora({ atrasadas: [], proxima: null, saldo: 0, hoje: HOJE, fmt }).valor).toBe("Nada a vencer");
  });
});

describe("Pode comprar mais", () => {
  test("com limite: quanto ainda cabe, o limite e a frase do score", () => {
    expect(fatoPodeComprarMais({ limite: 1000, usado: 570.66, disponivel: 429.34, scoreLabel: "regular", fmt })).toEqual({
      titulo: "Pode comprar mais", valor: "R$ 429,34", detalhe: "limite de R$ 1.000,00 · às vezes atrasa", tom: "ok",
    });
  });
  test("sem limite (0 é sem limite no backend)", () => {
    expect(fatoPodeComprarMais({ limite: 0, usado: 300, scoreLabel: "bom", fmt })).toEqual({
      titulo: "Limite", valor: "Sem limite definido", detalhe: "Paga em dia", tom: "sem",
    });
  });
  test("passou do limite: nunca negativo", () => {
    const f = fatoPodeComprarMais({ limite: 1000, usado: 1120, disponivel: -120, scoreLabel: null, fmt });
    expect(f).toEqual({ titulo: "Passou do limite", valor: "R$ 120,00", detalhe: "limite de R$ 1.000,00", tom: "passou" });
  });
});

describe("apoio", () => {
  test("valorDeHoje: encargos só quando atrasada (mesma regra da linha)", () => {
    expect(valorDeHoje({ due_date: "x", remaining: 80, total_due: 82.11, is_overdue: true })).toBe(82.11);
    expect(valorDeHoje({ due_date: "x", remaining: 80, total_due: 82.11, is_overdue: false })).toBe(80);
    expect(valorDeHoje({ due_date: "x", remaining: 80, total_due: 82.11 }, true)).toBe(82.11);
    expect(valorDeHoje({ due_date: "x", remaining: 80, charges_total: 3 }, true)).toBe(83);
    expect(valorDeHoje({ due_date: "x", amount_due: 100, covered_amount: 30 })).toBe(70);
  });
  test("datasDasPagas", () => {
    expect(datasDasPagas(["20/11"])).toBe("20/11");
    expect(datasDasPagas(["01/09", "05/10"])).toBe("01/09 e 05/10");
    expect(datasDasPagas(["01/09", "05/10", "05/11"])).toBe("01/09, 05/10 e 05/11");
    expect(datasDasPagas(["a", "b", "c", "05/12"])).toBe("a última em 05/12");
    expect(datasDasPagas([])).toBe("");
  });
});
