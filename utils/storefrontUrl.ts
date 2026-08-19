// ============================================================
// AURA STUDIO — endereco publico da vitrine de personalizados
//
// A vitrine do Studio (onde o cliente escolhe o produto, preenche os
// campos e fecha o pedido) e uma rota do proprio app:
// app/cardapio/studio/[slug].tsx.
//
// O painel divulgava `loja.getaura.com.br/:slug/studio`, que nunca
// existiu: esse dominio serve o backend, e o backend nao tem essa rota.
// A lojista clicava "Ver como cliente" e caia num JSON de erro; o card de
// WhatsApp saia com o mesmo endereco morto impresso.
//
// Se um dia loja.getaura.com.br passar a redirecionar pra ca, basta
// trocar aqui — os dois lugares que divulgam o endereco usam esta funcao.
// ============================================================

export const STUDIO_STOREFRONT_HOST = "app.getaura.com.br";

/** URL completa da vitrine de personalizados da loja. */
export function studioStorefrontUrl(slug: string): string {
  return `https://${STUDIO_STOREFRONT_HOST}/cardapio/studio/${encodeURIComponent(slug)}`;
}

/** Mesma URL sem o esquema — pra imprimir em imagem/legenda. */
export function studioStorefrontLabel(slug: string): string {
  return `${STUDIO_STOREFRONT_HOST}/cardapio/studio/${slug}`;
}
