import { request } from "@/services/api";

// ============================================================
// AURA. — Galeria de fotos do produto, por cor (migration 323)
//
// Até aqui a peça tinha UMA foto (products.image_url) e cada cor tinha
// UMA (product_variants.image_url, via POST /color-image). Quem vende
// tênis fotografa o de cima, o de lado e a sola — e não tinha onde pôr.
// Agora são até 4 por cor, mais até 4 na galeria principal.
//
// GET    /companies/:cid/products/:pid/images
// POST   /companies/:cid/products/:pid/images
// DELETE /companies/:cid/products/:pid/images/:imageId
// PATCH  /companies/:cid/products/:pid/images/reorder
//
// COMPATIBILIDADE (o backend garante, o front só precisa saber que é
// assim): a posição 0 da galeria principal espelha products.image_url e
// a posição 0 de uma cor espelha o image_url das variantes daquela cor.
// Ou seja: a vitrine, o PDV, o carrinho e o catálogo do WhatsApp
// continuam lendo o que sempre leram. Reordenar troca a capa; apagar a
// capa promove a próxima.
//
// As chaves de `by_color` vêm em MINÚSCULO (#rrggbb). O cadastro guarda
// os hex das cores em CAIXA ALTA (herança do atributo Cor das variantes)
// — por isso todo acesso passa por fotosDaCor()/chaveDaCor() em
// item-form/types.ts, nunca por indexação direta.
//
// Estilo espelhado de services/productsVariationsApi.ts.
// ============================================================

export type ProductImage = {
  id: string;
  url: string;
  thumb_url: string | null;
  position: number;
};

/** `by_color` só traz cores QUE TÊM foto — cor sem foto não aparece. */
export type ProductImagesByColor = Record<string, ProductImage[]>;

export type GetProductImagesResponse = {
  product_id: string;
  /** Limite por par (produto, cor). Hoje 4; vem do servidor pra não ficar hardcoded em dois lugares. */
  max_por_cor: number;
  main: ProductImage[];
  by_color: ProductImagesByColor;
};

export type UploadProductImageBody = {
  /** base64 SEM o prefixo `data:image/...;base64,`. */
  content: string;
  /** ex.: "image/jpeg" */
  content_type: string;
  /** `null`/omitido = galeria principal. Qualquer outro valor tem que ser #rrggbb. */
  color_hex?: string | null;
};

export type UploadProductImageResponse = ProductImage & {
  color_hex: string | null;
  created_at: string;
};

export type DeleteProductImageResponse = {
  deleted: boolean;
  id: string;
  color_hex: string | null;
  remaining: number;
};

export type ReorderProductImagesBody = {
  /** `null` = galeria principal. */
  color_hex: string | null;
  /** A lista COMPLETA de ids daquele par, na ordem nova. Lista parcial é recusada com 400. */
  ids: string[];
};

export type ReorderProductImagesResponse = {
  reordered: boolean;
  color_hex: string | null;
  images: ProductImage[];
};

function base(companyId: string, productId: string): string {
  return "/companies/" + companyId + "/products/" + productId + "/images";
}

export var productImagesApi = {
  list: function(companyId: string, productId: string) {
    return request<GetProductImagesResponse>(base(companyId, productId), { retry: 1 });
  },
  // retry 0 nas escritas: um POST repetido sobe a MESMA foto duas vezes e
  // come um dos quatro lugares da cor.
  upload: function(companyId: string, productId: string, body: UploadProductImageBody) {
    return request<UploadProductImageResponse>(base(companyId, productId), {
      method: "POST",
      body: body,
      retry: 0,
      // Foto em base64 é payload grande; 10s de padrão derruba upload de 4MB
      // em 4G antes de o servidor responder.
      timeout: 30000,
    });
  },
  remove: function(companyId: string, productId: string, imageId: string) {
    return request<DeleteProductImageResponse>(base(companyId, productId) + "/" + imageId, {
      method: "DELETE",
      retry: 0,
    });
  },
  reorder: function(companyId: string, productId: string, body: ReorderProductImagesBody) {
    return request<ReorderProductImagesResponse>(base(companyId, productId) + "/reorder", {
      method: "PATCH",
      body: body,
      retry: 0,
    });
  },
};

export default productImagesApi;
