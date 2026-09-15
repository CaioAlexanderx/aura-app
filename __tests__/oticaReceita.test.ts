// ============================================================
// Ótica — helpers da receita (15/09/2026).
//
// O que pode dar errado numa receita digitada e mandar a lente errada
// pro laboratório: sinal omitido, grau fora do passo de 0,25, eixo fora
// de 0–180, cilíndrico sem eixo, data virando véspera por UTC. Cada caso
// tem um teste aqui.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn(), BASE_URL: "http://x" }));

import {
  fmtDiopter, fmtAxis, fmtEyeShort, parseDiopter, snapQuarter, addMonthsIso, parseBrDate, fmtIsoDate, daysUntil, columnsToEyes, eyesToColumns, EMPTY_EYE,
} from "@/services/oticaApi";
import { normalizeCell } from "@/components/otica/RxGrid";
import { validateRxDraft, emptyRxDraft } from "@/components/otica/RxEditor";

describe("formatação de grau como no papel do médico", () => {
  test("sinal sempre presente, vírgula, duas casas", () => {
    expect(fmtDiopter(-1.75)).toBe("−1,75");
    expect(fmtDiopter(2)).toBe("+2,00");
    expect(fmtDiopter(0)).toBe("0,00");
    expect(fmtDiopter(null)).toBe("—");
  });
  test("eixo inteiro com grau", () => {
    expect(fmtAxis(180)).toBe("180°");
    expect(fmtAxis(null)).toBe("—");
  });
  test("resumo do olho", () => {
    expect(fmtEyeShort({ ...EMPTY_EYE, sph: -1.75, cyl: -0.5, axis: 180, add: 2 })).toBe("−1,75 −0,50 180° · ad +2,00");
    expect(fmtEyeShort({ ...EMPTY_EYE, sph: -3 })).toBe("−3,00");
  });
});

describe("digitação", () => {
  test("aceita vírgula, ponto, sinal unicode e vazio", () => {
    expect(parseDiopter("-1,75")).toBe(-1.75);
    expect(parseDiopter("−1.75")).toBe(-1.75);
    expect(parseDiopter("+2")).toBe(2);
    expect(parseDiopter("")).toBeNull();
    expect(Number.isNaN(parseDiopter("abc") as number)).toBe(true);
  });
  test("passo de 0,25", () => {
    expect(snapQuarter(-1.8)).toBe(-1.75);
    expect(snapQuarter(2.13)).toBe(2.25);
    expect(normalizeCell({ kind: "diopter" }, "-1,8")).toBe(-1.75);
  });
  test("eixo travado em 0–180 e inteiro", () => {
    expect(normalizeCell({ kind: "axis" }, "185")).toBe(180);
    expect(normalizeCell({ kind: "axis" }, "-5")).toBe(0);
    expect(normalizeCell({ kind: "axis" }, "92,6")).toBe(93);
  });
  test("milímetros com uma casa", () => {
    expect(normalizeCell({ kind: "mm" }, "31,55")).toBe(31.6);
  });
});

describe("datas puras sem UTC", () => {
  test("12 meses de validade não pula dia", () => {
    expect(addMonthsIso("2026-08-20", 12)).toBe("2027-08-20");
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-03-03"); // fevereiro curto: comportamento do Date, documentado
  });
  test("BR <-> ISO", () => {
    expect(parseBrDate("20/08/2026")).toBe("2026-08-20");
    expect(parseBrDate("31/02/2026")).toBeNull();
    expect(parseBrDate("2026-08-20")).toBeNull();
    expect(fmtIsoDate("2026-08-20")).toBe("20/08/2026");
  });
  test("daysUntil hoje = 0", () => {
    const d = new Date(); const pad = (v: number) => String(v).padStart(2, "0");
    expect(daysUntil(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)).toBe(0);
  });
});

describe("colunas <-> olhos", () => {
  test("ida e volta preserva os valores", () => {
    const od = { ...EMPTY_EYE, sph: -1.75, cyl: -0.5, axis: 180, add: 2, pd: 31.5, height: 20 };
    const oe = { ...EMPTY_EYE, sph: -2, cyl: -0.75, axis: 175, add: 2, pd: 32, height: 20 };
    const cols = eyesToColumns(od, oe);
    expect(cols.od_sph).toBe(-1.75);
    expect(cols.oe_axis).toBe(175);
    const back = columnsToEyes(cols as any);
    expect(back.od).toEqual(od);
    expect(back.oe).toEqual(oe);
  });
  test("strings do banco viram números", () => {
    const eyes = columnsToEyes({ od_sph: "-1.75" as any, oe_cyl: "" as any });
    expect(eyes.od.sph).toBe(-1.75);
    expect(eyes.oe.cyl).toBeNull();
  });
});

describe("validação do rascunho", () => {
  test("vazio não salva", () => {
    expect(validateRxDraft(emptyRxDraft())).toMatch(/esférico ou o cilíndrico/);
  });
  test("cilíndrico exige eixo", () => {
    const d = emptyRxDraft();
    d.od = { ...d.od, sph: -1, cyl: -0.5 };
    expect(validateRxDraft(d)).toMatch(/eixo/);
    d.od = { ...d.od, axis: 90 };
    expect(validateRxDraft(d)).toBeNull();
  });
  test("validade anterior à emissão não passa", () => {
    const d = emptyRxDraft();
    d.od = { ...d.od, sph: -1 };
    d.issued_at = "20/08/2026"; d.valid_until = "19/08/2026";
    expect(validateRxDraft(d)).toMatch(/anterior/);
  });
});
