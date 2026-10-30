// ============================================================
// Caixa — retirada e reforço: a conta (utils/caixaMovimentos.ts), 30/10/2026.
// ============================================================
import { esperadoNaGaveta, podeRetirar, rotuloDoMovimento, nomeDoTipo } from "@/utils/caixaMovimentos";

describe("esperadoNaGaveta", () => {
  test("troco + dinheiro + reforços − retiradas, em centavos certos", () => {
    expect(esperadoNaGaveta({ troco: 100, dinheiro: 250, suprimentos: 50, sangrias: 200 })).toBe(200);
    expect(esperadoNaGaveta({ troco: 100, dinheiro: 250 })).toBe(350);
    expect(esperadoNaGaveta({ troco: 0.1, dinheiro: 0.2 })).toBe(0.3);
  });
  test("lixo vira zero", () => {
    expect(esperadoNaGaveta({ troco: NaN as any, dinheiro: undefined as any })).toBe(0);
  });
});

describe("podeRetirar", () => {
  test("até o que há na gaveta, com 1 centavo de folga", () => {
    expect(podeRetirar(200, 200)).toBe(true);
    expect(podeRetirar(200.004, 200)).toBe(true);
    expect(podeRetirar(200.01, 200)).toBe(false);
    expect(podeRetirar(0, 200)).toBe(false);
    expect(podeRetirar(-5, 200)).toBe(false);
  });
});

describe("rotuloDoMovimento", () => {
  test("hora · tipo · motivo", () => {
    expect(rotuloDoMovimento({ tipo: "sangria", motivo: " depósito no banco ", created_at: "2026-10-30T17:10:00Z" })).toBe("14:10 · Retirada · depósito no banco");
    expect(rotuloDoMovimento({ tipo: "suprimento", motivo: null, created_at: "2026-10-30T13:35:00Z" })).toBe("10:35 · Reforço");
  });
  test("data inválida: sem hora", () => {
    expect(rotuloDoMovimento({ tipo: "sangria", motivo: "x", created_at: "nunca" })).toBe("Retirada · x");
    expect(nomeDoTipo("suprimento")).toBe("Reforço");
  });
});
