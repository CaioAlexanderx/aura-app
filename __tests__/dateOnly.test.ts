// Fuso fixado aqui dentro: no Windows o Git Bash não repassa `TZ=America/Sao_Paulo`
// para o Node, mas atribuir process.env.TZ em runtime o Node respeita.
process.env.TZ = "America/Sao_Paulo";

import {
  parseDateOnly,
  formatDateOnlyBR,
  dateOnlyToLocalDate,
  ageFromDateOnly,
  toDateOnlyString,
  localDayKey,
  todayLocalString,
} from "../utils/dateOnly";

describe("fuso do teste", () => {
  it("está em America/Sao_Paulo (UTC-3)", () => {
    expect(new Date(2026, 8, 16).getTimezoneOffset()).toBe(180);
    // prova do bug original: new Date("YYYY-MM-DD") cai no dia anterior
    expect(new Date("1990-03-10T00:00:00.000Z").getDate()).toBe(9);
  });
});

describe("parseDateOnly", () => {
  it("lê YYYY-MM-DD e ISO sem converter fuso", () => {
    expect(parseDateOnly("2026-09-17")).toEqual({ y: 2026, m: 9, d: 17 });
    expect(parseDateOnly("1990-03-10T00:00:00.000Z")).toEqual({ y: 1990, m: 3, d: 10 });
    expect(parseDateOnly("1990-03-10T23:59:59-03:00")).toEqual({ y: 1990, m: 3, d: 10 });
    expect(parseDateOnly("1990-03-10 00:00:00")).toEqual({ y: 1990, m: 3, d: 10 });
  });
  it("Date usa o dia local", () => {
    expect(parseDateOnly(new Date(2026, 8, 16, 23, 50))).toEqual({ y: 2026, m: 9, d: 16 });
  });
  it("rejeita vazio, lixo e dia inexistente", () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly("10/03/1990")).toBeNull();
    expect(parseDateOnly("2026-04-31")).toBeNull();
    expect(parseDateOnly("2026-02-29")).toBeNull();
    expect(parseDateOnly("2024-02-29")).toEqual({ y: 2024, m: 2, d: 29 });
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly(new Date("x"))).toBeNull();
  });
});

describe("formatDateOnlyBR", () => {
  it("formata sem perder um dia", () => {
    expect(formatDateOnlyBR("1990-03-10T00:00:00.000Z")).toBe("10/03/1990");
    expect(formatDateOnlyBR("2026-09-17")).toBe("17/09/2026");
    expect(formatDateOnlyBR(new Date(2026, 0, 1))).toBe("01/01/2026");
  });
  it("usa o fallback quando não dá para ler", () => {
    expect(formatDateOnlyBR(null)).toBe("");
    expect(formatDateOnlyBR("abc", "—")).toBe("—");
  });
});

describe("dateOnlyToLocalDate", () => {
  it("devolve meia-noite local do mesmo dia", () => {
    const d = dateOnlyToLocalDate("2026-09-17T00:00:00.000Z")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 17, 0]);
    expect(dateOnlyToLocalDate("x")).toBeNull();
  });
});

describe("ageFromDateOnly", () => {
  const birth = "1990-03-10T00:00:00.000Z";
  it("véspera do aniversário ainda não completou", () => {
    expect(ageFromDateOnly(birth, new Date(2026, 2, 9, 23, 59))).toBe(35);
  });
  it("no dia do aniversário completa (inclusive de manhã cedo)", () => {
    expect(ageFromDateOnly(birth, new Date(2026, 2, 10, 0, 1))).toBe(36);
    expect(ageFromDateOnly("1990-03-10", new Date(2026, 2, 10, 22, 0))).toBe(36);
  });
  it("29/02 faz aniversário em 01/03 em ano não bissexto", () => {
    const leap = "2000-02-29";
    expect(ageFromDateOnly(leap, new Date(2025, 1, 28))).toBe(24);
    expect(ageFromDateOnly(leap, new Date(2025, 2, 1))).toBe(25);
    expect(ageFromDateOnly(leap, new Date(2024, 1, 28))).toBe(23);
    expect(ageFromDateOnly(leap, new Date(2024, 1, 29))).toBe(24);
  });
  it("inválida ou futura → null", () => {
    expect(ageFromDateOnly(null)).toBeNull();
    expect(ageFromDateOnly("2030-01-01", new Date(2026, 8, 16))).toBeNull();
    expect(ageFromDateOnly("2026-09-16", new Date(2026, 8, 16))).toBe(0);
  });
});

describe("toDateOnlyString / localDayKey / todayLocalString", () => {
  it("usa o dia local mesmo depois das 21h", () => {
    const night = new Date(2026, 8, 16, 22, 30);
    expect(night.toISOString().slice(0, 10)).toBe("2026-09-17"); // o bug
    expect(toDateOnlyString(night)).toBe("2026-09-16");
  });
  it("localDayKey agrupa timestamp UTC pelo dia local", () => {
    expect(localDayKey("2026-09-17T01:30:00.000Z")).toBe("2026-09-16");
    expect(localDayKey(new Date(2026, 8, 16, 22, 30).getTime())).toBe("2026-09-16");
    expect(localDayKey("lixo")).toBe("");
  });
  it("todayLocalString bate com o relógio local", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-17T01:30:00.000Z")); // 16/09 22:30 em SP
    try {
      expect(todayLocalString()).toBe("2026-09-16");
    } finally {
      jest.useRealTimers();
    }
  });
});
