// Simulação de parcelas do crediário no PDV (15/09/2026).
// Venda nº 175 da empresa "Aura": 1º vencimento 15/10/2026 aparecia como
// 14/10, 14/11, 14/12 na tabela SIMULAÇÃO; o banco gravou 15/10, 15/11, 15/12.
//
// O bug só aparece a oeste de UTC. O fuso vem do jest.config.js
// (America/Sao_Paulo) — process.env.TZ dentro do teste não pega no sandbox.
import {
  formatDueDateBr,
  isoDateToLocal,
  localDateToIso,
  simulateInstallments,
} from "../utils/creditSimulation";

const datas = (total: number, n: number, first: string) =>
  simulateInstallments(total, n, first).map((p) => [p.date, p.dateBr]);

describe("fuso do teste", () => {
  it("roda num fuso onde meia-noite UTC ainda é o dia anterior", () => {
    expect(new Date("2026-10-15").getDate()).toBe(14);
  });
});

describe("simulateInstallments — datas", () => {
  it("1º vencimento 15/10/2026 mostra 15/10, 15/11 e 15/12 (venda 175)", () => {
    expect(datas(300, 3, "2026-10-15")).toEqual([
      ["2026-10-15", "15/10/26"],
      ["2026-11-15", "15/11/26"],
      ["2026-12-15", "15/12/26"],
    ]);
  });

  it("vira o ano", () => {
    expect(datas(400, 4, "2026-11-10")).toEqual([
      ["2026-11-10", "10/11/26"],
      ["2026-12-10", "10/12/26"],
      ["2027-01-10", "10/01/27"],
      ["2027-02-10", "10/02/27"],
    ]);
  });

  it("dia 1º de janeiro não recua para dezembro do ano anterior", () => {
    expect(datas(100, 1, "2027-01-01")).toEqual([["2027-01-01", "01/01/27"]]);
  });

  it("dia 31 avança como o backend (setMonth): mês curto rola para o seguinte", () => {
    // terms.js dueDateForIndex: 31/01 + 1 mês = 03/03 (fev/2027 tem 28 dias).
    expect(datas(500, 5, "2027-01-31")).toEqual([
      ["2027-01-31", "31/01/27"],
      ["2027-03-03", "03/03/27"],
      ["2027-03-31", "31/03/27"],
      ["2027-05-01", "01/05/27"],
      ["2027-05-31", "31/05/27"],
    ]);
  });

  it("dia 31 de dezembro vira o ano", () => {
    expect(datas(200, 2, "2026-12-31")).toEqual([
      ["2026-12-31", "31/12/26"],
      ["2027-01-31", "31/01/27"],
    ]);
  });
});

describe("simulateInstallments — valores", () => {
  it("trunca a base em centavos e põe a sobra na última parcela", () => {
    const p = simulateInstallments(100, 3, "2026-10-15");
    expect(p.map((x) => x.num)).toEqual([1, 2, 3]);
    expect(p[0].amount).toBe(33.33);
    expect(p[1].amount).toBe(33.33);
    expect(p[2].amount).toBeCloseTo(33.34, 10);
  });

  it("sem total, sem parcelas ou sem data não simula", () => {
    expect(simulateInstallments(0, 3, "2026-10-15")).toEqual([]);
    expect(simulateInstallments(100, 0, "2026-10-15")).toEqual([]);
    expect(simulateInstallments(100, 3, null)).toEqual([]);
    expect(simulateInstallments(100, 3, "15/10/2026")).toEqual([]);
  });
});

describe("helpers de data", () => {
  it("isoDateToLocal lê o dia no calendário local e recusa data inexistente", () => {
    const d = isoDateToLocal("2026-10-15")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 15]);
    expect(isoDateToLocal("2027-02-31")).toBeNull();
    expect(isoDateToLocal("")).toBeNull();
  });

  it("localDateToIso não passa por UTC", () => {
    // 22h em SP já é o dia seguinte em UTC; toISOString daria 2026-09-16.
    expect(localDateToIso(new Date(2026, 8, 15, 22, 0))).toBe("2026-09-15");
  });

  it("formatDueDateBr mostra o due_date 'YYYY-MM-DD' do backend no dia certo", () => {
    expect(formatDueDateBr("2026-10-15")).toBe("15/10/26");
    expect(formatDueDateBr(new Date(2026, 9, 15, 12))).toBe("15/10/26");
    expect(formatDueDateBr(null)).toBe("—");
    expect(formatDueDateBr("lixo")).toBe("—");
  });
});
