// ============================================================
// utils/cest.ts — CEST sugerido a partir do NCM (Matcon M2, 22/09/2026,
// docs/CONTRACT_MATCON.md §M2). Funções puras, sem mock necessário.
//
// A tabela só sugere: NCM fora dela devolve null (nunca chuta), igual à
// regra do utils/ncm.ts. Os exemplos abaixo (2523.29.10, 3209.10.10,
// 6907.21.00) são os mesmos do mockup docs/mockups/matcon-m2-fiscal.html.
// ============================================================
import { suggestCest, getCestStatus, formatCestDisplay, isStLikely, cestFamilyByCode } from "@/utils/cest";

describe("suggestCest", () => {
  test("cimento — 2523.29.10 -> 05.001.00, família cimento, stLikely true", () => {
    const r = suggestCest("2523.29.10");
    expect(r).not.toBeNull();
    expect(formatCestDisplay(r!.cest)).toBe("05.001.00");
    expect(r!.family).toBe("cimento");
    expect(r!.stLikely).toBe(true);
  });

  test("tinta — 3209.10.10 -> 24.001.00 (mesmo NCM do mockup)", () => {
    const r = suggestCest("3209.10.10");
    expect(formatCestDisplay(r!.cest)).toBe("24.001.00");
    expect(r!.family).toBe("tinta");
  });

  test("argamassa — 3214.90.00 -> 10.026.00 (mesmo NCM do mockup)", () => {
    const r = suggestCest("3214.90.00");
    expect(formatCestDisplay(r!.cest)).toBe("10.026.00");
    expect(r!.family).toBe("argamassa");
  });

  test("revestimento — 6907.21.00 -> 10.032.00 (mesmo NCM do mockup)", () => {
    const r = suggestCest("6907.21.00");
    expect(formatCestDisplay(r!.cest)).toBe("10.032.00");
    expect(r!.family).toBe("revestimento");
  });

  test("aceita ncm já sem pontuação", () => {
    expect(suggestCest("25232910")?.family).toBe("cimento");
  });

  test("NCM desconhecido -> null (não sugere, não chuta)", () => {
    expect(suggestCest("64041100")).toBeNull(); // tênis, fora do escopo do Matcon
    expect(suggestCest("")).toBeNull();
    expect(suggestCest(null)).toBeNull();
    expect(suggestCest(undefined)).toBeNull();
  });
});

describe("isStLikely", () => {
  test("família da tabela -> true", () => {
    expect(isStLikely("2523.29.10")).toBe(true);
    expect(isStLikely("8302.41.00")).toBe(true); // ferragem
  });

  test("fora da tabela -> false", () => {
    expect(isStLikely("64041100")).toBe(false);
    expect(isStLikely(null)).toBe(false);
  });
});

describe("getCestStatus", () => {
  test("vazio", () => {
    expect(getCestStatus("")).toBe("empty");
    expect(getCestStatus(null)).toBe("empty");
    expect(getCestStatus(undefined)).toBe("empty");
  });

  test("parcial — '05001' tem 5 dígitos, faltam 2 pros 7", () => {
    expect("05001".length).toBe(5);
    expect(getCestStatus("05001")).toBe("partial");
  });

  test("válido — 7 dígitos", () => {
    expect(getCestStatus("0500100")).toBe("valid");
  });
});

describe("formatCestDisplay", () => {
  test('"0500100" -> "05.001.00"', () => {
    expect(formatCestDisplay("0500100")).toBe("05.001.00");
  });

  test("cest incompleto volta sem formatar", () => {
    expect(formatCestDisplay("05001")).toBe("05001");
  });
});

describe("cestFamilyByCode", () => {
  test("acha a família pelo CEST já preenchido", () => {
    expect(cestFamilyByCode("0500100")).toBe("cimento");
    expect(cestFamilyByCode("2400100")).toBe("tinta");
  });

  test("CEST fora da tabela -> null", () => {
    expect(cestFamilyByCode("9999999")).toBeNull();
  });
});
