// ============================================================
// AURA. — Matcon (materiais de construção): configurações do módulo
//
// 22/09/2026 (M0). As configurações do Matcon vivem em pdv_settings
// (docs/CONTRACT_MATCON.md, §1) e o PUT faz merge parcial. Este arquivo é
// a ÚNICA fonte dos defaults no front: carrinho, cadastro de produto e a
// tela /matcon/config leem daqui. Loja sem o toggle nunca lê nada disto.
// ============================================================

export type MatconSettings = {
  matcon_enabled: boolean;
  // Unidades do grupo "Materiais" que a loja habilitou ("Minha loja vende
  // em …" na config). O cadastro mostra só estas; as demais de MATCON_UNITS
  // ficam atrás de "+ rolo, lata, balde".
  matcon_units: string[];
  // Perda padrão (%) em piso/revestimento, sugerida na calculadora de
  // ambiente (M3). Guardada desde M0 porque a config já a expõe.
  matcon_default_waste_pct: number;
  // Ao vender unidade fracionada com purchase_factor, o carrinho mostra
  // "= N caixas · X m² · sobra Y m²". NÃO altera a quantidade vendida.
  matcon_round_to_package: boolean;
  // Prazo padrão de entrega (dias) — usado no orçamento (M1).
  matcon_default_delivery_days: number;
  // Validade padrão do orçamento e quantos dias antes de vencer ele entra
  // em "Vencendo" (M1).
  matcon_quote_valid_days: number;
  matcon_quote_warn_days: number;
  // M3 — regras dos Profissionais Parceiros (docs/CONTRACT_MATCON.md, M3).
  // Liga/desliga os parceiros sem desligar o Matcon (frase da config no mockup M3).
  matcon_club_enabled: boolean;
  // M4: "Controlo lote e tonalidade nos produtos vendidos em m² e m³".
  matcon_lots_enabled: boolean;
  matcon_points_per_100: number;
  matcon_points_to_coupon: number;
  matcon_coupon_value: number;
};

export const MATCON_SETTINGS_DEFAULTS: MatconSettings = {
  matcon_enabled: false,
  matcon_units: ["m²", "m³", "m", "sc", "br", "mlh", "ton", "pç"],
  matcon_default_waste_pct: 10,
  matcon_round_to_package: true,
  matcon_default_delivery_days: 2,
  matcon_quote_valid_days: 7,
  matcon_quote_warn_days: 3,
  matcon_club_enabled: true,
  matcon_lots_enabled: false,
  matcon_points_per_100: 10,
  matcon_points_to_coupon: 100,
  matcon_coupon_value: 10,
};

// Lê as configurações do Matcon de um pdv_settings parcial, aplicando os
// defaults acima. `matcon_enabled` só é true com `=== true` (mesma regra do
// os_enabled/otica_enabled no _layout).
// Numero valido = number finito (typeof NaN === "number", entao `typeof`
// sozinho deixaria NaN passar -- achado do teste de matconSettings).
function num(v: unknown, fallback: number): number {
  return typeof v === "number" && isFinite(v) ? v : fallback;
}

export function readMatconSettings(pdv: Partial<MatconSettings> | null | undefined): MatconSettings {
  var p = pdv || {};
  return {
    matcon_enabled: p.matcon_enabled === true,
    matcon_units: Array.isArray(p.matcon_units) && p.matcon_units.length > 0 ? p.matcon_units : MATCON_SETTINGS_DEFAULTS.matcon_units,
    matcon_default_waste_pct: num(p.matcon_default_waste_pct, MATCON_SETTINGS_DEFAULTS.matcon_default_waste_pct),
    matcon_round_to_package: p.matcon_round_to_package === undefined ? MATCON_SETTINGS_DEFAULTS.matcon_round_to_package : p.matcon_round_to_package === true,
    matcon_default_delivery_days: num(p.matcon_default_delivery_days, MATCON_SETTINGS_DEFAULTS.matcon_default_delivery_days),
    matcon_quote_valid_days: num(p.matcon_quote_valid_days, MATCON_SETTINGS_DEFAULTS.matcon_quote_valid_days),
    matcon_quote_warn_days: num(p.matcon_quote_warn_days, MATCON_SETTINGS_DEFAULTS.matcon_quote_warn_days),
    matcon_club_enabled: p.matcon_club_enabled === undefined ? MATCON_SETTINGS_DEFAULTS.matcon_club_enabled : p.matcon_club_enabled === true,
    matcon_lots_enabled: p.matcon_lots_enabled === true,
    matcon_points_per_100: num(p.matcon_points_per_100, MATCON_SETTINGS_DEFAULTS.matcon_points_per_100),
    matcon_points_to_coupon: num(p.matcon_points_to_coupon, MATCON_SETTINGS_DEFAULTS.matcon_points_to_coupon),
    matcon_coupon_value: num(p.matcon_coupon_value, MATCON_SETTINGS_DEFAULTS.matcon_coupon_value),
  };
}
