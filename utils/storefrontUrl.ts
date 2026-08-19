// ============================================================
// AURA STUDIO — endereco publico da vitrine de personalizados
//
// A vitrine em si e uma rota do app (app/cardapio/studio/[slug].tsx), mas
// o endereco que a lojista divulga e o da loja: loja.getaura.com.br. O
// backend faz a ponte (GET /storefront/:slug/studio → 302), entao o
// cliente nunca ve o endereco interno.
//
// Ate 19/08/2026 esse endereco era divulgado sem existir do outro lado: a
// lojista clicava em "Ver como cliente" e caia num JSON de erro, e o card
// de WhatsApp saia com o mesmo endereco morto impresso na imagem.
// ============================================================

export const STUDIO_STOREFRONT_HOST = "loja.getaura.com.br";

/** URL completa da vitrine de personalizados da loja. */
export function studioStorefrontUrl(slug: string): string {
  return `https://${STUDIO_STOREFRONT_HOST}/${encodeURIComponent(slug)}/studio`;
}

/** Mesma URL sem o esquema — pra imprimir em imagem/legenda. */
export function studioStorefrontLabel(slug: string): string {
  return `${STUDIO_STOREFRONT_HOST}/${slug}/studio`;
}
