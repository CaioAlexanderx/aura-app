// Rótulo das parcelas no painel "Pagamento registrado" e na prévia (15/09/2026).
// No QA, a 1/1 de uma venda e a 1/3 de outra apareciam as duas como "Parcela 1".
import { installmentLabel, calendarDateBr } from "../utils/creditInstallmentLabel";

describe("installmentLabel", () => {
  it("mostra número, total e vencimento", () => {
    expect(installmentLabel({ number: 1, total_installments: 3, due_date: "2026-10-15" }))
      .toBe("Parcela 1/3 · vence 15/10/26");
  });

  it("distingue a 1/1 de uma venda da 1/3 de outra", () => {
    const a = installmentLabel({ number: 1, total_installments: 1, due_date: "2026-09-22" });
    const b = installmentLabel({ number: 1, total_installments: 3, due_date: "2026-10-15" });
    expect(a).not.toBe(b);
  });

  it("backend antigo, sem total nem vencimento, mantém o rótulo de antes", () => {
    expect(installmentLabel({ number: 2 })).toBe("Parcela 2");
  });

  it("sem número não inventa '?'", () => {
    expect(installmentLabel({ number: null, total_installments: 3 })).toBe("Parcela");
  });

  it("vencimento inválido é omitido em vez de quebrar", () => {
    expect(installmentLabel({ number: 1, total_installments: 2, due_date: "lixo" })).toBe("Parcela 1/2");
  });
});

describe("calendarDateBr", () => {
  it("formata data pura sem mexer em fuso", () => {
    expect(calendarDateBr("2026-10-15")).toBe("15/10/26");
  });

  it("meia-noite UTC do driver continua sendo o mesmo dia", () => {
    expect(calendarDateBr("2026-10-15T00:00:00.000Z")).toBe("15/10/26");
  });

  it("timestamp com hora não é data de calendário", () => {
    expect(calendarDateBr("2026-10-15T14:30:00.000Z")).toBe("");
  });

  it("vazio devolve vazio", () => {
    expect(calendarDateBr(null)).toBe("");
    expect(calendarDateBr("")).toBe("");
  });
});
