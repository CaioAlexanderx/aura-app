import { request } from "./api";

// ============================================================
// AURA. — Variants API (Tarefa A)
//
// Modulo separado pro fluxo de variantes. Mantem o api.ts gigante
// (36KB) sem inflar. As operacoes basicas de variantes (CRUD)
// continuam em companiesApi pra retro-compat; este arquivo so
// agrega features novas.
// ============================================================

export type VariantAttribute = { attribute: string; value: string };

export type QuickBatchBody = {
  attribute_name: string;             // "Tamanho", "Cor", etc
  values: string[];                   // ["P", "G", "GG"]
  shared_attributes?: VariantAttribute[];  // padrao: extrai do produto pai
  stock_per_variant?: number;         // default 0
  price_override?: number | null;     // default null (usa preco do pai)
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
    attributes: VariantAttribute[];
  }>;
  skipped_details: Array<{ value: string; reason: string }>;
};

export var variantsApi = {
  // Tarefa A: cria N variantes em batch via "+" inline.
  // Backend cb4da27 (POST /products/:pid/variants/quick-batch).
  // Atomico — se falhar, nada eh persistido.
  quickBatch: function(
    companyId: string,
    productId: string,
    body: QuickBatchBody
  ): Promise<QuickBatchResponse> {
    return request<QuickBatchResponse>(
      "/companies/" + companyId + "/products/" + productId + "/variants/quick-batch",
      { method: "POST", body: body, retry: 0, timeout: 20000 }
    );
  },
};

export default variantsApi;
