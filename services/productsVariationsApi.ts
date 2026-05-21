import { request } from "@/services/api";

// ============================================================
// AURA. -- Products Variations API (v2 reformulado)
//
// Sistema novo de variantes: listas simples de cores + tamanhos,
// matriz de estoque por combinacao, preco unico do pai.
//
// 21/05/2026: barcodes adicionado ao GET response e ao SaveVariationsBody.
// Chave identica ao matrix (ex: "|38" para tamanho-38 sem cor).
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

export type VariationsMode = 'none' | 'color' | 'size' | 'matrix';

export type GetVariationsResponse = {
  product_id: string;
  product_name: string;
  colors: ColorEntry[];
  sizes: string[];
  matrix: MatrixMap;
  barcodes: BarcodesMap;   // 21/05/2026: barcode por combinacao
  mode: VariationsMode;
  total_variants: number;
};

export type SaveVariationsBody = {
  colors: ColorEntry[];
  sizes: string[];
  matrix: MatrixMap;
  barcodes?: BarcodesMap;   // 21/05/2026: opcional (omitir = nao altera barcodes existentes nao)
};

export type SaveVariationsResponse = {
  product_id: string;
  created_count: number;
  total_stock: number;
  mode: VariationsMode;
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
};

export default productsVariationsApi;
