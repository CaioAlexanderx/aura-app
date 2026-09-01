// ============================================================
// A virada do mês não pode transformar a lojista em conta nova.
//
// HISTÓRICO. O estado vazio do Painel tinha um critério só — "mês atual
// sem movimento" — e um texto só, o de onboarding de conta nova. No QA de
// 01/09/2026 a conta da Lorena (R$ 15.364,83 acumulados, 602 clientes)
// abriu o Painel e leu "Bem-vindo, Lorena! Seu painel vai ganhar vida à
// medida que você usar a Aura", com os três CTAs de cadastro inicial. O
// GET /companies/:id/dashboard tinha devolvido revenue: 0 e expenses: 0
// pelo motivo mais banal do mundo: setembro tinha acabado de começar.
//
// Não era um caso de borda de uma conta — era todo usuário da Aura, todo
// dia 1º, lendo que os dados sumiram.
//
// O QUE ESTE TESTE PRENDE. Duas coisas que a UI não avisa quando quebram:
//
// 1. A bifurcação. "Conta nova" (nunca teve movimento) e "mês novo" (tem
//    histórico, o mês é que começou) precisam continuar sendo estados
//    diferentes. O sinal de histórico pode vir da sparkline do próprio
//    payload ou do fechamento do mês anterior; enquanto nenhum dos dois
//    respondeu, o certo é não mostrar texto nenhum — piscar o texto
//    errado é o bug original em versão rápida.
//
// 2. O fuso. A virada é calculada em America/Sao_Paulo, não em UTC. Em
//    UTC, 21h do dia 31 já é dia 1º: quem estivesse com o Painel aberto
//    às 21h de 31/08 veria "Setembro começando" com agosto ainda rodando
//    por mais três horas. Os casos abaixo cravam justamente as bordas de
//    21h-1min e 21h.
// ============================================================
import {
  brToday,
  monthNameBR,
  previousMonthOf,
  daysInMonth,
  hasMovementInSpark,
  classifyEmptyDashboard,
} from "@/components/screens/dashboard/types";

describe("fuso do Brasil na virada do mês", () => {
  it("às 20h59 de 31/08 (BRT) ainda é 31 de agosto, mesmo já sendo 1º em UTC", () => {
    // 31/08/2026 23:59 UTC = 20:59 BRT
    const d = brToday(new Date("2026-08-31T23:59:00Z"));
    expect(d).toEqual({ year: 2026, month: 8, day: 31 });
  });

  it("às 21h de 31/08 (BRT já é 1º/09 em UTC) o mês ainda não virou", () => {
    // 01/09/2026 00:00 UTC = 21:00 BRT do dia 31/08
    const d = brToday(new Date("2026-09-01T00:00:00Z"));
    expect(d).toEqual({ year: 2026, month: 8, day: 31 });
  });

  it("vira o mês na meia-noite de Brasília, não na de Greenwich", () => {
    // 01/09/2026 03:00 UTC = 00:00 BRT
    const d = brToday(new Date("2026-09-01T03:00:00Z"));
    expect(d).toEqual({ year: 2026, month: 9, day: 1 });
  });

  it("vira o ano junto com o mês", () => {
    // 01/01/2027 03:00 UTC = 00:00 BRT
    expect(brToday(new Date("2027-01-01T03:00:00Z"))).toEqual({ year: 2027, month: 1, day: 1 });
    expect(previousMonthOf({ year: 2027, month: 1 })).toEqual({ year: 2026, month: 12 });
  });
});

describe("nomes de mês em pt-BR", () => {
  it("sai capitalizado e acentuado", () => {
    expect(monthNameBR(3)).toBe("Março");
    expect(monthNameBR(9)).toBe("Setembro");
  });

  it("sai em minúscula quando vai no meio da frase", () => {
    expect(monthNameBR(8, false)).toBe("agosto");
  });

  it("a abreviação de três letras do rótulo não perde o acento errado", () => {
    // O selo da Visão geral mostra "mar 26", "set 26" — três letras.
    expect(monthNameBR(3, false).slice(0, 3)).toBe("mar");
    expect(monthNameBR(9, false).slice(0, 3)).toBe("set");
  });
});

describe("daysInMonth", () => {
  it("conhece fevereiro bissexto", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });
  it("conhece os meses de 30 e 31", () => {
    expect(daysInMonth(2026, 9)).toBe(30);
    expect(daysInMonth(2026, 8)).toBe(31);
  });
});

describe("hasMovementInSpark", () => {
  it("acha movimento em qualquer uma das séries", () => {
    expect(hasMovementInSpark([0, 0, 0], [0, 0, 12], null)).toBe(true);
  });
  it("não inventa movimento em série zerada, vazia ou ausente", () => {
    expect(hasMovementInSpark([0, 0, 0], [], undefined, null)).toBe(false);
    expect(hasMovementInSpark()).toBe(false);
  });
});

describe("conta nova x mês novo", () => {
  it("conta nova de verdade continua vendo o onboarding", () => {
    expect(
      classifyEmptyDashboard({
        hasSpark: false,
        previousTotals: { income: 0, expenses: 0, net: 0 },
        loadingHistory: false,
      }),
    ).toBe("conta-nova");
  });

  it("o caso da Lorena: mês zerado, agosto com R$ 819,40 -> mês novo", () => {
    expect(
      classifyEmptyDashboard({
        hasSpark: false,
        previousTotals: { income: 819.4, expenses: 0, net: 819.4 },
        loadingHistory: false,
      }),
    ).toBe("mes-novo");
  });

  it("mês só com despesas no anterior também é histórico", () => {
    expect(
      classifyEmptyDashboard({
        hasSpark: false,
        previousTotals: { income: 0, expenses: 240, net: -240 },
        loadingHistory: false,
      }),
    ).toBe("mes-novo");
  });

  it("a sparkline do próprio payload decide na hora, sem esperar o histórico", () => {
    expect(
      classifyEmptyDashboard({ hasSpark: true, previousTotals: null, loadingHistory: true }),
    ).toBe("mes-novo");
  });

  it("enquanto o histórico não chega, não mostra nenhum dos dois textos", () => {
    expect(
      classifyEmptyDashboard({ hasSpark: false, previousTotals: null, loadingHistory: true }),
    ).toBe("carregando");
  });

  it("histórico indisponível (erro/demo) cai no onboarding, não trava a tela", () => {
    expect(
      classifyEmptyDashboard({ hasSpark: false, previousTotals: null, loadingHistory: false }),
    ).toBe("conta-nova");
  });
});
