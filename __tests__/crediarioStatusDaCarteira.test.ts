// Situação da linha do Crediário (08/10/2026, Valen).
//
// Três clientes com o débito apagado do razão (saldo R$0,00 ou negativo) e
// parcela aberta apareciam com a pill vermelha "Em atraso". O backend parou
// de chamar isso de atraso (Aura-backend, regra única, condição 5) e manda
// overdue=false + ledger_mismatch=true; a tela precisa de um terceiro estado:
// "Conferir" — nem vermelho (não há dívida) nem verde (há parcela solta).
import { isCustomerOverdue, statusDaCarteira } from "../utils/creditOverdue";

const base = { id: "c1", name: "kaio roy", balance: 0, open_installments: 734, ledger_mismatch: true };

describe("statusDaCarteira", () => {
  it("parcela aberta sem dívida no razão: 'conferir', nunca 'atraso'", () => {
    expect(statusDaCarteira({ ...base, overdue: false })).toBe("conferir");
    expect(statusDaCarteira({ ...base, balance: -200, overdue: false })).toBe("conferir");
  });

  it("o backend manda; se ele disser atraso, é atraso", () => {
    expect(statusDaCarteira({ ...base, overdue: true })).toBe("atraso");
  });

  it("com dívida no razão e divergência (carnê duplicado), a regra de sempre vale", () => {
    expect(statusDaCarteira({ balance: 515, open_installments: 3560, ledger_mismatch: true, overdue: true })).toBe("atraso");
    expect(statusDaCarteira({ balance: 515, open_installments: 3560, ledger_mismatch: true, overdue: false })).toBe("em_dia");
  });

  it("quitado de verdade é 'em_dia'", () => {
    expect(statusDaCarteira({ balance: 0, open_installments: 0, ledger_mismatch: false, overdue: false })).toBe("em_dia");
    expect(statusDaCarteira({ balance: 120, overdue: false })).toBe("em_dia");
  });

  it("backend antigo (sem os campos novos) não inventa 'conferir'", () => {
    expect(statusDaCarteira({ balance: 0, overdue: false })).toBe("em_dia");
    expect(statusDaCarteira({ balance: 0 })).toBe("em_dia");
  });
});

describe("isCustomerOverdue", () => {
  it("prefere o campo do backend ao vencimento", () => {
    expect(isCustomerOverdue({ overdue: false, next_due_date: "2020-01-01" })).toBe(false);
    expect(isCustomerOverdue({ overdue: true, next_due_date: "2099-01-01" })).toBe(true);
  });

  it("sem o campo, vencimento passado é atraso", () => {
    expect(isCustomerOverdue({ next_due_date: "2020-01-01" })).toBe(true);
    expect(isCustomerOverdue({ next_due_date: "2099-01-01" })).toBe(false);
    expect(isCustomerOverdue({})).toBe(false);
  });
});
