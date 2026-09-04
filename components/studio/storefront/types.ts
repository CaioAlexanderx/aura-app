// ============================================================
// components/studio/storefront/types.ts
// Tipos canônicos do storefront público do Studio.
// CONTRATO CONGELADO — Onda 0. Não alterar sem versionar.
// ============================================================
import type { CustomizationConfig, CustomizationField } from "@/services/studioApi";
import type { StoreCategory } from "./categoryGrouping";
import type { QtyTier } from "./qtyTiers";

export type { CustomizationConfig, CustomizationField };
export type { StoreCategory };
export type { QtyTier };

export type StudioStoreProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  /** Ate 5 fotos (migration 290); indice 0 e a capa. A API sempre mandou;
   *  o tipo e a vitrine e que ignoravam. */
  gallery_urls?: string[] | null;
  category: string | null;
  // S1 — vinculo primario da arvore da F0. null em catalogo pre-migracao
  // ou quando a categoria nao e visivel na vitrine (o backend ja filtra).
  category_id?: string | null;
  category_slug?: string | null;
  category_path?: string | null;
  // S6 — escada de desconto por quantidade, JA calculada pelo backend
  // (preco unitario e percentual por faixa). [] quando nao ha faixa.
  qty_tiers?: QtyTier[];
  stock_qty: number;
  /** S0 — quantos pedidos esta peça já teve. Ordena o bloco "mais pedidos". */
  pedidos?: number;
  /** S0 — 'model3d' | 'photo2d' | null. Vira o chip "Mockup 3D" no card. */
  visual_kind?: string | null;
  // Ficha tecnica (migration 305). Nasceu na loja comum em 23/08 e levou
  // uma correcao pra chegar ate aqui (backend #598) — o SELECT da vitrine
  // e outro. Opcional porque o backend so devolve depois da migration.
  material?: string | null;
  medidas?: string | null;
  cuidados?: string | null;
  customization_config: CustomizationConfig | null;
  templates: Array<{
    id: string; name: string; image_url: string; thumb_url: string | null;
    category_name: string | null;
  }>;
};

// S8 — a terceira modalidade: o cliente contrata Uber/99 e informa quem
// vai retirar. Mesmos valores que o backend grava em delivery_type.
export type DeliveryType = "pickup" | "delivery" | "courier";

// S2 — resposta de GET /studio/shipping-quote. `fee: null` com `error`
// nao e falha: e "fora da area de entrega", e o cliente precisa ler isso.
export type ShippingQuote = {
  fee: number | null;
  eta: string | null;
  mode: string;
  currency: string;
  free_shipping?: boolean;
  distance_km?: number;
  tier_max_km?: number;
  error?: string;
  alert?: string;
};

export type StoreRevisions = {
  max_included: number;   // 0 = ilimitado
  extra_price: number;    // R$ cobrado por revisão extra
  policy_text: string | null;
};

/** Um banner da home. Mesmo formato que a loja comum recebe. */
export type BannerDaLoja = {
  kicker: string;
  headline: string;
  body: string;
  cta: string;
  cta_url: string | null;
  tone: string;
  tint: string;
  image_url: string | null;
  /** A versão quadrada, para o celular; sem ela a larga serve nos dois. */
  image_url_mobile: string | null;
  enabled: boolean;
};

export type RedeSocial = {
  rede: string;
  nome: string;
  handle: string;
  url: string;
};

export type StorePayload = {
  site: {
    name: string; tagline?: string;
    primary_color: string; accent_color: string;
    /** Par tipografico escolhido pela lojista (ver TIPOGRAFIAS). */
    font_family?: string | null;
    /** Estilo do cartao: editorial | minimal | image-heavy. */
    card_style?: string | null;
    logo_url: string | null; cover_url?: string | null;
    /** S0 — os banners da lojista, no MESMO formato da loja comum. */
    banners?: BannerDaLoja[];
    /** S0 — Instagram, TikTok e Facebook com a URL pronta. */
    redes?: RedeSocial[];
    whatsapp?: string | null;
    /** Rodapé (04/09/2026): a coluna de identidade, igual à loja comum. */
    endereco?: string;
    /** "Seg a sáb, 9h às 18h" — já escrito pelo backend. */
    horario_resumo?: string;
    /** Já com máscara; formatar de novo daria duas máscaras. */
    cnpj_formatado?: string;
  };
  products: StudioStoreProduct[];
  sla: { sla_base_days: number; queue_qty: number; total_estimate_days: number };
  payment: { has_pix: boolean; has_card: boolean; pay_on_delivery_enabled: boolean };
  revisions: StoreRevisions;
  // S1 — lista FLAT com parent_id; o cliente deriva a hierarquia.
  // Ausente/vazia em base sem as migrations 257/258 da F0.
  categories?: StoreCategory[];
  // S8 — modalidades de entrega. Antes o checkout do Studio oferecia
  // retirada e entrega fixas, sem consultar o config da loja.
  delivery?: {
    pickup_enabled: boolean;
    delivery_enabled: boolean;
    courier_pickup_enabled: boolean;
    delivery_fee: number;
    pickup_eta_text: string | null;
    delivery_eta_text: string | null;
  };
  /** S0 — os números da faixa de confiança, do banco. */
  numeros?: { pedidos_entregues: number };
  /**
   * Formas de pagamento e política de troca, JÁ RESOLVIDAS pelo backend
   * (services/rodapeInstitucional.js, um módulo só para as duas lojas).
   * A vitrine desenha; não decide.
   */
  rodape_institucional?: {
    formas?: string[];
    politica_titulo?: string;
    politica?: string;
  };
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

// S6 — "lote" e o orcamento em lote publico. Aditivo: quem nao conhece
// o estagio novo continua caindo em "list".
export type Stage = "list" | "configure" | "checkout" | "sent" | "lote";

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
