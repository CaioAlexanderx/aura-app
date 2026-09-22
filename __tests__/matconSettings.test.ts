// ============================================================
// constants/matcon.ts — readMatconSettings (22/09/2026, M0 do Matcon).
//
// Fonte única de defaults do módulo (front): carrinho, cadastro de
// produto e /matcon/config leem daqui. Este teste garante que entrada
// ausente, malformada ou com tipo errado nunca quebra a tela — sempre
// cai num MatconSettings válido.
// ============================================================
import { readMatconSettings, MATCON_SETTINGS_DEFAULTS } from "@/constants/matcon";

describe("readMatconSettings", () => {
  test("pdv vazio/undefined/null -> defaults", () => {
    expect(readMatconSettings(undefined)).toEqual(MATCON_SETTINGS_DEFAULTS);
    expect(readMatconSettings(null)).toEqual(MATCON_SETTINGS_DEFAULTS);
    expect(readMatconSettings({})).toEqual(MATCON_SETTINGS_DEFAULTS);
  });

  test("matcon_enabled só é true com === true; string 'true' não conta", () => {
    expect(readMatconSettings({ matcon_enabled: "true" as any }).matcon_enabled).toBe(false);
    expect(readMatconSettings({ matcon_enabled: 1 as any }).matcon_enabled).toBe(false);
    expect(readMatconSettings({ matcon_enabled: true }).matcon_enabled).toBe(true);
    expect(readMatconSettings({ matcon_enabled: false }).matcon_enabled).toBe(false);
  });

  test("matcon_units vazio ([]) cai no default; array não-vazio é respeitado", () => {
    expect(readMatconSettings({ matcon_units: [] }).matcon_units).toEqual(MATCON_SETTINGS_DEFAULTS.matcon_units);
    expect(readMatconSettings({ matcon_units: "m²" as any }).matcon_units).toEqual(MATCON_SETTINGS_DEFAULTS.matcon_units);
    expect(readMatconSettings({ matcon_units: ["sc", "br"] }).matcon_units).toEqual(["sc", "br"]);
  });

  test("matcon_round_to_package: false explícito fica false (não cai no default true)", () => {
    expect(readMatconSettings({ matcon_round_to_package: false }).matcon_round_to_package).toBe(false);
    expect(readMatconSettings({ matcon_round_to_package: true }).matcon_round_to_package).toBe(true);
    expect(readMatconSettings({}).matcon_round_to_package).toBe(MATCON_SETTINGS_DEFAULTS.matcon_round_to_package);
    expect(readMatconSettings({ matcon_round_to_package: "false" as any }).matcon_round_to_package).toBe(false);
  });

  test("números inválidos (string, null) caem no default", () => {
    // Nota: readMatconSettings só checa `typeof === "number"`, então NaN
    // (typeof "number") passa direto — não é pego por este guard. Ver
    // ressalva no relatório do M0.
    expect(readMatconSettings({ matcon_default_waste_pct: "8" as any }).matcon_default_waste_pct).toBe(MATCON_SETTINGS_DEFAULTS.matcon_default_waste_pct);
    expect(readMatconSettings({ matcon_default_delivery_days: null as any }).matcon_default_delivery_days).toBe(MATCON_SETTINGS_DEFAULTS.matcon_default_delivery_days);
    expect(readMatconSettings({ matcon_quote_valid_days: "7" as any }).matcon_quote_valid_days).toBe(MATCON_SETTINGS_DEFAULTS.matcon_quote_valid_days);
    expect(readMatconSettings({ matcon_quote_warn_days: undefined }).matcon_quote_warn_days).toBe(MATCON_SETTINGS_DEFAULTS.matcon_quote_warn_days);
    // número válido é respeitado
    expect(readMatconSettings({ matcon_default_waste_pct: 12 }).matcon_default_waste_pct).toBe(12);
  });
});

// 22/09/2026 -- NaN tem typeof "number"; sem isFinite ele vazava pro form.
test("readMatconSettings: NaN e Infinity caem no default", () => {
  const { readMatconSettings, MATCON_SETTINGS_DEFAULTS } = require("@/constants/matcon");
  const r = readMatconSettings({ matcon_default_waste_pct: NaN, matcon_quote_valid_days: Infinity } as any);
  expect(r.matcon_default_waste_pct).toBe(MATCON_SETTINGS_DEFAULTS.matcon_default_waste_pct);
  expect(r.matcon_quote_valid_days).toBe(MATCON_SETTINGS_DEFAULTS.matcon_quote_valid_days);
});
