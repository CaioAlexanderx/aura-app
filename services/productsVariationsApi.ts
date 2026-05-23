import { request } from "@/services/api";

// ============================================================
// AURA. -- Products Variations API (v2 reformulado)
//
// Sistema novo de variantes: listas simples de cores + tamanhos,
// matriz de estoque por combinacao, preco unico do pai.
//
// 21/05/2026: barcodes adicionado ao GET response e ao SaveVariationsBody.
// Chave identica ao matrix (ex: "|38" para tamanho-38 sem cor).
//
// 23/05/2026: images por combinacao (foto especifica por variante).
// GET retorna `images: { "hex|size": url }`. Upload/delete em rota
// separada (/variant-image) que identifica variante por combinacao
// pra sobreviver ao soft-delete+INSERT do PUT.
// ============================================================

export type ColorEntry = {
  hex: string;         // "#FF0000"
  name: string | null; // "Vermelho" (opcional, auto-detectado via colorNames)
};

// matrix eh objeto { "hex|size": stock }.
// Se so tem cor: "hex|" (size vazio)
// Se so tem tamanho: "|size" (hex vazio)
// Se matriz completa: "hex|size"
export type MatrixMap = Record<string, number>;

// barcodes usa a mesma chave do matrix: { "hex|size": "7891234567890" }
export type BarcodesMap = Record<string, string>;

// 23/05/2026: images usa a mesma chave: { "hex|size": "https://r2..." }
export type ImagesMap = Record<string, string>;

export type VariationsMode = 'none' | 'color' | 'size' | 'matrix';

export type GetVariationsResponse = {
  product_id: string;
  product_name: string;
  colors: ColorEntry[];
  sizes: string[];
  matrix: MatrixMap;
  barcodes: BarcodesMap;   // 21/05/2026: barcode por combinacao
  images: ImagesMap;        // 23/05/2026: foto por combinacao (URL R2)
  mode: VariationsMode;
  total_variants: number;
};

export type SaveVariationsBody = {
  colors: ColorEntry[];
  sizes: string[];
  matrix: MatrixMap;
  barcodes?: BarcodesMap;   // 21/05/2026: opcional (omitir = nao altera barcodes existentes nao)
  // images NAO entra no PUT — sao gerenciadas via POST/DELETE /variant-image
  // separado e preservadas server-side no rewrite via lookup por (color, size).
};

export type SaveVariationsResponse = {
  product_id: string;
  created_count: number;
  total_stock: number;
  mode: VariationsMode;
};

export type UploadVariantImageBody = {
  color_hex?: string | null;   // ao menos um de color_hex / size_value
  size_value?: string | null;
  content: string;             // base64 (sem prefix data:)
  content_type: string;        // ex: "image/jpeg"
};

export type UploadVariantImageResponse = {
  image_url: string;
  variant_id: string;
  color_hex: string | null;
  size_value: string | null;
};

// Helper: monta a chave da matrix (usada em ambos os lados)
export function matrixKey(hex: string | null, size: string | null): string {
  return (hex || '') + '|' + (size || '');
}

export var productsVariationsApi = {
  get: function(companyId: string, productId: string) {
    return request<GetVariationsResponse>(
      "/companies/" + companyId + "/products/" + productId + "/variations",
      { retry: 1 }
    );
  },
  save: function(companyId: string, productId: string, body: SaveVariationsBody) {
    return request<SaveVariationsResponse>(
      "/companies/" + companyId + "/products/" + productId + "/variations",
      { method: "PUT", body: body, retry: 0 }
    );
  },
  // 23/05/2026: upload de foto por variante. Identifica a variante via
  // combinacao (color_hex + size_value) — nao precisa de variant_id,
  // sobrevive ao soft-delete + INSERT do PUT.
  uploadImage: function(companyId: string, productId: string, body: UploadVariantImageBody) {
    return request<UploadVariantImageResponse>(
      "/companies/" + companyId + "/products/" + productId + "/variant-image",
      { method: "POST", body: body, retry: 0 }
    );
  },
  deleteImage: function(companyId: string, productId: string, args: { color_hex?: string | null; size_value?: string | null }) {
    return request<{ deleted: boolean; variant_id: string }>(
      "/companies/" + companyId + "/products/" + productId + "/variant-image",
      { method: "DELETE", body: args, retry: 0 }
    );
  },
};

export default productsVariationsApi;
