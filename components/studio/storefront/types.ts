// ============================================================
// components/studio/storefront/types.ts
// Tipos canônicos do storefront público do Studio.
// CONTRATO CONGELADO — Onda 0. Não alterar sem versionar.
// ============================================================
import type { CustomizationConfig, CustomizationField } from "@/services/studioApi";

export type { CustomizationConfig, CustomizationField };

export type StudioStoreProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  stock_qty: number;
  customization_config: CustomizationConfig | null;
  templates: Array<{
    id: string; name: string; image_url: string; thumb_url: string | null;
    category_name: string | null;
  }>;
};

export type StoreRevisions = {
  max_included: number;   // 0 = ilimitado
  extra_price: number;    // R$ cobrado por revisão extra
  policy_text: string | null;
};

export type StorePayload = {
  site: {
    name: string; tagline?: string;
    primary_color: string; accent_color: string;
    logo_url: string | null; cover_url?: string | null;
  };
  products: StudioStoreProduct[];
  sla: { sla_base_days: number; queue_qty: number; total_estimate_days: number };
  payment: { has_pix: boolean; has_card: boolean; pay_on_delivery_enabled: boolean };
  revisions: StoreRevisions;
  total_products: number;
};

/**
 * CONTRATO CONGELADO — CartLine
 * Um item no carrinho. Shape estável para Onda 1.
 *
 * - lineId: identificador único da linha (Date.now + random)
 * - product: o produto completo (inclui customization_config + templates)
 * - qty: quantidade
 * - values: Record<fieldId, valor> onde:
 *     - campo text   → string
 *     - campo color  → hex string (ex: "#FF0000")
 *     - campo option → string (value da choice)
 *     - campo image  → URL string (R2 público) ← Agente G grava aqui
 *     - campo template → URL string da imagem do template
 * - hasBackSelected?: true quando cliente optou pelo verso (quando back_charge_enabled)
 */
export type CartLine = {
  lineId: string;
  product: StudioStoreProduct;
  qty: number;
  values: Record<string, any>;
  hasBackSelected?: boolean;
};

export type Stage = "list" | "configure" | "checkout" | "sent";

export type SentOrder = {
  order_id: string;
  order_number: string;
  total: number;
  status: string;
  pix: { qrcode: string; payload: string } | null;
  card: { init_point: string } | null;
};

// Paleta Studio — exportada para sub-componentes não precisarem redefinir
export const T = {
  bg: "#FAFAFC",
  card: "#FFFFFF",
  border: "#E5E7EB",
  ink: "#0F172A",
  ink2: "#334155",
  ink3: "#64748B",
  ink4: "#94A3B8",
  primary: "#1E3A8A",
  accent: "#EC4899",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
} as const;

// Estilos compartilhados
export const sectionLabel: any = {
  fontSize: 11, color: T.ink3, fontWeight: "700",
  textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6,
};
export const chip: any = {
  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: T.border,
};
export const chipActive: any = { backgroundColor: T.primary, borderColor: T.primary };
export const chipTxt: any = { color: T.ink2, fontSize: 12, fontWeight: "700" };
export const chipTxtActive: any = { color: "#fff" };
