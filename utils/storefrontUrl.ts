// ============================================================
// AURA STUDIO — endereco publico da vitrine de personalizados
//
// `loja.getaura.com.br/<slug>`. Sem sufixo, sem prefixo, sem o host do
// painel: e o endereco que a lojista divulga e que a cliente digita.
//
// ── COMO CHEGAMOS AQUI ─────────────────────────────────────────────────
// Ate 19/08/2026 o painel divulgava um endereco que nao existia do outro
// lado: a lojista clicava em "Ver como cliente" e caia num JSON de erro,
// e o card de WhatsApp saia com o mesmo endereco morto impresso na
// imagem. A ponte veio como um 302 de `/<slug>/studio` para o host do
// app, e o endereco real da vitrine ficou sendo
// `app.getaura.com.br/cardapio/studio/<slug>` — o host do PAINEL, com uma
// palavra que faz loja de caneca parecer restaurante.
//
// Em 04/09/2026 a vitrine mudou de casa: empresa em modo Studio tem UMA
// loja, e ela e servida aqui (backend: services/vitrineStudioShell.js).
// O caminho com `/studio` no fim continua de pe e redireciona para ca,
// entao nenhum link impresso ou compartilhado quebra.
// ============================================================

export const STUDIO_STOREFRONT_HOST = "loja.getaura.com.br";

/** URL completa da vitrine de personalizados da loja. */
export function studioStorefrontUrl(slug: string): string {
  return `https://${STUDIO_STOREFRONT_HOST}/${encodeURIComponent(slug)}`;
}

/** Mesma URL sem o esquema — pra imprimir em imagem/legenda. */
export function studioStorefrontLabel(slug: string): string {
  return `${STUDIO_STOREFRONT_HOST}/${slug}`;
}
