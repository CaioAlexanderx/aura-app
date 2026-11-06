// ============================================================
// "Editar lançamento" não pode mudar o dia da venda (06/11/2026)
//
// Esquina da Make, venda 527: trocar só a forma de pagamento levava a venda
// para o dia anterior. O que este arquivo trava:
//   1. o vencimento abre no MESMO dia, venha como "AAAA-MM-DD" ou como
//      meia-noite UTC, em qualquer fuso do aparelho;
//   2. sem vencimento, vale o dia em Brasília em que o lançamento nasceu;
//   3. numa edição, o due_date só vai no PATCH se a data do campo mudou;
//   4. o modal usa estas regras (e não o isoToBR antigo) para abrir e salvar.
// ============================================================
import * as fs from "fs";
import * as path from "path";
import { dataInicialDoLancamento, momentoParaBR, vencimentoDoPatch, vencimentoParaBR } from "@/utils/dataDoLancamento";

describe("o dia que o campo abre", () => {
  it("vencimento como data pura ou como meia-noite UTC: o mesmo dia", () => {
    expect(vencimentoParaBR("2026-11-06")).toBe("06/11/2026");
    expect(vencimentoParaBR("2026-11-06T00:00:00.000Z")).toBe("06/11/2026");
    expect(vencimentoParaBR("2026-11-06T03:00:00.000Z")).toBe("06/11/2026");
  });
  it("lixo não vira data", () => {
    expect(vencimentoParaBR(null)).toBeNull();
    expect(vencimentoParaBR("ontem")).toBeNull();
  });
  it("sem vencimento: o dia em Brasília do momento em que nasceu", () => {
    // 01:30 UTC de 07/11 = 22:30 de 06/11 em Brasília
    expect(momentoParaBR("2026-11-07T01:30:00.000Z")).toBe("06/11/2026");
    expect(dataInicialDoLancamento({ due_date: null, created_at: "2026-11-07T01:30:00.000Z" })).toBe("06/11/2026");
  });
  it("o vencimento vence o created_at", () => {
    expect(dataInicialDoLancamento({ due_date: "2026-11-06T00:00:00.000Z", created_at: "2026-11-07T19:00:00.000Z" })).toBe("06/11/2026");
  });
});

describe("o due_date do PATCH", () => {
  it("data igual à que abriu: não vai (o backend não mexe na venda)", () => {
    expect(vencimentoDoPatch("06/11/2026", "06/11/2026", "2026-11-06")).toBeUndefined();
  });
  it("data mudada: vai", () => {
    expect(vencimentoDoPatch("04/11/2026", "06/11/2026", "2026-11-04")).toBe("2026-11-04");
  });
  it("campo vazio: não vai", () => {
    expect(vencimentoDoPatch("", "06/11/2026", undefined)).toBeUndefined();
  });
});

describe("o modal", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "components", "screens", "financeiro", "TransactionModal.tsx"), "utf8");
  it("abre com dataInicialDoLancamento e guarda a data com que abriu", () => {
    expect(src).toMatch(/var abriu = dataInicialDoLancamento\(editTransaction as any\);/);
    expect(src).toMatch(/setDataQueAbriu\(abriu \|\| ""\);/);
    expect(src).not.toMatch(/setDateStr\(isoToBR\(raw\)\)/);
  });
  it("na edição, o due_date passa por vencimentoDoPatch", () => {
    expect(src).toMatch(/due_date: vencimentoDoPatch\(dateStr, dataQueAbriu, dueDate\)/);
  });
});

describe("a forma de pagamento no PATCH", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "components", "screens", "financeiro", "TransactionModal.tsx"), "utf8");
  it("campo vazio e lançamento sem forma são a mesma coisa: não manda null", () => {
    expect(src).toMatch(/if \(\(unitPayment \|\| null\) !== \(prevPay \|\| null\)\) patchBody\.payment_method = unitPayment \|\| null;/);
    expect(src).not.toMatch(/if \(unitPayment !== prevPay\)/);
  });
});
