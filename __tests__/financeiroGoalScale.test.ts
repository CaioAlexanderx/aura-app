// Testes da escala de cor da barra de gasto do ResumoHero (F3).
//
// A barra "esverdeia" conforme o negocio se afasta da meta pra baixo e vira
// vermelho quando estoura. Como a cor sai de interpolacao continua, o que
// interessa testar e a ordenacao (mais gasto => menos saudavel) e os pontos
// de ancoragem, nao um hex especifico.

import { goalHealth, goalColor, goalCaption, hexLerp } from "@/components/screens/financeiro/v2/goalScale";

var PALETTE = { green: "#34d399", amber: "#fbbf24", red: "#f87171" };

describe("hexLerp", () => {
  it("devolve os extremos sem alterar", () => {
    expect(hexLerp("#000000", "#ffffff", 0)).toBe("#000000");
    expect(hexLerp("#000000", "#ffffff", 1)).toBe("#ffffff");
  });

  it("interpola o meio do caminho", () => {
    expect(hexLerp("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("clampa t fora de 0..1", () => {
    expect(hexLerp("#000000", "#ffffff", -3)).toBe("#000000");
    expect(hexLerp("#000000", "#ffffff", 9)).toBe("#ffffff");
  });

  it("cai no destino quando o hex e invalido", () => {
    expect(hexLerp("nao-e-hex", "#34d399", 0.5)).toBe("#34d399");
  });
});

describe("goalHealth", () => {
  it("da saude maxima bem abaixo da meta", () => {
    // gastou 40% com meta de 70% => 0.57 da meta, folgado
    expect(goalHealth(40, 70)).toBe(1);
  });

  it("da 0.5 exatamente na meta", () => {
    expect(goalHealth(70, 70)).toBeCloseTo(0.5, 5);
  });

  it("zera quando estoura a meta com folga", () => {
    expect(goalHealth(80, 70)).toBe(0);
  });

  it("decresce monotonicamente conforme o gasto sobe", () => {
    var ratios = [30, 45, 55, 65, 70, 73, 77];
    var healths = ratios.map(function (r) { return goalHealth(r, 70); });
    for (var i = 1; i < healths.length; i++) {
      expect(healths[i]).toBeLessThanOrEqual(healths[i - 1]);
    }
  });

  it("respeita metas diferentes — o mesmo gasto vale conforme a meta", () => {
    // O ponto do F3: a meta e do usuario, entao 60% de gasto significa coisas
    // diferentes pra quem definiu 85% e pra quem definiu 65%.
    expect(goalHealth(60, 85)).toBeGreaterThan(goalHealth(60, 65));
    // Bem abaixo de uma meta folgada => saude cheia
    expect(goalHealth(55, 85)).toBe(1);
    // O mesmo gasto ja encosta numa meta apertada
    expect(goalHealth(60, 65)).toBeLessThan(0.7);
  });

  it("nao quebra com entradas invalidas", () => {
    expect(goalHealth(NaN, 70)).toBe(0.5);
    expect(goalHealth(50, 0)).toBe(0.5);
    expect(goalHealth(0, 70)).toBe(1);
  });
});

describe("goalColor", () => {
  it("devolve verde puro bem abaixo da meta", () => {
    expect(goalColor(30, 70, PALETTE)).toBe(PALETTE.green);
  });

  it("devolve ambar exatamente na meta", () => {
    expect(goalColor(70, 70, PALETTE)).toBe(PALETTE.amber);
  });

  it("devolve vermelho quando estoura", () => {
    expect(goalColor(85, 70, PALETTE)).toBe(PALETTE.red);
  });

  it("sempre devolve um hex valido na faixa util", () => {
    for (var r = 0; r <= 120; r += 5) {
      expect(goalColor(r, 70, PALETTE)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("goalCaption", () => {
  it("diz quantos pontos faltam pra meta", () => {
    expect(goalCaption(62, 70)).toBe("Você está 8 pontos abaixo da sua meta.");
  });

  it("usa singular com 1 ponto", () => {
    expect(goalCaption(69, 70)).toBe("Você está 1 ponto abaixo da sua meta.");
  });

  it("reconhece estar na meta", () => {
    expect(goalCaption(70, 70)).toBe("Você está exatamente na sua meta.");
  });

  it("avisa quando passou", () => {
    expect(goalCaption(78, 70)).toBe("Você passou 8 pontos da sua meta.");
  });

  it("trata periodo sem despesa", () => {
    expect(goalCaption(0, 70)).toBe("Sem despesas no período.");
  });
});

// ─── Cenários que o QA pós-F7 levantou ──────────────────────

import { buildNarrative } from "@/components/screens/financeiro/v2/types";

describe("buildNarrative — casos que escapavam da ordem dos ifs", () => {
  var base = { score: 50, margem: 10, runwayDays: 90, growthPct: 0, txCount: 30, hasIncome: true };

  it("reconhece o período só de despesa em vez de dizer que sobrou 0%", () => {
    // computeClientSide força margem = 0 quando income === 0, então sem a flag
    // hasIncome a frase caía em "sobrou pouco: 0%" — como se tivesse faturado.
    var n = buildNarrative({ ...base, score: 10, margem: 0, runwayDays: 0, hasIncome: false });
    expect(n.headline).toContain("não entrou nada");
    expect(n.headline).not.toContain("0%");
  });

  it("alerta quando o caixa zerou (runway exatamente 0)", () => {
    // O guard antigo era `runwayDays > 0 && < 30`, então runway 0 — o pior
    // caso — escapava do alerta.
    var n = buildNarrative({ ...base, runwayDays: 0 });
    expect(n.headline).toContain("limite");
  });

  it("ainda alerta com caixa curto mas não zerado", () => {
    expect(buildNarrative({ ...base, runwayDays: 12 }).headline).toContain("menos de um mês");
  });

  it("não chama de saudável quem gastou mais do que entrou", () => {
    var n = buildNarrative({ ...base, score: 90, margem: -25, runwayDays: 200 });
    expect(n.headline).toContain("gastou mais do que entrou");
    expect(n.headline).toContain("25%");
  });

  it("nunca devolve NaN ou undefined na frase", () => {
    var casos = [
      { ...base, margem: NaN },
      { ...base, runwayDays: 999 },
      { ...base, txCount: 0 },
      { ...base, score: 100, margem: 45, growthPct: 30 },
    ];
    casos.forEach(function (c) {
      var n = buildNarrative(c);
      expect(n.headline).toBeTruthy();
      expect(n.subline).toBeTruthy();
      expect(n.headline).not.toMatch(/NaN|undefined/);
      expect(n.subline).not.toMatch(/NaN|undefined/);
    });
  });

  it("toda frase é acentuada e termina em pontuação", () => {
    var variantes = [
      { ...base, txCount: 3 },
      { ...base, hasIncome: false },
      { ...base, margem: -10 },
      { ...base, runwayDays: 5 },
      { ...base, score: 40 },
      { ...base, score: 70, runwayDays: 45 },
      { ...base, score: 70, margem: 8 },
      { ...base, score: 90, growthPct: 20 },
      { ...base, score: 90 },
    ];
    variantes.forEach(function (v) {
      var n = buildNarrative(v);
      expect(n.headline).toMatch(/[.!?]$/);
      // nenhuma variante pode ter escapado da revisão de acentuação
      expect(n.headline + n.subline).not.toMatch(/\b(voce|nao|periodo|negocio|proximo)\b/);
    });
  });
});
