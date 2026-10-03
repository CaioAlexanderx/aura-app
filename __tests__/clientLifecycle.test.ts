// Gestão Aura — etapa da conta, contagem regressiva e resumo do funil.
import {
  stageOf, trialCountdown, usageSummary, sortForStage, waLink,
  lifecycleSummary, archiveLabel, isNewAccount, type LifecycleClient,
} from "@/components/admin/clientLifecycle";

const NOW = new Date("2026-10-03T15:00:00Z").getTime();
const at = (days: number) => new Date(NOW + days * 86400000).toISOString();
const client = (over: Partial<LifecycleClient>): LifecycleClient => ({
  billing_status: "trial", is_active: true, created_at: at(-5), trial_ends_at: at(2), ...over,
});

describe("stageOf", () => {
  it("usa a etapa do backend quando ela vem", () => {
    expect(stageOf(client({ stage: "interno" }), NOW)).toBe("interno");
  });

  it("sem etapa do backend, separa trial vigente, vencido e arquivo", () => {
    expect(stageOf(client({ trial_ends_at: at(2) }), NOW)).toBe("trial");
    expect(stageOf(client({ trial_ends_at: at(-1) }), NOW)).toBe("vencido");
    expect(stageOf(client({ trial_ends_at: at(-30) }), NOW)).toBe("arquivo");
    expect(stageOf(client({ billing_status: "active", trial_ends_at: at(-30) }), NOW)).toBe("cliente");
    expect(stageOf(client({ billing_status: "cancelled" }), NOW)).toBe("arquivo");
  });
});

describe("trialCountdown", () => {
  it("mostra dias com urgência crescente e horas no último dia", () => {
    expect(trialCountdown(client({ trial_ends_at: at(6.5) }), NOW)).toEqual({ value: "7", unit: "dias", tone: "neutral" });
    expect(trialCountdown(client({ trial_ends_at: at(2.5) }), NOW)).toEqual({ value: "3", unit: "dias", tone: "amber" });
    expect(trialCountdown(client({ trial_ends_at: at(0.5) }), NOW)).toEqual({ value: "12", unit: "horas", tone: "red" });
  });

  it("depois do prazo nunca diz que vence hoje: diz que venceu", () => {
    expect(trialCountdown(client({ trial_ends_at: at(-0.5) }), NOW)).toEqual({ value: "hoje", unit: "venceu", tone: "red" });
    expect(trialCountdown(client({ trial_ends_at: at(-2.2) }), NOW)).toEqual({ value: "2d", unit: "vencido", tone: "red" });
    expect(trialCountdown(client({ trial_ends_at: at(-12) }), NOW).tone).toBe("muted");
  });
});

describe("usageSummary", () => {
  it("conta sem nada vira 'só cadastrou'", () => {
    expect(usageSummary(client({ login_days: 1 }))).toEqual({ text: "só cadastrou", engaged: false });
  });

  it("junta os sinais e marca quem está usando de verdade", () => {
    expect(usageSummary(client({ prod_count: 138, sale_count: 0, login_days: 4 })))
      .toEqual({ text: "138 produtos · 4 dias de uso", engaged: true });
    expect(usageSummary(client({ prod_count: 1, login_days: 1 }))).toEqual({ text: "1 produto", engaged: false });
  });
});

describe("lista", () => {
  const list = [
    client({ trial_ends_at: at(6), created_at: at(-1) }),
    client({ trial_ends_at: at(1), created_at: at(-6) }),
    client({ trial_ends_at: at(-2), created_at: at(-9) }),
    client({ trial_ends_at: at(-80), created_at: at(-87) }),
    client({ stage: "interno", created_at: at(-1) }),
  ];

  it("em trial ordena por quem vence primeiro", () => {
    const trial = sortForStage(list.filter((c) => stageOf(c, NOW) === "trial"), "trial");
    expect(trial.map((c) => c.trial_ends_at)).toEqual([at(1), at(6)]);
  });

  it("resumo conta só o funil, sem arquivo nem internos", () => {
    expect(lifecycleSummary(list, NOW)).toEqual({ trial: 2, expiring: 1, expired: 1, newThisWeek: 2 });
  });

  it("marca como nova a conta de até 2 dias", () => {
    expect(isNewAccount(list[0], NOW)).toBe(true);
    expect(isNewAccount(list[1], NOW)).toBe(false);
  });

  it("arquivo explica o motivo", () => {
    expect(archiveLabel(list[3], NOW)).toMatch(/^Não aderiu · trial venceu em \d\d\/\d\d \(80 dias\)$/);
    expect(archiveLabel(client({ billing_status: "cancelled" }), NOW)).toBe("Cancelou");
  });
});

describe("waLink", () => {
  it("põe o 55 em telefone nacional e recusa número incompleto", () => {
    expect(waLink("(92) 99627-7335")).toBe("https://wa.me/5592996277335");
    expect(waLink("5592996277335")).toBe("https://wa.me/5592996277335");
    expect(waLink("9962")).toBeNull();
    expect(waLink(null)).toBeNull();
  });
});
