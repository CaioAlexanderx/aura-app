import { resetAllTips, TOOLTIPS } from "../../components/TooltipBanner";

beforeEach(() => {
  localStorage.clear();
});

describe("TooltipBanner", () => {
  it("should have tooltips for all key screens", () => {
    const screens = TOOLTIPS.map(t => t.screen);
    expect(screens).toContain("dashboard");
    expect(screens).toContain("pdv");
    expect(screens).toContain("estoque");
    expect(screens).toContain("financeiro");
    expect(screens).toContain("clientes");
  });

  it("should have unique IDs", () => {
    const ids = TOOLTIPS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resetAllTips should clear localStorage", () => {
    localStorage.setItem("aura_tooltips_seen", JSON.stringify(["tip1"]));
    resetAllTips();
    expect(localStorage.getItem("aura_tooltips_seen")).toBeNull();
  });
});
