process.env.TZ = "America/Sao_Paulo";

jest.mock("@/services/api", () => ({ request: jest.fn() }));

import { generateAvailableDates, generateSlotsForDay } from "../app/dental/book/[slug]";

// terça 15/09/2026
const baseConfig = {
  company_name: "Clínica Teste",
  welcome_msg: "",
  slot_duration_min: 30,
  available_days: [1, 2, 3, 4, 5],
  start_hour: 8,
  end_hour: 18,
  require_phone: false,
  min_advance_hours: 0,
  max_advance_days: 10,
  booked_slots: [] as Array<{ start: string; duration: number }>,
};

describe("app/dental/book/[slug] — geração de horários com day_windows", () => {
  it("sem day_windows, mantém o comportamento antigo (start_hour..end_hour)", () => {
    const tue = new Date(2026, 8, 15);
    const slots = generateSlotsForDay(tue, baseConfig as any);
    expect(slots[0].time).toBe("08:00");
    expect(slots.some((s) => s.time === "17:30")).toBe(true);
    expect(slots.some((s) => s.time === "18:00")).toBe(false);
  });

  it("com day_windows, só oferece horários que cabem inteiros no turno (sem almoço)", () => {
    const cfg = {
      ...baseConfig,
      day_windows: {
        "2": [ // terça
          { start: "08:00", end: "12:00" },
          { start: "14:00", end: "18:00" },
        ],
      },
    };
    const tue = new Date(2026, 8, 15);
    const slots = generateSlotsForDay(tue, cfg as any).filter((s) => s.available).map((s) => s.time);
    expect(slots).not.toContain("12:00");
    expect(slots).not.toContain("13:00");
    expect(slots).toContain("11:30");
    expect(slots).toContain("14:00");
    expect(slots).toContain("17:30"); // 17:30+30=18:00 cabe exatamente
  });

  it("dia sem janela em day_windows não aparece em generateAvailableDates", () => {
    const cfg = {
      ...baseConfig,
      max_advance_days: 14,
      day_windows: {
        "1": [{ start: "08:00", end: "12:00" }], // só segunda
      },
    };
    const dates = generateAvailableDates(cfg as any);
    expect(dates.every((d) => d.getDay() === 1)).toBe(true);
    expect(dates.length).toBeGreaterThan(0);
  });

  it("respeita booked_slots e min_advance_hours com day_windows", () => {
    const now = new Date(2026, 8, 15, 10, 0); // terça 10h
    jest.useFakeTimers().setSystemTime(now);
    const cfg = {
      ...baseConfig,
      min_advance_hours: 1,
      day_windows: { "2": [{ start: "08:00", end: "18:00" }] },
      booked_slots: [{ start: new Date(2026, 8, 15, 14, 0).toISOString(), duration: 30 }],
    };
    const slots = generateSlotsForDay(new Date(2026, 8, 15), cfg as any);
    const byTime = Object.fromEntries(slots.map((s) => [s.time, s]));
    expect(byTime["10:00"].available).toBe(false); // passou (min_advance)
    expect(byTime["14:00"].available).toBe(false); // ocupado
    expect(byTime["11:30"].available).toBe(true);
    jest.useRealTimers();
  });
});
