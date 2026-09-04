// ============================================================
// components/studio/storefront/slugDaVitrine.ts
//
// Qual loja abrir.
//
// A vitrine passou a existir em dois endereços (04/09/2026):
//
//   loja.getaura.com.br/sheid-mania                 ← o endereço público
//   app.getaura.com.br/cardapio/studio/sheid-mania  ← o de dentro de casa
//
// No primeiro, quem serve a página é o backend, que injeta
// `window.__AURA_VITRINE__` antes do bundle carregar. No segundo, o slug
// vem do caminho, como sempre.
//
// O injetado vence quando existe: ele é o que o servidor sabe, e sobrevive
// a qualquer diferença entre o caminho visível e a rota que casou. O
// parâmetro da rota é o padrão de quem abre direto no app.
//
// Fica em módulo, e não dentro da tela, porque é regra — e porque tela
// que importa Icon não carrega no jest.
// ============================================================

export type RecadoDaVitrine = { slug?: unknown; base?: unknown };

/** O que o backend injetou na página, se injetou. */
export function recadoInjetado(): RecadoDaVitrine | null {
  if (typeof window === "undefined") return null;
  const r = (window as any).__AURA_VITRINE__;
  return r && typeof r === "object" ? (r as RecadoDaVitrine) : null;
}

/**
 * O slug da loja a abrir.
 *
 * `doCaminho` é o parâmetro da rota. Devolve "" quando não há loja
 * nenhuma para abrir — a tela mostra o erro em vez de pedir `/storefront//`
 * à API, que responderia 404 sem explicar nada.
 */
export function slugDaVitrine(doCaminho?: unknown, injetado?: RecadoDaVitrine | null): string {
  const recado = injetado === undefined ? recadoInjetado() : injetado;
  const doServidor = typeof recado?.slug === "string" ? recado.slug.trim() : "";
  if (doServidor) return doServidor.toLowerCase();

  const daRota = typeof doCaminho === "string" ? doCaminho.trim() : "";
  return daRota.toLowerCase();
}
