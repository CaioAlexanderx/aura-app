// ============================================================
// AURA. — services/studioApi.ts
// Vertical Aura Studio (personalizados)
//
// Endpoints (todos sob /companies/:id/studio):
//   GET  /health
//   GET  /products/:pid/customization-config
//   PUT  /products/:pid/customization-config
//   POST /products/:pid/personalize  { enabled: boolean }
//
// Migration 130 (24/05/2026). PR Aura-backend#110.
// Memory: plano_aura_studio_vertical_24mai2026
// ============================================================
import { request } from "./api";

// ─── Health ───────────────────────────────────────────────
export type StudioHealth = {
  vertical: "studio";
  version: number;
  enabled: boolean;
  kds_enabled: boolean;
  gallery_enabled: boolean;
  approval_enabled: boolean;
  approval_mode: "wa_me" | "whatsapp_business";
  settings: Record<string, any>;
  timestamp: string;
};

// ─── Customization config ─────────────────────────────────
export type CustomizationFieldType = "text" | "image" | "template" | "color" | "option";

export type CustomizationField = {
  id: string;
  type: CustomizationFieldType;
  label: string;
  required: boolean;
  config: {
    // text
    max_chars?: number;
    fonts?: string[];
    colors?: string[];
    // image
    formats?: string[];
    max_mb?: number;
    min_dpi?: number;
    // template
    category_ids?: string[];
    // option
    choices?: Array<{ value: string; label: string; price_delta?: number }>;
  };
};

export type CustomizationConfig = {
  print_area: {
    width_cm: number;
    height_cm: number;
    position?: "center" | "left" | "right";
  };
  fields: CustomizationField[];
};

export type CustomizationConfigResponse = {
  product_id: string;
  name: string;
  is_personalizable: boolean;
  config: CustomizationConfig | null;
};

// ─── API ──────────────────────────────────────────────────
export const studioApi = {
  // Sentinel — retorna toggles + studio_settings da empresa atual.
  health: function (companyId: string) {
    return request<StudioHealth>(
      "/companies/" + companyId + "/studio/health",
      { method: "GET", retry: 1, timeout: 8000 }
    );
  },

  // Lê config de personalização de 1 produto.
  getCustomizationConfig: function (companyId: string, productId: string) {
    return request<CustomizationConfigResponse>(
      "/companies/" + companyId + "/studio/products/" + productId + "/customization-config",
      { method: "GET", retry: 1, timeout: 8000 }
    );
  },

  // Salva config + liga is_personalizable=true automaticamente.
  saveCustomizationConfig: function (
    companyId: string,
    productId: string,
    config: CustomizationConfig
  ) {
    return request<CustomizationConfigResponse>(
      "/companies/" + companyId + "/studio/products/" + productId + "/customization-config",
      { method: "PUT", body: config, retry: 0, timeout: 10000 }
    );
  },

  // Toggle on/off do is_personalizable sem perder config salva.
  togglePersonalizable: function (
    companyId: string,
    productId: string,
    enabled: boolean
  ) {
    return request<{ id: string; is_personalizable: boolean }>(
      "/companies/" + companyId + "/studio/products/" + productId + "/personalize",
      { method: "POST", body: { enabled }, retry: 0, timeout: 5000 }
    );
  },
};

export default studioApi;
