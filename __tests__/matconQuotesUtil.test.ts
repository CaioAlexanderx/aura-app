// ============================================================
// Matcon M1 — as contas de vencimento do orçamento (22/09/2026).
//
// components/matcon/quotesUtil.ts é puro de propósito: vencimento é o que
// o dono lê de manhã na esteira e é onde erro de fuso mora. O jest.config
// já fixa TZ=America/Sao_Paulo, então "2026-09-23" tem que continuar sendo
// 23/09 — e não a véspera, que é o que new Date("2026-09-23") daria em
// UTC-3.
// ============================================================
import {
  diasAteVencer, fmtDiaMes, fmtDiaMesDeTimestamp, estaVencendo, estaVencido,
  rotuloVencimento, seloVencimento, rotuloAutoria,
} from "@/components/matcon/quotesUtil";

// Terça, 22/09/2026, meio-dia no fuso da loja — o "hoje" de todos os testes.
const HOJE = new Date(2026, 8, 22, 12, 0, 0);

describe("diasAteVencer", () => {
  test("conta de meia-noite a meia-noite, não de hora em hora", () => {
    expect(diasAteVencer("2026-09-22", HOJE)).toBe(0);
    expect(diasAteVencer("2026-09-23", HOJE)).toBe(1);
    expect(diasAteVencer("2026-09-29", HOJE)).toBe(7);
    expect(diasAteVencer("2026-09-14", HOJE)).toBe(-8);
  });

  test("data pura não vira véspera em UTC-3", () => {
    // O dia 23 tem que ser amanhã, não hoje.
    expect(diasAteVencer("2026-09-23T00:00:00.000Z".slice(0, 10), HOJE)).toBe(1);
  });

  test("entrada ruim devolve null, nunca NaN", () => {
    expect(diasAteVencer(null, HOJE)).toBeNull();
    expect(diasAteVencer(undefined, HOJE)).toBeNull();
    expect(diasAteVencer("", HOJE)).toBeNull();
    expect(diasAteVencer("sem data", HOJE)).toBeNull();
  });
});

describe("fmtDiaMes", () => {
  test("YYYY-MM-DD vira DD/MM", () => {
    expect(fmtDiaMes("2026-09-23")).toBe("23/09");
    expect(fmtDiaMes("2026-01-05")).toBe("05/01");
    expect(fmtDiaMes(null)).toBe("");
  });

  test("timestamp do servidor sai no fuso da loja", () => {
    expect(fmtDiaMesDeTimestamp("2026-09-22T15:30:00.000Z")).toBe("22/09");
    expect(fmtDiaMesDeTimestamp(null)).toBe("");
  });
});

describe("janela de aviso (matcon_quote_warn_days)", () => {
  test("vencendo = ainda vale e falta no máximo warnDays", () => {
    expect(estaVencendo("2026-09-22", 3, HOJE)).toBe(true);  // hoje
    expect(estaVencendo("2026-09-25", 3, HOJE)).toBe(true);  // limite
    expect(estaVencendo("2026-09-26", 3, HOJE)).toBe(false); // fora
    expect(estaVencendo("2026-09-21", 3, HOJE)).toBe(false); // já venceu
    expect(estaVencendo(null, 3, HOJE)).toBe(false);
  });

  test("vencido é só o que passou da data", () => {
    expect(estaVencido("2026-09-21", HOJE)).toBe(true);
    expect(estaVencido("2026-09-22", HOJE)).toBe(false);
    expect(estaVencido(null, HOJE)).toBe(false);
  });
});

describe("rotuloVencimento — português de balcão, sem jargão", () => {
  test("hoje, amanhã, em N dias e venceu", () => {
    expect(rotuloVencimento("2026-09-22", { agora: HOJE })).toBe("vence hoje, 22/09");
    expect(rotuloVencimento("2026-09-23", { agora: HOJE })).toBe("vence amanhã, 23/09");
    expect(rotuloVencimento("2026-09-25", { agora: HOJE })).toBe("vence em 3 dias, 25/09");
    expect(rotuloVencimento("2026-09-14", { agora: HOJE })).toBe("venceu em 14/09");
  });

  test("fora da janela de aviso o card diz 'vale até', não assusta", () => {
    expect(rotuloVencimento("2026-09-29", { agora: HOJE, warnDays: 3 })).toBe("vale até 29/09");
    expect(rotuloVencimento("2026-09-25", { agora: HOJE, warnDays: 3 })).toBe("vence em 3 dias, 25/09");
  });

  test("sem data, sem rótulo", () => {
    expect(rotuloVencimento(null, { agora: HOJE })).toBe("");
  });
});

describe("seloVencimento — o selo curto do canto do card", () => {
  test("singular e plural do dia", () => {
    expect(seloVencimento("2026-09-22", HOJE)).toBe("Vence hoje");
    expect(seloVencimento("2026-09-23", HOJE)).toBe("Vence em 1 dia");
    expect(seloVencimento("2026-09-24", HOJE)).toBe("Vence em 2 dias");
    expect(seloVencimento("2026-09-14", HOJE)).toBe("Venceu");
    expect(seloVencimento(null, HOJE)).toBe("");
  });
});

describe("rotuloAutoria — 'feito por Davi em 22/09'", () => {
  test("primeiro nome do vendedor + dia", () => {
    expect(rotuloAutoria("Davi Nogueira", "2026-09-22T15:30:00.000Z")).toBe("feito por Davi em 22/09");
  });

  test("some o pedaço que não existe, sem deixar ' · ' órfão", () => {
    expect(rotuloAutoria(null, "2026-09-22T15:30:00.000Z")).toBe("feito em 22/09");
    expect(rotuloAutoria("Davi", null)).toBe("feito por Davi");
    expect(rotuloAutoria(null, null)).toBe("");
  });
});
