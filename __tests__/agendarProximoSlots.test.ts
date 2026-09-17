process.env.TZ = "America/Sao_Paulo";

jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: null }) }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import { buildDays } from "../components/dental/consulta/AgendarProximoModal";

// "agora" = terça 15/09/2026 10h local; amanhã = quarta 16/09
const now = new Date(2026, 8, 15, 10, 0);
const cfg = { start_hour: 8, end_hour: 23, slot_duration_min: 30, available_days: [0, 1, 2, 3, 4, 5, 6] };
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

describe("AgendarProximoModal / buildDays", () => {
  it("consulta das 22h fica no dia local (não no dia UTC seguinte)", () => {
    const busy = [{ id: "a", scheduled_at: new Date(2026, 8, 16, 22, 0).toISOString(), duration_min: 30, status: "agendado" }];
    const days = buildDays(now, busy, null, cfg, 30);
    const qua = days.find((d) => d.iso === "2026-09-16")!;
    const qui = days.find((d) => d.iso === "2026-09-17")!;
    expect(qua.used).toBe(1);
    expect(qua.free.map(hhmm)).not.toContain("22:00");
    expect(qui.used).toBe(0);
    expect(qui.free.map(hhmm)).toContain("22:00");
  });

  it("usa a duração escolhida para checar sobreposição", () => {
    const busy = [{ id: "b", scheduled_at: new Date(2026, 8, 16, 9, 30).toISOString(), duration_min: 30, status: "agendado" }];
    const curta = buildDays(now, busy, null, cfg, 30).find((d) => d.iso === "2026-09-16")!;
    const longa = buildDays(now, busy, null, cfg, 60).find((d) => d.iso === "2026-09-16")!;
    expect(curta.free.map(hhmm)).toContain("09:00");
    expect(longa.free.map(hhmm)).not.toContain("09:00"); // 09:00-10:00 bate com 09:30
    expect(longa.free.map(hhmm)).toContain("08:30");     // 08:30-09:30 encosta, não sobrepõe
    expect(longa.free.map(hhmm)).toContain("10:00");
  });

  it("sem duração cai no tamanho do slot", () => {
    const busy = [{ id: "c", scheduled_at: new Date(2026, 8, 16, 9, 30).toISOString(), duration_min: 30, status: "agendado" }];
    const d = buildDays(now, busy, null, cfg).find((x) => x.iso === "2026-09-16")!;
    expect(d.free.map(hhmm)).toContain("09:00");
  });

  // Item 4: com horário da clínica salvo, ele manda — não a config do
  // agendamento online (`cfg`, que fica só de fallback).
  describe("com horário da clínica (item 4)", () => {
    const clinicHours = [
      { weekday: 1, open: true, shifts: [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }] }, // seg
      { weekday: 2, open: true, shifts: [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }] }, // ter
      { weekday: 3, open: false, shifts: [] }, // qua fechada
      { weekday: 4, open: true, shifts: [{ start: "08:00", end: "18:00" }] },
      { weekday: 5, open: true, shifts: [{ start: "08:00", end: "17:00" }] },
      { weekday: 6, open: false, shifts: [] },
      { weekday: 7, open: false, shifts: [] },
    ];
    const clinic = { configured: true, hours: clinicHours, defaultIntervalMin: 30 };

    it("ignora `cfg` (agendamento online) quando o horário da clínica está configurado", () => {
      const days = buildDays(now, [], null, cfg, 30, clinic);
      const qua = days.find((d) => d.iso === "2026-09-16")!; // quarta, clínica fechada
      expect(qua).toBeUndefined();
    });

    it("o almoço (vão entre turnos) nunca aparece e horários fora do turno não são oferecidos", () => {
      const days = buildDays(now, [], null, cfg, 60, clinic);
      const ter = days.find((d) => d.iso === "2026-09-15" || d.weekday === 2)!;
      const terFree = ter.free.map(hhmm);
      expect(terFree).not.toContain("12:00");
      expect(terFree).not.toContain("13:00");
      expect(terFree).toContain("08:00");
      expect(terFree).toContain("14:00");
      expect(terFree).not.toContain("17:30"); // não cabe 60min inteiro (turno acaba 18:00, cabe 17:00 mas não 17:30)
    });

    it("respeita a duração escolhida (não cabe inteiro não aparece)", () => {
      const days = buildDays(new Date(2026, 8, 17, 8, 0), [], null, cfg, 90, clinic); // quinta-base, olha sexta
      const sex = days.find((d) => d.weekday === 5)!; // sexta 08-17h
      const sexFree = sex.free.map(hhmm);
      expect(sexFree).toContain("15:30"); // 15:30+90min=17:00 cabe exatamente
      expect(sexFree).not.toContain("16:00"); // 16:00+90min=17:30 não cabe
    });

    it("sem `clinic.configured`, cai no comportamento atual (baseado em cfg)", () => {
      const days = buildDays(now, [], null, cfg, 30, { configured: false, hours: clinicHours, defaultIntervalMin: 30 });
      const qua = days.find((d) => d.iso === "2026-09-16")!;
      expect(qua).toBeDefined(); // quarta é dia útil em `cfg.available_days`, mesmo fechada na clínica
    });
  });
});
