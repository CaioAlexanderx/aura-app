import { request } from "@/services/api";

// ============================================================
// AURA. — Variants Quick-Batch API (Tarefa A)
//
// Wrapper isolado pra POST /companies/:id/products/:pid/variants/quick-batch
// Mantido em arquivo proprio pra nao inflar o api.ts (36KB+).
//
// Backend (variants.js, ja deployado): aceita batch de N valores
// para 1 atributo (ex: ["P", "M", "G"] cria 3 variantes), promove
// produto pai a variante padrao automaticamente se ainda nao tiver
// variantes, e detecta duplicatas via signature.
// ============================================================

export type QuickBatchBody = {
  attribute_name: string;                              // "Tamanho" ou "Cor" etc
  values: string[];                                    // ["P", "M", "G"] etc (max 20)
  shared_attributes?: Array<{ name?: string; attribute?: string; value: string }>;
  stock_per_variant?: number;                          // default 0
  price_override?: number | null;                      // default null
};

export type QuickBatchResponse = {
  ok: boolean;
  created: number;
  skipped: number;
  parent_promoted: boolean;
  parent_variant_id: string | null;
  variants: Array<{
    id: string;
    sku_suffix: string;
    attributes: Array<{ attribute: string; value: string }>;
  }>;
  skipped_details: Array<{ value: string; reason: string }>;
};

export var variantsQuickBatchApi = {
  // POST /companies/:companyId/products/:productId/variants/quick-batch
  // Cria N variantes simultaneas pro produto. Se for o primeiro batch e
  // o produto pai tiver color/size, o pai vira variante padrao
  // automaticamente preservando seu estoque atual.
  quickBatch: function(companyId: string, productId: string, body: QuickBatchBody) {
    // Normaliza shared_attributes pro formato que o backend espera
    // (backend usa "attribute" mas aceita "name" como alias).
    var sharedNormalized = (body.shared_attributes || [])
      .map(function(a) { return { attribute: a.attribute || a.name, value: a.value }; })
      .filter(function(a) { return a.attribute && a.value; });

    return request<QuickBatchResponse>(
      "/companies/" + companyId + "/products/" + productId + "/variants/quick-batch",
      {
        method: "POST",
        body: {
          attribute_name: body.attribute_name,
          values: body.values,
          shared_attributes: sharedNormalized,
          stock_per_variant: body.stock_per_variant || 0,
          price_override: body.price_override == null ? null : body.price_override,
        },
        retry: 0,
        timeout: 30000,
      }
    );
  },
};

export default variantsQuickBatchApi;
