import { DENTAL_STATUS, DENTAL_STATUS_ORDER, dentalStatus, DENTAL_LOCKED_STATUSES } from "@/constants/dentalStatus";

describe("dentalStatus", () => {
  it("tem os 8 status do menu com rótulo e cor distintos", () => {
    const colors = DENTAL_STATUS_ORDER.map(s => DENTAL_STATUS[s].color);
    expect(new Set(colors).size).toBe(8);
    DENTAL_STATUS_ORDER.forEach(s => {
      expect(DENTAL_STATUS[s].label).toBeTruthy();
      expect(DENTAL_STATUS[s].bg).toMatch(/^rgba\(/);
    });
  });
  it("status desconhecido cai em agendado", () => {
    expect(dentalStatus("xyz").label).toBe("Agendado");
    expect(dentalStatus(undefined).label).toBe("Agendado");
  });
  it("só agendado (e avaliação) usam borda tracejada", () => {
    expect(dentalStatus("agendado").dashed).toBe(true);
    expect(dentalStatus("confirmado").dashed).toBe(false);
  });
  it("status finais ficam travados na grade", () => {
    expect(DENTAL_LOCKED_STATUSES.has("concluido")).toBe(true);
    expect(DENTAL_LOCKED_STATUSES.has("confirmado")).toBe(false);
  });
});
