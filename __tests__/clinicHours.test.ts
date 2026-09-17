import {
  timeToMinutes,
  minutesToTime,
  jsDayToWeekday,
  normalizeClinicHours,
  validateDayShifts,
  validateClinicHours,
  hasClinicHoursErrors,
  copyDayToWeekdays,
  weeklyHoursTotal,
  formatWeeklyHours,
  clinicGridRange,
  isWithinClinicHours,
  clipShiftsToWindow,
  generateSlotsForShift,
  generateSlotsForShifts,
  clinicMinuteStatus,
  clinicDayBands,
  isClinicDayClosed,
  outsideHoursPrompt,
  type ClinicHours,
} from "../utils/clinicHours";

function hours(partial: Record<number, { open: boolean; shifts: Array<[string, string]> }>): ClinicHours {
  return normalizeClinicHours(
    Object.entries(partial).map(([weekday, d]) => ({
      weekday: Number(weekday),
      open: d.open,
      shifts: d.shifts.map(([start, end]) => ({ start, end })),
    }))
  );
}

describe("timeToMinutes / minutesToTime", () => {
  it("converte HH:MM ida e volta", () => {
    expect(timeToMinutes("08:30")).toBe(510);
    expect(minutesToTime(510)).toBe("08:30");
  });
  it("aceita 24:00 como fim de turno", () => {
    expect(timeToMinutes("24:00")).toBe(1440);
    expect(minutesToTime(1440)).toBe("24:00");
  });
});

describe("jsDayToWeekday", () => {
  it("domingo (0) vira 7, resto mantém", () => {
    expect(jsDayToWeekday(0)).toBe(7);
    expect(jsDayToWeekday(1)).toBe(1);
    expect(jsDayToWeekday(6)).toBe(6);
  });
});

describe("normalizeClinicHours", () => {
  it("sempre devolve 7 dias, fechados quando ausentes", () => {
    const out = normalizeClinicHours([{ weekday: 1, open: true, shifts: [{ start: "08:00", end: "12:00" }] }]);
    expect(out).toHaveLength(7);
    expect(out.find((d) => d.weekday === 1)?.open).toBe(true);
    expect(out.find((d) => d.weekday === 2)?.open).toBe(false);
    expect(out.find((d) => d.weekday === 2)?.shifts).toEqual([]);
  });
});

describe("validateDayShifts", () => {
  it("fim precisa ser depois do início", () => {
    const errs = validateDayShifts([{ start: "12:00", end: "08:00" }]);
    expect(errs).toEqual([{ shift: 0, field: "end", message: "O fim precisa ser depois do início." }]);
  });
  it("detecta sobreposição entre turnos", () => {
    const errs = validateDayShifts([
      { start: "08:00", end: "13:00" },
      { start: "12:00", end: "18:00" },
    ]);
    expect(errs).toEqual([{ shift: 1, field: "start", message: "Este turno se sobrepõe ao anterior." }]);
  });
  it("turnos sem sobreposição não geram erro", () => {
    expect(validateDayShifts([{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }])).toEqual([]);
  });
});

describe("validateClinicHours / hasClinicHoursErrors", () => {
  it("ignora dias fechados", () => {
    const h = hours({ 1: { open: false, shifts: [["12:00", "08:00"]] } });
    expect(validateClinicHours(h)).toEqual([]);
    expect(hasClinicHoursErrors(h)).toBe(false);
  });
  it("acha erro em dia aberto e devolve o weekday", () => {
    const h = hours({ 1: { open: true, shifts: [["12:00", "08:00"]] } });
    const errs = validateClinicHours(h);
    expect(errs).toHaveLength(1);
    expect(errs[0].weekday).toBe(1);
    expect(hasClinicHoursErrors(h)).toBe(true);
  });
});

describe("copyDayToWeekdays", () => {
  it("copia segunda para os outros dias úteis, sem tocar sábado/domingo", () => {
    const h = hours({
      1: { open: true, shifts: [["08:00", "18:00"]] },
      2: { open: true, shifts: [["09:00", "17:00"]] },
      6: { open: true, shifts: [["08:00", "12:00"]] },
    });
    const out = copyDayToWeekdays(h, 1);
    expect(out.find((d) => d.weekday === 2)?.shifts).toEqual([{ start: "08:00", end: "18:00" }]);
    expect(out.find((d) => d.weekday === 5)?.shifts).toEqual([{ start: "08:00", end: "18:00" }]);
    expect(out.find((d) => d.weekday === 6)?.shifts).toEqual([{ start: "08:00", end: "12:00" }]);
  });
});

describe("weeklyHoursTotal / formatWeeklyHours", () => {
  it("soma os turnos abertos em horas, com uma casa decimal", () => {
    const h = hours({
      1: { open: true, shifts: [["08:00", "12:00"], ["14:00", "17:30"]] },
      2: { open: false, shifts: [["08:00", "18:00"]] },
    });
    expect(weeklyHoursTotal(h)).toBe(7.5);
    expect(formatWeeklyHours(h)).toBe("7,5h");
  });
});

describe("clinicGridRange", () => {
  it("sem configuração cai no fallback 7–19h", () => {
    expect(clinicGridRange([], false)).toEqual({ startHour: 7, endHour: 19 });
  });
  it("usa horário real ±1h quando configurado", () => {
    const h = hours({ 3: { open: true, shifts: [["08:00", "18:00"]] } });
    expect(clinicGridRange(h, true)).toEqual({ startHour: 7, endHour: 19 });
  });
  it("nenhum dia aberto também cai no fallback", () => {
    const h = hours({ 1: { open: false, shifts: [] } });
    expect(clinicGridRange(h, true)).toEqual({ startHour: 7, endHour: 19 });
  });
});

describe("isWithinClinicHours", () => {
  const h = hours({ 2: { open: true, shifts: [["08:00", "12:00"], ["14:00", "18:00"]] } });
  it("dentro de um turno cabe", () => {
    expect(isWithinClinicHours(h, new Date(2026, 8, 15, 9, 0), 60)).toBe(true); // 15/09/2026 = terça
  });
  it("no almoço não cabe", () => {
    expect(isWithinClinicHours(h, new Date(2026, 8, 15, 12, 30), 30)).toBe(false);
  });
  it("ultrapassa o fim do turno não cabe", () => {
    expect(isWithinClinicHours(h, new Date(2026, 8, 15, 17, 30), 60)).toBe(false);
  });
  it("dia fechado não cabe", () => {
    expect(isWithinClinicHours(h, new Date(2026, 8, 16, 9, 0), 30)).toBe(false); // quarta fechada
  });
});

describe("clipShiftsToWindow", () => {
  it("recorta o turno à janela pedida", () => {
    expect(clipShiftsToWindow([{ start: "08:00", end: "18:00" }], 9 * 60, 12 * 60)).toEqual([{ start: 540, end: 720 }]);
  });
  it("fora da janela não sobra nada", () => {
    expect(clipShiftsToWindow([{ start: "08:00", end: "09:00" }], 10 * 60, 12 * 60)).toEqual([]);
  });
});

describe("generateSlotsForShift(s)", () => {
  it("só oferece horários que cabem inteiros no turno", () => {
    expect(generateSlotsForShift({ start: "08:00", end: "09:10" }, 30)).toEqual(["08:00", "08:30"]);
  });
  it("o almoço (vão entre turnos) nunca aparece", () => {
    const slots = generateSlotsForShifts(
      [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
      60
    );
    expect(slots).not.toContain("12:00");
    expect(slots).not.toContain("13:00");
    expect(slots).toEqual(["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"]);
  });
});

// ─── Efeito na Agenda (mockup do horário, parte 2) ──────────
describe("clinicMinuteStatus / clinicDayBands / outsideHoursPrompt", () => {
  // seg 08–12 + 14–18; ter 08–12 + 12:30–18 (vão de 30 min); sáb 08–12; dom fechado;
  // qua "aberta" sem turno válido conta como fechada.
  const h = hours({
    1: { open: true, shifts: [["14:00", "18:00"], ["08:00", "12:00"]] },
    2: { open: true, shifts: [["08:00", "12:00"], ["12:30", "18:00"]] },
    3: { open: true, shifts: [["10:00", "09:00"]] },
    6: { open: true, shifts: [["08:00", "12:00"]] },
    7: { open: false, shifts: [["08:00", "12:00"]] },
  });
  const m = (t: string) => timeToMinutes(t);

  it("classifica cada faixa do dia por minuto (turnos fora de ordem)", () => {
    expect(clinicMinuteStatus(h, 1, m("07:59"))).toEqual({ kind: "before", opensAt: m("08:00") });
    expect(clinicMinuteStatus(h, 1, m("08:00"))).toEqual({ kind: "open" });
    expect(clinicMinuteStatus(h, 1, m("11:59"))).toEqual({ kind: "open" });
    expect(clinicMinuteStatus(h, 1, m("12:00"))).toEqual({ kind: "lunch", from: m("12:00"), to: m("14:00") });
    expect(clinicMinuteStatus(h, 1, m("13:59"))).toEqual({ kind: "lunch", from: m("12:00"), to: m("14:00") });
    expect(clinicMinuteStatus(h, 1, m("14:00"))).toEqual({ kind: "open" });
    expect(clinicMinuteStatus(h, 1, m("18:00"))).toEqual({ kind: "after", closesAt: m("18:00") });
    expect(clinicMinuteStatus(h, 6, m("12:00"))).toEqual({ kind: "after", closesAt: m("12:00") });
  });

  it("dia fechado (inclusive aberto sem turno válido e turnos ignorados de dia fechado)", () => {
    expect(clinicMinuteStatus(h, 7, m("09:00"))).toEqual({ kind: "closedDay" });
    expect(clinicMinuteStatus(h, 3, m("09:30"))).toEqual({ kind: "closedDay" });
    expect(clinicMinuteStatus(h, 5, m("09:30"))).toEqual({ kind: "closedDay" });
    expect(isClinicDayClosed(h, 7)).toBe(true);
    expect(isClinicDayClosed(h, 3)).toBe(true);
    expect(isClinicDayClosed(h, 1)).toBe(false);
  });

  it("bandas: turnos ordenados, almoço com rótulo só com 60 min ou mais", () => {
    expect(clinicDayBands(h, 1)).toEqual({
      closed: false,
      open: [{ start: m("08:00"), end: m("12:00") }, { start: m("14:00"), end: m("18:00") }],
      lunch: [{ start: m("12:00"), end: m("14:00"), label: true }],
    });
    expect(clinicDayBands(h, 2).lunch).toEqual([{ start: m("12:00"), end: m("12:30"), label: false }]);
    expect(clinicDayBands(h, 6).lunch).toEqual([]);
    expect(clinicDayBands(h, 7)).toEqual({ closed: true, open: [], lunch: [] });
  });

  it("confirmação: depois de fechar, antes de abrir, almoço e dia fechado", () => {
    // 14/09/2026 = segunda; 20/09/2026 = domingo
    expect(outsideHoursPrompt(h, new Date(2026, 8, 14, 9, 0))).toBeNull();
    const after = outsideHoursPrompt(h, new Date(2026, 8, 14, 18, 30))!;
    expect(after.title).toBe("Fora do horário de funcionamento (18:00). Agendar mesmo assim?");
    expect(after.message).toBe("Segunda, 14/09 às 18:30. A clínica fecha às 18:00 neste dia. O horário fica marcado como encaixe na agenda.");
    const before = outsideHoursPrompt(h, new Date(2026, 8, 14, 7, 0))!;
    expect(before.title).toBe("Fora do horário de funcionamento (08:00). Agendar mesmo assim?");
    expect(before.message).toContain("A clínica abre às 08:00 neste dia.");
    expect(outsideHoursPrompt(h, new Date(2026, 8, 14, 12, 30))!.title)
      .toBe("Intervalo entre turnos (12:00–14:00). Agendar mesmo assim?");
    const sunday = outsideHoursPrompt(h, new Date(2026, 8, 20, 10, 0))!;
    expect(sunday.title).toBe("Fora do horário de funcionamento (domingo fechado). Agendar mesmo assim?");
    expect(sunday.message).toBe("Domingo, 20/09 às 10:00. O horário fica marcado como encaixe na agenda.");
  });
});
