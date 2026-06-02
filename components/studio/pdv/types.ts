// ============================================================
// AURA STUDIO · PDV (caixa) — tipos compartilhados
// Fase 6 — rebuild do Caixa do estúdio em módulos.
// Mantém o modelo de dados REAL (backend /studio/products), não o
// modelo estático do mockup. Configurador é data-driven por
// customization_config.fields.
// ============================================================
import type { CustomizationConfig } from "@/services/studioApi";

export type StudioProduct = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
  stock_qty: number;
  is_personalizable: boolean;
  customization_config: CustomizationConfig | null;
  sku?: string | null;        // usado pelo leitor de código (DD-8)
};

export type CartLine = {
  lineId: string;
  product: StudioProduct;
  qty: number;
  values: Record<string, any>; // customização (vazio = produto comum)
};

export type Stage = "list" | "configure" | "checkout" | "done";

export type DayStats = {
  pedidos_hoje: number;
  faturamento_hoje: number;
  aguardando_arte: number;
  em_producao: number;
};

export type SaleDone = {
  sale_id: string;
  total: number;
  wa_link: string | null;
};

export const PAY_METHODS: { id: string; label: string; icon: string }[] = [
  { id: "dinheiro", label: "Dinheiro", icon: "cash" },
  { id: "pix", label: "PIX", icon: "pix" },
  { id: "credito", label: "Crédito", icon: "card" },
  { id: "debito", label: "Débito", icon: "card" },
  { id: "crediario", label: "Crediário", icon: "clipboard" },
];

export const isCustomLine = (l: CartLine) => !!l.product.is_personalizable;
