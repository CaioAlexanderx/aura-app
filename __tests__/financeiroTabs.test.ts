// Invariantes de navegacao do Financeiro apos o F6 (6 abas -> 4).
//
// Esta e a mudanca de maior risco do redesign: mexer em TABS/TAB_INDEX quebra
// deep-links que ja circulam (favoritos, links colados no WhatsApp, o
// SalesAnalyticsCard do Painel). Estes testes travam o contrato.

import { TABS, TAB_INDEX, getPeriodRange, getPreviousPeriodRange, parseDateLocal } from "@/components/screens/financeiro/types";

describe("TABS / TAB_INDEX apos o F6", () => {
  it("expõe exatamente as 4 abas do redesign", () => {
    expect(TABS).toEqual(["Visão Geral", "Receitas", "Despesas", "Lançamentos"]);
  });

  it("os índices das abas visíveis apontam pra posição certa de TABS", () => {
    expect(TABS[TAB_INDEX.visao]).toBe("Visão Geral");
    expect(TABS[TAB_INDEX.receitas]).toBe("Receitas");
    expect(TABS[TAB_INDEX.despesas]).toBe("Despesas");
    expect(TABS[TAB_INDEX.lancamentos]).toBe("Lançamentos");
  });

  it("mantém retirada e cupons como alias FORA da faixa de abas", () => {
    // Continuam definidos pro deep-link antigo resolver e redirecionar, mas
    // fora da faixa: se um redirect falhar, a tela fica vazia em vez de abrir
    // silenciosamente a aba errada.
    expect(TAB_INDEX.retirada).toBeGreaterThanOrEqual(TABS.length);
    expect(TAB_INDEX.cupons).toBeGreaterThanOrEqual(TABS.length);
    expect(TABS[TAB_INDEX.retirada]).toBeUndefined();
    expect(TABS[TAB_INDEX.cupons]).toBeUndefined();
  });

  it("não repete índice entre abas visíveis", () => {
    var visiveis = [TAB_INDEX.visao, TAB_INDEX.receitas, TAB_INDEX.despesas, TAB_INDEX.lancamentos];
    expect(new Set(visiveis).size).toBe(visiveis.length);
  });

  it("todos os textos de aba estão acentuados", () => {
    // O produto falava duas línguas: "Visao Geral" ao lado de "Crediário".
    expect(TABS.join(" ")).not.toMatch(/Visao|Lancamentos/);
  });
});

describe("getPeriodRange — datas que a tela envia pro backend", () => {
  it("nunca produz Invalid Date nos períodos fixos", () => {
    (["today", "week", "month", "year", "prev_year", "all"] as const).forEach(function (k) {
      var r = getPeriodRange(k);
      expect(isNaN(r.start.getTime())).toBe(false);
      expect(isNaN(r.end.getTime())).toBe(false);
      expect(r.start.getTime()).toBeLessThanOrEqual(r.end.getTime());
    });
  });

  it("cai no mês quando o range custom está incompleto", () => {
    var mes = getPeriodRange("month");
    var semDatas = getPeriodRange("custom");
    expect(semDatas.start.getTime()).toBe(mes.start.getTime());
  });

  it("respeita um range custom válido", () => {
    var r = getPeriodRange("custom", "2026-08-01", "2026-08-15");
    expect(isNaN(r.start.getTime())).toBe(false);
    expect(r.start.getDate()).toBe(1);
    expect(r.end.getDate()).toBe(15);
  });

  it("período anterior é sempre anterior ao atual, quando existe", () => {
    (["today", "week", "month", "year"] as const).forEach(function (k) {
      var atual = getPeriodRange(k);
      var anterior = getPreviousPeriodRange(k);
      if (!anterior) return;
      expect(anterior.end.getTime()).toBeLessThanOrEqual(atual.start.getTime() + 86400000);
    });
  });
});

describe("parseDateLocal — o que alimenta atraso e gráficos", () => {
  it("lê date-only no fuso local, não em UTC", () => {
    var d = parseDateLocal("2026-08-21");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(21);
  });

  it("lê o timestamp de meia-noite UTC que o backend manda como o mesmo dia", () => {
    // Era isto que fazia vencimento de hoje contar como atrasado em BRT.
    var d = parseDateLocal("2026-08-21T00:00:00.000Z");
    expect(d.getDate()).toBe(21);
    expect(d.getMonth()).toBe(7);
  });

  it("devolve Invalid Date pra entrada vazia, sem lançar", () => {
    expect(isNaN(parseDateLocal(null).getTime())).toBe(true);
    expect(isNaN(parseDateLocal(undefined).getTime())).toBe(true);
    expect(isNaN(parseDateLocal("").getTime())).toBe(true);
  });
});
