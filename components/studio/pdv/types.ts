// ============================================================
// AURA STUDIO · PDV (caixa) — tipos compartilhados
// Fase 6 — rebuild do Caixa do estúdio em módulos.
// Mantém o modelo de dados REAL (backend /studio/products), não o
// modelo estático do mockup. Configurador é data-driven por
// customization_config.fields.
//
// 05/06/2026 (paridade checkout Negócio):
//   - CartLine.unitPrice: preço de venda efetivo (lápis). Ausente = usa
//     product.price (tabela). A diferença vira item_discount no backend.
//   - PaymentEntry: entrada de split (uma detPag por forma no backend).
//   - PAY_METHODS restrito a dinheiro/PIX/cartão (decisão com Caio).
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
  barcode?: string | null;    // código de barras (campo mais populado p/ scanner)
};

/**
 * kind discrimina a origem do item no carrinho:
 *   'quick'        — adicionado direto (1 toque), sem personalização preenchida
 *   'personalizado'— passou pelo StageConfigure (tem values significativos)
 *
 * Itens de produtos NÃO personalizáveis são sempre 'quick'.
 * O campo é display-only no carrinho e no orçamento.
 */
export type CartLineKind = 'quick' | 'personalizado';

export type CartLine = {
  lineId: string;
  product: StudioProduct;
  qty: number;
  values: Record<string, any>; // customização (vazio = produto comum)
  kind: CartLineKind;          // quick-add vs personalizado
  // 05/06/2026: preço de venda efetivo (lápis do caixa). Quando presente e
  // menor que product.price, a diferença × qtd vira item_discount no backend.
  // product.price (tabela do estoque) permanece intacto.
  unitPrice?: number;
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

// Multi-pagamento (split): cada entrada vira uma detPag no backend
// (tPag = method, vPag = value). O backend mapeia method PDV → tPag SEFAZ.
export type PaymentEntry = {
  method: string;   // "dinheiro" | "pix" | "cartao"
  value: number;    // valor em R$
};

// Checkout do Studio: só dinheiro, PIX e cartão (decisão 05/06/2026 com Caio).
// 'cartao' = crédito, alinhado ao mapeamento tPag do backend (igual ao Negócio).
export const PAY_METHODS: { id: string; label: string; icon: string }[] = [
  { id: "dinheiro", label: "Dinheiro", icon: "cash" },
  { id: "pix", label: "PIX", icon: "pix" },
  { id: "cartao", label: "Cartão", icon: "card" },
];

export const isCustomLine = (l: CartLine) => l.kind === 'personalizado';
