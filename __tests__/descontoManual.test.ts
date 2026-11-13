// ============================================================
// Desconto manual até 100% (12/11/2026) — utils/descontoManual.ts
//
// A tabela de arredondamento é a MESMA do backend
// (aura-backend __tests__/descontoManual.ate100.test.js): centavos inteiros,
// meio centavo para cima, sem erro de ponto flutuante. Se um lado mudar,
// o outro quebra junto.
// ============================================================
import {
  LIMITE_SEM_CONFIRMACAO_PCT, aoCentavo, avisoDoLimite, descontoEmReais, descontoPercentual,
  lerDescontoDigitado, mensagemDaConfirmacao, paraCentavos, resolverDescontoManual, textoDoPct,
} from "@/utils/descontoManual";
import { totalComoNoServidor } from "@/utils/precoNoCartao";

// [subtotal, pct, desconto] — idêntica à do backend.
const TABELA_PCT: [number, number, number][] = [
  [10.05, 10, 1.01],
  [1.15, 10, 0.12],
  [0.05, 10, 0.01],
  [0.04, 10, 0],
  [139.9, 50, 69.95],
  [139.9, 80, 111.92],
  [149.9, 80, 119.92],
  [99.99, 33.33, 33.33],
  [19.9, 12.5, 2.49],
  [1234.57, 7.5, 92.59],
  [0.01, 50, 0.01],
  [100, 100, 100],
  [100, 0, 0],
];

describe("arredondamento ao centavo (tabela comum com o backend)", () => {
  test.each(TABELA_PCT)("%s × %s%% = %s", (subtotal, pct, desconto) => {
    expect(descontoPercentual(subtotal, pct)).toBe(desconto);
    // O espelho do servidor usa a mesma função.
    expect(totalComoNoServidor([{ totalDaLinha: subtotal }], { manualPct: pct }).manual).toBe(desconto);
  });

  test("R$ 10,05 − 10% = R$ 9,04 (escolha do backend: meio centavo do desconto para cima)", () => {
    expect(resolverDescontoManual(10.05, "%", "10").valor).toBe(1.01);
    expect(totalComoNoServidor([{ totalDaLinha: 10.05 }], { manualPct: 10 }).total).toBe(9.04);
  });

  test("paraCentavos / aoCentavo sem erro de ponto flutuante", () => {
    expect(paraCentavos(1.005)).toBe(101);
    expect(paraCentavos(0.1 + 0.2)).toBe(30);
    expect(paraCentavos(2.675)).toBe(268);
    expect(paraCentavos(-1.005)).toBe(-101);
    expect(paraCentavos(NaN)).toBe(0);
    expect(aoCentavo(69.955)).toBe(69.96);
  });

  test("R$: ao centavo e com teto no subtotal", () => {
    expect(descontoEmReais(100, 10.005)).toBe(10.01);
    expect(descontoEmReais(139.9, 200)).toBe(139.9);
    expect(totalComoNoServidor([{ totalDaLinha: 139.9 }], { manualValor: 500 })).toMatchObject({ manual: 139.9, desconto: 139.9, total: 0 });
  });
});

describe("resolverDescontoManual", () => {
  test("80% aplica 80% e pede confirmação", () => {
    const d = resolverDescontoManual(149.9, "%", "80");
    expect(d).toMatchObject({ valor: 119.92, pct: 80, precisaConfirmar: true, limitadoAoTotal: false });
    expect(d.campos).toEqual({ discount_type: "percent", discount_value: 80 });
    expect(mensagemDaConfirmacao(d)).toBe("Desconto de 80% (R$ 119,92). Confirma?");
  });

  test("R$ 80 numa peça de R$ 139,90: vale R$ 80 (57,2%) e pede confirmação", () => {
    const d = resolverDescontoManual(139.9, "R$", "80");
    expect(d.valor).toBe(80);
    expect(textoDoPct(d.pct)).toBe("57,2%");
    expect(d.precisaConfirmar).toBe(true);
    expect(d.campos).toEqual({ discount_type: "fixed", discount_value: 80 });
  });

  test("50% ou menos não pede confirmação", () => {
    expect(LIMITE_SEM_CONFIRMACAO_PCT).toBe(50);
    expect(resolverDescontoManual(139.9, "%", "50").precisaConfirmar).toBe(false);
    expect(resolverDescontoManual(139.9, "R$", "69,95").precisaConfirmar).toBe(false);
    expect(resolverDescontoManual(139.9, "R$", "69,96").precisaConfirmar).toBe(true);
    expect(resolverDescontoManual(139.9, "%", "50,01").precisaConfirmar).toBe(true);
  });

  test("R$ acima do total: limita ao total (100%) e avisa", () => {
    const d = resolverDescontoManual(139.9, "R$", "200");
    expect(d).toMatchObject({ valor: 139.9, pct: 100, limitadoAoTotal: true, precisaConfirmar: true });
    expect(d.campos).toEqual({ discount_type: "fixed", discount_value: 139.9 });
    expect(avisoDoLimite(d)).toBe("O desconto passou do total. Ficou no total, R$ 139,90 (100%).");
  });

  test("% acima de 100: limita a 100% e avisa", () => {
    const d = resolverDescontoManual(139.9, "%", "150");
    expect(d).toMatchObject({ valor: 139.9, pct: 100, limitadoAoTotal: true });
    expect(d.campos).toEqual({ discount_type: "percent", discount_value: 100 });
    expect(avisoDoLimite(d)).toBe("O desconto vai até 100%. Ficou em 100% (R$ 139,90).");
  });

  test("sem desconto, sem aviso e sem campos", () => {
    const d = resolverDescontoManual(139.9, "%", "");
    expect(d).toMatchObject({ valor: 0, precisaConfirmar: false, limitadoAoTotal: false, campos: {} });
    expect(avisoDoLimite(d)).toBeNull();
    expect(resolverDescontoManual(0, "R$", "10").valor).toBe(0);
  });

  test("lê o que se digita no Caixa", () => {
    expect(lerDescontoDigitado("80")).toBe(80);
    expect(lerDescontoDigitado("80,5")).toBe(80.5);
    expect(lerDescontoDigitado("1.234,56")).toBe(1234.56);
    expect(lerDescontoDigitado("1234.56")).toBe(1234.56);
    expect(lerDescontoDigitado("-5")).toBe(0);
    expect(lerDescontoDigitado("abc")).toBe(0);
  });
});
